const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

/**
 * Validate a customer-supplied custom hostname for v1 (subdomains only).
 * Returns the normalized (lowercased, trimmed) hostname or a user-facing error.
 */
export function validateCustomHostname(
  hostname: string,
  opts: { siamsiteSuffix: string }
): { ok: true; value: string } | { ok: false; error: string } {
  const value = (hostname || '').trim().toLowerCase();
  if (!value) return { ok: false, error: 'กรุณากรอกโดเมน' };
  if (!HOSTNAME_RE.test(value)) return { ok: false, error: 'รูปแบบโดเมนไม่ถูกต้อง (เช่น shop.yourdomain.com)' };
  // Subdomain only: need at least 3 labels (sub + domain + tld). Reject apex like x.com.
  if (value.split('.').length < 3) {
    return { ok: false, error: 'รองรับเฉพาะ subdomain (เช่น shop.yourdomain.com) ยังไม่รองรับโดเมนหลัก' };
  }
  if (value === opts.siamsiteSuffix || value.endsWith(`.${opts.siamsiteSuffix}`)) {
    return { ok: false, error: `ใช้โดเมน ${opts.siamsiteSuffix} เป็นโดเมนของตัวเองไม่ได้` };
  }
  return { ok: true, value };
}

export type CustomDomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed';

/**
 * Map a Cloudflare custom-hostname API response to our 4-state machine.
 * - failed: terminal/blocked states.
 * - active: both hostname and edge cert are live.
 * - pending_dns: waiting for the customer's CNAME / DCV validation.
 * - pending_ssl: cert is issuing or deploying (default for unknown in-progress states).
 */
export function mapCfHostnameStatus(cf: { status?: string; ssl?: { status?: string } }): CustomDomainStatus {
  const hostStatus = cf.status ?? '';
  const sslStatus = cf.ssl?.status ?? '';

  if (['blocked', 'moved', 'deleted', 'pending_deletion'].includes(hostStatus)) return 'failed';
  if (['deleted', 'pending_deletion'].includes(sslStatus)) return 'failed';

  if (hostStatus === 'active' && sslStatus === 'active') return 'active';

  if (['initializing', 'pending_validation'].includes(sslStatus)) return 'pending_dns';
  if (['pending_issuance', 'pending_deployment', 'pending_cleanup'].includes(sslStatus)) return 'pending_ssl';

  return 'pending_ssl';
}
