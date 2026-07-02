# Design — Decouple ban/transfer/delete + restore, and Online-Players panel upgrade

Date: 2026-07-03
Status: approved (directional), implementing

## Background

Two independent workstreams bundled in one session:

1. **Account lifecycle cleanup.** `users.deleted_at` was overloaded for BOTH "account
   deleted" and "merge/transfer source retired". Both block login (`auth.service.ts:145`
   checks `deleted_at OR banned_at`) and there is NO UI to clear `deleted_at`. Result:
   a transferred (merged) account is locked out forever and looks like a ban. Real
   incident: gamexd `aurora16g` (fixed manually 2026-07-02).

2. **Online-players panel** (`/admin/online`) has bugs + missing data the operators want.

---

## Feature 1 — Ban / Transfer / Delete decoupling + Restore

### Principle (three independent concepts)

| Action   | Column      | Blocks login | Reversible          |
|----------|-------------|:---:|---------------------|
| Ban      | `banned_at` | yes | unban (exists)      |
| Delete   | `deleted_at`| yes | **restore (new)**   |
| Transfer | *(neither)* | no  | n/a                 |

After this, `deleted_at` means "deleted" only. Transfer moves data and leaves the
source a normal, usable (empty) account.

### Backend

- `user.service.ts`
  - `transferData`: remove `UPDATE users SET deleted_at = NOW()` (line ~484) and the
    `destroySession(fromUserId)` (line ~489). Source stays active; only data moves.
    Update the doc-comment (drop "soft-delete the source" step).
  - `restoreUser(userId)`: `SELECT deleted_at FOR UPDATE`; NotFoundError if missing;
    `ConflictError('บัญชีนี้ไม่ได้ถูกลบ')` if not deleted; else `UPDATE users SET
    deleted_at = NULL`.
  - `getAllUsers`: `UserListFilters.status` adds `'deleted'`. If `status==='deleted'`
    the where uses `u.deleted_at IS NOT NULL`; otherwise keep the existing
    `u.deleted_at IS NULL` plus banned/active. Add `u.deleted_at` to the SELECT.
- `admin.routes.ts`
  - `POST /users/:id/restore` → `restoreUser`, audit `admin_user_restore`
    (`กู้คืนบัญชี <name>`).
  - Members list route: accept `status=deleted` and pass through.
  - `getProfile` SELECT (used by `GET /users/:id`): add `u.deleted_at` so the detail
    page can show the restore banner.
- `audit.service.ts`: add `'admin_user_restore'` to the action-type union.

### Frontend

- `users/[id]/page.tsx`
  - Transfer modal copy: replace "บัญชีจะถูก soft-delete อัตโนมัติ" with "ข้อมูล
    ทั้งหมดจะย้ายไปบัญชีปลายทาง บัญชีต้นทางยังใช้งานได้ (ยอดเงินจะเป็น 0)".
  - Add `deleted_at` to the user type. If set → red banner "บัญชีนี้ถูกลบ" +
    "กู้คืนบัญชี" button → confirm → `POST /users/:id/restore`.
- `users/page.tsx` (members): add status filter option "ถูกลบ", show a deleted badge,
  keep row link to detail.

### Out of scope
No bulk restore of historically-merged accounts on other shops — operators restore
each via the new button.

---

## Feature 2 — Online-players panel

Decision: **skip** the 15/30 fix. Root cause is server-side: honeyland's `list`
truncates every RCON variant and appends `...` (evidence: 30 online → 14 names /
222 bytes; `list uuids` → 5 names / 348 bytes; both `< 4096` so not packet
fragmentation, and vanilla `list` never emits `...`). Getting all names would need a
Bridge-plugin online feed (separate project). Our code is correct.

Page fetch model stays **polling** (`GET /admin/online-players` every 10s). "Realtime"
= 10s granularity, consistent with the tracker cadence. No new WebSocket wiring.

### 2a. Detail: right drawer → centered modal
Replace the `selected` right-side slide-in (`online/page.tsx` ~303-387) with a
centered popup modal (overlay + `max-w` card, click-outside + X to close). Keep
`openDetail` + world lookup. Enrich: on open, if `hasAccount`, fetch
`GET /admin/users/:userId` (getProfile) for deeper stats (topup count, last topup,
monthly topup/spend, avg) shown alongside the live session + world + wallet fields.
Keep the "จัดการบัญชีนี้" link.

### 2b. Top stat bar
Expand summary cards: total online, peak today, accounts vs guests, **sum wallet of
online**, **admins online**, **banned online**, servers count. New aggregates come
from the endpoint (below).

### 2c. Peak / trend over time
- player-tracker: sample total online **once per minute** into a per-day Redis list
  `mc:trend:<YYYY-MM-DD>` of `{ts,total}` (only push when the minute bucket changes),
  `EXPIRE` 48h, cap length (LTRIM). `getTrend()` returns the series (last ~180 pts).
- `/online-players` returns `trend`. Frontend renders an inline **SVG sparkline/area**
  (no new dependency).

### 2d. Per-server breakdown
Visible strip of per-server mini-cards: server name + online count + truncated badge
(data already in `servers[]`).

### 2e. Join / leave feed (near-realtime)
- player-tracker poll: for each server with `!truncated`, diff previous vs current
  name set → joins (new) / leaves (gone). Guarded to complete lists only so truncated
  servers never emit false events. Extract the diff into a **pure function**
  `diffPlayers(prev, curr)` for unit testing.
- Push each event to Redis list `mc:events` (`{type,name,serverId,serverName,ts}`),
  `LTRIM` to last 60, `EXPIRE` 6h. `getRecentEvents(limit)` parses them.
- `/online-players` returns `recentEvents`. Frontend shows a "เข้า-ออกล่าสุด" feed
  (join = green ↑, leave = gray ↓, name + server + relative time), refreshed by the
  10s poll.

### Endpoint additions (`GET /admin/online-players`)
Add to the JSON: `onlineWallet`, `onlineSpent`, `adminsOnline`, `bannedOnline`,
`trend`, `recentEvents`. (Existing fields unchanged.)

---

## Testing / Verification
- `cd backend && npm run build` and `cd frontend && npm run build` must both pass.
- Unit tests (Jest, pure functions only — repo convention avoids DB tests):
  `diffPlayers` join/leave logic; trend per-minute downsample bucketing.
- Manual sanity: hit `/admin/online-players` shape against a live shop if needed.

## Limitations (documented)
- Realtime = 10s poll, not push.
- Join/leave + trend accuracy on truncating servers (honeyland) is limited by design
  (events only computed from complete lists).

## Deploy
Commit only. No shop rebuild this session (operator decision).
