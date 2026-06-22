# TrueMoney Wallet Angpao Top-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TrueMoney Wallet Angpao (gift-voucher) top-up gateway to the customer shop, mirroring the PromptPay/EasySlip flow and security model.

**Architecture:** A new native `truemoney.service.ts` redeems an angpao voucher into the shop's own TrueMoney wallet via `gift.truemoney.com` (ported from the tw-angpao reference, no external microservice). `payment.service.redeemTrueMoney` orchestrates config → parse → redeem → atomic wallet credit with a `UNIQUE(voucher_hash)` dedup guard and bonus multiplier. Admin configures the shop wallet phone + enable flag in the existing Payment Settings page; the top-up page gains a single-step "paste gift link" flow with a 5-step illustrated guide.

**Tech Stack:** Node.js + Express + TypeScript (backend), Next.js 14 + Tailwind (frontend), MySQL 8, Redis. New dev dependency: jest + ts-jest for the security-critical unit tests.

## Global Constraints

- **Customer shop only** (`backend/`, `frontend/`). No SaaS panel changes whatsoever.
- Currency is Thai Baht (฿) only. No em dashes in user-facing text; use `-`, `:`, or parentheses.
- Icons: Font Awesome (`fas`/`far`/`fab`) primary; no emoji in UI.
- Top-up bonus multiplier APPLIES to TrueMoney top-ups. Discount codes do NOT. No min/max amount bounds (amount must be `> 0`).
- Ledger (`transactions.amount`) records REAL money redeemed; the bonus only inflates the wallet balance / `wallet_logs`.
- TrueMoney redeem response (raw, called directly): status at `json.status.code`; redeemed amount (string baht) at `json.data.my_ticket.amount_baht`; sender name at `json.data.owner_profile.full_name`.
- Settings keys: `truemoney_enabled` (`'true'`/`'false'`), `truemoney_phone` (normalized `0XXXXXXXXX`). `truemoney_phone` is NEVER exposed to public clients.
- `wallet_logs.source` / `transactions.method` are free-text varchars; use `'truemoney'`.
- Commit after every task with a `feat(payment):` / `test(payment):` style message.

---

### Task 1: Jest + ts-jest test harness

**Files:**
- Modify: `backend/package.json` (add devDeps + `test` script)
- Create: `backend/jest.config.js`
- Create: `backend/src/services/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` command for all later backend tasks.

- [ ] **Step 1: Install dev dependencies**

Run from `backend/`:
```bash
cd backend && npm install --save-dev jest@^29 ts-jest@^29 @types/jest@^29
```
Expected: packages added to `devDependencies`, no errors.

- [ ] **Step 2: Add the test script**

In `backend/package.json`, add to the `"scripts"` object (keep existing scripts):
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 3: Create `backend/jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
```

- [ ] **Step 4: Create a smoke test** `backend/src/services/__tests__/smoke.test.ts`

```ts
describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd backend && npm test`
Expected: 1 passing test, exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/jest.config.js backend/src/services/__tests__/smoke.test.ts
git commit -m "test(payment): add jest + ts-jest harness"
```

---

### Task 2: TrueMoney pure helpers (parsing, phone, errors)

**Files:**
- Create: `backend/src/services/truemoney.service.ts` (helpers + error class only in this task)
- Test: `backend/src/services/__tests__/truemoney.helpers.test.ts`

**Interfaces:**
- Produces:
  - `class TrueMoneyApiError extends Error { code: string; httpStatus: number }`
  - `extractVoucherHash(input: string): string` — throws `TrueMoneyApiError('INVALID_VOUCHER_CODE', ...)` on failure.
  - `normalizePhone(phone: string): string` — returns `0XXXXXXXXX`; throws `TrueMoneyApiError('INVALID_PHONE_NUMBER', ...)`.
  - `statusToThaiMessage(code: string): string` — maps TrueMoney status codes to Thai messages.

- [ ] **Step 1: Write the failing test** `backend/src/services/__tests__/truemoney.helpers.test.ts`

```ts
import { extractVoucherHash, normalizePhone, statusToThaiMessage, TrueMoneyApiError } from '../truemoney.service';

describe('extractVoucherHash', () => {
  it('extracts hash from a full gift link', () => {
    expect(extractVoucherHash('https://gift.truemoney.com/campaign/?v=abc123XYZ')).toBe('abc123XYZ');
  });
  it('accepts a raw hash', () => {
    expect(extractVoucherHash('abc123XYZ')).toBe('abc123XYZ');
  });
  it('takes the first alphanumeric run after ?v=', () => {
    expect(extractVoucherHash('https://gift.truemoney.com/campaign/vouchers/?v=HASH001#frag')).toBe('HASH001');
  });
  it('throws on input with no valid code', () => {
    expect(() => extractVoucherHash('https://example.com/?v=')).toThrow(TrueMoneyApiError);
    expect(() => extractVoucherHash('!!!')).toThrow(TrueMoneyApiError);
  });
});

describe('normalizePhone', () => {
  it('passes a valid 0-prefixed number', () => {
    expect(normalizePhone('0812345678')).toBe('0812345678');
  });
  it('converts 66-prefixed to 0-prefixed', () => {
    expect(normalizePhone('66812345678')).toBe('0812345678');
  });
  it('strips +66 and separators', () => {
    expect(normalizePhone('+66 81-234-5678')).toBe('0812345678');
  });
  it('throws on invalid number', () => {
    expect(() => normalizePhone('123')).toThrow(TrueMoneyApiError);
    expect(() => normalizePhone('0712345678')).toThrow(TrueMoneyApiError); // 07x not allowed
  });
});

