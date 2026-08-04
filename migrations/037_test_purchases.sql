-- ============================================================
--  037_test_purchases.sql
--  Mark purchases/loot-box opens made by an admin as TEST buys so they
--  stop counting as real sales.
--
--  A shop owner buys their own item to confirm the RCON command actually
--  delivers it in-game. Until now that purchase was indistinguishable from
--  a real one: it inflated the product's public sold_count, the dashboard
--  revenue, top-products and every chart. The owner could not verify
--  delivery without corrupting their own analytics.
--
--  WHY A STORED FLAG AND NOT `JOIN users WHERE role != 'admin'`:
--  role-at-query-time rewrites history. Promote a long-time player to admin
--  and every real purchase they ever made retroactively vanishes from the
--  shop's revenue; demote an admin and their test buys become revenue. The
--  flag snapshots what was true when the money moved. It is also cheaper:
--  sold_count is a correlated subquery evaluated per product row on the
--  hottest read path in the app, and a users join would multiply that work.
--
--  transactions needs the flag too, because gacha revenue is read from
--  transactions (description LIKE 'เปิดกล่อง%'), not from web_inventory.
--  Without it, excluding a test box-open would need the users join again.
--
--  DELIBERATELY NOT MARKED: topup transactions. An admin self-crediting
--  Baht still counts as income, by decision. Only type='purchase' spend
--  rows are flagged.
-- ============================================================

-- ── purchases ─────────────────────────────────────────────────
-- The backfill lives INSIDE the guard: apply-migrations.sh already runs a
-- file once, but if the column is ever added by hand we must not re-run the
-- UPDATE and clobber rows an operator has since corrected.
DROP PROCEDURE IF EXISTS add_purchases_is_test;
DELIMITER //
CREATE PROCEDURE add_purchases_is_test()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'is_test'
  ) THEN
    ALTER TABLE purchases
      ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

    -- Backfill from role as of now. Rows bought by anyone who is an admin
    -- today are treated as tests; there is no better signal available
    -- retroactively.
    UPDATE purchases p JOIN users u ON u.id = p.user_id
       SET p.is_test = 1
     WHERE u.role = 'admin';
  END IF;

  -- (product_id, status, is_test) serves the sold_count subquery and the
  -- remainingStock() lookup, which both filter exactly these three columns.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchases' AND INDEX_NAME = 'idx_prod_status_test'
  ) THEN
    ALTER TABLE purchases ADD KEY idx_prod_status_test (product_id, status, is_test);
  END IF;
END //
DELIMITER ;
CALL add_purchases_is_test();
DROP PROCEDURE add_purchases_is_test;

-- ── web_inventory ─────────────────────────────────────────────
DROP PROCEDURE IF EXISTS add_web_inventory_is_test;
DELIMITER //
CREATE PROCEDURE add_web_inventory_is_test()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory' AND COLUMN_NAME = 'is_test'
  ) THEN
    ALTER TABLE web_inventory
      ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

    UPDATE web_inventory w JOIN users u ON u.id = w.user_id
       SET w.is_test = 1
     WHERE u.role = 'admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'web_inventory' AND INDEX_NAME = 'idx_wi_box_test'
  ) THEN
    ALTER TABLE web_inventory ADD KEY idx_wi_box_test (loot_box_id, is_test);
  END IF;
END //
DELIMITER ;
CALL add_web_inventory_is_test();
DROP PROCEDURE add_web_inventory_is_test;

-- ── transactions ──────────────────────────────────────────────
DROP PROCEDURE IF EXISTS add_transactions_is_test;
DELIMITER //
CREATE PROCEDURE add_transactions_is_test()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'is_test'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

    -- type='purchase' only: admin top-ups keep counting as income.
    UPDATE transactions t JOIN users u ON u.id = t.user_id
       SET t.is_test = 1
     WHERE u.role = 'admin' AND t.type = 'purchase';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'idx_tx_type_status_test'
  ) THEN
    ALTER TABLE transactions ADD KEY idx_tx_type_status_test (type, status, is_test);
  END IF;
END //
DELIMITER ;
CALL add_transactions_is_test();
DROP PROCEDURE add_transactions_is_test;
