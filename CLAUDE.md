# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
# migrations/001_*.sql → 005_*.sql
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
- **`validators/schemas.ts`** — All Zod request schemas
- **`utils/crypto.ts`** — AES encryption for RCON passwords stored in DB

### Key Services

| Service | Responsibility |
|---------|---------------|
| `auth.service.ts` | Register/login against `authme` table (AuthMe bcrypt) |
| `wallet.service.ts` | Balance operations with `FOR UPDATE` row locking |
| `shop.service.ts` | Purchase flow: idempotency → online check → deduct → RCON → refund on failure |
| `loot-box.service.ts` | Weighted random item selection, inventory tracking |
| `payment.service.ts` | PromptPay QR generation + TrueMoney gift card redemption |
| `rcon-manager.ts` | Singleton RCON connection pool across servers |
| `rcon-queue.ts` | Queued RCON command execution with retry + logging |
| `player-tracker.ts` | Polls RCON `list` every 10s, caches in Redis, broadcasts via WebSocket |
| `admin-stats.service.ts` | Aggregated dashboard statistics |
| `settings.service.ts` | Key-value store backed by `settings` DB table |

### Frontend Structure (`frontend/src/`)

- **`app/`** — Next.js App Router pages
- **`context/AuthContext.tsx`** — JWT token storage + user state
- **`context/SettingsContext.tsx`** — Shop-wide settings (name, currency) fetched from API
- **`context/ThemeContext.tsx`** — Dark/light mode
- **`lib/api.ts`** — Axios instance with JWT auto-injection
- **`components/`** — Shared UI components

### Database Schema Highlights

- **`authme`** — Minecraft plugin table; auth reads passwords from here (do not modify schema)
- **`wallets`** — One row per user; all debits/credits use transactions with `FOR UPDATE`
- **`purchases`** — Idempotency key prevents duplicate orders; status: `pending/delivered/failed/refunded`
- **`loot_box_items`** — Weighted random via `weight` column + rarity tiers
- **`web_inventory`** — Loot box item claims: `PENDING` → `REDEEMED` after RCON delivery
- **`redeem_codes`** — Supports `point` (wallet credit) and `rcon` reward types; enforced one-use-per-user via `redeem_logs`
- **`settings`** — Key-value table; frontend reads shop name, currency symbol, etc.

### API Route Groups

All routes are prefixed with `/api`:

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/auth` | None | Login, register |
| `/user` | JWT | Profile |
| `/wallet` | JWT | Balance, topup, transactions |
| `/shop` | JWT | Products, purchase, loot boxes |
| `/payment` | JWT | PromptPay, TrueMoney |
| `/admin` | JWT + Admin | Full management |
| `/public` | None | Slides, featured products, server status |
| `/setup` | None | Initial system setup |

### Critical Patterns

**Purchase flow** (`shop.service.ts`): Always verify player is online (Redis cache from PlayerTracker) before charging wallet. Use idempotency key from client to prevent duplicate charges on retry. RCON failures trigger automatic wallet refund.

**Wallet transactions**: Always use MySQL transactions with `SELECT ... FOR UPDATE` on the wallet row before any debit to prevent race conditions.

**RCON passwords**: Stored encrypted in DB via `utils/crypto.ts`. Never log or return raw RCON passwords.

**Settings**: Cached in frontend `SettingsContext`; invalidated on admin save. Backend reads from `settings` table via `settings.service.ts`.
