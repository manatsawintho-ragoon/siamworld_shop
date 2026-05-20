-- Migration 014: Add stock limit and time-limited sale fields to products and loot_boxes
-- Idempotent: each ADD COLUMN guarded.

-- products.original_price (older installs may not have this even though it's in current init.sql)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'original_price');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN original_price DECIMAL(15,2) NULL DEFAULT NULL AFTER price',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- products.stock_limit
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'stock_limit');
SET @sql := IF(@col = 0,
  "ALTER TABLE products ADD COLUMN stock_limit INT NULL DEFAULT NULL COMMENT 'NULL = unlimited' AFTER original_price",
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- products.sale_start
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sale_start');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN sale_start DATETIME NULL DEFAULT NULL AFTER stock_limit',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- products.sale_end
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sale_end');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN sale_end DATETIME NULL DEFAULT NULL AFTER sale_start',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- loot_boxes.stock_limit
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'stock_limit');
SET @sql := IF(@col = 0,
  "ALTER TABLE loot_boxes ADD COLUMN stock_limit INT NULL DEFAULT NULL COMMENT 'NULL = unlimited' AFTER original_price",
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- loot_boxes.sale_start
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'sale_start');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN sale_start DATETIME NULL DEFAULT NULL AFTER stock_limit',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- loot_boxes.sale_end
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'sale_end');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN sale_end DATETIME NULL DEFAULT NULL AFTER sale_start',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
