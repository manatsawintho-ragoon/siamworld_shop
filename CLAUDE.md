# CLAUDE.md

## Mandatory Startup Sequence

**Run this EVERY time before any task — no exceptions.**

### Step 1 — Load all context (always)
```bash
find .agents/context -type f | sort
```
Read every file returned.

### Step 2 — Discover available skills (always)
```bash
find .agents/skills -name "SKILL.md" | sort
```
Read only the frontmatter/description block of each SKILL.md (first ~10 lines).

### Step 3 — Load matching skills (on demand)
If the task matches a skill's description, read that skill's full SKILL.md before starting.

---

## Project Overview

SiamWorld Shop is a full-stack e-commerce platform for Minecraft servers. Players authenticate using their in-game AuthMe accounts, top up a wallet, purchase items/permissions (delivered via RCON), and open loot boxes. Admins manage everything through a dashboard.

## Commands

### Development

```bash
# Start all services (MySQL, Redis, backend, frontend, phpMyAdmin)
docker-compose up -d

# Backend only (requires MySQL + Redis running)
cd backend && npm run dev        # ts-node-dev, port 4000

# Frontend only (requires backend running)
cd frontend && npm run dev       # Next.js, port 3000
```

### Build

```bash
cd backend && npm run build      # tsc → dist/
cd frontend && npm run build     # Next.js build
```

### Database

```bash
# Apply migrations manually (run in order)
# migrations/001_*.sql → 017_*.sql
# init.sql is loaded automatically via docker-compose volume mount
```

### Environment Setup

Copy `.env.example` to `.env` and fill in values before starting. Key fields:
- `JWT_SECRET` / `ENCRYPTION_KEY` — must be 32+ chars, different values
- `NEXT_PUBLIC_API_URL` — must match backend URL as seen from the browser
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for Socket.IO

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript, port 4000 |
| Frontend | Next.js 14 App Router + TailwindCSS, port 3000 |
| Database | MySQL 8.0 |
| Cache | Redis 7 |
| Auth | JWT + AuthMe bcrypt (passwords never duplicated) |
| Real-time | Socket.IO (`players` namespace) |

### Backend Structure (`backend/src/`)

- **`server.ts`** — Express + Socket.IO initialization, route registration, RconManager bootstrap
- **`config/index.ts`** — Env variable validation; import this for all config values
- **`database/connection.ts`** — MySQL2 promise pool (20 connections)
- **`database/redis.ts`** — Redis client singleton
- **`routes/`** — Thin route handlers; delegates to services
- **`services/`** — All business logic lives here
- **`middleware/auth.ts`** — JWT verification + RBAC (`requireAuth`, `requireAdmin`)
- **`middleware/cooldown.ts`** — Per-user request cooldown (5s purchases, 3s loot boxes)
- **`middleware/validate.ts`** — Zod schema middleware
- **`middleware/asyncRoute.ts`** — Async route error wrapper
- **`middleware/errorHandler.ts`** — Global error handler
- **`validators/schemas.ts`** — All Zod request schemas
- **`utils/crypto.ts`** — AES encryption for RCON passwords stored in DB
- **`utils/errors.ts`** — Typed error classes
- **`utils/logger.ts`** — Logging utility

### Key Services

| Service | Responsibility |
|---------|---------------|
| `auth.service.ts` | Register/login against `authme` table (AuthMe bcrypt) |
| `wallet.service.ts` | Balance operations with `FOR UPDATE` row locking |
| `shop.service.ts` | Purchase flow: idempotency → online check → deduct → RCON → refund on failure |
| `loot-box.service.ts` | Weighted random item selection, inventory tracking |
| `payment.service.ts` | PromptPay QR generation + TrueMoney gift card redemption |
| `easyslip.service.ts` | EasySlip payment slip verification integration |
| `rcon-manager.ts` | Singleton RCON connection pool across servers |
| `rcon-pool.ts` | RCON pool implementation |
| `rcon-queue.ts` | Queued RCON command execution with retry + logging |
| `player-tracker.ts` | Polls RCON `list` every 10s, caches in Redis, broadcasts via WebSocket |
| `admin-stats.service.ts` | Aggregated dashboard statistics |
| `audit.service.ts` | Audit log recording for admin actions |
| `server.service.ts` | RCON server management (CRUD) |
| `settings.service.ts` | Key-value store backed by `settings` DB table |
| `setup.service.ts` | Initial system setup logic |
| `user.service.ts` | User profile read/update operations |

### Frontend Structure (`frontend/src/`)

#### Pages (`app/`)

**User-facing:**
| Page | Path |
|------|------|
| Home | `app/page.tsx` |
| Shop | `app/shop/page.tsx` |
| Top-up wallet | `app/topup/page.tsx` |
| Profile | `app/profile/page.tsx` |
| Inventory | `app/inventory/page.tsx` |
| Redeem code | `app/redeem/page.tsx` |
| Download | `app/download/page.tsx` |
| Loot box list | `app/lootbox/page.tsx` |
| Loot box detail | `app/lootbox/[id]/page.tsx` |

**Admin panel (`app/admin/`):**
| Page | Purpose |
|------|---------|
| `layout.tsx` | Admin sidebar + shell |
| `page.tsx` | Dashboard with stats |
| `setup/page.tsx` | Initial system setup |
| `settings/page.tsx` | Shop-wide settings |
| `products/page.tsx` | Manage shop products |
| `lootboxes/page.tsx` | Manage loot boxes & items |
| `servers/page.tsx` | RCON server management |
| `users/page.tsx` | User list |
| `users/[id]/page.tsx` | User detail |
| `users/[id]/history/page.tsx` | User transaction history |
| `purchases/page.tsx` | Purchase logs |
| `codes/page.tsx` | Redeem code management |
| `payment-settings/page.tsx` | Payment provider config |

