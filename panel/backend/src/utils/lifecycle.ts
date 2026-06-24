/**
 * Shop expiry lifecycle thresholds (days overdue, measured from `expires_at`).
 *
 * Two stages:
 *  - suspend: stop the shop container (reversible — renew brings it back).
 *  - delete:  permanently remove the shop (containers + DB volume + custom domain).
 *
 * Safety invariant: delete MUST come strictly after suspend, so a shop is always
 * suspended (and the customer emailed) before anything is destroyed. If the operator
 * misconfigures `auto_delete_days <= auto_suspend_days`, we clamp delete to
 * suspend + 1 rather than risk deleting a shop that was never suspended.
 */
export interface LifecycleDays {
  suspendDays: number;
  deleteDays: number;
}

const DEFAULT_SUSPEND_DAYS = 3;
const DEFAULT_DELETE_DAYS = 7;

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Resolve suspend/delete day thresholds from panel settings, enforcing the
 * delete-after-suspend invariant. Pure (no I/O) so it is unit-testable.
 */
export function resolveLifecycleDays(settings: Record<string, string>): LifecycleDays {
  const suspendDays = toPositiveInt(settings['auto_suspend_days'], DEFAULT_SUSPEND_DAYS);
  let deleteDays = toPositiveInt(settings['auto_delete_days'], DEFAULT_DELETE_DAYS);
  if (deleteDays <= suspendDays) deleteDays = suspendDays + 1;
  return { suspendDays, deleteDays };
}
