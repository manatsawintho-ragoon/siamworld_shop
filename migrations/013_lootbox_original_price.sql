-- Migration 013: Add original_price to loot_boxes for promotional pricing
ALTER TABLE loot_boxes
  ADD COLUMN original_price DECIMAL(10,2) NULL DEFAULT NULL
  AFTER price;
