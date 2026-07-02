# Online-players panel: modern redesign + richer data (RCON-only)

Date: 2026-07-02

## Goal

Redesign `/admin/online` into a modern, dense, filterable panel that shows many players at
once (no constant scrolling), with session/login timing, peak-today, per-player world, and
search/filter. Scope is deliberately **RCON-only** + our own tracking. Ping and command/chat
log are excluded (RCON cannot read them; would need a server-side plugin).

## Data feasibility (what ships)

| Field | Source |
|-------|--------|
| Online now, names, per-server count | existing RCON `list` via PlayerTracker |
| Online since / login time | our tracking: Redis hash `mc:since:<serverId>` (name → first-seen epoch) |
| Session playtime | derived `now - onlineSince`, ticked live client-side |
| Peak online today | our tracking: Redis `mc:peak:<YYYY-MM-DD>` = max total seen |
| World / Dimension | on-demand RCON `data get entity <name> Dimension` (only when a player's detail drawer opens, to spare RCON) |
| Web role / wallet / topup / spend / ban | existing `users` join (`lookupPlayersByUsernames`) |

Excluded: **ping ms**, **command/chat log** (need a plugin — see bridge follow-up).

## Backend

### PlayerTracker tracking (`player-tracker.ts`)
- In `poll()`, per `ok` server: maintain `mc:since:<id>` hash — HSET new players with `Date.now()`,
  HDEL players who left. **Skip the HDEL cleanup when the list is truncated** (partial list must
  not evict still-online players). Refresh a 1h expiry each poll (self-heal).
- After the loop: update `mc:peak:<date>` to `max(existing, totalOnline)` (48h expiry).
- New methods: `getSinceMap(serverId): Record<string, number>` (lowercased name → epoch),
  `getPeakToday(): number`.

### Routes (`admin.routes.ts`)
- `GET /admin/online-players` (existing, enriched): each player gains `onlineSince` (epoch|null);
  response gains `peakToday = max(getPeakToday(), totalOnline)`.
- `GET /admin/online-players/:serverId/:name/world` (new): sanitize `name` to `[A-Za-z0-9_]{1,16}`,
  run `sendCommandDirect(serverId, 'data get entity <name> Dimension')`, parse the quoted dimension
  (e.g. `minecraft:overworld`), return `{ world }` (raw string fallback). RCON failure → `{ world: null }`.

## Frontend (`/admin/online/page.tsx`, full rewrite)

- **Hero summary**: gradient cards — ออนไลน์ตอนนี้ (live pulse), Peak วันนี้, มีบัญชีเว็บ, จำนวนเซิร์ฟ + last-updated.
- **Filter/search bar** (client-side over the fetched list): search by name; server selector;
  toggle chips (มีบัญชีเว็บ / ไม่มีบัญชี / ถูกแบน / เฉพาะ admin); sort (playtime / ยอดเงิน / ชื่อ).
- **Dense player grid**: responsive `grid-cols-1 sm:2 lg:3 xl:4` of compact cards so many players
  are visible at once. Card: avatar, name, role/ban badges, "ออนไลน์มาแล้ว <duration>" (ticks live
  every 1s from `onlineSince`), wallet. Server shown as a grouping header or a card tag.
- **Detail drawer** (slide-in right on card click): fetches `/world` on open; shows world, online
  since, session playtime, full account stats (topup/spend/balance/ban), and a link to the user page.
- Data auto-refreshes every 10s; the live playtime counter ticks independently so numbers move
  smoothly between refreshes. Font Awesome icons only, THEME.md styling.

## Non-goals

Ping, command/chat log, in-game rank (all need a server plugin). Total lifetime playtime
(needs a scoreboard objective per server) is out; only current-session playtime ships.

## Rollout

Build, commit, `manage-customer.sh --action rebuild` for all deployable customers
(kovaksmp excluded — no deploy config/containers on host; pre-existing gap).
