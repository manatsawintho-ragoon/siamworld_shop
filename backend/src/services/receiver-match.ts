// Receiver-account matching for PromptPay top-up slips (EasySlip v2).
//
// Each shop configures its own PromptPay receiver in Admin -> Payment Settings.
// A slip is accepted when it was paid to THAT receiver. EasySlip exposes the
// receiver under `receiver.account` as:
//   - proxy: { type: 'NATID'|'MSISDN'|'EWALLETID'|'EMAIL'|'BILLERID', account } (masked)
//   - bank:  { type: 'BANKAC'|'TOKEN'|'DUMMY', account } (masked)
//   - name:  { th?, en? } (may be partially masked)
//
// For a phone-number (MSISDN) PromptPay the proxy suffix matches the configured
// promptpay_id, so a numeric match is enough. For a national-ID (NATID) PromptPay
// the slip often exposes only the linked *bank account* number, which never equals
// the configured citizen id -> numeric match is impossible. In that case we fall
// back to matching the receiver *name* against the configured shop name.

export interface SlipParty {
  account?: {
    name?: { th?: string; en?: string };
    bank?: { type?: string; account?: string };
    proxy?: { type?: string; account?: string };
  };
}

export interface ReceiverMatchResult {
  matched: boolean;
  matchedBy: 'number' | 'bank+name' | null;
  /** Best receiver account string, for logging/notifications. */
  receiverAccount: string;
  receiverName: string;
}

/** Normalize Thai phone / international formats: 0066XXXXXXXXX <-> 66XXXXXXXXX <-> 0XXXXXXXXX. */
function normalizeAccount(v: string): string {
  if (v.startsWith('0066')) return '0' + v.slice(4);
  if (/^66\d{9}$/.test(v)) return '0' + v.slice(2);
  return v;
}

/**
 * Extract the unambiguous trailing digits AFTER any masking characters.
 * e.g. "06xxxx6132" -> "6132"; "xxx-x-x5678-x" -> ""(no trailing digits) ;
 * "08xxxxxxxx89" -> "89". Falls back to all digits when unmasked.
 */
function visibleSuffix(masked: string): string {
  const acct = masked.replace(/[-\s]/g, '');
  const m = acct.match(/[x*]+([0-9]+)$/i);
  if (m) return m[1];
  // No mask chars at all -> treat the whole thing as visible.
  if (!/[x*]/i.test(acct)) return acct.replace(/[^0-9]/g, '');
  return '';
}

/** A single masked receiver number vs the configured id. */
export function numberMatches(candidate: string, configuredId: string): boolean {
  if (!candidate || !configuredId) return false;
  const cfg = normalizeAccount(configuredId.replace(/[-\s]/g, ''));
  const acct = normalizeAccount(candidate.replace(/[-\s]/g, ''));
  if (acct === cfg) return true;
  const vis = visibleSuffix(candidate);
  return vis.length >= 4 && cfg.endsWith(vis);
}

const THAI_TITLES = [
  /^นางสาว/, /^นาย/, /^นาง/, /^น\.?ส\.?/, /^ด\.?ช\.?/, /^ด\.?ญ\.?/,
  /^dr\.?/i, /^mr\.?/i, /^mrs\.?/i, /^miss/i, /^ms\.?/i,
];

/** Lowercase, strip leading title, drop spaces/punctuation. */
function normalizeName(v: string): string {
  let s = (v || '').trim().toLowerCase();
  for (const t of THAI_TITLES) s = s.replace(t, '');
  return s.replace(/[\s.·,]/g, '');
}

/** Normalized name with masking characters removed (visible letters only). */
function visibleName(v: string): string {
  return normalizeName(v).replace(/[x*×_]+/g, '');
}

/**
 * Match a (possibly masked) receiver name against the configured shop name.
 * Bank slips usually mask the surname tail, so we compare the visible portion:
 * the configured name and the slip's visible name must be prefix/substring
 * consistent. Requires >= 4 visible chars on each side to avoid trivial matches.
 */
export function nameMatches(slipName: string, configuredName: string): boolean {
  const cfg = visibleName(configuredName);
  const slip = visibleName(slipName);
  if (cfg.length < 4 || slip.length < 4) return false;
  return (
    cfg.startsWith(slip) || slip.startsWith(cfg) ||
    cfg.includes(slip)   || slip.includes(cfg)
  );
}

/**
 * Decide whether a slip's receiver belongs to this shop.
 *
 * Two accepted paths:
 *  - 'number'    : the slip's proxy/bank number matches the configured promptpay_id.
 *                  Covers phone-number (MSISDN) PromptPay, which EasySlip reports
 *                  as a proxy whose suffix equals promptpay_id.
 *  - 'bank+name' : for national-ID (บัตรประชาชน) PromptPay, EasySlip does NOT return
 *                  the 13-digit card number — it returns the linked bank account.
 *                  So when the shop has registered its receiver bank account
 *                  (promptpay_bankacct), we require BOTH the bank account number AND
 *                  the receiver name to match. Both must pass, never one alone.
 */
export function matchReceiver(
  receiver: SlipParty | undefined,
  settings: Record<string, string | undefined>,
): ReceiverMatchResult {
  const configuredId = (settings['promptpay_id'] || '').replace(/[-\s]/g, '');
  const configuredBank = (settings['promptpay_bankacct'] || '').replace(/[-\s]/g, '');
  const configuredName =
    (settings['promptpay_name'] || '').trim() ||
    [settings['promptpay_firstname'], settings['promptpay_lastname']]
      .filter(Boolean).join(' ').trim();

  const acct = receiver?.account;
  const proxyAcct = acct?.proxy?.account ?? '';
  const bankAcct = acct?.bank?.account ?? '';
  const receiverName = acct?.name?.th ?? acct?.name?.en ?? '';
  const receiverAccount = proxyAcct || bankAcct;

  // Path 'number' — proxy/bank number matches promptpay_id (phone-PromptPay).
  if (configuredId && (numberMatches(proxyAcct, configuredId) || numberMatches(bankAcct, configuredId))) {
    return { matched: true, matchedBy: 'number', receiverAccount, receiverName };
  }

  // Path 'bank+name' — for บัตรประชาชน PromptPay: require the registered bank
  // account AND the receiver name to BOTH match.
  if (configuredBank) {
    const bankMatched = numberMatches(bankAcct, configuredBank) || numberMatches(proxyAcct, configuredBank);
    const nameMatched = !!configuredName && !!receiverName && nameMatches(receiverName, configuredName);
    if (bankMatched && nameMatched) {
      return { matched: true, matchedBy: 'bank+name', receiverAccount, receiverName };
    }
  }

  return { matched: false, matchedBy: null, receiverAccount, receiverName };
}
