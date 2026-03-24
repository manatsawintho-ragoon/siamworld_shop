-- Migration 016: Allow deleting products that have purchase history
-- Makes purchases.product_id nullable; MySQL will SET NULL automatically on product delete

SET @fk := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'purchases'
    AND COLUMN_NAME = 'product_id'
    AND REFERENCED_TABLE_NAME = 'products'
  LIMIT 1
);
SET @sql := CONCAT('ALTER TABLE purchases DROP FOREIGN KEY `', @fk, '`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE purchases MODIFY COLUMN product_id INT NULL;

ALTER TABLE purchases ADD CONSTRAINT fk_purchases_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
