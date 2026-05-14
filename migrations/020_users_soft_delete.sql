-- ============================================================
--  020_users_soft_delete.sql
--  Soft-delete column so admin "delete account" preserves audit
-- ============================================================

-- MySQL doesn't support IF NOT EXISTS on ADD COLUMN before 8.0.29.
-- Wrap in a stored procedure for backward-compat.
DROP PROCEDURE IF EXISTS add_users_deleted_at;
DELIMITER //
CREATE PROCEDURE add_users_deleted_at()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE users
      ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
      ADD KEY idx_deleted_at (deleted_at);
  END IF;
END //
DELIMITER ;
CALL add_users_deleted_at();
DROP PROCEDURE add_users_deleted_at;
