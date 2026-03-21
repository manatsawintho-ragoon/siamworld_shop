-- Migration 003: Add email column to users for password reset
-- Note: MySQL 8.0 does not support ADD COLUMN IF NOT EXISTS; check before running.
-- Run: SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='email';
-- Only run if result is 0:
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL UNIQUE AFTER username;
