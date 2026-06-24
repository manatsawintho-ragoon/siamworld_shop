-- Migration 015: Admin-managed landing-page feature showcase.
-- The "ตัวอย่างฟีเจอร์" slider on the landing page is editable from the admin UI
-- (title, description, image). Image is stored as a base64 data URL (same approach
-- as payment_slips) so no file-storage/volume is required. Idempotent.

CREATE TABLE IF NOT EXISTS landing_showcase (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  image_data  LONGTEXT NOT NULL,            -- data URL (data:image/...;base64,....)
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
