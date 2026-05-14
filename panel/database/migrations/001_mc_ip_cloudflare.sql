-- Migration 001: Add mc_ip to subscriptions + Cloudflare settings
-- Run once on existing installations:
--   docker exec -i <panel-mysql-container> mysql -u root -p<password> siamworld_panel < migrations/001_mc_ip_cloudflare.sql

USE siamworld_panel;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS mc_ip VARCHAR(45) NULL AFTER mysql_exposed_port;

INSERT INTO panel_settings (`key`, `value`) VALUES
  ('cloudflare_api_key', ''),
  ('cloudflare_email',   ''),
  ('cloudflare_zone_id', ''),
  ('server_ip',          '')
ON DUPLICATE KEY UPDATE `key` = `key`;
