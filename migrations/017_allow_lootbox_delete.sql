-- Migration 017: Allow deleting loot boxes and items without deleting inventory history
-- Makes web_inventory.loot_box_id and loot_box_item_id nullable with ON DELETE SET NULL. Idempotent.

-- 1. Drop existing FK for loot_box_id (if present)
SET @fk1 := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_id'
    AND REFERENCED_TABLE_NAME = 'loot_boxes'
  LIMIT 1
);
SET @sql1 := IF(@fk1 IS NOT NULL,
  CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', @fk1, '`'),
  'DO 0');
PREPARE s FROM @sql1; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. Drop existing FK for loot_box_item_id (if present)
SET @fk2 := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_item_id'
    AND REFERENCED_TABLE_NAME = 'loot_box_items'
  LIMIT 1
);
SET @sql2 := IF(@fk2 IS NOT NULL,
  CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', @fk2, '`'),
  'DO 0');
PREPARE s FROM @sql2; EXECUTE s; DEALLOCATE PREPARE s;

-- 3. Modify columns to be nullable (idempotent MODIFY)
ALTER TABLE web_inventory MODIFY COLUMN loot_box_id INT NULL;
ALTER TABLE web_inventory MODIFY COLUMN loot_box_item_id INT NULL;

-- 4. Re-add FK for loot_box_id only if missing
SET @fk1b := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_id'
    AND REFERENCED_TABLE_NAME = 'loot_boxes'
  LIMIT 1
);
SET @sql := IF(@fk1b IS NULL,
  'ALTER TABLE web_inventory ADD CONSTRAINT fk_inventory_lootbox FOREIGN KEY (loot_box_id) REFERENCES loot_boxes(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 5. Re-add FK for loot_box_item_id only if missing
SET @fk2b := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_item_id'
    AND REFERENCED_TABLE_NAME = 'loot_box_items'
  LIMIT 1
);
SET @sql := IF(@fk2b IS NULL,
  'ALTER TABLE web_inventory ADD CONSTRAINT fk_inventory_lootbox_item FOREIGN KEY (loot_box_item_id) REFERENCES loot_box_items(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
