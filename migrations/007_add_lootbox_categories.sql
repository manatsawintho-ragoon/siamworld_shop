-- Migration 007: Add loot box categories
-- Idempotent.

CREATE TABLE IF NOT EXISTS loot_box_categories (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  NOT NULL DEFAULT '#637469',
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Add category_id column if missing
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes' AND COLUMN_NAME = 'category_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE loot_boxes ADD COLUMN category_id INT NULL AFTER id',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Add FK if not present
SET @fk := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loot_boxes'
    AND COLUMN_NAME = 'category_id' AND REFERENCED_TABLE_NAME = 'loot_box_categories');
SET @sql := IF(@fk = 0,
  'ALTER TABLE loot_boxes ADD CONSTRAINT fk_lootbox_category FOREIGN KEY (category_id) REFERENCES loot_box_categories(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