describe('statusToThaiMessage', () => {
  it('maps known codes', () => {
    expect(statusToThaiMessage('VOUCHER_NOT_FOUND')).toContain('ไม่พบ');
    expect(statusToThaiMessage('VOUCHER_EXPIRED')).toContain('หมดอายุ');
    expect(statusToThaiMessage('VOUCHER_OUT_OF_STOCK')).toContain('ถูกรับ');
    expect(statusToThaiMessage('TARGET_USER_REDEEMED')).toContain('ถูกใช้');
    expect(statusToThaiMessage('CANNOT_GET_OWN_VOUCHER')).toContain('ตัวเอง');
  });
  it('falls back for unknown codes', () => {
    expect(statusToThaiMessage('SOMETHING_ELSE')).toContain('ไม่สำเร็จ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- truemoney.helpers`
Expected: FAIL — cannot find module `../truemoney.service`.

- [ ] **Step 3: Write minimal implementation** `backend/src/services/truemoney.service.ts`

```ts
// ── Custom error class ───────────────────────────────────────────────────────
export class TrueMoneyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'TrueMoneyApiError';
  }
}

// ── Voucher hash extraction ──────────────────────────────────────────────────
// Accepts a full gift link (…?v=HASH) or a raw hash. Returns the first
// continuous alphanumeric run of the code segment.
export function extractVoucherHash(input: string): string {
  const trimmed = (input ?? '').trim();
  const parts = trimmed.split('?v=');
  const candidate = parts[1] ?? parts[0] ?? '';
  const match = candidate.match(/[0-9A-Za-z]+/);
  if (!match) {
    throw new TrueMoneyApiError('INVALID_VOUCHER_CODE', 'ลิงก์ซองของขวัญไม่ถูกต้อง');
  }
  return match[0];
}

// ── Phone normalization ──────────────────────────────────────────────────────
// Normalizes to 0XXXXXXXXX and validates a Thai mobile (0[689]xxxxxxxx).
export function normalizePhone(phone: string): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (/^66\d{9}$/.test(digits)) digits = '0' + digits.slice(2);
  if (!/^0[689]\d{8}$/.test(digits)) {
    throw new TrueMoneyApiError('INVALID_PHONE_NUMBER', 'เบอร์ TrueMoney Wallet ไม่ถูกต้อง');
  }
  return digits;
}

// ── Status code → Thai message ───────────────────────────────────────────────
const STATUS_THAI: Record<string, string> = {
  VOUCHER_NOT_FOUND:      'ไม่พบซองของขวัญนี้ ลิงก์อาจไม่ถูกต้อง',
  VOUCHER_EXPIRED:        'ซองของขวัญนี้หมดอายุแล้ว',
  VOUCHER_OUT_OF_STOCK:   'ซองของขวัญนี้ถูกรับไปหมดแล้ว',
  TARGET_USER_REDEEMED:   'ซองของขวัญนี้ถูกใช้ไปแล้ว',
  CANNOT_GET_OWN_VOUCHER: 'ไม่สามารถรับซองของตัวเองได้',
};

export function statusToThaiMessage(code: string): string {
  return STATUS_THAI[code] ?? 'แลกซองของขวัญไม่สำเร็จ กรุณาตรวจสอบลิงก์อีกครั้ง';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- truemoney.helpers`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/truemoney.service.ts backend/src/services/__tests__/truemoney.helpers.test.ts
git commit -m "feat(payment): TrueMoney voucher/phone parsing helpers + error class"
```

---

### Task 3: TrueMoney redeem response parsing + HTTP transport

**Files:**
- Modify: `backend/src/services/truemoney.service.ts` (add `parseRedeemResponse` + `redeem`)
- Test: `backend/src/services/__tests__/truemoney.parse.test.ts`

**Interfaces:**
- Consumes: `TrueMoneyApiError`, `statusToThaiMessage` from Task 2.
- Produces:
  - `parseRedeemResponse(httpStatus: number, json: any): { amount: number; ownerName: string | null }` — throws `TrueMoneyApiError` for non-SUCCESS or malformed responses.
  - `truemoneyService.redeem(phone: string, voucherHash: string): Promise<{ amount: number; ownerName: string | null }>` — performs the HTTP/2 call to `gift.truemoney.com` and delegates parsing.

- [ ] **Step 1: Write the failing test** `backend/src/services/__tests__/truemoney.parse.test.ts`

```ts
import { parseRedeemResponse, TrueMoneyApiError } from '../truemoney.service';

const okJson = {
  status: { code: 'SUCCESS', message: 'success' },
  data: {
    my_ticket: { amount_baht: '100.00' },
    voucher: { redeemed_amount_baht: '100.00' },
    owner_profile: { full_name: 'Somchai J.' },
  },
};

describe('parseRedeemResponse', () => {
  it('returns amount + owner on SUCCESS', () => {
    expect(parseRedeemResponse(200, okJson)).toEqual({ amount: 100, ownerName: 'Somchai J.' });
  });
  it('handles missing owner_profile', () => {
    const j = { ...okJson, data: { my_ticket: { amount_baht: '55.50' } } };
    expect(parseRedeemResponse(200, j)).toEqual({ amount: 55.5, ownerName: null });
  });
  it('throws mapped error on a TrueMoney error status', () => {
    const j = { status: { code: 'VOUCHER_EXPIRED', message: 'expired' } };
    try {
      parseRedeemResponse(200, j);
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TrueMoneyApiError);
      expect((e as TrueMoneyApiError).code).toBe('VOUCHER_EXPIRED');
      expect((e as TrueMoneyApiError).message).toContain('หมดอายุ');
    }
  });
  it('throws when amount is missing on a SUCCESS body', () => {
    const j = { status: { code: 'SUCCESS' }, data: {} };
    expect(() => parseRedeemResponse(200, j)).toThrow(TrueMoneyApiError);
  });
  it('throws on a non-2xx with no usable body', () => {
    expect(() => parseRedeemResponse(500, {})).toThrow(TrueMoneyApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- truemoney.parse`
Expected: FAIL — `parseRedeemResponse` is not exported.

- [ ] **Step 3: Write the implementation** — append to `backend/src/services/truemoney.service.ts`

```ts
import http2 from 'http2';
import dns from 'dns';
import { logger } from '../utils/logger';

const TRUEMONEY_HOSTNAME = 'gift.truemoney.com';

// ── Response parsing (pure) ──────────────────────────────────────────────────
export function parseRedeemResponse(
  httpStatus: number,
  json: any,
): { amount: number; ownerName: string | null } {
  const code: string | undefined = json?.status?.code;
  if (code !== 'SUCCESS') {
    if (code) throw new TrueMoneyApiError(code, statusToThaiMessage(code), 400);
    throw new TrueMoneyApiError(
      'HTTP_ERROR_UNKNOWN',
      'แลกซองของขวัญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      httpStatus >= 500 ? 503 : 400,
    );
  }
  const rawAmount = json?.data?.my_ticket?.amount_baht ?? json?.data?.voucher?.redeemed_amount_baht;
  const amount = parseFloat(rawAmount);
  if (!isFinite(amount) || amount <= 0) {
    throw new TrueMoneyApiError('INVALID_AMOUNT', 'ไม่สามารถอ่านยอดเงินจากซองของขวัญได้', 400);
  }
  const ownerName: string | null = json?.data?.owner_profile?.full_name ?? null;
  return { amount, ownerName };
}

// ── Hardened HTTP/2 transport (mirrors easyslip.service.ts) ──────────────────
function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses?.length) reject(err ?? new Error('No IPv4 address'));
      else resolve(addresses[0]);
    });
  });
}

async function http2Post(path: string, body: string): Promise<{ status: number; json: any }> {
  const ipv4 = await resolveIPv4(TRUEMONEY_HOSTNAME);
  return new Promise((resolve, reject) => {
    const session = http2.connect(`https://${ipv4}`, { servername: TRUEMONEY_HOSTNAME });
    const timer = setTimeout(() => { session.destroy(); reject(new Error('Request timeout')); }, 30000);
    session.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    const bodyBuf = Buffer.from(body);
    const req = session.request({
      ':method': 'POST',
      ':path': path,
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; SiamsiteShop/1.0)',
      'content-length': String(bodyBuf.length),
    });
    req.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    let status = 0;
    req.on('response', (headers) => { status = headers[':status'] as number; });
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      clearTimeout(timer);
      session.destroy();
      try { resolve({ status, json: JSON.parse(raw) }); }
      catch { reject(new Error('Invalid JSON response')); }
    });
    req.write(bodyBuf);
    req.end();
  });
}

