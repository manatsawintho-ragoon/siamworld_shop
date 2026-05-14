# Siamsite Shop - Comprehensive Project Context

## Project Overview
**Siamsite Shop** (v2.0.0) is a high-performance, multi-tenant capable SaaS shop system designed for Minecraft servers. It integrates directly with **AuthMe Reloaded** for authentication and uses **RCON** for real-time product delivery and command execution across multiple Minecraft servers.

### Key Features
- **Authentication:** Direct integration with AuthMe MySQL tables (bcrypt).
- **Wallet & Payments:** Supports PromptPay (QR Generation via EasySlip API) and TrueMoney Gift Cards.
- **Shop & Loot Boxes:** Category-based products and Loot Boxes with Rarity (Common to Mythic) and weighted random logic.
- **Inventory System:** Items won from Loot Boxes are stored in a web inventory for later redemption.
- **RCON Management:** Persistent connection pooling, command queuing, retry logic, and multi-server orchestration.
- **Real-time Updates:** Online player tracking via RCON polling and WebSocket (Socket.IO) broadcasting.
- **Admin Dashboard:** Management of servers, products, boxes, users, and audit logs.
- **Multi-Tenancy SaaS:** Automated deployment and management of separate shop instances for different customers via bash scripts.

### Tech Stack
- **Backend:** Node.js 20, Express 4.21, TypeScript 5.5, MySQL 8.0, Redis 7, Socket.IO 4.7.
- **Frontend:** Next.js 14.2 (App Router), TailwindCSS 3.4, Framer Motion 12.
- **Management Panel:** Next.js 14.2 (Admin interface for SaaS operations).
- **Infrastructure:** Ubuntu 24.04 VPS, Docker & Docker Compose, Nginx Proxy Manager (NPM), Cloudflare (DNS/WAF).
- **Integrations:** `rcon-client`, AuthMe (MySQL backend), EasySlip.

---

## Directory Structure

```text
/
├── backend/                # Node.js + Express API (Per-tenant)
│   ├── src/
│   │   ├── services/       # Core business logic (See Service Layer)
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth, Validation, Rate Limiting
│   │   └── database/       # Connection pooling (MySQL & Redis)
├── frontend/               # Next.js 14 App Router (Per-tenant)
├── panel/                  # Central management panel for SaaS (Backend + Frontend)
├── deploy/                 # Multi-tenancy deployment scripts
│   ├── new-customer.sh     # Scaffolds a new shop instance (generates .env, starts containers)
│   ├── manage-customer.sh  # Start/stop/update/rebuild/HA instances
│   ├── customers.json      # Registry of all customer instances and allocated ports
│   └── docker-compose.customer.yml # Template for customer stacks
├── migrations/             # Idempotent SQL migration files (001-017)
└── init.sql                # Core database schema
```

---

## Production Architecture & Deployment

### Multi-Tenancy Isolation
- Each customer gets their own isolated Docker stack: **MySQL, Redis, Backend, and Frontend**.
- **Nginx Proxy Manager (NPM)** handles SSL and routing. It routes `shop-domain.com` to the customer's frontend container, and `/api/` & `/socket.io/` to their backend container.
- **MySQL Ports** are exposed uniquely per customer (e.g., 3401, 3402) so their remote Minecraft servers can connect directly to the database for AuthMe authentication.

### AuthMe High Availability (HA) via Tailscale
To prevent Minecraft players from being unable to login if the web panel goes down, the system supports a Master-Replica HA setup:
- The customer's local machine/server acts as the **MySQL Master**.
- The SaaS Panel's MySQL acts as the **Replica**.
- Connection is strictly secured over **Tailscale** VPN (port 3306 restricted to Tailscale IPs via Windows Firewall).
- Handled via `./manage-customer.sh --action setup-replica` and `connect-replica`.

