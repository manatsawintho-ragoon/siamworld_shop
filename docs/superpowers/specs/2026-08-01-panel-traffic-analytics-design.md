# Panel Traffic Analytics — Design

**Date:** 2026-08-01
**Branch:** `feat/panel-traffic-analytics`
**Status:** approved, ready for implementation

## Goal

Give the operator a panel surface showing how much web traffic each customer
shop is actually serving: a cross-customer overview to spot the big, the dead
and the abused, and a per-shop drill-down explaining why a shop looks the way
it does.

Operator-only. Customers do not see this. No customer-facing i18n or
customer-safe metric filtering is in scope.

## Data source

NGINX Proxy Manager already writes one access log per proxy host, and there is
one proxy host per shop:

```
/data/logs/proxy-host-<id>_access.log
```

Format (confirmed from `/etc/nginx/conf.d/include/log-proxy.conf`):

```
[$time_local] $upstream_cache_status $upstream_status $status - $request_method
$scheme $host "$request_uri" [Client $remote_addr] [Length $body_bytes_sent]
[Gzip $gzip_ratio] [Sent-to $server] "$http_user_agent" "$http_referer"
```

Sample line:

```
[31/Jul/2026:17:53:30 +0000] - 200 200 - GET https gfloorsmp.siamsite.shop "/favicon.ico" [Client 172.68.4.221] [Length 14908] [Gzip -] [Sent-to 172.18.0.1] "Mozilla/5.0 (iPhone...)" "-"
```

Volume is small: the busiest shop writes ~2.7MB/day.

The log line carries `$host`, so a shop is identified by hostname rather than
by proxy-host id. That means BYOD custom domains map correctly with no extra
work, and no dependency on NPM's own database.

### Rejected alternatives

- **Cloudflare GraphQL Analytics API.** Would give real unique visitors,
  countries and bot scores with no parsing or storage. Rejected because it
  depends on the stored API key carrying Analytics scope, has Free-plan
  retention and sampling limits, gives no path-level detail, and adds an
  external dependency to a panel page. The NPM logs are already on disk and
  fully under our control.
- **In-shop beacon.** Would require rebuilding every shop image and would only
  ever see traffic that successfully reached a working shop.

## Plumbing

NPM's data is a named docker volume, `nginx-proxy-manager_npm_data`. The panel
backend mounts it **read-only**:

```yaml
# deploy/panel-compose.yml, service panel-backend
volumes:
  - npm_data:/npm-data:ro

volumes:
  npm_data:
    external: true
    name: nginx-proxy-manager_npm_data
```

Read-only is a deliberate safety property, not just least privilege: CLAUDE.md
records that truncating a live container log desyncs the docker daemon's log
reader and hangs `docker logs` until the container restarts, with no self-heal.
A read-only mount makes that class of mistake structurally impossible here.

## Backend structure

| File | Responsibility | Depends on |
|---|---|---|
| `utils/trafficLog.ts` | Pure functions: `parseProxyLine`, `normalizePath`, `isBotUA`, `refererLabel`, `bucketHour`, `bucketDay`. No I/O. | nothing |
| `services/traffic/log-cursor.ts` | Per-file read position, rotation handling, bounded reads. | `fs` |
| `services/traffic/traffic.service.ts` | Orchestration, aggregation, upserts, and the read queries the routes call. | both above |

The pure module lives in `utils/` rather than beside the service because that is
where this codebase already keeps pure helpers with tests (`customDomain.ts`,
`lifecycle.ts`, `activity-events.ts`). Its having zero I/O is what makes the
risky part (a regex against a log format we do not control) cheap to test
exhaustively: it is verified against 382,296 real captured lines at a 99.999%
parse rate.

### Rotation handling

The naive approach — remember a byte offset, read from there next time — loses
data every time logrotate runs, because the file we resume reading is a new,
empty one. `log-cursor.ts` therefore stores **inode plus offset**. On each poll:

