-- ============================================================
--  028_per_method_topup_bonus.sql
--  Split the single top-up bonus promotion into independent
--  per-method promotions (PromptPay vs TrueMoney Wallet).
--
--  Seeds the new per-method keys from the existing legacy keys
--  (topup_bonus_enabled / topup_bonus_multiplier) so a shop that
--  already runs a promotion keeps it on BOTH channels until the
--  admin tunes them separately. INSERT IGNORE keeps it idempotent.
--
--  Backend still falls back to the legacy keys at read time
--  (resolveTopupBonus), so this migration is purely for a clean
--  admin display + per-channel tuning going forward.
-- ============================================================

SET @legacy_enabled = (SELECT `value` FROM settings WHERE `key` = 'topup_bonus_enabled'    LIMIT 1);
SET @legacy_mult    = (SELECT `value` FROM settings WHERE `key` = 'topup_bonus_multiplier' LIMIT 1);

INSERT IGNORE INTO settings (`key`, `value`) VALUES
  ('topup_bonus_promptpay_enabled',    COALESCE(@legacy_enabled, 'false')),
  ('topup_bonus_promptpay_multiplier', COALESCE(@legacy_mult,    '1')),
  ('topup_bonus_truemoney_enabled',    COALESCE(@legacy_enabled, 'false')),
  ('topup_bonus_truemoney_multiplier', COALESCE(@legacy_mult,    '1'));
