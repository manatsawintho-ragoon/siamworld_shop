-- 009_turnstile.sql
-- Cloudflare Turnstile CAPTCHA on login + register.
-- All three keys default to empty; the feature is OFF unless an admin sets a site key + secret.
USE siamworld_panel;

INSERT INTO panel_settings (`key`, `value`) VALUES
  ('enable_turnstile',    '0'),
  ('turnstile_site_key',  ''),
  ('turnstile_secret',    '')
ON DUPLICATE KEY UPDATE `key` = `key`;
