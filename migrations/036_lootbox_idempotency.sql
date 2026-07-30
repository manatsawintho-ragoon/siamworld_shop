-- ============================================================
--  036_lootbox_idempotency.sql
--  Give loot-box opens the same duplicate protection purchases and
--  reward redemptions already have.
--
--  The API has always accepted an `idempotencyKey` on
--  POST /api/shop/lootboxes/:id/open, and loot-box.service.ts has always
--  computed one - then never used it. There was no dedup check and no
--  unique constraint, so a retried request (flaky mobile connection, an
--  impatient second click, two tabs) charged the wallet twice and wrote
--  two web_inventory rows. The client sent the key, which made the path
--  look protected while it was not.
--
--  UNIQUE(idempotency_key) is the authoritative guard, exactly as
--  purchases.idx_idempotency and reward_redemptions.idx_idempotency are.
--  NULL is allowed and repeats freely under MySQL's UNIQUE semantics, so
--  historical rows and any caller that omits a key are unaffected.
--
--  Idempotent.
-- ============================================================

DROP PROCEDURE IF EXISTS add_web_inventory_idempotency;
DELIMITER //
CREATE PROCEDURE add_web_inventory_idempotency()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'web_inventory'
      AND COLUMN_NAME = 'idempotency_key'
  ) THEN
    ALTER TABLE web_inventory
      ADD COLUMN idempotency_key VARCHAR(64) DEFAULT NULL AFTER status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'web_inventory'
      AND INDEX_NAME = 'idx_wi_idempotency'
  ) THEN
    ALTER TABLE web_inventory
      ADD UNIQUE KEY idx_wi_idempotency (idempotency_key);
  END IF;
END //
DELIMITER ;
CALL add_web_inventory_idempotency();
DROP PROCEDURE add_web_inventory_idempotency;
