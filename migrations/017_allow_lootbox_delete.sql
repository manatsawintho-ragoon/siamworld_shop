-- Migration 017: Allow deleting loot boxes and items without deleting inventory history
-- Makes web_inventory.loot_box_id and loot_box_item_id nullable; MySQL will SET NULL automatically on delete

-- 1. Drop existing foreign keys for loot_box_id
SET @fk1 := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_id'
    AND REFERENCED_TABLE_NAME = 'loot_boxes'
  LIMIT 1
);
SET @sql1 := CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', @fk1, '`');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

-- 2. Drop existing foreign keys for loot_box_item_id
SET @fk2 := (
  SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'web_inventory'
    AND COLUMN_NAME = 'loot_box_item_id'
    AND REFERENCED_TABLE_NAME = 'loot_box_items'
  LIMIT 1
);
SET @sql2 := CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', @fk2, '`');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 3. Modify columns to be nullable
ALTER TABLE web_inventory MODIFY COLUMN loot_box_id INT NULL;
ALTER TABLE web_inventory MODIFY COLUMN loot_box_item_id INT NULL;

-- 4. Re-add foreign keys with ON DELETE SET NULL
ALTER TABLE web_inventory ADD CONSTRAINT fk_inventory_lootbox
  FOREIGN KEY (loot_box_id) REFERENCES loot_boxes(id) ON DELETE SET NULL;

ALTER TABLE web_inventory ADD CONSTRAINT fk_inventory_lootbox_item
  FOREIGN KEY (loot_box_item_id) REFERENCES loot_box_items(id) ON DELETE SET NULL;
