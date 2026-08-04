/**
 * Single definition of "this purchase is a test, keep it out of the numbers".
 *
 * A shop owner buys their own item to confirm the RCON command really delivers
 * it in-game. That buy must not move the product's public sold_count, the shop's
 * revenue, or anything on the dashboard - otherwise verifying delivery costs
 * them their analytics.
 *
 * The result is STAMPED onto the row at insert time (purchases.is_test,
 * web_inventory.is_test, transactions.is_test) rather than re-derived at query
 * time from users.role. Deriving it later would rewrite history: promote a
 * long-time player to admin and every real purchase they ever made would
 * retroactively vanish from revenue; demote an admin and their test buys would
 * become income. The flag records what was true when the money moved.
 *
 * Keep this the only place that decides. If "test" ever needs to mean something
 * else (a dedicated staff role, an explicit toggle), this is the one line to
 * change.
 */
export const isTestBuyer = (role?: string | null): boolean => role === 'admin';

/** Stamp value for a SQL parameter list. */
export const testFlag = (role?: string | null): number => (isTestBuyer(role) ? 1 : 0);
