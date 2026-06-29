-- Migration 029: Dedicated web-admin credential, decoupled from AuthMe.
--
-- The shop admin can now have a login credential that lives entirely in the
-- app-side `users` table instead of `authme`. This means:
--   * resetting the admin password never touches the player's Minecraft password
--   * it works even in Bridge mode (where `authme` is not the source of truth)
--   * the panel can display + regenerate it (stored reversibly, AES-256-GCM,
--     same scheme as RCON passwords — see backend/src/utils/crypto.ts)
--
-- Players are unaffected: they keep authenticating via authme/bridge. Only a
-- `users` row whose `admin_password_enc` IS NOT NULL uses the new login path.
-- Idempotent (MySQL 8 has no ADD COLUMN IF NOT EXISTS, so guard via schema).

SET @col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'admin_password_enc'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN admin_password_enc VARCHAR(255) NULL DEFAULT NULL AFTER role',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
