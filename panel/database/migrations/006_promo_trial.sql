-- 006_promo_trial.sql
-- Adds 7-day free trial + ฿99 first-month intro promotion + EasySlip fee transparency.
USE siamworld_panel;

-- ── Promotion eligibility flags on user (one-shot per user) ────
ALTER TABLE panel_users
  ADD COLUMN used_trial  BOOLEAN     NOT NULL DEFAULT FALSE AFTER role,
  ADD COLUMN used_intro  BOOLEAN     NOT NULL DEFAULT FALSE AFTER used_trial,
  ADD COLUMN signup_ip   VARCHAR(45) NULL          AFTER used_intro;

CREATE INDEX idx_panel_users_signup_ip ON panel_users(signup_ip);

-- ── Subscription kind tracking ─────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN kind ENUM('regular','trial','intro') NOT NULL DEFAULT 'regular' AFTER package_months;

-- ── Promo settings ─────────────────────────────────────────────
INSERT INTO panel_settings (`key`, `value`) VALUES
  ('enable_trial',  '1'),
  ('trial_days',    '7'),
  ('enable_intro',  '1'),
  ('intro_price',   '99'),
  ('easyslip_fee',  '0.396')
ON DUPLICATE KEY UPDATE `key` = `key`;
