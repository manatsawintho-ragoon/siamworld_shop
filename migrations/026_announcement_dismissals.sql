-- Migration 026: Per-admin "don't show again" tracking for operator announcements.
-- announcement_id references the PANEL's announcements.id (cross-system, no FK).
-- Idempotent.

CREATE TABLE IF NOT EXISTS announcement_dismissals (
  announcement_id INT NOT NULL,
  admin_user_id   INT NOT NULL,
  dismissed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
