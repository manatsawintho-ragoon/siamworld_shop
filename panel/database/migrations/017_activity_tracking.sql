-- Migration 017: Behavioural activity tracking, layered onto the existing audit_logs.
--   category = 'action'   -> accountability rows (wallet ops, settings, slips, ...) — unchanged behaviour.
--   category = 'activity' -> page views + tagged feature clicks, used for usage-hotspot analytics.
-- Activity rows reuse existing columns: action = 'page_view' | 'feature_click',
-- details = normalized path or feature key. The Audit Logs admin view filters to
-- category='action' so it is not drowned by navigation noise.

ALTER TABLE audit_logs
  ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'action' AFTER action;

-- Fast hotspot aggregation + retention pruning.
CREATE INDEX idx_audit_category_created ON audit_logs (category, created_at);
