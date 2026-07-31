-- Migration 019: Per-customer web traffic analytics.
--
-- Source is the NGINX Proxy Manager access log written per proxy host, and we
-- run one proxy host per shop. The panel backend mounts NPM's data volume
-- read-only and rolls those lines up into the tables below every 10 minutes.
--
-- Buckets are stored in Asia/Bangkok wall-clock, not UTC. Thailand has never
-- observed DST so UTC+7 is unambiguous for every instant, and storing what the
-- operator will actually read removes the UTC/local conversion drift that has
-- bitten this codebase before.
--
-- NOTE: panel migrations are MANUAL. Apply this before rebuilding the backend,
-- otherwise the new code queries tables that do not exist yet.

-- ── Hourly spine ──────────────────────────────────────────────
-- One table, no separate daily roll-up: 14 shops x 24h x 400d is ~134k rows,
-- which is nothing for MySQL, and day/week/month views are a GROUP BY over
-- this. A second table would only add a job that can drift from its source.
CREATE TABLE IF NOT EXISTS traffic_hourly (
  shop_name    VARCHAR(30) NOT NULL,
  bucket_hour  DATETIME    NOT NULL,
  requests     INT UNSIGNED    NOT NULL DEFAULT 0,
  -- $body_bytes_sent: response body only. Excludes headers and ALL inbound
  -- bytes (slip uploads reach 10MB). This is egress, not total transfer.
  bytes_sent   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  s2xx         INT UNSIGNED NOT NULL DEFAULT 0,
  s3xx         INT UNSIGNED NOT NULL DEFAULT 0,
  s4xx         INT UNSIGNED NOT NULL DEFAULT 0,
  s5xx         INT UNSIGNED NOT NULL DEFAULT 0,
  bot_requests INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_name, bucket_hour),
  KEY idx_traffic_hourly_bucket (bucket_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ── Daily dimensions (top paths / top referrers) ──────────────
-- One table with a `kind` discriminator rather than two near-identical tables:
-- same query shape, same retention, one prune job.
CREATE TABLE IF NOT EXISTS traffic_dim_daily (
  shop_name  VARCHAR(30) NOT NULL,
  bucket_day DATE        NOT NULL,
  kind       ENUM('path','referrer') NOT NULL,
  value      VARCHAR(255) NOT NULL,
  requests   INT UNSIGNED    NOT NULL DEFAULT 0,
  bytes_sent BIGINT UNSIGNED NOT NULL DEFAULT 0,
  s4xx       INT UNSIGNED NOT NULL DEFAULT 0,
  s5xx       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_name, bucket_day, kind, value),
  KEY idx_traffic_dim_prune (bucket_day),
  KEY idx_traffic_dim_top (shop_name, bucket_day, kind, requests)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;

-- ── Ingest cursors ────────────────────────────────────────────
-- inode is stored alongside the offset so logrotate is detectable: NPM rotates
-- weekly with `create` + `kill -USR1` (not copytruncate), so the path gets a new
-- inode and a naive offset would silently skip a week of lines.
CREATE TABLE IF NOT EXISTS traffic_cursor (
  log_file    VARCHAR(255) NOT NULL,
  inode       BIGINT UNSIGNED NOT NULL,
  byte_offset BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (log_file)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ROW_FORMAT=DYNAMIC;