// ── Service ──────────────────────────────────────────────────────────────────
class TrueMoneyService {
  async redeem(phone: string, voucherHash: string): Promise<{ amount: number; ownerName: string | null }> {
    const path = `/campaign/vouchers/${encodeURIComponent(voucherHash)}/redeem`;
    const payload = JSON.stringify({ mobile: phone, voucher_hash: voucherHash });
    let status: number;
    let json: any;
    try {
      const res = await http2Post(path, payload);
      status = res.status;
      json = res.json;
    } catch (err: any) {
      logger.warn('TrueMoney connection error', { error: err.message, code: err.code });
      throw new TrueMoneyApiError('NETWORK_ERROR', 'ไม่สามารถเชื่อมต่อระบบ TrueMoney ได้ กรุณาลองใหม่อีกครั้ง', 503);
    }
    return parseRedeemResponse(status, json);
  }
}

export const truemoneyService = new TrueMoneyService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- truemoney.parse`
Expected: PASS.

- [ ] **Step 5: Type-check the whole backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/truemoney.service.ts backend/src/services/__tests__/truemoney.parse.test.ts
git commit -m "feat(payment): TrueMoney redeem service (HTTP/2 transport + response parsing)"
```

---

### Task 4: Migration 027 — truemoney_logs table

**Files:**
- Create: `migrations/027_truemoney_logs.sql`

**Interfaces:**
- Produces: `truemoney_logs` table with `UNIQUE(voucher_hash)`, consumed by Task 5.

- [ ] **Step 1: Create the migration** `migrations/027_truemoney_logs.sql`

