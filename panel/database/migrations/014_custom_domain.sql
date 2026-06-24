-- panel/database/migrations/014_custom_domain.sql
-- Custom domain (BYOD) support for subscriptions.
ALTER TABLE subscriptions
  ADD COLUMN custom_domain VARCHAR(255) NULL,
  ADD COLUMN custom_hostname_id VARCHAR(64) NULL,
  ADD COLUMN custom_domain_status ENUM('pending_dns','pending_ssl','active','failed') NULL,
  ADD COLUMN custom_domain_added_at DATETIME NULL;

-- Unique when set (MySQL allows multiple NULLs in a UNIQUE index).
CREATE UNIQUE INDEX uq_subscriptions_custom_domain ON subscriptions (custom_domain);
