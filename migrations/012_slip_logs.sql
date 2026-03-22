-- Migration 012: Slip verification logs
-- Stores every verified bank slip to prevent duplicate top-ups
-- (independent safety net on top of EasySlip's own checkDuplicate)

CREATE TABLE IF NOT EXISTS slip_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  trans_ref    VARCHAR(100) NOT NULL,              -- EasySlip rawSlip.transRef (unique per slip)
  amount       DECIMAL(10,2) NOT NULL,
  bank_from    VARCHAR(10)  DEFAULT NULL,          -- sender bank code (e.g. "004" = KBANK)
  bank_to      VARCHAR(10)  DEFAULT NULL,          -- receiver bank code
  sender_name  VARCHAR(255) DEFAULT NULL,
  receiver_name VARCHAR(255) DEFAULT NULL,
  slip_date    DATETIME     DEFAULT NULL,          -- date/time from the slip itself
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_trans_ref (trans_ref),            -- prevents duplicate credits for same slip
  KEY idx_slip_logs_user (user_id),
  KEY idx_slip_logs_created (created_at),
  CONSTRAINT fk_slip_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
