-- 008_security_hardening.sql
-- Closes several issues found in the security review:
--   * UNIQUE(easyslip_ref) prevents racing duplicate slip credits.
--   * claimed_trial_ip / claimed_intro_ip track the *claim* IP (not signup IP)
--     so VPN-rotation can't bypass the per-IP cap.
--   * Indexes for the new IP checks + faster expiry/audit lookups.
USE siamworld_panel;

-- ── Slip dedup: enforce uniqueness on EasySlip transaction reference ──
-- First, clean up any pre-existing duplicates (keep the earliest verified row).
-- Note: keeps the *first* verified row per ref; later duplicates become rejected.
UPDATE payment_slips ps
JOIN (
  SELECT MIN(id) AS keep_id, easyslip_ref
  FROM payment_slips
  WHERE easyslip_ref IS NOT NULL AND easyslip_ref <> ''
  GROUP BY easyslip_ref
  HAVING COUNT(*) > 1
) d ON ps.easyslip_ref = d.easyslip_ref AND ps.id <> d.keep_id
SET ps.status = 'rejected', ps.reject_reason = COALESCE(ps.reject_reason, 'Duplicate ref (cleaned up by migration 008)');

ALTER TABLE payment_slips
  ADD UNIQUE KEY uniq_easyslip_ref (easyslip_ref);

-- ── Trial/Intro IP cap: store claim IP, not just signup IP ──
ALTER TABLE panel_users
  ADD COLUMN claimed_trial_ip VARCHAR(45) NULL AFTER signup_ip,
  ADD COLUMN claimed_intro_ip VARCHAR(45) NULL AFTER claimed_trial_ip;

CREATE INDEX idx_panel_users_claimed_trial_ip ON panel_users(claimed_trial_ip);
CREATE INDEX idx_panel_users_claimed_intro_ip ON panel_users(claimed_intro_ip);

-- Backfill: for users who already used their trial/intro, treat signup_ip as the claim IP
UPDATE panel_users SET claimed_trial_ip = signup_ip WHERE used_trial = 1 AND claimed_trial_ip IS NULL;
UPDATE panel_users SET claimed_intro_ip = signup_ip WHERE used_intro = 1 AND claimed_intro_ip IS NULL;

-- ── Performance: index for cron jobs scanning expiring subs ──
CREATE INDEX idx_subscriptions_status_expires ON subscriptions(status, expires_at);

-- ── Performance: audit_logs created_at for the admin list query ──
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
