-- Migration 015: Add pause/resume sale support
ALTER TABLE loot_boxes
  ADD COLUMN is_paused TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_end,
  ADD COLUMN sale_remaining_seconds INT NULL AFTER is_paused;

ALTER TABLE products
  ADD COLUMN is_paused TINYINT(1) NOT NULL DEFAULT 0 AFTER sale_end,
  ADD COLUMN sale_remaining_seconds INT NULL AFTER is_paused;
