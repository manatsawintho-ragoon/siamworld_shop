-- Migration 003: Add email column to users for password reset
-- Idempotent: only adds column if missing.

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER username',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
