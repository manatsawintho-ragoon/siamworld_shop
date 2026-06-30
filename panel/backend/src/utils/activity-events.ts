/**
 * Pure helpers for behavioural activity telemetry — no DB/config imports so they stay
 * trivially unit-testable. The service layer (activity.service.ts) wires these to storage.
 */

export type ActivityType = 'page_view' | 'feature_click';

export interface IncomingEvent {
  type: ActivityType;
  value: string; // page_view -> path, feature_click -> feature key
}

/**
 * Allowlist of feature-click keys. Unknown keys are dropped (not errored) so a stale
 * frontend never floods the table with junk and cardinality stays bounded.
 * Keep in sync with the `data-track="..."` attributes in the frontend.
 */
export const ALLOWED_FEATURES = new Set<string>([
  // Renew / billing
  'renew_open', 'renew_submit', 'renew_promptpay', 'renew_easyslip',
  // Top-up
  'topup_open', 'topup_promptpay', 'topup_truemoney', 'topup_submit',
  // Custom domain
  'domain_connect', 'domain_verify',
  // Support
  'support_open', 'support_submit',
  // Profile / account
  'profile_save', 'account_delete_open',
  // Shop credentials
  'credentials_regenerate', 'credentials_copy',
  // Order / new shop
  'order_open', 'order_submit',
  // Dashboard
  'dashboard_manage_shop',
]);

const MAX_DETAILS_LEN = 191;

/**
 * Normalize a page path into a low-cardinality, prefix-restricted key.
 * Returns null for anything outside the tracked panel area (we only track the
 * logged-in `/dashboard` and `/admin` surfaces).
 */
export function normalizePath(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  // Drop query string + hash.
  let p = raw.split('?')[0].split('#')[0].trim();
  if (!p.startsWith('/')) return null;
  // Collapse trailing slash (except root).
  if (p.length > 1) p = p.replace(/\/+$/, '');
  // Only the logged-in panel area is in scope.
  if (!/^\/(dashboard|admin)(\/|$)/.test(p)) return null;
  // Collapse numeric id segments so /admin/customers/123 -> /admin/customers/:id.
  p = p.replace(/\/\d+(?=\/|$)/g, '/:id');
  return p.slice(0, MAX_DETAILS_LEN);
}

/**
 * Turn raw client events into validated (action, details) pairs ready for insert.
 * Pure + DB-free so it can be unit tested. Invalid/out-of-scope events are dropped.
 */
export function sanitizeEvents(events: IncomingEvent[]): { action: ActivityType; details: string }[] {
  const out: { action: ActivityType; details: string }[] = [];
  for (const ev of events) {
    if (!ev || typeof ev.value !== 'string') continue;
    if (ev.type === 'page_view') {
      const path = normalizePath(ev.value);
      if (path) out.push({ action: 'page_view', details: path });
    } else if (ev.type === 'feature_click') {
      const key = ev.value.trim();
      if (ALLOWED_FEATURES.has(key)) out.push({ action: 'feature_click', details: key });
    }
  }
  return out;
}
