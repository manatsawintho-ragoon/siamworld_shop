# SiamWorld Shop - Project Context

## Project Overview
**SiamWorld Shop** is a high-performance web-based shop system designed for Minecraft servers. It integrates directly with **AuthMe Reloaded** for authentication and uses **RCON** to deliver products and execute commands across multiple Minecraft servers in real-time.

### Key Features
- **Authentication:** Direct integration with AuthMe MySQL tables (bcrypt).
- **Wallet & Payments:** Supports PromptPay (QR Generation) and TrueMoney Gift Cards.
- **Shop & Loot Boxes:** Category-based products and Loot Boxes with Rarity (Common to Mythic) and weighted random logic.
- **RCON Management:** Persistent connection pooling with a command queue, retry logic, and multi-server orchestration.
- **Inventory System:** Items won from Loot Boxes are stored in a web inventory for later redemption.
- **Real-time Updates:** Online player tracking via RCON polling and WebSocket (Socket.IO) broadcasting.
- **Admin Dashboard:** Comprehensive management of servers, products, boxes, users, and audit logs.

### Tech Stack
- **Backend:** Node.js 20, Express, TypeScript, MySQL 8.0, Redis 7, Socket.IO.
- **Frontend:** Next.js 14 (App Router), TailwindCSS, Framer Motion.
- **Infrastructure:** Docker & Docker Compose.
- **Integrations:** rcon-client, AuthMe (MySQL backend), EasySlip (for payment verification).

---

## Architecture & Structure

### Backend (`/backend`)
Follows a service-oriented architecture:
- **`src/services/`**: Contains core business logic.
    - `rcon-manager.ts`: Orchestrates RCON commands across servers.
    - `rcon-pool.ts`: Manages persistent RCON connections to avoid handshake overhead.
    - `rcon-queue.ts`: Handles command retries and logging.
    - `shop.service.ts`: Manages purchases and product delivery.
- **`src/routes/`**: Thin route handlers that delegate to services.
- **`src/middleware/`**: Includes `auth.ts` (JWT), `cooldown.ts` (Redis-based rate limiting), and `validate.ts` (Zod schemas).

### Frontend (`/frontend`)
Built with Next.js 14 App Router:
- **`src/app/`**: Contains page definitions and layouts.
- **`src/components/`**: Reusable UI components.
- **`src/context/`**: Global state management (Auth, Settings, Theme).
- **`src/lib/api.ts`**: Axios wrapper for API communication with JWT injection.

### Database (`/migrations` & `init.sql`)
- Uses MySQL 8.0.
- `init.sql`: Core schema, auto-loaded by Docker.
- `migrations/`: Idempotent SQL scripts to be applied in order for updates.

---

## Building and Running

### Quick Start (Docker)
1. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database, Redis, and secret keys.
   ```
2. **Launch Services:**
   ```bash
   docker compose up -d
   ```
3. **Apply Migrations:**
   Run the migration scripts manually (or via the provided loop in README.md) against the `siamworld-mysql` container.

### Development Mode (Local)
- **Backend:** `cd backend && npm install && npm run dev` (Runs on port 4000).
- **Frontend:** `cd frontend && npm install && npm run dev` (Runs on port 3000).
- *Note:* Requires MySQL and Redis to be running (can use Docker for these only).

---

## Development Conventions

### Coding Style
- **TypeScript:** Strict typing is enforced. Avoid `any` where possible.
- **Zod:** Used for both environment variable validation and request body validation.
- **Services:** Business logic should always reside in the `services` layer, not in routes or controllers.
- **Logging:** Use the custom `logger` utility in the backend for consistent formatting and levels.

### Database Interactions
- **Migrations:** Never modify `init.sql` for existing installations. Always create a new migration file in `migrations/`.
- **Idempotency:** Migration scripts should use `IF NOT EXISTS` or `DROP ... IF EXISTS` to allow multiple runs.
- **AuthMe:** The `users` logic is tied to the `authme` table. Do not duplicate user data; read directly from the AuthMe schema.

### RCON & Command Templates
- Use `{username}` or `{player}` as placeholders in RCON command templates.
- RCON commands are executed via a queue (`rconQueue`) to ensure reliability and logging, except for health checks and player listing which use `sendCommandDirect`.

### Security
- **Sensitive Data:** RCON passwords and other secrets are encrypted at rest using AES-256-CBC.
- **Rate Limiting:** Enforced at the Next.js middleware level (Global) and Backend Redis level (Per-user cooldowns).
- **JWT:** Used for authentication. Ensure `JWT_SECRET` is at least 32 characters.
