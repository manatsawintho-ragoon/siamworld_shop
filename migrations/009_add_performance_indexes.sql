-- Performance indexes for high-load production
-- Uses procedure to add indexes only if they don't already exist

DROP PROCEDURE IF EXISTS siamworld_add_index;

DELIMITER //
CREATE PROCEDURE siamworld_add_index(
  p_table  VARCHAR(64),
  p_index  VARCHAR(64),
  p_cols   VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = p_table
      AND index_name   = p_index
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` (', p_cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- transactions
CALL siamworld_add_index('transactions', 'idx_reference',  '`reference`');
CALL siamworld_add_index('transactions', 'idx_user_type',  '`user_id`, `type`');
CALL siamworld_add_index('transactions', 'idx_status',     '`status`');

-- purchases
CALL siamworld_add_index('purchases', 'idx_idempotency', '`idempotency_key`');
CALL siamworld_add_index('purchases', 'idx_user_status', '`user_id`, `status`');
CALL siamworld_add_index('purchases', 'idx_server',      '`server_id`');

-- wallet_logs
CALL siamworld_add_index('wallet_logs', 'idx_user_created', '`user_id`, `created_at`');
CALL siamworld_add_index('wallet_logs', 'idx_source',       '`source`');
CALL siamworld_add_index('wallet_logs', 'idx_action',       '`action`');

-- web_inventory
CALL siamworld_add_index('web_inventory', 'idx_user_status', '`user_id`, `status`');

-- redeem_logs (column is redeemed_at, not created_at)
CALL siamworld_add_index('redeem_logs', 'idx_redeemed', '`redeemed_at`');

DROP PROCEDURE IF EXISTS siamworld_add_index;
