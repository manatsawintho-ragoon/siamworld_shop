-- 012_terms_acceptance.sql
-- Record each panel user's acceptance of the legal terms at signup, so we can
-- prove which version of the policies they agreed to (PDPA / e-transaction
-- evidence). Set by auth.service.register on account creation.
USE siamworld_panel;

-- Idempotent ADD COLUMN — MySQL 8.0 doesn't support `IF NOT EXISTS` on ALTER TABLE.
DROP PROCEDURE IF EXISTS _add_terms_acceptance_cols;
DELIMITER //
CREATE PROCEDURE _add_terms_acceptance_cols()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panel_users'
                   AND COLUMN_NAME = 'terms_accepted_at') THEN
    ALTER TABLE panel_users
      ADD COLUMN terms_accepted_at DATETIME    NULL,
      ADD COLUMN terms_version     VARCHAR(20) NULL;
  END IF;
END //
DELIMITER ;
CALL _add_terms_acceptance_cols();
DROP PROCEDURE IF EXISTS _add_terms_acceptance_cols;
