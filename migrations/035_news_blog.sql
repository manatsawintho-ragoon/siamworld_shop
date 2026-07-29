-- ============================================================
--  035_news_blog.sql
--  Reworks News from "extra hero-carousel slides" (033) into a real
--  blog: an index page, per-article pages with their own image
--  carousel or one embedded video, publish scheduling, and read
--  tracking for patch notes.
--
--  033 modelled news as carousel slides. That was the wrong shape:
--  News is a reading surface and must be separate from the hero
--  slideshow. The carousel that belongs to News is the one INSIDE an
--  article (several images, like product extra images), which is what
--  news_media provides.
--
--  Idempotent.
-- ============================================================

-- ── news: slide columns out, blog columns in ──────────────────
DROP PROCEDURE IF EXISTS rework_news_to_blog;
DELIMITER //
CREATE PROCEDURE rework_news_to_blog()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news' AND COLUMN_NAME = 'slug'
  ) THEN
    ALTER TABLE news
      ADD COLUMN slug VARCHAR(200) NULL AFTER id,
      ADD COLUMN body MEDIUMTEXT NULL DEFAULT NULL AFTER excerpt,
      ADD COLUMN category ENUM('update','event','maintenance','patch','general')
        NOT NULL DEFAULT 'general' AFTER body,
      ADD COLUMN cover_image VARCHAR(500) NULL DEFAULT NULL AFTER category,
      ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER cover_image,
      ADD COLUMN published_at DATETIME NULL DEFAULT NULL AFTER pinned,
      ADD COLUMN view_count INT NOT NULL DEFAULT 0 AFTER published_at,
      ADD COLUMN author_id INT NULL DEFAULT NULL AFTER view_count,
      ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER author_id;

    -- ends_at already means "stop showing", which is exactly expires_at.
    -- Rename FIRST so the idx_published index below can reference expires_at.
    ALTER TABLE news CHANGE COLUMN ends_at expires_at DATETIME NULL DEFAULT NULL;

    -- Carry 033's data across before the old columns go.
    -- `active = 0` meant "not shown", which in blog terms is an unpublished
    -- draft, so those rows must NOT get a published_at.
    UPDATE news SET published_at = COALESCE(starts_at, created_at) WHERE active = 1;
    UPDATE news SET cover_image = image_url WHERE image_url IS NOT NULL;
    UPDATE news SET slug = CONCAT('post-', id) WHERE slug IS NULL;

    ALTER TABLE news
      MODIFY COLUMN slug VARCHAR(200) NOT NULL,
      ADD UNIQUE KEY idx_slug (slug),
      ADD KEY idx_published (published_at, expires_at, deleted_at),
      ADD KEY idx_pinned (pinned, published_at);

    -- Slide-only columns. Nothing reads them once the hero carousel stops
    -- rendering news.
    ALTER TABLE news
      DROP COLUMN badge,
      DROP COLUMN accent,
      DROP COLUMN link_url,
      DROP COLUMN sort_order,
      DROP COLUMN image_url,
      DROP COLUMN active,
      DROP COLUMN starts_at;
  END IF;
END //
DELIMITER ;
CALL rework_news_to_blog();
DROP PROCEDURE rework_news_to_blog;

-- ── news_media: the in-article carousel ───────────────────────
-- Up to 3 images OR exactly one video, never mixed. Enforced in Zod, not here,
-- because the rule is "either/or across rows" which a table constraint cannot
-- express cleanly.
--
-- For type='youtube', `url` stores ONLY the bare 11-char video id. Never a
-- full URL and never an embed string: the id is re-wrapped server-side into a
-- youtube-nocookie embed, which is what keeps a pasted <iframe> from becoming
-- stored XSS.
CREATE TABLE IF NOT EXISTS news_media (
  id INT NOT NULL AUTO_INCREMENT,
  news_id INT NOT NULL,
  type ENUM('image','youtube') NOT NULL,
  url VARCHAR(500) NOT NULL,
  caption VARCHAR(255) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_news (news_id, sort_order),
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── news_reads: who has actually read a post ──────────────────
-- One row per (post, player). The PK makes recording a read idempotent, so a
-- refresh cannot inflate the reader list - which is why "readers" is the
-- honest metric and view_count (refresh-inflatable) is only ever labelled
-- "views" (design B8).
CREATE TABLE IF NOT EXISTS news_reads (
  news_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (news_id, user_id),
  KEY idx_user (user_id, read_at),
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The hero carousel no longer renders news, so this toggle is dead. The
-- campaign slide toggle stays: that one is still live.
DELETE FROM settings WHERE `key` = 'show_news_slides';