```sql
-- Migration 027: TrueMoney angpao redemption ledger (dedup guard for top-ups).
-- voucher_hash is UNIQUE so the same angpao can never credit a wallet twice,
-- even under a retry/race. Idempotent.

CREATE TABLE IF NOT EXISTS truemoney_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  voucher_hash VARCHAR(64) NOT NULL UNIQUE,
  amount       DECIMAL(12,2) NOT NULL,
  owner_name   VARCHAR(255) NULL,
  redeemed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tmn_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Apply it to the running dev DB and verify**

Run (adjust container/db name to your dev env; matches docker-compose MySQL):
```bash
docker-compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < migrations/027_truemoney_logs.sql
docker-compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "DESCRIBE truemoney_logs;"'
```
Expected: the `DESCRIBE` lists the 6 columns; `voucher_hash` shows `UNI` in the Key column.

- [ ] **Step 3: Commit**

```bash
git add migrations/027_truemoney_logs.sql
git commit -m "feat(payment): migration 027 truemoney_logs dedup ledger"
```

---

### Task 5: payment.service.redeemTrueMoney (replace stub)

**Files:**
- Modify: `backend/src/services/payment.service.ts` (replace the `redeemTrueMoney` stub; add a `computeTopupCredit` helper)
- Test: `backend/src/services/__tests__/payment.credit.test.ts`

**Interfaces:**
- Consumes: `truemoneyService.redeem`, `extractVoucherHash`, `TrueMoneyApiError` (Task 2-3); `settingsService`, `notificationService`, `pool`; `truemoney_logs` (Task 4).
- Produces: `paymentService.redeemTrueMoney(userId, giftLink)` returning
  `{ amount, paid_amount, multiplier, voucherHash, balanceAfter, ownerName }`.
  Plus exported pure helper `computeTopupCredit(amount, multiplierSetting, enabled)`.

- [ ] **Step 1: Write the failing test** `backend/src/services/__tests__/payment.credit.test.ts`

```ts
import { computeTopupCredit } from '../payment.service';

