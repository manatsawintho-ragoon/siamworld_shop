-- Migration 004: Add redeem_codes table for item code system
CREATE TABLE IF NOT EXISTS redeem_codes (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  command TEXT NOT NULL COMMENT 'RCON command to execute, use {player} as placeholder',
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
