-- Audit log retention policy
-- user_login  → keep 30 days  (high volume, short-term value)
-- admin actions → keep 365 days (low volume, high value)
-- MySQL Event Scheduler runs purge every night at 02:00

DROP EVENT IF EXISTS evt_audit_log_purge;

CREATE EVENT evt_audit_log_purge
  ON SCHEDULE EVERY 1 DAY
  STARTS (DATE(NOW()) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
  COMMENT 'Purge old audit_logs by tiered retention policy'
  DO
    DELETE FROM audit_logs
    WHERE
      (action_type = 'user_login'  AND created_at < NOW() - INTERVAL 30  DAY)
   OR (action_type != 'user_login' AND created_at < NOW() - INTERVAL 365 DAY);