describe('computeTopupCredit', () => {
  it('returns the raw amount when bonus disabled', () => {
    expect(computeTopupCredit(100, '2', false)).toEqual({ creditAmount: 100, multiplier: 1 });
  });
  it('applies the multiplier when enabled and > 1', () => {
    expect(computeTopupCredit(100, '1.5', true)).toEqual({ creditAmount: 150, multiplier: 1.5 });
  });
  it('ignores a multiplier of 1 or less', () => {
    expect(computeTopupCredit(80, '1', true)).toEqual({ creditAmount: 80, multiplier: 1 });
  });
  it('rounds to 2 decimals', () => {
    expect(computeTopupCredit(33.33, '1.1', true)).toEqual({ creditAmount: 36.66, multiplier: 1.1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- payment.credit`
Expected: FAIL — `computeTopupCredit` is not exported.

- [ ] **Step 3: Add the pure helper** near the top of `backend/src/services/payment.service.ts` (after the imports / before the `class PaymentService`):

```ts
// Shared top-up bonus math. Bonus only inflates the credited (spendable) amount;
// the ledger records real money elsewhere.
export function computeTopupCredit(
  amount: number,
  multiplierSetting: string,
  enabled: boolean,
): { creditAmount: number; multiplier: number } {
  const raw = parseFloat(multiplierSetting || '1');
  const multiplier = (enabled && raw > 1) ? raw : 1;
  const creditAmount = parseFloat((amount * multiplier).toFixed(2));
  return { creditAmount, multiplier };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- payment.credit`
Expected: PASS.

- [ ] **Step 5: Replace the `redeemTrueMoney` stub** in `backend/src/services/payment.service.ts`

Add these imports at the top (alongside the existing imports):
```ts
import { truemoneyService, extractVoucherHash, TrueMoneyApiError } from './truemoney.service';
```

Replace the existing stub:
```ts
  async redeemTrueMoney(_userId: number, _giftLink: string) {
    // TrueMoney integration is not yet available. Disabled to prevent the simulated
    // random-amount payout from being exploited.
    throw new ValidationError('ระบบ TrueMoney ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }
```
with:
```ts
  async redeemTrueMoney(userId: number, giftLink: string) {
    // ── L0: Config ───────────────────────────────────────────────────────────
    const settings = await settingsService.getAll();
    if (settings['truemoney_enabled'] !== 'true') {
      throw new ValidationError('ระบบ TrueMoney Wallet ยังไม่เปิดใช้งาน กรุณาแจ้งผู้ดูแลระบบ');
    }
    const shopPhone = (settings['truemoney_phone'] || '').replace(/\D/g, '');
    if (!/^0[689]\d{8}$/.test(shopPhone)) {
      throw new ValidationError('ยังไม่ได้ตั้งค่าเบอร์ TrueMoney Wallet ของร้าน กรุณาแจ้งผู้ดูแลระบบ');
    }

    // ── L1: Parse voucher hash ───────────────────────────────────────────────
    let voucherHash: string;
    try {
      voucherHash = extractVoucherHash(giftLink);
    } catch {
      throw new ValidationError('ลิงก์ซองของขวัญไม่ถูกต้อง');
    }

    // ── L1b: Pre-dedup (cheap reject before the external call) ────────────────
    const [pre] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM truemoney_logs WHERE voucher_hash = ?', [voucherHash]
    );
    if (pre.length > 0) {
      throw new ConflictError('ซองของขวัญนี้ถูกใช้ไปแล้ว');
    }

    // ── L2: Redeem into the shop wallet (TrueMoney is the source of truth) ────
    let amount: number;
    let ownerName: string | null;
    try {
      const r = await truemoneyService.redeem(shopPhone, voucherHash);
      amount = r.amount;
      ownerName = r.ownerName;
    } catch (err) {
      if (err instanceof TrueMoneyApiError) throw new ValidationError(err.message);
      throw err;
    }

    // ── L3: Sanity ───────────────────────────────────────────────────────────
    if (!(amount > 0)) throw new ValidationError('ยอดเงินในซองของขวัญไม่ถูกต้อง');

    // ── L4: Bonus + atomic credit ────────────────────────────────────────────
    const bonusEnabled = settings['topup_bonus_enabled'] === 'true';
    const { creditAmount, multiplier } = computeTopupCredit(
      amount, settings['topup_bonus_multiplier'] || '1', bonusEnabled,
    );
    const desc = multiplier > 1
      ? `ซองของขวัญ TrueMoney ฿${amount} (โบนัส x${multiplier} = ฿${creditAmount})`
      : `ซองของขวัญ TrueMoney ฿${amount}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // UNIQUE(voucher_hash) is the authoritative retry/race guard.
      try {
        await conn.execute(
          'INSERT INTO truemoney_logs (user_id, voucher_hash, amount, owner_name) VALUES (?, ?, ?, ?)',
          [userId, voucherHash, amount, ownerName]
        );
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY') {
          await conn.rollback();
          throw new ConflictError('ซองของขวัญนี้ถูกใช้ไปแล้ว');
        }
        throw e;
      }

      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');

      const balanceBefore = parseFloat(walletRows[0].balance);
      const balanceAfter  = balanceBefore + creditAmount;

      await conn.execute('UPDATE wallets SET balance = ? WHERE user_id = ?', [balanceAfter, userId]);
      await conn.execute(
        `INSERT INTO wallet_logs (user_id, action, amount, balance_before, balance_after, source, reference_id, description)
         VALUES (?, 'credit', ?, ?, ?, 'truemoney', ?, ?)`,
        [userId, creditAmount, balanceBefore, balanceAfter, voucherHash, desc]
      );
      // Ledger records REAL money (`amount`), not the bonus-inflated creditAmount.
      await conn.execute(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'truemoney', 'success', ?, ?)`,
        [userId, amount, voucherHash, desc]
      );

      await conn.commit();

      logger.info('TrueMoney redeemed', { userId, paidAmount: amount, creditAmount, multiplier, voucherHash });

      const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
      const username = uRows[0]?.username ?? `User#${userId}`;
      notificationService.create('topup_success',
        `เติมเงินสำเร็จ (TrueMoney): ${username}`,
        JSON.stringify({
          username, userId,
          status: 'สำเร็จ',
          method: 'TrueMoney Wallet',
          amount_paid: `฿${amount}`,
          credit: multiplier > 1 ? `฿${creditAmount} (โบนัส x${multiplier})` : `฿${creditAmount}`,
          sender_name: ownerName ?? '-',
          voucher_hash: voucherHash,
          balance_after: `฿${balanceAfter.toLocaleString()}`,
        })
      );

      return { amount: creditAmount, paid_amount: amount, multiplier, voucherHash, balanceAfter, ownerName };
    } catch (err) {
      await conn.rollback();
      // Reconciliation safety: the money is already in the shop wallet, but the
      // DB credit failed. Alert loudly so an admin can credit manually.
      if (!(err instanceof ConflictError)) {
        const [uRows] = await pool.execute<RowDataPacket[]>('SELECT username FROM users WHERE id = ?', [userId]);
        const username = uRows[0]?.username ?? `User#${userId}`;
        notificationService.create('topup_failed',
          `TrueMoney credit ค้าง: ${username}`,
          JSON.stringify({
            username, userId,
            status: 'ต้องตรวจสอบ',
            reason: 'แลกซองสำเร็จแต่ลงบัญชีไม่สำเร็จ',
            detail: 'เงินเข้ากระเป๋าร้านแล้ว แต่ยังไม่ได้เติมให้ผู้เล่น กรุณาเติมมือ',
            voucher_hash: voucherHash,
            amount: `฿${amount}`,
          })
        );
      }
      throw err;
    } finally {
      conn.release();
    }
  }
```

- [ ] **Step 6: Type-check the backend**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. (Confirms `RowDataPacket`, `NotFoundError`, `ConflictError`, `ValidationError`, `pool`, `logger`, `settingsService`, `notificationService` are all already imported in this file — they are used by `verifySlip` above.)

- [ ] **Step 7: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all suites pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/payment.service.ts backend/src/services/__tests__/payment.credit.test.ts
git commit -m "feat(payment): implement TrueMoney angpao redeem with atomic credit + dedup"
```

---

### Task 6: Route cooldown + schema loosening

**Files:**
- Modify: `backend/src/routes/payment.routes.ts:25-30` (add cooldown to the redeem route)
- Modify: `backend/src/validators/schemas.ts:44-46` (`trueMoneyRedeemSchema`)

**Interfaces:**
- Consumes: `purchaseCooldown` (already imported in payment.routes.ts).
- Produces: a 30s-cooldown, validated `/payment/truemoney/redeem` accepting a URL or raw hash.

- [ ] **Step 1: Loosen the schema** in `backend/src/validators/schemas.ts`

Replace:
```ts
export const trueMoneyRedeemSchema = z.object({
  giftLink: z.string().url().min(1),
});
```
with:
```ts
// Accepts a TrueMoney gift URL OR a raw voucher hash. The redeem service is the
// single source of truth for parsing (extractVoucherHash); here we just bound size.
export const trueMoneyRedeemSchema = z.object({
  giftLink: z.string().min(1).max(2048),
});
```

- [ ] **Step 2: Add the cooldown** in `backend/src/routes/payment.routes.ts`

Replace:
```ts
router.post('/truemoney/redeem', authenticate, validate(trueMoneyRedeemSchema), async (req: Request, res: Response, next: NextFunction) => {
```
with:
```ts
router.post('/truemoney/redeem', authenticate, purchaseCooldown(30, 'truemoney'), validate(trueMoneyRedeemSchema), async (req: Request, res: Response, next: NextFunction) => {
```

Then enrich the success response so the frontend can show bonus details. Replace the handler body:
```ts
  try {
    await paymentService.redeemTrueMoney(req.user!.userId, req.body.giftLink);
    res.json({ success: true });
  } catch (err) { next(err); }
```
with:
```ts
  try {
    const result = await paymentService.redeemTrueMoney(req.user!.userId, req.body.giftLink);
    res.json({
      success: true,
      message: `เติมเงินสำเร็จ ฿${result.amount} จาก TrueMoney Wallet`,
      ...result,
    });
  } catch (err) { next(err); }
```

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/payment.routes.ts backend/src/validators/schemas.ts
git commit -m "feat(payment): TrueMoney redeem route cooldown + schema + rich response"
```

---

### Task 7: Expose enable flags to public settings

**Files:**
- Modify: `backend/src/routes/public.routes.ts:17` (`publicKeys` array)

**Interfaces:**
- Produces: `truemoney_enabled` and `promptpay_enabled` available to the unauthenticated `GET /public/settings` (and thus `useSettings()`). `truemoney_phone` is intentionally NOT added.

- [ ] **Step 1: Add the keys** in `backend/src/routes/public.routes.ts`

In the `publicKeys` array, add `'promptpay_enabled'` and `'truemoney_enabled'` (e.g. right after `'topup_bonus_multiplier'`):
```ts
    const publicKeys = ['shop_name', 'shop_subtitle', 'shop_description', 'welcome_message', 'currency', 'currency_symbol', 'maintenance_mode', 'logo_url', 'favicon_url', 'banner_url', 'facebook_url', 'discord_invite', 'website_bg_url', 'server_ip', 'topup_bonus_enabled', 'topup_bonus_multiplier', 'promptpay_enabled', 'truemoney_enabled', 'theme_name', 'website_logo_url',
```

- [ ] **Step 2: Type-check + verify exposure**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

Run (with backend up):
```bash
curl -s http://localhost:4000/api/public/settings | grep -o 'truemoney_enabled'
```
Expected: prints `truemoney_enabled` (key present even if shop hasn't set it, once a value exists; absence is fine until first save).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/public.routes.ts
git commit -m "feat(payment): expose promptpay_enabled + truemoney_enabled to public settings"
```

---

### Task 8: Admin Payment Settings — TrueMoney section

**Files:**
- Modify: `frontend/src/app/admin/payment-settings/page.tsx`

**Interfaces:**
- Consumes: existing `/admin/settings` GET/PUT (generic key/value), `adminAlert`.
- Produces: admin can set `truemoney_enabled` + `truemoney_phone`.

- [ ] **Step 1: Add state** — in `PaymentSettingsPage`, after the bonus state block (around line 36):

```tsx
  // TrueMoney Wallet state
  const [tmnEnabled, setTmnEnabled] = useState(false);
  const [tmnPhone,   setTmnPhone]   = useState('');
  const [savingTmn,  setSavingTmn]  = useState(false);
```

- [ ] **Step 2: Hydrate from settings** — inside `load()`, after `setBonusMult(...)` (around line 53):

```tsx
      setTmnEnabled(s.truemoney_enabled === 'true');
      setTmnPhone(s.truemoney_phone || '');
```

- [ ] **Step 3: Add the save handler** — after `handleSaveBonus` (around line 128):

```tsx
  const handleSaveTmn = async () => {
    const phone = tmnPhone.replace(/\D/g, '');
    if (tmnEnabled && !/^0[689]\d{8}$/.test(phone)) {
      adminAlert({ type: 'error', title: 'เบอร์ TrueMoney ไม่ถูกต้อง', message: 'กรอกเบอร์ 10 หลัก (เช่น 0812345678) ก่อนเปิดใช้งาน' });
      return;
    }
    setSavingTmn(true);
    try {
      await api('/admin/settings', {
        method: 'PUT', token: getToken()!,
        body: { settings: [
          { key: 'truemoney_enabled', value: String(tmnEnabled) },
          { key: 'truemoney_phone',   value: phone },
        ]},
      });
      adminAlert({ type: 'success', title: 'บันทึกข้อมูลแล้ว' });
    } catch { adminAlert({ type: 'error', title: 'บันทึกไม่สำเร็จ' }); }
    finally  { setSavingTmn(false); }
  };
```

- [ ] **Step 4: Add the TrueMoney card** — just before the closing `</div>` of the outer container (after the Bonus Multiplier Card block, around line 561, before line 562 `</div>`):

```tsx
      {/* ── TrueMoney Wallet Card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <i className="fas fa-gift text-[#ed1c24] text-xs" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">TrueMoney Wallet (ซองของขวัญ)</h3>
              <p className="text-[11px] text-gray-400">รับเติมเงินผ่านซองของขวัญ TrueMoney</p>
            </div>
          </div>
          {tmnEnabled && /^0[689]\d{8}$/.test(tmnPhone.replace(/\D/g, '')) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ed1c24] text-white text-[11px] font-black">
              <i className="fas fa-circle-check text-[10px]" /> เปิดใช้งานอยู่
            </span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className={`relative flex items-center justify-between px-4 py-3.5 rounded-xl border-2 shadow-[0_4px_0_rgba(0,0,0,0.08),0_2px_12px_rgba(0,0,0,0.07)] transition-all ${tmnEnabled ? 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`} />
              <div className="flex items-center gap-3 pl-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`}>
                  <i className="fas fa-wallet text-white text-sm" />
                </div>
                <div>
                  <p className={`text-sm font-black ${tmnEnabled ? 'text-red-800' : 'text-gray-600'}`}>
                    {tmnEnabled ? 'เปิดรับซองของขวัญ' : 'ปิดรับซองของขวัญ'}
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${tmnEnabled ? 'text-red-600' : 'text-gray-400'}`}>
                    {tmnEnabled ? 'ผู้เล่นเติมผ่านซองของขวัญได้' : 'ผู้เล่นยังเติมผ่านซองไม่ได้'}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={tmnEnabled} onChange={e => setTmnEnabled(e.target.checked)} />
                  <div className={`w-14 h-7 rounded-full transition-colors ${tmnEnabled ? 'bg-[#ed1c24]' : 'bg-gray-300'}`} />
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${tmnEnabled ? 'translate-x-7' : ''}`} />
                </div>
              </label>
            </div>

            {/* Phone input */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">
                เบอร์ TrueMoney Wallet ของร้าน <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <i className="fas fa-mobile-alt text-sm" />
                </div>
                <input type="text" value={tmnPhone} onChange={e => setTmnPhone(e.target.value)}
                  placeholder="0812345678"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 font-mono tracking-wider" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">ซองของขวัญจะถูกแลกเข้ากระเป๋านี้โดยอัตโนมัติ</p>
            </div>

            <button onClick={handleSaveTmn} disabled={savingTmn}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#ed1c24] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#991b1b] hover:brightness-110 transition-all active:shadow-[0_1px_0_#991b1b] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {savingTmn ? <><i className="fas fa-spinner fa-spin text-[12px]" /> กำลังบันทึก...</> : <><i className="fas fa-save text-[12px]" /> บันทึก TrueMoney</>}
            </button>
          </div>

          {/* RIGHT — note */}
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <i className="fas fa-shield-halved text-[#ed1c24] text-xs mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold text-red-800 leading-relaxed">
                ระบบจะแลกซองของขวัญเข้ากระเป๋าร้านโดยตรง ยอดที่ TrueMoney แจ้งคือยอดจริงที่ credit เข้า Wallet ผู้เล่น
                (ป้องกันซองซ้ำด้วยรหัสซองที่ไม่ซ้ำกัน) โบนัสเติมเงินใช้กับซองของขวัญด้วย
              </p>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 5: Build the frontend (type-check)**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual check**

Start the app (`docker-compose up -d` or the frontend/backend dev servers). Go to Admin > ระบบรับชำระเงิน. Confirm the TrueMoney card appears, toggling + entering `0812345678` + Save shows the success alert, and reloading the page keeps the values.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/payment-settings/page.tsx
git commit -m "feat(payment): admin TrueMoney Wallet settings (enable + shop phone)"
```

---

### Task 9: Top-up page — enable TrueMoney method + 5-step guide

**Files:**
- Modify: `frontend/src/app/topup/page.tsx`

**Interfaces:**
- Consumes: `useSettings()` (`truemoney_enabled`, `promptpay_enabled`), `handleRedeemTrueMoney` (already present), the 5 images `frontend/public/images/truemoney-sendgift-icon-20240521-how-to-create-1.png` … `-5.png`.
- Produces: a working customer-facing TrueMoney top-up flow.

- [ ] **Step 1: Read enable flags** — after the existing `hasBonus` line (around line 90):

```tsx
  const ppEnabled  = settings['promptpay_enabled'] !== 'false'; // default on if unset
  const tmnEnabled = settings['truemoney_enabled'] === 'true';  // default off until configured
```

- [ ] **Step 2: Enable method selection** — replace:

```tsx
  const handleSelectMethod = (m: Method) => {
    if (m === 'truemoney') return; // Disable selection
    setMethod(m);
    setStep('amount');
  };
```
with:
```tsx
  const handleSelectMethod = (m: Method) => {
    if (m === 'truemoney') {
      if (!tmnEnabled) return;
      setMethod(m);
      setStep('truemoney');
      return;
    }
    if (!ppEnabled) return;
    setMethod(m);
    setStep('amount');
  };
```

- [ ] **Step 3: Replace the disabled TrueMoney selection card** — replace the entire `{/* TrueMoney Card (Disabled Version) */}` block (the `<div className="group relative bg-surface-hover ... cursor-not-allowed">…</div>`, lines ~346-370) with a live button that gates on `tmnEnabled`:

```tsx
                {/* TrueMoney Card */}
                <button
                  onClick={() => handleSelectMethod('truemoney')}
                  disabled={!tmnEnabled}
                  className={`group relative bg-surface rounded-2xl border-2 overflow-hidden flex flex-col shadow-theme-sm transition-all duration-300 text-center h-[280px] ${
                    tmnEnabled ? 'border-green-200 hover:border-[#ed1c24] hover:shadow-lg' : 'border-border grayscale opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i className="fas fa-wallet text-7xl text-[#ed1c24]"></i>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 relative z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#ed1c24]/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                      <img src="/images/truemoney_wallet.png" alt="TrueMoney" className="relative h-16 w-auto object-contain transform group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-[#ed1c24]">TrueMoney Wallet</h3>
                      <p className="text-xs font-bold text-foreground-subtle leading-tight">
                        เติมผ่านซองของขวัญ<br/>
                        <span className="text-[9px] uppercase tracking-wider opacity-60">
                          {tmnEnabled ? 'วางลิงก์ซองของขวัญ' : 'ยังไม่เปิดใช้งาน'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className={`py-3.5 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${tmnEnabled ? 'bg-[#ed1c24] group-hover:bg-[#c81118]' : 'bg-gray-300'}`}>
                    {tmnEnabled ? <>เลือกช่องทางนี้ <i className="fas fa-chevron-right text-[9px] group-hover:translate-x-1 transition-transform"></i></> : 'ไม่พร้อมใช้งาน'}
                  </div>
                </button>
```

- [ ] **Step 4: Replace the inline text instructions with the 5-step illustrated guide** — in the `{step === 'truemoney' && (...)}` block, replace the existing `<div className="bg-red-50/50 border border-dashed ...">…</div>` (the `<ol>` how-to block, lines ~405-416) with:

```tsx
                  <div className="bg-red-50/50 border border-dashed border-red-200 rounded-xl p-4">
                    <h4 className="text-[12px] font-black text-[#ed1c24] mb-3 flex items-center gap-2">
                      <i className="fas fa-circle-info"></i> ขั้นตอนการสร้างซอง
                    </h4>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { n: 1, t: 'เข้าแอป TrueMoney Wallet เลือก "ส่งซองของขวัญ"' },
                        { n: 2, t: 'ระบุจำนวนเงินที่ต้องการเติม' },
                        { n: 3, t: 'เลือก "แบ่งจำนวนเงินเท่ากัน"' },
                        { n: 4, t: 'ระบุจำนวนคนรับซอง "1 คน"' },
                        { n: 5, t: 'กดยืนยัน คัดลอกลิงก์มาวางในช่องด้านบน' },
                      ].map(s => (
                        <div key={s.n} className="flex flex-col items-center text-center gap-1.5">
                          <div className="relative w-full aspect-[3/5] rounded-lg overflow-hidden border border-red-100 bg-white">
                            <img
                              src={`/images/truemoney-sendgift-icon-20240521-how-to-create-${s.n}.png`}
                              alt={`ขั้นตอนที่ ${s.n}`}
                              className="w-full h-full object-contain"
                            />
                            <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#ed1c24] text-white text-[9px] font-black flex items-center justify-center">{s.n}</span>
                          </div>
                          <p className="text-[9px] font-bold text-foreground-subtle leading-tight">{s.t}</p>
                        </div>
                      ))}
                    </div>
                  </div>
```

- [ ] **Step 5: Relax the submit-button guard** so a raw hash or any TrueMoney link is accepted — in the same block, change:

```tsx
                  disabled={loading || !giftLink.includes('truemoney.com')}
```
to:
```tsx
                  disabled={loading || giftLink.trim().length < 6}
```

- [ ] **Step 6: Capture bonus details on success** — in `handleRedeemTrueMoney`, replace:

```tsx
      setSuccessAmount(d.amount);
      await refresh();
      setStep('success');
```
with:
```tsx
      setSuccessAmount(d.amount);
      setSuccessPaid(d.paid_amount ?? d.amount);
      setSuccessMultiplier(d.multiplier ?? 1);
      await refresh();
      setStep('success');
```

- [ ] **Step 7: Build the frontend (type-check)**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual verification**

1. In Admin > Payment Settings, enable TrueMoney with a valid shop phone.
2. On `/topup`, the TrueMoney card is now selectable; click it.
3. Confirm the 5-step "ขั้นตอนการสร้างซอง" guide renders all 5 images with numbered badges.
4. With a real ฿1 angpao gift link (per the spec's fallback verification), submit and confirm: wallet credited the real amount (+bonus if enabled), success screen shows the bonus breakdown, and re-submitting the same link is rejected with "ซองของขวัญนี้ถูกใช้ไปแล้ว".

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/topup/page.tsx
git commit -m "feat(payment): enable TrueMoney top-up flow + 5-step angpao guide"
```

---

## Self-Review Notes (resolved)

- **Spec coverage:** service (T2-3), migration (T4), redeem orchestration + security layers (T5), route cooldown/schema (T6), public flag exposure (T7), admin config (T8), customer UX + 5-step guide (T9), tests (T1-3, T5). All spec sections mapped.
- **No discount / no min-max:** enforced by omission in T5 (only bonus applied; only `amount > 0` checked).
- **Customer-only:** no panel paths touched in any task.
- **Type consistency:** `redeemTrueMoney` returns `{ amount, paid_amount, multiplier, voucherHash, balanceAfter, ownerName }`; consumed by T6 route spread and T9 success UI (`d.amount`, `d.paid_amount`, `d.multiplier`). `truemoneyService.redeem` → `{ amount, ownerName }` consumed by T5. `computeTopupCredit` → `{ creditAmount, multiplier }` consumed in T5.
- **Ledger invariant:** `transactions.amount = amount` (real money), wallet credited `creditAmount` (with bonus) — matches the slip flow and the topup-bonus-ledger memory.
