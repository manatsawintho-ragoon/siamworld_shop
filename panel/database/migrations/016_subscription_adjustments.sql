-- Migration 016: Manual time adjustments (+/-) on a subscription's expiry.
-- Used for compensation, special promotions, or corrections. One row per adjustment.
-- Doubles as the queue for the optional customer popup (notify_customer + customer_seen_at).
-- Idempotent.

CREATE TABLE IF NOT EXISTS subscription_adjustments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id  INT NOT NULL,
  admin_user_id    INT NULL,
  delta_days       INT NOT NULL,
  old_expires_at   TIMESTAMP NULL,
  new_expires_at   TIMESTAMP NULL,
  category         VARCHAR(20) NULL,
  reason           TEXT NULL,
  notify_customer  TINYINT(1) NOT NULL DEFAULT 0,
  customer_seen_at TIMESTAMP NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub (subscription_id),
  INDEX idx_notify (subscription_id, notify_customer, customer_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
