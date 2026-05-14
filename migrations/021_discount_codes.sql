-- ============================================================
--  021_discount_codes.sql
--  Extend redeem_codes with discount-type rewards
--
--  New reward_type values:
--    discount_topup     — applies % or fixed amount off a wallet top-up
--    discount_purchase  — applies % or fixed amount off a shop purchase
--    discount_any       — works for both
--
--  Columns:
--    discount_percent   — 1..100 (NULL if amount-based)
--    discount_amount    — fixed Baht off (NULL if percent-based)
--    min_topup_amount   — minimum spend before code can be applied
-- ============================================================

ALTER TABLE redeem_codes
  MODIFY COLUMN reward_type ENUM(
    'rcon',
    'point',
    'discount_topup',
    'discount_purchase',
    'discount_any'
  ) NOT NULL DEFAULT 'rcon';

DROP PROCEDURE IF EXISTS add_discount_cols;
DELIMITER //
CREATE PROCEDURE add_discount_cols()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_codes'
                 AND COLUMN_NAME = 'discount_percent') THEN
    ALTER TABLE redeem_codes
      ADD COLUMN discount_percent DECIMAL(5,2) NULL DEFAULT NULL AFTER point_amount,
      ADD COLUMN discount_amount DECIMAL(10,2) NULL DEFAULT NULL AFTER discount_percent,
      ADD COLUMN min_topup_amount DECIMAL(10,2) NULL DEFAULT NULL AFTER discount_amount;
  END IF;
END //
DELIMITER ;
CALL add_discount_cols();
DROP PROCEDURE add_discount_cols;
