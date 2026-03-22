-- Audit log table for all website activity
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGINT       AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  username   VARCHAR(50)  NOT NULL,
  role       VARCHAR(20)  NOT NULL DEFAULT 'admin',
  action_type VARCHAR(60) NOT NULL,
  description TEXT        NOT NULL,
  amount     DECIMAL(12,2) NULL,
  ref_id     VARCHAR(255) NULL,
  meta       JSON         NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id     (user_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
