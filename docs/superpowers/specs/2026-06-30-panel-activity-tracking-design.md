# Panel Activity Tracking (Usage Hotspots) — Design

**Date:** 2026-06-30
**Surface:** Panel only (`panel.siamsite.shop`)
**Status:** Approved, implementing

## Goal

Extend the panel's existing `audit_logs` (which only records mutating admin/customer
*actions*) to also capture **behavioral telemetry** — page views and key feature clicks
by logged-in panel users (customers = shop owners, and admins) — so admins can see
**usage hotspots**: which pages/features get used, which are dead.

## Scope decisions (locked)

- **Surface:** the logged-in panel area only — customer `/dashboard/*` and `/admin/*`.
  Anonymous public/marketing pages (`/`, `/lp/*`, `/solutions`) are **not** tracked
  (avoids anonymous-visitor tracking + extra privacy surface). Can revisit later.
- **Depth:** *semantic* events, not a pixel heatmap.
  - `page_view` — fired automatically on every route change inside the panel.
  - `feature_click` — fired only for elements tagged `data-track="<feature_key>"`.
  No mouse coordinates, scroll depth, input values, or time-on-page.
- **Storage:** extend the existing `audit_logs` table (no new table), distinguished by a
  new `category` column.

Rationale: the panel has ~tens of customers, not millions. Semantic events answer the
hotspot question directly at a fraction of the storage/complexity of a coordinate heatmap,
and keep cardinality + PII controlled.

## Data model

One migration adds a `category` column to `audit_logs`:

- `category = 'action'` (DEFAULT) — existing accountability rows. **Unchanged.**
- `category = 'activity'` — new telemetry rows.

Activity rows reuse existing columns:

| column      | meaning for activity rows                                   |
|-------------|-------------------------------------------------------------|
| `user_id`   | the logged-in panel user                                    |
| `action`    | `page_view` or `feature_click`                              |
| `category`  | `activity`                                                  |
| `details`   | normalized path (page_view) or feature key (feature_click)  |
| `ip_address`| request IP                                                  |
| `created_at`| event time                                                  |

Index: `(category, created_at)` for fast hotspot aggregation + retention pruning.

The existing **Audit Logs** admin page filters to `category='action'` by default so it
stays clean and is not drowned by navigation noise.

## Components

### Backend

1. **Migration `017_activity_tracking.sql`** + matching update to `init.sql`:
   add `category` column + `idx_audit_category_created` index.
2. **`activity.service.ts`**
   - `ALLOWED_FEATURES: Set<string>` — allowlist of feature keys (controls cardinality /
     blocks abuse). Events with unknown keys are silently dropped, not errored.
   - `normalizePath(p)` — strip query/hash, collapse numeric id segments to `:id`,
     cap length, allowlist `/dashboard` and `/admin` prefixes only.
   - `recordEvents(userId, ip, events[])` — validate + bulk-insert `category='activity'`
     rows. Best-effort (never throws to caller).
   - `getHotspots({ from, to, userId? })` — aggregate queries:
     top pages by views, top features by clicks, totals, unique active users.
   - `pruneActivity(days)` — delete `category='activity'` rows older than N days.
3. **`activity.routes.ts`** mounted at `/api/activity`:
   - `POST /api/activity` (`requireAuth`) — body `{ events: [...] }`, Zod-validated,
     batch capped (≤30), small-json. Returns `204`. Designed for `sendBeacon`.
4. **Admin read endpoint** in `admin.routes.ts` (already `router.use(requireAdmin)`):
   - `GET /api/admin/activity-hotspots?from&to&userId` → aggregates from `getHotspots`.
5. **Retention:** call `pruneActivity(90)` from the existing daily cron (alongside the
   suspend/notify jobs). `category='action'` rows are never pruned by this.

### Frontend

1. **`lib/track.ts`** — tiny tracker singleton: in-memory queue, `trackPageView(path)`,
   `trackFeature(key)`, flush via `navigator.sendBeacon('/api/activity', ...)` (cookie
   auth, same-origin) with a `fetch(..., {keepalive:true})` fallback. Flushes on batch
   threshold, an interval, and `pagehide`/`visibilitychange`.
2. **`components/ActivityTracker.tsx`** — mounted in `app/layout.tsx` inside
   `AuthProvider`. When a user is logged in: fires `page_view` on `usePathname()` change
   (panel area only) and attaches one delegated `click` listener for `[data-track]`.
3. **`data-track` attributes** on a curated set of key buttons (renew, topup methods,
   domain connect, support submit, profile save, credential regenerate, etc.) — kept in
   sync with `ALLOWED_FEATURES`.
4. **Admin Hotspots page `app/admin/activity/page.tsx`** — top pages, top features,
   date-range filter, optional per-customer filter. Built with the existing
   Card/Badge/motion design system. Nav link added to `app/admin/layout.tsx` (System
   group) + `PageTitle` mapping.

## Privacy / safety

- Only logged-in panel users tracked (user_id + ip already stored for audit rows today).
- Feature keys are an allowlist; paths are normalized + prefix-restricted; no free-form
  user content captured.
- `POST /api/activity` is best-effort and rate-limited by the existing global limiter;
  malformed/oversized batches are rejected by Zod, unknown feature keys dropped.

## Out of scope (YAGNI)

Pixel/coordinate heatmaps, scroll depth, time-on-page, anonymous/public-page tracking,
real-time dashboards. Addable later if genuinely needed.
