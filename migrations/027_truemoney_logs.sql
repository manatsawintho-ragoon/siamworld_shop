-- Migration 027: TrueMoney angpao redemption ledger (dedup guard for top-ups).
-- voucher_hash is UNIQUE so the same angpao can never credit a wallet twice,
-- even under a retry/race. Idempotent.

CREATE TABLE IF NOT EXISTS truemoney_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  voucher_hash VARCHAR(64) NOT NULL UNIQUE,
  amount       DECIMAL(12,2) NOT NULL,
  owner_name   VARCHAR(255) NULL,
  redeemed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tmn_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