1. `stat` the live log.
2. If the inode is unchanged and size >= offset, read from offset. Normal case.
3. If the inode changed, or size < offset, the file rotated. Read the remainder
   of `<file>.1.gz` from the old offset to its end, then read the new live file
   from 0. This recovers the lines written between the last poll and the
   rotation, instead of silently undercounting once per day.

Each poll is capped at a maximum byte count per file so a runaway log cannot
exhaust panel memory.

### Idempotency

Rollup upserts are `ON DUPLICATE KEY UPDATE requests = requests + VALUES(...)`,
which is not naturally idempotent: a re-run would inflate counts. Two guards:

- The cursor advance and the rollup upserts happen in **one transaction per
  file**, so a crash mid-poll rolls back both together and the next poll
  re-reads exactly the same bytes once.
- The cron job runs under the existing `withRedisLock` primitive, so two
  replicas cannot ingest concurrently.

### Backfill

On first sight of a log file (no cursor row), the ingester reads that host's
available rotated `.gz` files oldest-to-newest before reading the live file.
About 30 days of history already sits in `/data/logs`, the parser is identical,
and without this the feature is empty for a week after deploy. Bounded by the
same per-poll byte cap.

## Schema

Migration `panel/database/migrations/019_traffic_analytics.sql`.

**Panel migrations are manual — there is no auto-runner.** It must be applied by
hand against `panel-mysql`, and applied *before* the backend rebuild.

Three tables, all keyed on `shop_name VARCHAR(30)`, **with no foreign key**:

```
traffic_hourly    (shop_name, bucket_hour, requests, bytes_sent,
                   s2xx, s3xx, s4xx, s5xx, bot_requests)
                   PK (shop_name, bucket_hour)

traffic_dim_daily (shop_name, bucket_day, kind ENUM('path','referrer'), value,
                   requests, bytes_sent, s4xx, s5xx)
                   PK (shop_name, bucket_day, kind, value)

traffic_cursor    (log_file PK, inode, byte_offset, updated_at)
```

### Why no foreign key

`notification.service.ts:119` runs `DELETE FROM subscriptions WHERE id=?` when a
shop is torn down. An FK with `ON DELETE CASCADE` would erase a shop's traffic
history at precisely the moment an operator most wants it — answering "was this
shop being used at all before it churned?". Keying on `shop_name` and letting
history outlive the subscription matches the existing `shop_archives`
precedent. The UI left-joins `subscriptions` to enrich rows with status and
domain, and renders unmatched shops with a "ลบแล้ว" badge.

### Why one hourly table instead of hourly plus daily

14 shops x 24 hours x 400 days is roughly 134k rows, which is nothing for
MySQL. Day, week and month views are a `GROUP BY` over the same table. A second
daily roll-up table would add a job that can drift out of sync with its source
for no measurable benefit.

### Why paths and referrers share a table

Same query shape, same retention, same prune job. A `kind` discriminator is
cheaper than a second table that differs only in what the string column means.

### Cardinality control

`normalizePath` strips query strings and collapses numeric path segments
(`/admin/users/123` -> `/admin/users/:id`). Without this, `/_next/image?url=...`
alone would generate thousands of distinct rows per shop per day. The daily
prune then caps `traffic_dim_daily` at the top 50 values per shop per day per
kind.

That cap must rank with an explicit tiebreak. The obvious implementation, "find
the request count in 50th place and delete everything below it", bounds nothing
in practice: a shop being probed by scanners has a long tail of paths tied at
one request each, so the cutoff is 1, `requests < 1` matches no rows, and the
group keeps growing. Ranking by `(requests DESC, value ASC)` with `ROW_NUMBER`
makes the cap real.

### Retention

- `traffic_hourly`: 400 days.
- `traffic_dim_daily`: 30 days.

Both pruned by the existing 04:00 cron job, alongside the activity prune.

## Ingestion schedule

New cron entry, every 10 minutes, under
`withRedisLock('panel_cron_lock:traffic_ingest', ...)`.

