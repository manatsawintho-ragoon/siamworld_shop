-- Migration 014: Add stock limit and time-limited sale fields to products and loot_boxes
ALTER TABLE products
  ADD COLUMN stock_limit INT NULL DEFAULT NULL COMMENT 'NULL = unlimited' AFTER original_price,
  ADD COLUMN sale_start  DATETIME NULL DEFAULT NULL                       AFTER stock_limit,
  ADD COLUMN sale_end    DATETIME NULL DEFAULT NULL                       AFTER sale_start;

ALTER TABLE loot_boxes
  ADD COLUMN stock_limit INT NULL DEFAULT NULL COMMENT 'NULL = unlimited' AFTER original_price,
  ADD COLUMN sale_start  DATETIME NULL DEFAULT NULL                       AFTER stock_limit,
  ADD COLUMN sale_end    DATETIME NULL DEFAULT NULL                       AFTER sale_start;
