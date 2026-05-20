-- Migration 016: Allow deleting products that have purchase history
-- Makes purchases.product_id nullable + FK ON DELETE SET NULL. Idempotent.

-- 1. Drop existing FK if present
SET @fk := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchases'
    AND COLUMN_NAME = 'product_id'
    AND REFERENCED_TABLE_NAME = 'products'
  LIMIT 1
);
SET @sql := IF(@fk IS NOT NULL,
  CONCAT('ALTER TABLE purchases DROP FOREIGN KEY `', @fk, '`'),
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Make product_id nullable (idempotent — MODIFY to same type is a no-op metadata change)
ALTER TABLE purchases MODIFY COLUMN product_id INT NULL;

-- 3. Re-add FK only if missing now
SET @fk2 := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchases'
    AND COLUMN_NAME = 'product_id'
    AND REFERENCED_TABLE_NAME = 'products'
  LIMIT 1
);
SET @sql := IF(@fk2 IS NULL,
  'ALTER TABLE purchases ADD CONSTRAINT fk_purchases_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
