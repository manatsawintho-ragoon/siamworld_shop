-- 007_bridge_tokens.sql
-- Token-authed WebSocket bridge: lets the customer's MC plugin relay
-- AuthMe queries without exposing local MySQL to the internet.
USE siamworld_panel;

CREATE TABLE IF NOT EXISTS bridge_tokens (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  subscription_id INT NOT NULL,
  -- sha256 hex of the plaintext token; plaintext only shown once at issue time
  token_hash      CHAR(64) NOT NULL UNIQUE,
  -- short prefix (first 8 chars of plaintext) so admins can identify a token without unhashing
  token_prefix    CHAR(8) NOT NULL,
  plugin_version  VARCHAR(32) NULL,
  last_seen       TIMESTAMP NULL,
  last_error      VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at      TIMESTAMP NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_bridge_subscription ON bridge_tokens(subscription_id);
CREATE INDEX idx_bridge_active       ON bridge_tokens(subscription_id, revoked_at);
