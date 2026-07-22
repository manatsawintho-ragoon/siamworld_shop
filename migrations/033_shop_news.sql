-- ============================================================
--  033_shop_news.sql
--  Player-facing news items for the shop homepage hero carousel.
--
--  These are *rendered* slides, not uploaded artwork: the shop owner
--  writes a headline and the carousel draws the card. `image_url` is
--  an optional background, so a news slide costs zero design work.
--
--  Publishing window (starts_at / ends_at) is optional and evaluated
--  in Node against Asia/Bangkok, matching how campaigns do it -- see
--  032_campaign_points.sql. NULL on either side means "unbounded".
--  Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS news (
  id INT NOT NULL AUTO_INCREMENT,
  title      VARCHAR(255) NOT NULL,
  excerpt    VARCHAR(500) DEFAULT NULL,
  -- Short pill rendered above the headline, e.g. 'ใหม่' / 'อัปเดต'.
  badge      VARCHAR(40)  DEFAULT NULL,
  -- Slide tint. Constrained to a named set in the Zod schema so this
  -- never becomes an arbitrary style string on the client.
  accent     VARCHAR(20)  NOT NULL DEFAULT 'primary',
  image_url  VARCHAR(500) DEFAULT NULL,
  link_url   VARCHAR(500) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  starts_at  DATETIME DEFAULT NULL,
  ends_at    DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_live (active, sort_order),
  KEY idx_window (starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Homepage carousel toggles. Both default on so an existing shop that
-- runs a campaign gets the slide without touching settings.
INSERT INTO settings (`key`, `value`)
VALUES ('show_campaign_slide', '1'), ('show_news_slides', '1')
ON DUPLICATE KEY UPDATE `key` = `key`;
