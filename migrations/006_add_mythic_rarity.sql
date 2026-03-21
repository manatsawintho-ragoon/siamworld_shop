-- Migration 006: Add 'mythic' to loot_box_items rarity ENUM
ALTER TABLE loot_box_items
  MODIFY COLUMN rarity ENUM('common','uncommon','rare','epic','legendary','mythic') DEFAULT 'common';
