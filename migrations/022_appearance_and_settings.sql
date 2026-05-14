-- ============================================================
--  022_appearance_and_settings.sql
--  Default settings rows for new feature toggles.
--
--  All these read through settings.service so admins can change
--  them without redeploying. Defaults preserve current behavior.
-- ============================================================

INSERT IGNORE INTO settings (`key`, `value`) VALUES
  -- Homepage navigation/widget visibility (1 = show, 0 = hide).
  ('show_lootbox_nav',        '1'),
  ('show_download_nav',       '1'),
  ('show_topup_rank_widget',  '1'),
  ('show_topup_daily_widget', '1'),
  ('show_live_shop_widget',   '1'),
  ('show_popular_widget',     '1'),
  -- Skip the "must be online in-game" gate on purchases/redeems.
  -- 0 = enforce online check (current default), 1 = skip
  ('skip_online_check',       '0'),
  -- Recommended product image dimensions (admin-tunable, shown in upload UI)
  ('product_image_width',     '600'),
  ('product_image_height',    '600'),
  -- SMTP credentials for OTP email. password is stored encrypted via settings.service.
  ('smtp_host',     ''),
  ('smtp_port',     '587'),
  ('smtp_user',     ''),
  ('smtp_password', ''),
  ('smtp_from',     ''),
  ('smtp_secure',   '0');
