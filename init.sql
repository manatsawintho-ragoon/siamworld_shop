-- ============================================================
-- SiamWorld Minecraft Shop - Database Schema
-- Multi-server, RCON integration, AuthMe compatible
-- ============================================================
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- AuthMe Table
CREATE TABLE IF NOT EXISTS authme (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  realname VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  ip VARCHAR(40) DEFAULT NULL,
  lastlogin BIGINT DEFAULT 0,
  x DOUBLE DEFAULT 0, y DOUBLE DEFAULT 0, z DOUBLE DEFAULT 0,
  world VARCHAR(255) DEFAULT 'world',
  regdate BIGINT DEFAULT 0, regip VARCHAR(40) DEFAULT NULL,
  yaw FLOAT DEFAULT NULL, pitch FLOAT DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  isLogged SMALLINT DEFAULT 0, hasSession SMALLINT DEFAULT 0,
  totp VARCHAR(32) DEFAULT NULL,
  PRIMARY KEY (id), UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) DEFAULT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY username (username), UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallets (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00,
  PRIMARY KEY (id), UNIQUE KEY user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type ENUM('topup','purchase','refund','redeem_code','admin_adjust') NOT NULL,
  method VARCHAR(50) DEFAULT NULL,
  status ENUM('success','pending','failed') DEFAULT 'pending',
  reference VARCHAR(255) DEFAULT NULL,
  description VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id), KEY idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS servers (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 25565,
  rcon_port INT DEFAULT 25575,
  rcon_password VARCHAR(255) NOT NULL,
  minecraft_version VARCHAR(50) DEFAULT NULL,
  max_players INT DEFAULT 100,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  icon VARCHAR(100) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (id), UNIQUE KEY slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(15,2) NOT NULL,
  original_price DECIMAL(15,2) DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  command TEXT NOT NULL,
  category_id INT DEFAULT NULL,
  featured TINYINT(1) DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category (category_id), KEY idx_active (active), KEY idx_featured (featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_servers (
  product_id INT NOT NULL,
  server_id INT NOT NULL,
  PRIMARY KEY (product_id, server_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  server_id INT NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  status ENUM('pending','delivered','failed','refunded') DEFAULT 'pending',
  rcon_response TEXT DEFAULT NULL,
  idempotency_key VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_idempotency (idempotency_key),
  KEY idx_user_id (user_id), KEY idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (server_id) REFERENCES servers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS truemoney_used (
  id INT NOT NULL AUTO_INCREMENT,
  gift_link VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY gift_link (gift_link),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_logs (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  action ENUM('credit','debit') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  source VARCHAR(50) NOT NULL COMMENT 'topup, purchase, refund, admin',
  reference_id VARCHAR(255) DEFAULT NULL,
  description VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rcon_logs (
  id INT NOT NULL AUTO_INCREMENT,
  server_id INT NOT NULL,
  command VARCHAR(2000) NOT NULL,
  response VARCHAR(2000) DEFAULT NULL,
  status ENUM('success','failed') DEFAULT 'success',
  attempts INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_server_id (server_id),
  KEY idx_created_at (created_at),
  KEY idx_status (status),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT DEFAULT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slides (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) DEFAULT NULL,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS downloads (
  id INT NOT NULL AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  file_size VARCHAR(50) DEFAULT NULL,
  download_url VARCHAR(1000) NOT NULL,
  category VARCHAR(100) DEFAULT '',
  active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Loot Box System ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS loot_boxes (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  price DECIMAL(15,2) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loot_box_items (
  id INT NOT NULL AUTO_INCREMENT,
  loot_box_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  command TEXT NOT NULL COMMENT 'RCON command, use {player} as placeholder',
  weight INT NOT NULL DEFAULT 100 COMMENT 'Higher weight = more likely to drop',
  rarity ENUM('common','uncommon','rare','epic','legendary','mythic') DEFAULT 'common',
  color VARCHAR(20) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loot_box_id (loot_box_id),
  FOREIGN KEY (loot_box_id) REFERENCES loot_boxes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS web_inventory (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  loot_box_id INT NOT NULL,
  loot_box_item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_image VARCHAR(500) DEFAULT NULL,
  item_command TEXT NOT NULL,
  item_rarity VARCHAR(50) DEFAULT 'common',
  status ENUM('PENDING','REDEEMED') DEFAULT 'PENDING',
  won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (loot_box_id) REFERENCES loot_boxes(id),
  FOREIGN KEY (loot_box_item_id) REFERENCES loot_box_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Redeem Code System ──────────────────────────────────

CREATE TABLE IF NOT EXISTS redeem_codes (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  reward_type ENUM('rcon', 'point') NOT NULL DEFAULT 'rcon',
  point_amount DECIMAL(10,2) DEFAULT NULL,
  command TEXT DEFAULT NULL COMMENT 'RCON command to execute, use {player} as placeholder',
  max_uses INT DEFAULT 1 COMMENT '0 = unlimited',
  used_count INT DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY idx_active (active),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redeem_logs (
  id INT NOT NULL AUTO_INCREMENT,
  code_id INT NOT NULL,
  user_id INT NOT NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_code_user (code_id, user_id),
  KEY idx_user_id (user_id),
  FOREIGN KEY (code_id) REFERENCES redeem_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings (required for app to function — customizable via Admin Panel)
INSERT INTO settings (`key`, `value`) VALUES
('shop_name', 'My Minecraft Shop'),
('shop_description', ''),
('welcome_message', ''),
('currency', 'THB'),
('currency_symbol', '฿'),
('maintenance_mode', '0'),
('logo_url', ''),
('discord_webhook_url', ''),
('discord_notify_purchase', '1'),
('discord_notify_topup', '1'),
('discord_invite', ''),
('promptpay_id', ''),
('truemoney_phone', '')
ON DUPLICATE KEY UPDATE `key`=`key`;
