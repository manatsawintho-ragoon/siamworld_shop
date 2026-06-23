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
