# Operator Announcements → Shop Admin Popup — Design

**Date:** 2026-06-20
**Scope:** Panel (author + serve) + every customer shop admin (display + dismiss).

## Problem

When the operator ships an update, every customer should learn about it in their
shop admin panel via a popup on entry, with a "don't show again" checkbox. The
operator must publish once centrally, with no per-shop hardcoding.

## Decisions (confirmed)

1. **Approach A** — panel is the source of truth; shops fetch and display.
2. **Realtime feel via polling** — shop admin polls every ~15s + on window focus
   + on route change. No fan-out, no bridge dependency.
3. **"Don't show again" per admin, stored in the shop DB.**
4. **Broadcast to all shops always** (no targeting).

## Architecture

```
Operator → Panel admin UI → panel.announcements (DB)
                                  │  GET /api/announcements/active  (open read, published only)
                                  ▼
Shop backend (poll, cached 12s) ──┘  via http://host.docker.internal:5000
   │  GET /api/admin/announcements  (active minus this admin's dismissals)
   │  POST /api/admin/announcements/:id/dismiss
   ▼
Shop admin frontend → useAnnouncements (poll 15s + focus + nav) → AnnouncementPopup
```

All shops reach `host.docker.internal:5000` (verified; `extra_hosts: host-gateway`
in `docker-compose.customer.yml`). Bridge is NOT used — many shops lack it
(e.g. yokaicraft has no `PANEL_BRIDGE_URL`).

## Panel side

### DB — `panel/database/migrations/013_announcements.sql` + `init.sql`
```sql
CREATE TABLE IF NOT EXISTS announcements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  body         TEXT NOT NULL,
  level        ENUM('info','update','important') NOT NULL DEFAULT 'update',
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at TIMESTAMP NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### `announcement.service.ts`
`listAll()`, `create()`, `update()`, `setPublished(id, bool)` (sets/clears
`published_at`), `remove(id)`, `listActive()` (published only, newest first).

### Routes
- Author (admin-only, under `/api/admin/announcements`): list, create, update,
  publish/unpublish, delete. Registered in panel `admin.routes.ts`.
- Read for shops: `GET /api/announcements/active` — **open read**, returns only
  published announcements (id, title, body, level, published_at). Low-sensitivity
  broadcast content; avoids adding a secret to 9 existing shop envs. New
  `announcement.routes.ts`, registered in `server.ts`.

### Panel admin UI
New page `panel/frontend/src/app/admin/announcements/page.tsx`: list + create/edit
form (title, body textarea, level select), publish/unpublish toggle, delete. Link
from the admin nav.

## Shop side

### DB — `migrations/026_announcement_dismissals.sql` (idempotent)
```sql
CREATE TABLE IF NOT EXISTS announcement_dismissals (
  announcement_id INT NOT NULL,           -- panel announcement id (no FK, cross-system)
  admin_user_id   INT NOT NULL,
  dismissed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
Applied automatically by `apply-migrations.sh` on rebuild.

### `announcement.service.ts`
- `fetchActiveFromPanel()` — GET `host.docker.internal:5000/api/announcements/active`
  with a short timeout; in-memory cache (TTL ~12s) so 15s polls from multiple
  admins don't hammer panel. Best-effort: on error returns last cache or `[]`.
- `listForAdmin(adminUserId)` — active list minus rows in `announcement_dismissals`
  for that admin.
- `dismiss(announcementId, adminUserId)` — `INSERT IGNORE`.
- Panel base URL from `PANEL_ANNOUNCE_URL` env, default `http://host.docker.internal:5000`.

### Routes (`/api/admin`, requireAdmin)
- `GET /admin/announcements` → `listForAdmin(req.user.userId)`
- `POST /admin/announcements/:id/dismiss` → `dismiss(id, req.user.userId)`

### Frontend
- `hooks/useAnnouncements.ts` — fetch on mount, `setInterval` 15s, `focus` +
  `visibilitychange` + pathname-change listeners. Exposes `announcements`,
  `dismiss(id)`.
- `components/AnnouncementPopup.tsx` — modal for the newest undismissed
  announcement: level badge (info=blue, update=orange, important=red), title,
  body (`whitespace-pre-line`, no HTML → XSS-safe), date. Checkbox "ไม่แสดงอีก";
  closing with it ticked calls `dismiss(id)` (persist), unticked just hides for
  now. Mounted once in `app/admin/layout.tsx` inside the authed shell.

## Error handling

- Panel unreachable → shop returns `[]`/cache, no popup, no error surfaced
  (best-effort like notifications).
- Unpublished after shown → drops out of active list; dismissals remain valid.
- New admin → sees all active, undismissed.

## Security / Out of scope

- Read endpoint is open (published content only). If locking is wanted later,
  add a shared `ANNOUNCE_KEY` header on both sides.
- v1 body is plain text with newlines (no markdown/HTML). Targeting, scheduling,
  rich text are future work.

## Verification

- Publish in panel → appears in shop admin within ~15s (or on click/focus).
- Tick "don't show again" → row in `announcement_dismissals`, no re-popup.
- Second admin still sees it until they dismiss (per-admin).
- Panel down → shop admin loads normally, no popup, no error.