### Deployment Workflow (`deploy/`)
- **New Customer:** `./deploy/new-customer.sh <name> <domain>` creates the `.env` with random secrets, assigns ports, and starts the Docker stack.
- **Rebuild Customer:** `./deploy/manage-customer.sh --action rebuild --name <name>` (Must be run when pulling new code for the frontend/backend).
- **Logs:** `./deploy/manage-customer.sh --action logs --name <name>`

---

## Core Architecture & Service Layer

### Authentication & Users
- **AuthMe Integration:** The system reads directly from the `authme` table for credentials. Requires Minecraft to have `online-mode=false`.
- **JWT:** Used for web session management. `JWT_SECRET` must be consistent across instances if sharing sessions.

### RCON Management
- **`rcon-pool.ts`**: Maintains persistent connections to Minecraft servers.
- **`rcon-queue.ts`**: Ensures commands are executed reliably, handling retries.
- **Command Placeholders:** Use `{username}` or `{player}` in RCON command templates.
- **Firewall:** Port 25575 (default RCON) must be open on the Minecraft server to accept connections from the VPS.

### Service Layer Responsibilities
- **`shop.service.ts`**: Validates purchases, checks balance, and triggers RCON delivery.
- **`loot-box.service.ts`**: Handles the logic for opening boxes and selecting rewards.
- **`wallet.service.ts`**: Atomic balance updates and transaction logging (`FOR UPDATE` locking).
- **`rcon-manager.ts`**: High-level orchestration of commands across multiple servers.
- **`easyslip.service.ts`**: Integration with external payment verification APIs.

---

## Development Workflow

### Database Migrations
1.  Create a new file in `/migrations/` following the naming convention: `XXX_description.sql`.
2.  Ensure scripts are **idempotent** (use `IF NOT EXISTS`, `IF EXISTS`).
3.  Migrations are applied manually to the target database container using `docker exec`.

### Adding a New Feature
1.  **Define Schema:** Add migration if needed.
2.  **Service Layer:** Implement logic in `backend/src/services/`.
3.  **Route/Middleware:** Expose logic via `backend/src/routes/`.
4.  **Frontend:** Create components/pages in `frontend/src/` or `panel/frontend/src/`.

---

## Directives for Agents
- **Prioritize Service Layer:** Do not put business logic in routes or controllers.
- **Use Zod:** Always validate request bodies and environment variables.
- **Logging:** Use the custom `logger` in the backend for all significant events.
- **Security:** Never expose RCON passwords, JWT secrets, or DB passwords in logs.
- **Atomic Operations:** Use database transactions (`transaction` with `FOR UPDATE`) for multi-step financial or delivery operations to prevent race conditions.
---

## Agent Environment & Operations

### Available Skills
The following specialized skills are installed and should be used for relevant tasks:
- **`seo-audit`**: For auditing search discoverability and on-page optimization.
- **`ui-ux-pro-max`**: Comprehensive design guidelines and component review.
- **`better-auth-best-practices`**: Guidance for authentication implementation.
- **`tailwind-design-system`**: Best practices for Tailwind CSS v4 and design tokens.
- **`secure-linux-web-hosting`**: Hardening and reviewing cloud server setups.

### Maintenance & common Commands
The project has pre-approved permissions (in `.claude/settings.local.json`) for:
- **Docker Orchestration**: Extensive use of `docker-compose` and `docker exec` for both B2B panel and B2C shop instances.
- **Thai Language Consistency**: A known task is ensuring correct Thai spelling (e.g., changing "ไอเทม" to "ไอเท็ม").
- **Playwright Testing**: Infrastructure exists for `test_webapp.py` using Playwright and Chromium.

### Contextual Knowledge
- **Development History**: References to `C:/Users/gamec/Desktop/siamsite_shop` suggest a Windows-to-Linux migration. Be cautious of hardcoded paths in scripts.
- **Multi-tenant Control**: Each customer instance has a unique prefix (e.g., `sw-siamworld`, `sw-mchanom`). Always verify the container prefix before running `docker` commands.

