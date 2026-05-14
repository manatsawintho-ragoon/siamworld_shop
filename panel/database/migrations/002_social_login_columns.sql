-- Add social login columns to panel_users (run only if not already applied)
ALTER TABLE panel_users
  ADD COLUMN google_id   VARCHAR(255) NULL AFTER role,
  ADD COLUMN facebook_id VARCHAR(255) NULL AFTER google_id,
  ADD COLUMN avatar_url  TEXT         NULL AFTER facebook_id;

CREATE INDEX idx_panel_users_google_id   ON panel_users(google_id);
CREATE INDEX idx_panel_users_facebook_id ON panel_users(facebook_id);
