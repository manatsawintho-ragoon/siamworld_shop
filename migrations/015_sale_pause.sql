-- Migration 015: Add pause/resume sale support
-- Idempotent.

-- loot_boxes.is_paused
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'is_paused');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN is_paused TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_end',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- loot_boxes.sale_remaining_seconds
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'sale_remaining_seconds');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN sale_remaining_seconds INT NULL AFTER is_paused',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- products.is_paused
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_paused');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN is_paused TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_end',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- products.sale_remaining_seconds
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sale_remaining_seconds');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN sale_remaining_seconds INT NULL AFTER is_paused',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
