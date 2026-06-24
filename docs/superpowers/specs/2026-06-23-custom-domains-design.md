# Custom Domains (Bring-Your-Own-Domain) for Shops — Design

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation plan
**Scope:** Panel SaaS (`panel/`) + shared shop image (`backend/`, `frontend/`)

## 1. Goal & Model

Let a shop owner serve their shop on their own domain (e.g. `shop.theirstore.com`),
registered at any registrar (z.com, Hostinger, etc.), by adding **one CNAME record**.

- **Per-shop choice:** a shop uses either the default `name.siamsite.shop` subdomain,
  **or** goes custom-domain-only (their domain is the address customers use).
- **Self-service:** the shop owner enters their domain in the panel and follows a
  step-by-step wizard. No operator action required for the happy path.
- **Origin stays hidden:** the operator's origin IP and DDoS hardening
  (`harden-web-ports.sh` DROPs non-Cloudflare IPs on 80/443) remain intact. The
  customer's domain always routes **through the operator's Cloudflare**.

### Non-goals (YAGNI for v1)

- Apex/root domains (`theirstore.com` with no subdomain). Requires CNAME flattening
  on the customer side; start with subdomains only (`shop.theirstore.com`).
- Email on the customer's domain.
- More than one custom domain per shop.

## 2. Mechanism — Cloudflare for SaaS (Custom Hostnames)

The operator's `siamsite.shop` Cloudflare zone uses **Cloudflare for SaaS** to terminate
TLS for customer domains at the edge and route them to the operator origin.

### One-time operator setup

- Enable **Cloudflare for SaaS** on the `siamsite.shop` zone (100 custom hostnames
  free, then $0.10/hostname/month — fine at current scale).
- Create a **fallback origin**: a proxied record `custom.siamsite.shop` → operator
  origin IP. This is the CNAME target customers point at, and the SNI Cloudflare sends
  to the origin.

### Per custom domain (automated by the panel)

1. Panel creates a **CF Custom Hostname** for `shop.theirstore.com` with **HTTP DCV**
   (domain control validation over HTTP). With HTTP DCV the customer needs **only the
   single CNAME** — no extra TXT record. Cloudflare serves the ACME challenge at the
   edge once the CNAME resolves.
2. Cloudflare auto-issues the **edge TLS certificate** for the custom domain.
3. Customer adds one record at their registrar:
   `shop.theirstore.com  CNAME  custom.siamsite.shop`.

### TLS-to-origin (the subtlety)

- Edge cert (customer-facing) is issued and served by Cloudflare. The operator never
  manages a per-domain cert.
- Cloudflare → origin: SNI = the **fallback origin** (`custom.siamsite.shop`), while the
  `Host` header carries the real custom domain (`shop.theirstore.com`).
- NPM (nginx) selects the TLS cert by **SNI** → the existing `*.siamsite.shop` origin
  cert covers `custom.siamsite.shop`, so the handshake passes under CF SSL mode
  **Full (strict)**. NPM then routes the request by **Host header** to the shop's
  proxy host (whose `domain_names` now includes `shop.theirstore.com`).
- **Result: no per-domain origin certificate is ever required.**

## 3. Host-Agnostic Refactor (no rebuild / no restart per domain)

Two one-time changes to the **shared shop image** make a shop work on *any* hostname
pointed at it, so binding a domain is pure API calls with no container touch.

### 3a. Shop frontend — host-relative WebSocket

Today `NEXT_PUBLIC_WS_URL` is baked to `wss://name.siamsite.shop` at build time
(`deploy/new-customer.sh`). The online-players hook (`frontend/src/hooks/useOnlinePlayers.ts`)
must instead derive the WS URL from `window.location` and connect to the same-origin
`/socket.io` endpoint over 443 (which NPM already proxies to the backend), rather than
the baked subdomain or the `:4000` direct-port fallback.

- Effect: visiting the shop on `shop.theirstore.com` connects WS to
  `wss://shop.theirstore.com/socket.io` automatically. **No frontend rebuild** when a
  domain is added or changed.
- The shop's HTTP API is already host-relative (`frontend/src/lib/api.ts` uses `/api`),
  so no change is needed there.

### 3b. Shop backend — host-aware CORS / Socket.IO origin

Today `backend/src/server.ts` builds `allowedOrigins` from `CORS_ORIGIN` (comma list)
**at startup**, and Socket.IO enforces it even for same-origin connections. A custom
domain's WS handshake would be rejected.

Change the `origin` for both the Express `cors()` middleware and the Socket.IO server to
a **function** that allows a request when:

- the `Origin` is in the configured `CORS_ORIGIN` list, **or**
- the `Origin`'s host equals the request's `Host` (same-origin).

- Effect: a custom-domain WS handshake passes with **no container restart** and no
  per-domain `CORS_ORIGIN` edit.
- Safe: auth is an httpOnly, SameSite cookie, so allowing same-origin WS does not expose
  credentials to other sites.

After 3a + 3b, binding a domain never touches the running shop containers.

## 4. Panel Orchestration

New/extended services in `panel/backend/src/services/`:

### `cloudflare.service.ts` (extend)

- `ensureFallbackOrigin()` — one-time: create proxied `custom.siamsite.shop` record and
  register it as the Cloudflare-for-SaaS fallback origin (idempotent).
