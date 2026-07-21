-- ============================================================
--  032_campaign_points.sql
--  Top-up campaigns + the campaign point loyalty ledger.
--
--  Points are NON-MONETARY. They never appear in `wallets` or
--  `transactions`; those remain Baht-only. Points are a one-way
--  sink: Baht can produce points, points can never produce Baht.
--
--  All DATETIME values are UTC. Window evaluation (daily hours,
--  weekday mask) happens in Node against Asia/Bangkok, never in
--  SQL, so it stays unit-testable.
--  Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  banner_image VARCHAR(500) DEFAULT NULL,
  points_per_baht     DECIMAL(10,4) NOT NULL,
  min_topup_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  starts_at           DATETIME NOT NULL,
  ends_at             DATETIME NOT NULL,
  daily_start_time    TIME DEFAULT NULL,
  daily_end_time      TIME DEFAULT NULL,
  weekday_mask        TINYINT UNSIGNED DEFAULT NULL,
  max_points_per_user INT DEFAULT NULL,
  max_points_budget   INT DEFAULT NULL,
  points_expire_days  INT NOT NULL DEFAULT 30,
  paused     TINYINT(1) NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_window (starts_at, ends_at),
  KEY idx_live (active, paused, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_lots (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  campaign_id INT DEFAULT NULL,
  points_granted   INT NOT NULL,
  points_remaining INT NOT NULL,
  rate_applied DECIMAL(10,4) DEFAULT NULL,
  qualified_at DATETIME NOT NULL,
  expires_at   DATETIME NOT NULL,
  source_transaction_id INT DEFAULT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  revoked_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_grant_once (source_transaction_id, campaign_id),
  KEY idx_user_fifo (user_id, expires_at),
  KEY idx_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_spends (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  redemption_id INT NOT NULL,
  lot_id INT NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_redemption (redemption_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
