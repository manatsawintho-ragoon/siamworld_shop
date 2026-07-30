import { Request, Response, NextFunction } from 'express';

// A tiny stand-in for the Redis commands the middleware uses. `set` models the
// real NX contract: the first caller wins, everyone after gets null until the
// key is cleared. That is the whole property under test.
const store = new Map<string, number>();
const redisMock = {
  set: jest.fn(async (key: string, _v: string, _ex: string, seconds: number, mode?: string) => {
    if (mode === 'NX' && store.has(key)) return null;
    store.set(key, seconds);
    return 'OK';
  }),
  ttl: jest.fn(async (key: string) => store.get(key) ?? -2),
};

jest.mock('../../database/redis', () => ({ redis: redisMock }));
jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { purchaseCooldown } from '../cooldown';

function makeReq(userId = 7): Request {
  return { user: { userId, username: 'steve', role: 'user', jti: 'j' } } as unknown as Request;
}

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: any) => { res.body = b; return res; });
  return res as Response & { statusCode: number; body: any };
}

beforeEach(() => { store.clear(); });

describe('purchaseCooldown', () => {
  it('lets a single request through', async () => {
    const next = jest.fn() as NextFunction;
    const res = makeRes();
    await purchaseCooldown(30, 'slip')(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('admits exactly one of a concurrent burst (the regression)', async () => {
    // Fire 10 requests with no awaits in between, which is what two tabs or a
    // scripted burst produce. The old read-then-write-on-response version let
    // all 10 through because none had written the key yet.
    const mw = purchaseCooldown(30, 'slip');
    const results = await Promise.all(
      Array.from({ length: 10 }, () => {
        const next = jest.fn() as NextFunction;
        const res = makeRes();
        return mw(makeReq(), res, next).then(() => ({ next, res }));
      })
    );

    const admitted = results.filter(r => (r.next as jest.Mock).mock.calls.length === 1);
    const rejected = results.filter(r => r.res.statusCode === 429);

    expect(admitted).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    expect(rejected[0].res.body).toMatchObject({ success: false, code: 'PURCHASE_COOLDOWN' });
  });

  it('keeps the slot claimed after a failed request so quota cannot be re-burned', async () => {
    const mw = purchaseCooldown(30, 'slip');

    const first = jest.fn() as NextFunction;
    await mw(makeReq(), makeRes(), first);
    expect(first).toHaveBeenCalled();

    // The handler failed (res.json got success:false). The slot must NOT reopen.
    const second = jest.fn() as NextFunction;
    const res2 = makeRes();
    await mw(makeReq(), res2, second);

    expect(second).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(429);
  });

  it('scopes the cooldown per user and per namespace', async () => {
    const slip = purchaseCooldown(30, 'slip');
    const buy = purchaseCooldown(3, 'purchase');

    const a = jest.fn() as NextFunction;
    await slip(makeReq(1), makeRes(), a);
    // Same user, different namespace -> independent slot.
    const b = jest.fn() as NextFunction;
    await buy(makeReq(1), makeRes(), b);
    // Different user, same namespace -> independent slot.
    const c = jest.fn() as NextFunction;
    await slip(makeReq(2), makeRes(), c);

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    expect(c).toHaveBeenCalled();
  });

  it('reports a sane retryAfter when the key expires mid-check', async () => {
    store.set('cooldown:slip:7', 0);
    redisMock.ttl.mockResolvedValueOnce(-2); // expired between claim and read

    const res = makeRes();
    await purchaseCooldown(30, 'slip')(makeReq(), res, jest.fn() as NextFunction);

    expect(res.body.retryAfter).toBe(1);
  });

  it('fails open when Redis is down', async () => {
    redisMock.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const next = jest.fn() as NextFunction;
    const res = makeRes();
    await purchaseCooldown(30, 'slip')(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
