-- 023_product_extra_images.sql
-- Allow each product to display up to 3 images. Idempotent.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image2');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN image2 VARCHAR(500) DEFAULT NULL AFTER image',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image3');
SET @sql := IF(@col = 0,
  'ALTER TABLE products ADD COLUMN image3 VARCHAR(500) DEFAULT NULL AFTER image2',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