- `createCustomHostname(hostname)` — `POST /zones/{zone}/custom_hostnames` with
  `ssl.method = http`, `ssl.type = dv`. Returns custom hostname id + initial status.
- `getCustomHostnameStatus(id)` — returns `{ status, ssl.status }` for polling.
- `deleteCustomHostname(id)` — detach.

### `npm.service.ts` (extend)

- `addDomainToProxyHost(shopDomain, customDomain)` — find the shop's proxy host, push
  `customDomain` into `domain_names`, PUT (respecting NPM 2.14 quirks: omit `meta`,
  keep `locations: []`, preserve `advanced_config`).
- `removeDomainFromProxyHost(shopDomain, customDomain)` — reverse.

### New orchestration service (e.g. `custom-domain.service.ts`)

- `requestCustomDomain(subscriptionId, hostname)`:
  - Validate: subdomain format, not already used by another subscription, not a
    `*.siamsite.shop` host, customer's shop is `active`.
  - `ensureFallbackOrigin()` if not yet set.
  - `createCustomHostname()`, persist `custom_hostname_id` + `custom_domain` +
    `status = pending_dns`.
- `pollCustomDomain(subscriptionId)`:
  - `getCustomHostnameStatus()`; map to `pending_dns` → `pending_ssl` → `active` /
    `failed`.
  - On first transition to `active`: `addDomainToProxyHost()` and persist.
- `removeCustomDomain(subscriptionId)`:
  - `removeDomainFromProxyHost()`, `deleteCustomHostname()`, clear DB fields.

## 5. Database (panel — MANUAL migration)

Panel migrations have **no auto-runner** (apply by hand). Add columns to `subscriptions`:

| column | type | notes |
|--------|------|-------|
| `custom_domain` | `VARCHAR(255) NULL` | the customer hostname, unique when set |
| `custom_hostname_id` | `VARCHAR(64) NULL` | Cloudflare custom hostname id |
| `custom_domain_status` | `ENUM('pending_dns','pending_ssl','active','failed') NULL` | |
| `custom_domain_added_at` | `DATETIME NULL` | |

Unique index on `custom_domain` (allowing multiple NULLs).

## 6. Panel UI — Step-by-Step Wizard (self-service)

On the subscription/shop page, a "Custom domain" section:

1. **Enter domain** — input for `shop.theirstore.com`, with format validation and a note
   that apex domains are not supported in v1.
2. **Add this CNAME** — show the exact record to add at the registrar
   (`shop.theirstore.com  CNAME  custom.siamsite.shop`), with copy buttons and short
   z.com / Hostinger pointers ("go to DNS Zone Editor, add a CNAME...").
3. **Verifying** — status badge that polls the panel: `pending_dns` ("waiting for your
   CNAME") → `pending_ssl` ("issuing certificate") → `active` ("live"). Clear messaging
   for `failed` with a retry.
4. **Live** — show the live URL and a "Remove domain" button (detach flow).

Errors must name the field/problem (per professional-UX guidance), e.g. "This domain is
already in use", "CNAME not found yet — DNS can take a few minutes". No em dashes in
user-facing copy.

## 7. Component Boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `cloudflare.service` custom-hostname methods | CF for SaaS API (create/status/delete, fallback origin) | CF API, panel settings |
| `npm.service` domain-attach methods | NPM proxy-host `domain_names` mutation | NPM API |
| `custom-domain.service` | Orchestration, validation, state machine | cloudflare.service, npm.service, DB |
| Panel API route + UI | Self-service wizard, polling | custom-domain.service |
| Shop frontend WS (3a) | Host-relative live updates | window.location |
| Shop backend CORS (3b) | Host-aware origin allow | request Host |

## 8. Error Handling

- CF API errors surface the CF error code/message (existing `extractError`).
- Domain already in use / invalid format → 400 with a clear message before any CF call.
- Polling `failed` (DCV stalled, CNAME wrong) → status `failed` + actionable hint;
  customer can re-verify or remove and retry.
- NPM attach failure after CF `active` → keep status `pending_ssl`/retryable; do not lose
  the CF custom hostname; surface in deploy/admin log.
- Detach is best-effort idempotent (NPM remove + CF delete each tolerate "not found").

## 9. Testing

- Unit: domain validation (accept `shop.x.com`, reject apex `x.com`, reject
  `foo.siamsite.shop`, reject duplicates).
- Unit: status mapping CF response → `custom_domain_status` state machine.
- Backend: CORS/Socket.IO origin function allows same-host + configured origins, rejects
  unrelated cross-origin.
- Frontend: WS URL derivation uses `window.location.host` over 443 in production.
- Integration (manual, staging): full bind on a real test domain end to end (CNAME →
  pending_ssl → active → shop loads on custom domain, WS connects), then detach.

## 10. Rollout

1. Ship 3a + 3b in the shared shop image; rebuild existing shops on next normal rebuild
   (host-relative WS is backwards-compatible with siamsite subdomains).
2. One-time operator setup: enable Cloudflare for SaaS + fallback origin.
3. Apply panel DB migration (manual).
4. Ship panel service + route + wizard UI.
5. Validate end to end on a test domain before announcing.
