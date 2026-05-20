-- Migration 013: Add original_price to loot_boxes for promotional pricing
-- Idempotent.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'original_price');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN original_price DECIMAL(10,2) NULL DEFAULT NULL AFTER price',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
