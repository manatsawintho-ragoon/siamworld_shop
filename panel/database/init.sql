-- ============================================================
--  Siamsite Panel — Database Schema
--  Panel DB: separate from customer shop databases
-- ============================================================

CREATE DATABASE IF NOT EXISTS siamworld_panel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE siamworld_panel;

-- ── Panel Users (customers who buy hosting) ──────────────────
CREATE TABLE IF NOT EXISTS panel_users (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(100) NOT NULL,
  phone            VARCHAR(20),
  wallet_balance   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  line_notify_token VARCHAR(255),
  role             ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Subscriptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  user_id             INT NOT NULL,
  shop_name           VARCHAR(30) NOT NULL UNIQUE,
  domain              VARCHAR(255) NOT NULL UNIQUE,
  frontend_port       INT NOT NULL,
  backend_port        INT NOT NULL,
  mysql_exposed_port  INT NOT NULL,
  package_months      INT NOT NULL,
  price_paid          DECIMAL(10,2) NOT NULL,
  starts_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at          TIMESTAMP NOT NULL,
  status              ENUM('pending','deploying','active','suspended','expired','cancelled') NOT NULL DEFAULT 'pending',
  mc_ip               VARCHAR(45) NULL,
  deploy_log          TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renewed_at          TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE
);

-- ── Wallet Transactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  user_id        INT NOT NULL,
  type           ENUM('topup','renewal','purchase','refund','manual_credit','manual_debit','voucher') NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  balance_after  DECIMAL(10,2) NOT NULL,
  description    VARCHAR(255),
  reference_id   VARCHAR(100),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE
);

-- ── Payment Slips ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_slips (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  user_id           INT NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  slip_image_base64 MEDIUMTEXT NOT NULL,
  easyslip_ref      VARCHAR(255),
  easyslip_raw      JSON,
  status            ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  purpose           ENUM('topup','subscription') NOT NULL,
  subscription_id   INT,
  reject_reason     VARCHAR(255),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at       TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- ── Expiry Notifications Log (prevent duplicate sends) ────────
CREATE TABLE IF NOT EXISTS expiry_notifications (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  subscription_id INT NOT NULL,
  days_before     INT NOT NULL,
  sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_notif (subscription_id, days_before),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- ── Audit Logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT,
  action      VARCHAR(100) NOT NULL,
  category    VARCHAR(20) NOT NULL DEFAULT 'action', -- 'action' = accountability, 'activity' = page_view/feature_click telemetry
  target_type VARCHAR(50),
  target_id   INT,
  details     TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE SET NULL,
  INDEX idx_audit_category_created (category, created_at)
);

-- ── Panel Settings (key-value) ────────────────────────────────
CREATE TABLE IF NOT EXISTS panel_settings (
  `key`       VARCHAR(100) PRIMARY KEY,
  `value`     TEXT,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_subscriptions_user    ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at, status);
CREATE INDEX idx_wallet_txn_user       ON wallet_transactions(user_id);
CREATE INDEX idx_payment_slips_user    ON payment_slips(user_id, status);

-- ── Default Settings ──────────────────────────────────────────
INSERT INTO panel_settings (`key`, `value`) VALUES
  ('panel_name',           'Siamsite Panel'),
  ('panel_domain',         'siamsite.shop'),
  ('promptpay_id',         ''),
  ('promptpay_name',       ''),
  ('easyslip_api_key',     ''),
  ('price_1month',         '350'),
  ('price_3months',        '945'),
  ('price_6months',        '1785'),
  ('npm_url',              'http://localhost:81'),
  ('npm_email',            ''),
  ('npm_password',         ''),
  ('line_notify_token',    ''),
  ('notify_days_before',   '7,3,1'),
  ('auto_suspend_days',    '3'),
  ('cloudflare_api_key',   ''),
  ('cloudflare_email',     ''),
  ('cloudflare_zone_id',   ''),
  ('server_ip',            '')
ON DUPLICATE KEY UPDATE `key` = `key`;

-- ── Operator announcements (broadcast to all shop admins; see migration 013) ──
CREATE TABLE IF NOT EXISTS announcements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  level        ENUM('info','update','important') NOT NULL DEFAULT 'update',
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at TIMESTAMP NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_published (is_published, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
