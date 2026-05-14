-- 005_vouchers.sql
CREATE TABLE IF NOT EXISTS vouchers (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  code            VARCHAR(50) UNIQUE NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  max_uses        INT NOT NULL DEFAULT 1,
  current_uses    INT NOT NULL DEFAULT 0,
  created_by      INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES panel_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  voucher_id  INT NOT NULL,
  user_id     INT NOT NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_redemption (voucher_id, user_id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES panel_users(id) ON DELETE CASCADE
);

ALTER TABLE wallet_transactions MODIFY COLUMN type ENUM('topup','renewal','purchase','refund','manual_credit','manual_debit','voucher') NOT NULL;