## API

Added to `admin.routes.ts` behind `requireAdmin`, mirroring `/storage`:

- `GET /api/admin/traffic/overview?days=7`
  One row per shop: requests, bytes_sent, 4xx, 5xx, bot share, daily sparkline
  series. Plus fleet totals.
- `GET /api/admin/traffic/:shopName?days=30`
  Hourly series, status mix, top paths, top referrers, bot split, peak hour.

## Frontend

`panel/frontend/src/app/(operator)/admin/traffic/page.tsx` and
`.../traffic/[shopName]/page.tsx`. Sidebar entry added to `admin/layout.tsx`.

Recharts 3.8.1 is already a dependency. `chart-area` already exists in the
`components/ui/icon.tsx` registry, which is the panel's dominant convention
(37 files use the registry, 4 import lucide directly).

**Overview:** four stat tiles (total requests, total egress, error rate, bot
share) above a sortable table with a per-shop sparkline; a row opens the
drill-down.

**Drill-down:** requests area chart with hour/day toggle, stacked status-mix
chart, top-paths table, top-referrers table.

Range selector 24h / 7d / 30d / 90d, matching the activity page's existing
7/30/90 pattern.

Conventions: Thai copy, no em dashes in user-visible strings, Icon registry
rather than direct lucide imports, THEME.md for admin styling, and no
`data-theme-portal` / `.frontend-page` (the panel admin must not follow a
customer theme).

## Stated limits

These are surfaced in the UI rather than papered over, because a traffic number
that quietly means something other than what it says is worse than no number:

- **`$body_bytes_sent` is response body only.** It excludes response headers and
  excludes all *inbound* bytes, including slip image uploads of up to 10MB. The
  column is labelled ส่งออก (egress), never "bandwidth" or "transfer".
- **Cloudflare-cached responses never reach the origin.** These figures are
  origin load, not true visitor traffic. The page says so.
- **Client IP is a Cloudflare edge IP.** `nginx.conf` sets
  `real_ip_header X-Real-IP`, but Cloudflare sends `CF-Connecting-IP`, so every
  request logs a CF address. There is therefore no unique-visitor and no country
  metric. The upgrade path, if ever wanted, is a one-line
  `real_ip_header CF-Connecting-IP;` in `/data/nginx/custom/http.conf` — a
  persistent, upgrade-safe hook that nginx.conf includes *after* its own
  directive. Not in scope.

## Testing

- `parseProxyLine` against real fixture lines: the `-` upstream_status, a `"-"`
  referer, IPv6 clients, request URIs containing quotes and spaces, and
  malformed lines that must return `null` rather than throw.
- `normalizePath`, `isBotUA`, `refererLabel` and the Bangkok bucketing.
- Cursor rotation: write a temp log, read it, rotate it, assert no gap and no
  double-count. Rotation fixtures follow logrotate's real order (rename, then
  create, then compress), because unlink-then-create lets the filesystem reuse
  the inode and models a sequence that cannot occur here.
- Cursor partial lines: a trailing incomplete line is neither parsed nor
  consumed, and is emitted exactly once after it is completed.
- Bulk-upsert parameter shape: `VALUES ?` expands one array level into a row
  list, and the doubly-wrapped form that broke the first deploy is kept
  executable alongside it so the distinction stays visible.
- Ingest idempotency: verified against production data. A second pass over the
  same logs parsed 0 lines and left all counters byte-identical.

## Deploy order

1. Apply migration 019 to `panel-mysql` by hand.
2. Add the `npm_data` mount to `panel-compose.yml`.
3. Rebuild the panel.

Migration first, because the rebuild builds code before it would ever migrate,
and a backend that queries missing tables logs errors on boot.

Two recorded panel-deploy traps apply: building `panel-frontend` drags
`panel-backend` into a recreate, and a `<hash>_panel-backend` name conflict
looks like a failure while the container actually came up — check `docker ps`
before re-running anything.
