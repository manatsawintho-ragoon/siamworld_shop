-- Migration: Add wallet_logs and rcon_logs tables
-- Run this if upgrading from previous version (tables already exist)

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
