-- Migration 003: Add email column to users for password reset
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL UNIQUE AFTER username;
