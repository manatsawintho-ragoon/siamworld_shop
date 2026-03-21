-- Add reward_type and point_amount columns to redeem_codes
ALTER TABLE redeem_codes
  ADD COLUMN reward_type ENUM('rcon', 'point') NOT NULL DEFAULT 'rcon' AFTER description,
  ADD COLUMN point_amount DECIMAL(10,2) DEFAULT NULL AFTER reward_type;
