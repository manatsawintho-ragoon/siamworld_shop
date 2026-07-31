import { parseProxyLine, normalizePath, isBotUA, refererLabel, bucketHour, bucketDay } from '../trafficLog';

// Every fixture below is a verbatim line copied out of a live NPM access log.
// Inventing them would only prove the regex matches itself.
const LINE_200 =
  '[31/Jul/2026:17:53:30 +0000] - 200 200 - GET https gfloorsmp.siamsite.shop "/_next/image?url=https%3A%2F%2Fi.postimg.cc%2FCKhzsPhb%2F3f082a16.png&w=384&q=75" [Client 172.71.124.241] [Length 7412] [Gzip -] [Sent-to 172.18.0.1] "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.113 Mobile/15E148 Safari/604.1" "https://gfloorsmp.siamsite.shop/"';

// Client aborted the request: nginx logs 499 and $upstream_status is "-", not a number.
const LINE_499 =
  '[30/Jul/2026:17:32:17 +0000] - - 499 - GET https honeyland.siamsite.shop "/socket.io/?EIO=4&transport=websocket" [Client 172.68.44.143] [Length 0] [Gzip -] [Sent-to 172.18.0.1] "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36" "-"';

// Socket.IO websocket upgrade.
const LINE_101 =
  '[30/Jul/2026:21:06:16 +0000] - 101 101 - GET https yokaicraft.siamsite.shop "/socket.io/?EIO=4&transport=websocket" [Client 104.23.175.217] [Length 143] [Gzip -] [Sent-to 172.18.0.1] "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0" "-"';

const LINE_404 =
  '[31/Jul/2026:18:52:27 +0000] - 404 404 - GET https gfloorsmp.siamsite.shop "/favicon.ico" [Client 172.68.4.221] [Length 14908] [Gzip -] [Sent-to 172.18.0.1] "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0)" "-"';

describe('parseProxyLine', () => {
  it('parses a normal 200', () => {
    const r = parseProxyLine(LINE_200)!;
    expect(r).not.toBeNull();
    expect(r.status).toBe(200);
    expect(r.method).toBe('GET');
    expect(r.host).toBe('gfloorsmp.siamsite.shop');
    expect(r.uri).toContain('/_next/image?url=');
    expect(r.bytesSent).toBe(7412);
    expect(r.referer).toBe('https://gfloorsmp.siamsite.shop/');
    expect(r.userAgent).toContain('iPhone');
  });

  it('takes $status, not $upstream_status, when the client aborts (499)', () => {
    const r = parseProxyLine(LINE_499)!;
    expect(r.status).toBe(499);
    expect(r.bytesSent).toBe(0);
    expect(r.host).toBe('honeyland.siamsite.shop');
  });

  it('parses a websocket upgrade (101)', () => {
    expect(parseProxyLine(LINE_101)!.status).toBe(101);
  });

  it('treats a "-" referer as absent', () => {
    expect(parseProxyLine(LINE_404)!.referer).toBeNull();
  });

  it('parses the timestamp as a real instant, honouring the offset', () => {
    const r = parseProxyLine(LINE_200)!;
    expect(r.ts.toISOString()).toBe('2026-07-31T17:53:30.000Z');
  });

  it('honours a non-UTC offset', () => {
    const shifted = LINE_200.replace('+0000', '+0700');
    expect(parseProxyLine(shifted)!.ts.toISOString()).toBe('2026-07-31T10:53:30.000Z');
  });

  it('returns null rather than throwing on junk', () => {
    for (const bad of ['', '   ', 'not a log line', '[31/Jul/2026:17:53:30 +0000] truncated', '{"json":true}']) {
      expect(parseProxyLine(bad)).toBeNull();
    }
  });

  it('returns null on an unparseable month', () => {
    expect(parseProxyLine(LINE_200.replace('/Jul/', '/Xxx/'))).toBeNull();
  });

  it('handles an IPv6 client', () => {
    const v6 = LINE_200.replace('[Client 172.71.124.241]', '[Client 2001:db8::dead:beef]');
    expect(parseProxyLine(v6)!.host).toBe('gfloorsmp.siamsite.shop');
  });
});

