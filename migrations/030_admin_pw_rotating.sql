-- Migration 030: Rotating web-admin password (time-based, TOTP-style).
--
-- Builds on migration 029's dedicated web-admin credential. A freshly
-- provisioned admin now starts in ROTATING mode: `admin_password_enc` holds a
-- random 32-byte SEED (hex, AES-256-GCM encrypted) instead of a usable
-- password, and the actual login password is derived every minute from
--   readable( HMAC-SHA256(seed, floor(epochSeconds / 60)) ).
-- Both the shop backend (login verify) and the panel (display) compute the same
-- value, so the owner reads the current password off the panel with a live
-- countdown. Login accepts the current AND previous 60s window (grace).
--
-- The moment the owner sets a custom password, `admin_pw_rotating` flips to 0
-- and `admin_password_enc` holds that real password permanently (rotation
-- stops). This column is the single source of truth for "how to interpret
-- admin_password_enc".
--
-- Idempotent (MySQL 8 has no ADD COLUMN IF NOT EXISTS, so guard via schema).

SET @col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'admin_pw_rotating'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN admin_pw_rotating TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_password_enc',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
