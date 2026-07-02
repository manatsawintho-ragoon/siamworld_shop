# Admin panel: ban system, member filters, online-players view, wizard cleanup

Date: 2026-07-02

## Goal

Four independent admin-panel enhancements for the customer shop:

1. **Ban / suspend system** — replace the "delete (soft)" account button with an explicit
   "ระงับการใช้งาน" (ban) action that blocks website login, is reversible (ปลดระงับ),
   records a reason on both ban and unban, keeps a full audit table, and lists everyone
   currently suspended.
2. **Member-management filters** — richer filtering/sorting in `/admin/users`.
3. **Remove the Setup Wizard entry** from the admin sidebar (keep the page for first-time
   bootstrap via direct URL).
4. **Online-players admin view** — a new `/admin/online` page showing who is online per
   server, cross-referenced against the web `users` table (web role, wallet, spend, ban
   status, etc).

## 1. Ban / suspend system

### Data model (migration `031_user_ban.sql`)

Ban is kept **separate** from `deleted_at`. `deleted_at` is reused internally by
`transferData()` to retire a merged source account; folding ban into it would make merged
accounts appear in the "banned" list. New, explicit fields:

- `users.banned_at TIMESTAMP NULL` — non-null = currently suspended.
- `users.ban_reason VARCHAR(500) NULL` — current ban reason (denormalised for list display).
- `users.banned_by INT NULL` — admin user id who applied the current ban.
- New table `ban_logs`:
  - `id`, `user_id`, `action ENUM('ban','unban')`, `reason VARCHAR(500)`,
    `admin_id INT NULL`, `admin_username VARCHAR(255)`, `created_at TIMESTAMP`.
  - Index on `user_id`, `created_at`.

### Behaviour

- **Login block:** `auth.service.finalizeLogin()` rejects when `banned_at IS NOT NULL`
  (in addition to the existing `deleted_at` check), returning the generic
  "Invalid username or password". `findUser()` selects `banned_at`.
- **banUser(userId, reason, admin):** sets `banned_at=NOW()`, `ban_reason`, `banned_by`;
  inserts a `ban_logs` row (`action='ban'`); destroys the session. Rejects self-ban,
  admin-role targets (must demote first), and already-banned accounts (409).
- **unbanUser(userId, reason, admin):** clears `banned_at/ban_reason/banned_by`; inserts
  `ban_logs` (`action='unban'`). Rejects if not currently banned (409).
- Existing `deleted_at` accounts stay login-blocked and hidden but do **not** appear in the
  new banned list (they predate this feature). Noted, not backfilled.

### API (admin, JWT+admin)

- `POST /admin/users/:id/ban`   body `{ reason }`  → ban.
- `POST /admin/users/:id/unban` body `{ reason }`  → unban.
- `GET  /admin/users/banned`    → list currently-banned users + current reason + who/when.
- `GET  /admin/users/:id/ban-logs` → full ban/unban history for one user.
- Each action also writes an `audit_logs` entry (existing `auditService`).

### Frontend

- `users/[id]` danger zone: "ลบบัญชี (Soft)" → **"ระงับการใช้งาน"** opening a modal with a
  required reason textarea. When already banned, show a red status banner (reason + date +
  admin) and a **"ปลดระงับ"** button (modal with unban-reason).
- `users` list: red "ระงับอยู่" badge on suspended rows.
- New tab/section listing banned users (reason, banned_at, admin) reachable from the users
  page header.

## 2. Member-management filters

`getAllUsers(page, limit, filters)` gains:

- **sort:** whitelist `id | wallet_balance | total_topup | total_spent | created_at | username`,
  direction `asc | desc`.
- **balance:** `has_balance` (>0), optional `balance_min` / `balance_max`.
- **role:** `admin | user`.
- **status:** `banned | active`.
- **activity:** `has_topup`, `has_purchase`, `online` (username ∈ live online set from
  PlayerTracker), `created_from` / `created_to` date range.

Query uses `LEFT JOIN` aggregate subqueries for topup/spend sums so they can be both sorted
and filtered; count query mirrors the same joins/filters. Sort column and direction are
whitelisted (no interpolation of raw input). The list response adds `banned_at`,
`total_topup`, `total_spent` per row.

Frontend adds a filter toolbar above the table (sort dropdown + direction, role/status
selects, has-balance / has-topup / has-purchase / online toggles, date range), following
`THEME.md` card/button styling. Font Awesome icons only.

## 3. Remove Setup Wizard entry

Delete the `/admin/setup` menu item (SYSTEM group) from `admin/layout.tsx`. The page and
backend `/setup` routes remain for first-time bootstrap by direct URL.

## 4. Online-players admin view

- `GET /admin/online-players`: reads `playerTracker.getOnlinePlayers()` (existing Redis
  cache), collects all online IGNs, then one query joins the `users` table
  (case-insensitive) with wallet + topup/spend aggregates + ban status. Returns per-server
  lists where each entry is either a matched web account (userId, role, balance, totalTopup,
  totalSpent, banned, createdAt) or a guest (`hasAccount:false`).
- New page `/admin/online`: summary cards (total online, per-server counts, matched vs guest)
  + per-server tables of players with avatar, web-role badge, wallet, ban badge, and a link
  to the user detail page. Auto-refreshes on an interval (reusing the existing polling
  cadence). Sidebar gets an "ผู้เล่นออนไลน์" entry (icon `fa-signal`).

## Non-goals

- No sync of ban state to the Minecraft server (web-side ban only; a future bridge opcode
  could push in-game bans).
- No in-game role/rank lookup via RCON; "role" shown is the web role.

## Rollout

Build (`tsc` + `next build`), commit, then `deploy/manage-customer.sh --action rebuild
--name <c>` for every customer in `deploy/customers.json` (rebuild auto-applies migration
031 via `apply-migrations.sh`).
