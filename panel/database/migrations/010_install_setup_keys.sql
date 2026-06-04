-- 010_install_setup_keys.sql
-- One-time keys for the auto-installer script. A key authorizes:
--   1. fetching the customized setup.sh / setup.ps1 (read-only, can be re-fetched)
--   2. downloading the AuthMe dump exactly once (consumed)
--   3. issuing a bridge token on the customer's behalf at key creation time
-- Keys expire 30 minutes after creation.
USE siamworld_panel;

CREATE TABLE IF NOT EXISTS install_setup_keys (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  subscription_id INT NOT NULL,
  -- sha256 hex of the plaintext key
  key_hash        CHAR(64) NOT NULL UNIQUE,
  -- short prefix (first 8 chars of plaintext) for admin debug
  key_prefix      CHAR(8) NOT NULL,
  -- bridge token issued together with this key (for FK / revoke chain)
  bridge_token_id INT NULL,
  -- the bridge token plaintext, AES-256-GCM encrypted with the setup key as KEK.
  -- DB compromise alone doesn't leak working tokens — the plaintext setup key
  -- is required to decrypt, and that's only known to the customer who fetches.
  enc_bridge_token VARBINARY(255) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP NOT NULL,
  -- when the dump endpoint was hit; null until consumed; null = still usable
  dump_consumed_at TIMESTAMP NULL,
  -- last IP that fetched the script (telemetry only)
  last_script_ip  VARCHAR(45) NULL,
  last_script_at  TIMESTAMP NULL,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (bridge_token_id) REFERENCES bridge_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_install_subscription ON install_setup_keys(subscription_id);
CREATE INDEX idx_install_expires      ON install_setup_keys(expires_at);
