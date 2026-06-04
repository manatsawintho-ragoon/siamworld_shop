-- 011_subscription_internal_keys.sql
-- Per-subscription shared secret for the deployed shop → panel internal bridge API.
-- The shop sends `Authorization: Bearer <plaintext>` on POST /api/internal/bridge/:subId/...;
-- panel verifies by sha256(plaintext) == internal_key_hash. Plaintext lives only in the
-- shop's .env, never in the panel DB.
USE siamworld_panel;

-- Idempotent ADD COLUMN — MySQL 8.0 doesn't support `IF NOT EXISTS` on ALTER TABLE.
DROP PROCEDURE IF EXISTS _add_internal_key_cols;
DELIMITER //
CREATE PROCEDURE _add_internal_key_cols()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions'
                   AND COLUMN_NAME = 'internal_key_hash') THEN
    ALTER TABLE subscriptions
      ADD COLUMN internal_key_hash       CHAR(64)    NULL,
      ADD COLUMN internal_key_prefix     VARCHAR(16) NULL,
      ADD COLUMN internal_key_rotated_at TIMESTAMP   NULL;
  END IF;
END //
DELIMITER ;
CALL _add_internal_key_cols();
DROP PROCEDURE _add_internal_key_cols;
