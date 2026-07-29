-- ============================================================
--  034_reward_shop.sql
--  Slice 2 of the campaign design: the Reward Shop, where campaign
--  points are spent. Points remain a one-way sink - this migration
--  adds no path from points back to Baht.
--
--  Also closes the Slice 2 blocking gate by giving top-up reversal a
--  real, idempotent marker (`transactions.reversed_at`) so
--  campaignService.revokeForTransaction finally has a production caller.
--
--  Idempotent.
-- ============================================================

-- ── transactions.reversed_at: the clawback trigger ────────────
-- Without this column an admin reversal has no durable marker, so a
-- double-click would debit the wallet twice and claw back twice.
DROP PROCEDURE IF EXISTS add_tx_reversed_at;
DELIMITER //
CREATE PROCEDURE add_tx_reversed_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'reversed_at'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN reversed_at DATETIME NULL DEFAULT NULL AFTER created_at,
      ADD COLUMN reversed_reason VARCHAR(500) NULL DEFAULT NULL AFTER reversed_at,
      ADD KEY idx_tx_reversed (reversed_at);
  END IF;
END //
DELIMITER ;
CALL add_tx_reversed_at();
DROP PROCEDURE add_tx_reversed_at;

-- ── rewards catalog ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  point_cost INT NOT NULL,
  stock INT DEFAULT NULL,                 -- NULL = unlimited
  per_user_limit INT DEFAULT NULL,
  command TEXT NOT NULL,
  requires_campaign_id INT DEFAULT NULL,  -- reward exclusive to one campaign
  visible_from  DATETIME DEFAULT NULL,
  visible_until DATETIME DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_active (active, deleted_at),
  KEY idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which servers a reward may be claimed on. No rows = every server.
CREATE TABLE IF NOT EXISTS reward_servers (
  reward_id INT NOT NULL,
  server_id INT NOT NULL,
  PRIMARY KEY (reward_id, server_id),
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  point_cost INT NOT NULL,
  status ENUM('pending','claimed','failed') NOT NULL DEFAULT 'pending',
  inventory_id INT DEFAULT NULL,
  idempotency_key VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The concurrent-double-redeem defense. MySQL allows many NULLs here, which
  -- is fine: a client that sends no key simply opts out of dedup.
  UNIQUE KEY idx_idempotency (idempotency_key),
  KEY idx_user (user_id, created_at),
  KEY idx_reward (reward_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── web_inventory carries reward claims too ───────────────────
-- The design says rewards claim through the existing loot-box inventory
-- flow, but web_inventory hard-required a loot box: loot_box_id and
-- loot_box_item_id are NOT NULL with foreign keys. Widen them rather than
-- build a second inventory, so players keep one "claim when online" surface
-- and the RCON claim path (which only reads item_command) is reused as-is.
DROP PROCEDURE IF EXISTS widen_web_inventory_for_rewards;
DELIMITER //
CREATE PROCEDURE widen_web_inventory_for_rewards()
BEGIN
  DECLARE fk_name VARCHAR(255);

  -- Drop the loot-box foreign keys by looked-up name (names are
  -- auto-generated and differ between shops created at different times).
  SELECT CONSTRAINT_NAME INTO fk_name FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory'
     AND COLUMN_NAME = 'loot_box_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1;
  IF fk_name IS NOT NULL THEN
    SET @s = CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', fk_name, '`');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;

  SET fk_name = NULL;
  SELECT CONSTRAINT_NAME INTO fk_name FROM information_schema.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory'
     AND COLUMN_NAME = 'loot_box_item_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1;
  IF fk_name IS NOT NULL THEN
    SET @s = CONCAT('ALTER TABLE web_inventory DROP FOREIGN KEY `', fk_name, '`');
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;

  -- Allow NULL so a reward claim needs no loot box.
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory'
      AND COLUMN_NAME = 'loot_box_id' AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE web_inventory
      MODIFY COLUMN loot_box_id INT NULL DEFAULT NULL,
      MODIFY COLUMN loot_box_item_id INT NULL DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory' AND COLUMN_NAME = 'source'
  ) THEN
    ALTER TABLE web_inventory
      ADD COLUMN source ENUM('lootbox','reward') NOT NULL DEFAULT 'lootbox' AFTER loot_box_item_id,
      ADD COLUMN reward_id INT NULL DEFAULT NULL AFTER source,
      ADD KEY idx_source (source);
  END IF;
END //
DELIMITER ;
CALL widen_web_inventory_for_rewards();
DROP PROCEDURE widen_web_inventory_for_rewards;

-- Existing rows predate the discriminator and are all loot-box wins.
UPDATE web_inventory SET source = 'lootbox' WHERE source IS NULL;
