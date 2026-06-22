#!/usr/bin/env node
/**
 * TrueMoney Wallet Angpao - integration test script
 * ------------------------------------------------------------------
 * Verifies the exact redeem path the backend uses (HTTP/2 + IPv4-first to
 * gift.truemoney.com), independent of the app. Self-contained: only Node
 * builtins, so it runs on the host OR piped into a shop's backend container.
 *
 * USAGE
 *   # 1) Connectivity only (no voucher spent) - checks DNS + HTTP/2 reachability:
 *   node scripts/test-truemoney.js --connectivity
 *
 *   # 2) Real redeem (spends the angpao into the given wallet phone):
 *   node scripts/test-truemoney.js <shopPhone> <giftLinkOrHash>
 *   node scripts/test-truemoney.js 0812345678 "https://gift.truemoney.com/campaign/?v=abcd1234"
 *
 *   # 3) Run it INSIDE a customer's backend container (to test that container's
 *   #    network path to Cloudflare). Pipe the script in via stdin:
 *   docker exec -i sw-<name>-backend-1 node - --connectivity < scripts/test-truemoney.js
 *   docker exec -i sw-<name>-backend-1 node - 0812345678 "<giftLink>" < scripts/test-truemoney.js
 *
 * EXIT CODES: 0 = success, 1 = TrueMoney/voucher error, 2 = network/usage error.
 */

const http2 = require('http2');
const dns = require('dns');

const HOST = 'gift.truemoney.com';

// ── Helpers (mirror backend/src/services/truemoney.service.ts) ───────────────
function extractVoucherHash(input) {
  const parts = String(input || '').trim().split('?v=');
  const candidate = parts[1] || parts[0] || '';
  const m = candidate.match(/[0-9A-Za-z]+/);
  if (!m) throw new Error('ลิงก์/รหัสซองของขวัญไม่ถูกต้อง (no valid voucher hash)');
  return m[0];
}
function normalizePhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (/^66\d{9}$/.test(d)) d = '0' + d.slice(2);
  if (!/^0[689]\d{8}$/.test(d)) throw new Error(`เบอร์ไม่ถูกต้อง: ${phone}`);
  return d;
}
const STATUS_THAI = {
  VOUCHER_NOT_FOUND:      'ไม่พบซองของขวัญนี้ ลิงก์อาจไม่ถูกต้อง',
  VOUCHER_EXPIRED:        'ซองของขวัญนี้หมดอายุแล้ว',
  VOUCHER_OUT_OF_STOCK:   'ซองของขวัญนี้ถูกรับไปหมดแล้ว',
  TARGET_USER_REDEEMED:   'ซองของขวัญนี้ถูกใช้ไปแล้ว',
  CANNOT_GET_OWN_VOUCHER: 'ไม่สามารถรับซองของตัวเองได้',
};

function resolveIPv4(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addrs) => {
      if (err || !addrs || !addrs.length) reject(err || new Error('No IPv4 address'));
      else resolve(addrs[0]);
    });
  });
}

function post(path, body) {
  return new Promise(async (resolve, reject) => {
    let ipv4;
    try { ipv4 = await resolveIPv4(HOST); }
    catch (e) { return reject(new Error(`DNS resolve4 failed: ${e.message}`)); }

    const session = http2.connect(`https://${ipv4}`, { servername: HOST });
    const timer = setTimeout(() => { session.destroy(); reject(new Error('Request timeout (30s)')); }, 30000);
    session.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    const buf = Buffer.from(body);
    const req = session.request({
      ':method': 'POST', ':path': path,
      'content-type': 'application/json', 'accept': 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; SiamsiteShop/1.0)',
      'content-length': String(buf.length),
    });
    req.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });
    let status = 0; let raw = '';
    req.on('response', (h) => { status = h[':status']; });
    req.setEncoding('utf8');
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      clearTimeout(timer); session.destroy();
      resolve({ status, raw, ipv4 });
    });
    req.write(buf); req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);

  if (args[0] === '--connectivity') {
    // Use a deliberately-bogus hash. We only care that we reach Cloudflare and
    // get a structured TrueMoney JSON back (proves the HTTP/2 path works).
    const hash = 'CONNECTIVITYCHECK000';
    console.log(`[connectivity] resolving + POSTing to ${HOST} ...`);
    try {
      const { status, raw, ipv4 } = await post(`/campaign/vouchers/${hash}/redeem`, JSON.stringify({ mobile: '0800000000', voucher_hash: hash }));
      let json; try { json = JSON.parse(raw); } catch { json = null; }
      console.log(`[connectivity] OK  ipv4=${ipv4}  http=${status}`);
      console.log(`[connectivity] status.code = ${json?.status?.code ?? '(unparsed)'} `);
      console.log('[connectivity] Reachable: the backend can talk to gift.truemoney.com over HTTP/2.');
      process.exit(0);
    } catch (e) {
      console.error(`[connectivity] FAILED: ${e.message}`);
      console.error('[connectivity] The backend cannot reach gift.truemoney.com from this network.');
      process.exit(2);
    }
  }

  const [phoneArg, voucherArg] = args;
  if (!phoneArg || !voucherArg) {
    console.error('Usage: node scripts/test-truemoney.js <shopPhone> <giftLinkOrHash>');
    console.error('   or: node scripts/test-truemoney.js --connectivity');
    process.exit(2);
  }

  let phone, hash;
  try { phone = normalizePhone(phoneArg); hash = extractVoucherHash(voucherArg); }
  catch (e) { console.error(`[input] ${e.message}`); process.exit(2); }

  console.log(`[redeem] phone=${phone}  voucher_hash=${hash}`);
  console.log('[redeem] WARNING: a successful redeem moves real money into the wallet above.');

  let res;
  try { res = await post(`/campaign/vouchers/${hash}/redeem`, JSON.stringify({ mobile: phone, voucher_hash: hash })); }
  catch (e) { console.error(`[redeem] NETWORK ERROR: ${e.message}`); process.exit(2); }

  let json; try { json = JSON.parse(res.raw); } catch { console.error(`[redeem] Non-JSON response (http=${res.status}): ${res.raw.slice(0, 300)}`); process.exit(2); }

  const code = json?.status?.code;
  if (code !== 'SUCCESS') {
    const thai = STATUS_THAI[code] || 'แลกซองของขวัญไม่สำเร็จ';
    console.error(`[redeem] FAILED  code=${code || '(none)'}  http=${res.status}`);
    console.error(`[redeem] message(th) = ${thai}`);
    console.error(`[redeem] raw.status = ${JSON.stringify(json?.status)}`);
    process.exit(1);
  }

  const amount = parseFloat(json?.data?.my_ticket?.amount_baht ?? json?.data?.voucher?.redeemed_amount_baht);
  const owner = json?.data?.owner_profile?.full_name ?? '(unknown)';
  console.log('[redeem] SUCCESS');
  console.log(`[redeem] amount_baht = ${amount}`);
  console.log(`[redeem] owner       = ${owner}`);
  console.log(`[redeem] -> backend would credit the wallet ฿${amount} (plus top-up bonus if enabled).`);
  process.exit(0);
})();