#### Contexts (`context/`)
- **`AuthContext.tsx`** — JWT token storage + user state
- **`SettingsContext.tsx`** — Shop-wide settings (name, currency) fetched from API
- **`ThemeContext.tsx`** — Dark/light mode

#### Lib (`lib/`)
- **`api.ts`** — Axios instance with JWT auto-injection
- **`rarity.ts`** — Shared rarity config: `RARITY` map, `getRarity()` helper, `RarityKey` type — use on every page showing item rarity
- **`dateFormat.ts`** — Date formatting helpers

#### Hooks (`hooks/`)
- **`useOnlinePlayers.ts`** — Real-time online player count via WebSocket

#### Components (`components/`)
- `AdminAlert.tsx` — Admin alert banner
- `DynamicFavicon.tsx` — Dynamic favicon handler
- `Footer.tsx` — Page footer
- `HeroCarousel.tsx` — Featured product carousel (home page)
- `LoginModal.tsx` — Authentication modal
- `MainLayout.tsx` — Main page layout wrapper
- `Navbar.tsx` — Navigation bar
- `OnlinePlayersWidget.tsx` — Real-time online players display
- `ProductCard.tsx` — Reusable product card
- `RankingWidget.tsx` — Ranking/leaderboard widget
- `RconModal.tsx` — RCON config modal (admin)
- `SidebarLogin.tsx` — Sidebar login panel

#### Public Assets (`public/`)
- `images/thai_qr_payment.png` — Thai QR payment logo
- `images/truemoney_wallet.png` — TrueMoney wallet logo
- `sounds/cs2-case-reel.mp3` — Loot box spin sound
- `sounds/cs2-open-case.mp3` — Loot box open sound
- `sounds/cs2-reward-after-reel.mp3` — Loot box reward reveal sound

### Database Schema Highlights

- **`authme`** — Minecraft plugin table; auth reads passwords from here (do not modify schema)
- **`wallets`** — One row per user; all debits/credits use transactions with `FOR UPDATE`
- **`purchases`** — Idempotency key prevents duplicate orders; status: `pending/delivered/failed/refunded`
- **`loot_box_items`** — Weighted random via `weight` column + rarity tiers (COMMON → MYTHIC)
- **`web_inventory`** — Loot box item claims: `PENDING` → `REDEEMED` after RCON delivery
- **`redeem_codes`** — Supports `point` (wallet credit) and `rcon` reward types; enforced one-use-per-user via `redeem_logs`
- **`settings`** — Key-value table; frontend reads shop name, currency symbol, etc.
- **`audit_logs`** — Admin action audit trail with retention policy
- **`slip_logs`** — Payment slip verification records (EasySlip)

### Database Migrations (run in order)

| File | Purpose |
|------|---------|
| `001_add_logs_tables.sql` | Transaction & purchase logs |
| `002_add_downloads.sql` | Download system |
| `003_add_email_to_users.sql` | Email field on authme |
| `004_fix_downloads_schema.sql` | Download schema fix |
| `004_add_redeem_codes.sql` | Redeem code system |
| `005_add_reward_type_to_codes.sql` | Reward type column |
| `006_add_mythic_rarity.sql` | MYTHIC rarity tier |
| `007_add_lootbox_categories.sql` | Loot box categories |
| `008_audit_logs.sql` | Audit logging table |
| `009_add_performance_indexes.sql` | Query optimization indexes |
| `010_audit_log_retention.sql` | Audit log retention policy |
| `011_fix_authme_email_default.sql` | AuthMe email default |
| `012_slip_logs.sql` | Payment slip logging |
| `013_lootbox_original_price.sql` | Original price for loot boxes |
| `014_stock_sale_limit.sql` | Stock & sale limits |
| `015_sale_pause.sql` | Sale pause flag |
| `016_allow_product_delete.sql` | Soft-delete for products |
| `017_allow_lootbox_delete.sql` | Soft-delete for loot boxes |

### API Route Groups

All routes are prefixed with `/api`:

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/auth` | None | Login, register |
| `/user` | JWT | Profile |
| `/wallet` | JWT | Balance, topup, transactions |
| `/shop` | JWT | Products, purchase, loot boxes |
| `/payment` | JWT | PromptPay, TrueMoney, EasySlip slip verify |
| `/admin` | JWT + Admin | Full management |
| `/public` | None | Slides, featured products, server status |
| `/setup` | None | Initial system setup |

### Critical Patterns

**Purchase flow** (`shop.service.ts`): Always verify player is online (Redis cache from PlayerTracker) before charging wallet. Use idempotency key from client to prevent duplicate charges on retry. RCON failures trigger automatic wallet refund.

**Wallet transactions**: Always use MySQL transactions with `SELECT ... FOR UPDATE` on the wallet row before any debit to prevent race conditions.

**RCON passwords**: Stored encrypted in DB via `utils/crypto.ts`. Never log or return raw RCON passwords.

**Settings**: Cached in frontend `SettingsContext`; invalidated on admin save. Backend reads from `settings` table via `settings.service.ts`.

**Rarity display**: Always use `getRarity()` from `lib/rarity.ts` and the shared `RARITY` config — never define rarity colors/labels inline.

**Icons**: Use Font Awesome (`fas`/`far`/`fab`) as primary, Lucide React as secondary. Never use emoji in UI. See `.agents/context/ICONS.md`.

**Admin UI**: Follow the design system in `.agents/context/THEME.md` exactly — specific shadows, button styles, color palette, modal patterns.

**Currency**: All transactions in Thai Baht (฿) only. No points, RP, or virtual currency. See `.agents/context/SYSTEM.md`.