describe('normalizePath', () => {
  it('strips the query string', () => {
    expect(normalizePath('/_next/image?url=x&w=384')).toBe('/_next/image');
  });
  it('collapses numeric id segments', () => {
    expect(normalizePath('/admin/users/123')).toBe('/admin/users/:id');
    expect(normalizePath('/lootbox/42/open')).toBe('/lootbox/:id/open');
  });
  it('collapses uuid and long hex segments', () => {
    expect(normalizePath('/order/3f0821a6-0249-434e-9fe9-e357666db897')).toBe('/order/:id');
    expect(normalizePath('/x/a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe('/x/:id');
  });
  it('collapses the hashed static asset subtree', () => {
    expect(normalizePath('/_next/static/chunks/main-abc123.js')).toBe('/_next/static/*');
  });
  it('keeps ordinary paths intact', () => {
    expect(normalizePath('/shop')).toBe('/shop');
    expect(normalizePath('/')).toBe('/');
  });
  it('always yields a leading slash', () => {
    expect(normalizePath('shop')).toBe('/shop');
    expect(normalizePath('')).toBe('/');
  });
  it('caps absurd lengths so the column cannot overflow', () => {
    expect(normalizePath('/' + 'a'.repeat(500)).length).toBeLessThanOrEqual(255);
  });
  it('does not lowercase (paths are case sensitive)', () => {
    expect(normalizePath('/Shop')).toBe('/Shop');
  });
});

describe('isBotUA', () => {
  it('flags common crawlers', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
      'facebookexternalhit/1.1',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
      'curl/8.5.0',
      'python-requests/2.31.0',
      'Go-http-client/1.1',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl)',
      'HeadlessChrome/120.0.0.0',
    ]) {
      expect(isBotUA(ua)).toBe(true);
    }
  });
  it('does not flag real browsers', () => {
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.113 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ]) {
      expect(isBotUA(ua)).toBe(false);
    }
  });
  it('treats an empty or "-" user agent as a bot', () => {
    expect(isBotUA('')).toBe(true);
    expect(isBotUA('-')).toBe(true);
  });
});

describe('refererLabel', () => {
  it('reduces a referer to its host', () => {
    expect(refererLabel('https://www.google.com/search?q=x', 'shop.siamsite.shop')).toBe('www.google.com');
  });
  it('folds self-referers into a single bucket, since they are navigation not acquisition', () => {
    expect(refererLabel('https://shop.siamsite.shop/lootbox', 'shop.siamsite.shop')).toBe('(ภายในเว็บ)');
  });
  it('buckets an absent referer as direct', () => {
    expect(refererLabel(null, 'shop.siamsite.shop')).toBe('(เข้าตรง)');
  });
  it('survives a malformed referer without throwing', () => {
    expect(refererLabel('not a url', 'shop.siamsite.shop')).toBe('(อื่นๆ)');
  });
});

describe('bucketing', () => {
  // Thailand has no DST, so Asia/Bangkok is a fixed UTC+7. Bucketing in Bangkok
  // wall-clock means the frontend renders stored values verbatim and no
  // conversion bug is possible.
  it('buckets the hour in Asia/Bangkok wall-clock', () => {
    expect(bucketHour(new Date('2026-07-31T17:53:30.000Z'))).toBe('2026-08-01 00:00:00');
  });
  it('buckets the day in Asia/Bangkok wall-clock', () => {
    expect(bucketDay(new Date('2026-07-31T17:53:30.000Z'))).toBe('2026-08-01');
  });
  it('keeps a mid-afternoon UTC time on the same Bangkok day', () => {
    expect(bucketDay(new Date('2026-07-31T06:00:00.000Z'))).toBe('2026-07-31');
    expect(bucketHour(new Date('2026-07-31T06:00:00.000Z'))).toBe('2026-07-31 13:00:00');
  });
});
