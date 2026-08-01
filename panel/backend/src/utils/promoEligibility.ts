/**
 * Was a promo subscription actually delivered to the customer?
 *
 * `panel_users.used_trial` / `used_intro` are set in the same transaction that
 * inserts the subscription, which commits BEFORE deployService provisions
 * anything. Nothing ever reset them. So a customer whose trial shop failed to
 * build was told "you already used your free trial" about a shop they never
 * received, with no way out but a manual DB edit.
 *
 * This is the predicate that decides whether the flag is trustworthy. It is
 * deliberately conservative: it only forgives states that prove no working shop
 * exists, and treats everything else as delivered.
 *
 *   cancelled                      -> not delivered (torn down before use)
 *   pending + "Deploy failed:" log -> not delivered (deploy.service.ts:57 path)
 *   pending, no failure log        -> DELIVERED (queued, may still succeed)
 *   deploying                      -> DELIVERED (in flight, may still succeed)
 *   active / expired / suspended   -> DELIVERED (a 7-day trial that simply ran
 *                                     out is not grounds for a second one)
 */

/** Prefix deploy.service.ts writes when runDeploy() rejects. */
export const DEPLOY_FAILED_PREFIX = 'Deploy failed:';

/** Enough of deploy_log to see the failure prefix, without hauling back 100s of KB. */
export const DEPLOY_LOG_HEAD_CHARS = 64;

export function isPromoDelivered(
  status: string | null | undefined,
  deployLogHead: string | null | undefined
): boolean {
  if (status === 'cancelled') return false;
  if (status === 'pending' && (deployLogHead ?? '').startsWith(DEPLOY_FAILED_PREFIX)) return false;
  return true;
}
