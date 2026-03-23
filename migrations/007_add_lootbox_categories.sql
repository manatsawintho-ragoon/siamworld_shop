-- Migration 007: Add loot box categories
-- Run this file manually against your MySQL database

CREATE TABLE IF NOT EXISTS loot_box_categories (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  NOT NULL DEFAULT '#637469',
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE loot_boxes
  ADD COLUMN category_id INT NULL AFTER id,
  ADD CONSTRAINT fk_lootbox_category
    FOREIGN KEY (category_id) REFERENCES loot_box_categories(id)
    ON DELETE SET NULL;
