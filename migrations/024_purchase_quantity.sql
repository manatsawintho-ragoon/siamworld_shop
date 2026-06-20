-- Migration 024: Add quantity to purchases for multi-item single-order buys
-- One row per order; price stores the order total. Existing rows default to 1
-- so historical stock/sold-count stats stay correct. Idempotent.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'quantity');
SET @sql := IF(@col = 0,
  'ALTER TABLE purchases ADD COLUMN quantity INT NOT NULL DEFAULT 1 AFTER product_id',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
