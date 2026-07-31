-- Shop data archives.
--
-- Teardown used to be unrecoverable: deleteExpired() ran `compose down -v`,
-- which drops the MySQL volume, and the customer's players, wallets, purchase
-- history and settings went with it. The only notice was an email after the
-- fact. A customer who missed a renewal had no way to get their data back and
-- no way to take it elsewhere.
--
-- Every teardown now writes a compressed dump first and records it here, so the
-- owner can download it from the panel for `retention_days` afterwards. The row
-- deliberately outlives the subscription (no FK to subscriptions): the whole
-- point is that it survives the deletion. user_id keeps the ownership link so
-- the customer can still authenticate to their own archive.

CREATE TABLE IF NOT EXISTS shop_archives (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  shop_name     VARCHAR(30)  NOT NULL,
  domain        VARCHAR(255) NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  size_bytes    BIGINT       NOT NULL DEFAULT 0,
  reason        ENUM('expired','admin_delete','manual') NOT NULL DEFAULT 'expired',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    TIMESTAMP    NOT NULL,
  downloaded_at TIMESTAMP    NULL DEFAULT NULL,
  UNIQUE KEY uq_archive_file (file_name),
  KEY idx_archive_user (user_id),
  KEY idx_archive_expiry (expires_at),
  CONSTRAINT fk_archive_user FOREIGN KEY (user_id)
    REFERENCES panel_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
