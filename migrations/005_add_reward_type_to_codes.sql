-- Migration 005: Add reward_type and point_amount columns to redeem_codes
-- Idempotent: each column added only if missing.

SET @e1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_codes' AND COLUMN_NAME = 'reward_type');
SET @sql := IF(@e1 = 0,
  "ALTER TABLE redeem_codes ADD COLUMN reward_type ENUM('rcon','point') NOT NULL DEFAULT 'rcon' AFTER description",
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @e2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'redeem_codes' AND COLUMN_NAME = 'point_amount');
SET @sql := IF(@e2 = 0,
  'ALTER TABLE redeem_codes ADD COLUMN point_amount DECIMAL(10,2) DEFAULT NULL AFTER reward_type',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
