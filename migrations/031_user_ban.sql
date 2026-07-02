-- ============================================================
--  031_user_ban.sql
--  Web-side ban/suspend system, kept separate from deleted_at.
--    users.banned_at / ban_reason / banned_by  = current ban state
--    ban_logs                                   = full ban/unban history
--  deleted_at stays reserved for merge-retirement (transferData) so
--  merged accounts don't show up in the banned list.
-- ============================================================

-- ── users columns (idempotent; MySQL < 8.0.29 lacks ADD COLUMN IF NOT EXISTS) ──
DROP PROCEDURE IF EXISTS add_users_ban_cols;
DELIMITER //
CREATE PROCEDURE add_users_ban_cols()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'banned_at'
  ) THEN
    ALTER TABLE users
      ADD COLUMN banned_at TIMESTAMP NULL DEFAULT NULL AFTER deleted_at,
      ADD COLUMN ban_reason VARCHAR(500) NULL DEFAULT NULL AFTER banned_at,
      ADD COLUMN banned_by INT NULL DEFAULT NULL AFTER ban_reason,
      ADD KEY idx_users_banned_at (banned_at);
  END IF;
END //
DELIMITER ;
CALL add_users_ban_cols();
DROP PROCEDURE add_users_ban_cols;

-- ── ban_logs history table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ban_logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  action         ENUM('ban','unban') NOT NULL,
  reason         VARCHAR(500) NULL,
  admin_id       INT NULL,
  admin_username VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ban_logs_user (user_id),
  KEY idx_ban_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
