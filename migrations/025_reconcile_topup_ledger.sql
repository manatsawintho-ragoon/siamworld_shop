-- Migration 025: Reconcile historical topup ledger to the REAL money paid.
--
-- Context: before commit 6d83057, the slip-topup path wrote the bonus-inflated
-- creditAmount (paid x multiplier + discount-code bonus) into transactions.amount.
-- Toprank widgets and the admin dashboard SUM(transactions.amount) WHERE
-- type='topup', so historical revenue and rankings were inflated by the bonus
-- ("fake multiplied money"). The wallet balance / wallet_logs correctly keep the
-- bonus credit (the player's spendable points) and are deliberately NOT touched
-- here -- only the accounting ledger is corrected.
--
-- Real money paid is recorded per slip in slip_logs.amount, matched by
-- trans_ref = transactions.reference. Only rows that HAVE a matching slip_log are
-- corrected; manual credits (method='slip' but no slip_log, e.g. MANUAL-*) and
-- every other topup method were never inflated and are left untouched.
--
-- History is preserved: this only corrects the amount column, it does NOT delete
-- or remove any transaction rows.
--
-- Idempotent: only rows where the ledger still differs from the real paid amount
-- are updated (t.amount <> s.amount), so re-running is a no-op.
--
-- Collation: transactions.reference and slip_logs.trans_ref can use different
-- default collations across customer DBs (utf8mb4_0900_ai_ci vs
-- utf8mb4_unicode_ci). Forcing a common collation on BOTH sides makes the join
-- work regardless of how each column was created.

UPDATE transactions t
JOIN slip_logs s
  ON s.trans_ref COLLATE utf8mb4_unicode_ci = t.reference COLLATE utf8mb4_unicode_ci
SET t.amount = s.amount
WHERE t.type   = 'topup'
  AND t.method = 'slip'
  AND t.status = 'success'
  AND t.amount <> s.amount;
