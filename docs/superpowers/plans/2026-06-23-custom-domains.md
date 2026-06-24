# Custom Domains (BYOD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shop owner self-serve their own domain (e.g. `shop.theirstore.com`) by adding one CNAME, driven by a step-by-step panel wizard, using Cloudflare for SaaS custom hostnames.

**Architecture:** The shared shop image is made host-agnostic (host-relative WebSocket + same-origin Socket.IO gate) so a domain bind never rebuilds or restarts a shop. The panel orchestrates a Cloudflare custom hostname (edge TLS, HTTP DCV) and attaches the domain to the shop's existing NPM proxy host. Cloudflare sends SNI = fallback origin (`custom.siamsite.shop`) and Host = the custom domain, so the existing `*.siamsite.shop` origin cert is reused with no per-domain origin cert.

**Tech Stack:** Node/Express/TypeScript (panel + shop backend), Next.js 14 (panel + shop frontend), MySQL, Cloudflare for SaaS API, Nginx Proxy Manager 2.14 API, Socket.IO, Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-23-custom-domains-design.md`.
- v1 supports **subdomains only** (e.g. `shop.theirstore.com`); reject apex domains.
- Customer must add **exactly one** record: `<custom>  CNAME  custom.siamsite.shop`.
- No per-domain origin TLS cert — Cloudflare edge handles the customer-facing cert; origin keeps the `*.siamsite.shop` cert.
- NPM 2.14 API quirks: omit `meta` on proxy-host PUT/POST, keep `locations: []`, preserve `advanced_config`. Use `npmService` helpers only.
- Cloudflare service must reuse the existing IPv4-pinned `request()` + `headers()` in `cloudflare.service.ts` (container has no IPv6).
- Panel DB migrations are applied **manually** (no auto-runner).
- UI copy: Thai-friendly, **no em dashes** (use `-`, `:`, parentheses); validation errors must name the field/problem.
- Shop frontend HTTP API is already host-relative (`/api`) — do not change it.

---

### Task 1: Shop backend - host-aware Socket.IO origin gate

Makes Socket.IO accept a same-origin handshake from any custom domain while still honoring `CORS_ORIGIN`. HTTP API CORS is untouched (same-origin requests bypass CORS).

**Files:**
- Create: `backend/src/utils/wsOrigin.ts`
- Test: `backend/src/services/__tests__/wsOrigin.test.ts`
- Modify: `backend/src/server.ts:40-44` (Socket.IO init)

**Interfaces:**
- Produces: `isWsOriginAllowed(origin: string | undefined, host: string | undefined, allowed: '*' | string[]): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/services/__tests__/wsOrigin.test.ts
import { isWsOriginAllowed } from '../../utils/wsOrigin';

describe('isWsOriginAllowed', () => {
  it('allows non-browser clients (no Origin header)', () => {
    expect(isWsOriginAllowed(undefined, 'name.siamsite.shop', [])).toBe(true);
  });
  it('allows same-origin custom domains not in the configured list', () => {
    expect(isWsOriginAllowed('https://shop.theirstore.com', 'shop.theirstore.com', [])).toBe(true);
  });
  it('allows an explicitly configured origin', () => {
    expect(isWsOriginAllowed('https://name.siamsite.shop', 'name.siamsite.shop', ['https://name.siamsite.shop'])).toBe(true);
  });
  it('rejects a cross-origin host that is not configured', () => {
    expect(isWsOriginAllowed('https://evil.com', 'shop.theirstore.com', [])).toBe(false);
  });
  it('honors wildcard', () => {
    expect(isWsOriginAllowed('https://evil.com', 'shop.theirstore.com', '*')).toBe(true);
  });
  it('matches host including port (dev)', () => {
    expect(isWsOriginAllowed('http://localhost:3000', 'localhost:3000', [])).toBe(true);
  });
  it('rejects a malformed origin', () => {
    expect(isWsOriginAllowed('not-a-url', 'shop.theirstore.com', [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest wsOrigin -t isWsOriginAllowed`
Expected: FAIL with "Cannot find module '../../utils/wsOrigin'".

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/utils/wsOrigin.ts

/**
 * Decide whether a Socket.IO handshake is allowed.
 * A connection passes when it is non-browser (no Origin), explicitly configured,
 * wildcard, or strictly same-origin (Origin host === request Host). The same-origin
 * rule is what lets a shop work on any custom domain without a container restart.
 * Safe because auth is an httpOnly, SameSite cookie, so cross-site pages cannot
 * ride a logged-in user's session over the socket.
 */
export function isWsOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowed: '*' | string[]
): boolean {
  if (!origin) return true;
  if (allowed === '*') return true;
  if (allowed.includes(origin)) return true;
  if (host) {
    try {
      if (new URL(origin).host === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest wsOrigin`
Expected: PASS (7 passing).

- [ ] **Step 5: Wire it into Socket.IO**

In `backend/src/server.ts`, replace the Socket.IO init block (currently lines ~40-44):

```ts
// Socket.IO
// cors.origin: true reflects the request origin so the browser never sees a CORS
// error; allowRequest is the real gate (same-origin custom domains + configured
// origins). The players namespace only broadcasts public online counts.
const io = new SocketIO(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  allowRequest: (req, cb) => {
    const ok = isWsOriginAllowed(req.headers.origin, req.headers.host, allowedOrigins);
    cb(ok ? null : 'origin_not_allowed', ok);
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});
```

Add the import near the other imports at the top of `backend/src/server.ts`:

```ts
import { isWsOriginAllowed } from './utils/wsOrigin';
```

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/utils/wsOrigin.ts backend/src/services/__tests__/wsOrigin.test.ts backend/src/server.ts
git commit -m "feat(shop): host-aware Socket.IO origin gate for custom domains"
```

---

### Task 2: Shop frontend - host-relative WebSocket URL

Makes the live-players socket connect to the same origin the page is on, so any custom domain works with no frontend rebuild. Dev behavior (`:4000`) is preserved.

**Files:**
- Create: `frontend/src/lib/wsUrl.ts`
- Modify: `frontend/src/hooks/useOnlinePlayers.ts:54-63` (WS URL block)

**Interfaces:**
- Produces: `resolveWsUrl(loc: { protocol: string; hostname: string; host: string } | undefined, configuredUrl: string | undefined): string`

- [ ] **Step 1: Create the pure resolver**

```ts
// frontend/src/lib/wsUrl.ts

type Loc = { protocol: string; hostname: string; host: string };

/**
 * Resolve the Socket.IO URL.
 * - Production: connect same-origin (wss://<current host>) through NPM's 443 /socket.io
 *   proxy, so the shop works on its siamsite subdomain OR any custom domain pointed at
 *   it, with no rebuild. The baked NEXT_PUBLIC_WS_URL is intentionally ignored here.
 * - Dev (localhost/127.0.0.1): the backend runs on :4000 with no proxy, so target :4000.
 * - SSR (no window): fall back to the configured env or localhost.
 */
export function resolveWsUrl(loc: Loc | undefined, configuredUrl: string | undefined): string {
  if (!loc) return configuredUrl || 'ws://localhost:4000';
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws';
  const isLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (isLocal) {
    if (configuredUrl && (configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1'))) {
      return configuredUrl;
    }
    return `${scheme}://${loc.hostname}:4000`;
  }
  return `${scheme}://${loc.host}`;
}
```

- [ ] **Step 2: Use it in the hook**

In `frontend/src/hooks/useOnlinePlayers.ts`, replace the WS URL derivation block (the `const configuredUrl ... const wsUrl = ...` lines, ~54-63) with:

```ts
    const wsUrl = resolveWsUrl(
      typeof window !== 'undefined' ? window.location : undefined,
      process.env.NEXT_PUBLIC_WS_URL
    );
```

Add the import at the top of the file:

```ts
import { resolveWsUrl } from '@/lib/wsUrl';
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (reason through the four cases)**

Confirm by reading `resolveWsUrl`:
- `{protocol:'https:',hostname:'shop.theirstore.com',host:'shop.theirstore.com'}` + baked `wss://name.siamsite.shop` -> returns `wss://shop.theirstore.com` (custom domain, same-origin).
- `{protocol:'https:',hostname:'name.siamsite.shop',host:'name.siamsite.shop'}` -> returns `wss://name.siamsite.shop` (existing shops keep working).
- `{protocol:'http:',hostname:'localhost',host:'localhost:3000'}` -> returns `ws://localhost:4000` (dev).
- `undefined` + `wss://x` -> returns `wss://x` (SSR).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/wsUrl.ts frontend/src/hooks/useOnlinePlayers.ts
git commit -m "feat(shop): host-relative WebSocket URL so custom domains work without rebuild"
```

---

### Task 3: Panel backend - add Jest + custom-hostname validator

Adds a minimal test runner to the panel backend (it has none) and the pure domain validator the orchestration service depends on.

**Files:**
- Modify: `panel/backend/package.json` (devDeps + `test` script)
- Create: `panel/backend/jest.config.js`
- Create: `panel/backend/src/utils/customDomain.ts`
- Test: `panel/backend/src/utils/__tests__/customDomain.test.ts`

**Interfaces:**
- Produces: `validateCustomHostname(hostname: string, opts: { siamsiteSuffix: string }): { ok: true; value: string } | { ok: false; error: string }`

- [ ] **Step 1: Add Jest to the panel backend**

Run: `cd panel/backend && npm install -D jest@^29 ts-jest@^29 @types/jest@^29`

Add to `panel/backend/package.json` `scripts`:

```json
    "test": "jest"
```

Create `panel/backend/jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
```

- [ ] **Step 2: Write the failing test**

```ts
// panel/backend/src/utils/__tests__/customDomain.test.ts
import { validateCustomHostname } from '../customDomain';

const opts = { siamsiteSuffix: 'siamsite.shop' };

describe('validateCustomHostname', () => {
  it('accepts a normal subdomain (lowercased, trimmed)', () => {
    expect(validateCustomHostname('  Shop.TheirStore.com ', opts)).toEqual({ ok: true, value: 'shop.theirstore.com' });
  });
  it('accepts a deep subdomain', () => {
    expect(validateCustomHostname('store.shop.theirstore.com', opts)).toEqual({ ok: true, value: 'store.shop.theirstore.com' });
  });
  it('rejects an apex domain (only one label before TLD)', () => {
    expect(validateCustomHostname('theirstore.com', opts).ok).toBe(false);
  });
  it('rejects our own siamsite suffix', () => {
    expect(validateCustomHostname('foo.siamsite.shop', opts).ok).toBe(false);
  });
  it('rejects empty / malformed input', () => {
    expect(validateCustomHostname('', opts).ok).toBe(false);
    expect(validateCustomHostname('has space.com', opts).ok).toBe(false);
    expect(validateCustomHostname('http://x.theirstore.com', opts).ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd panel/backend && npx jest customDomain`
Expected: FAIL with "Cannot find module '../customDomain'".

- [ ] **Step 4: Implement the validator**

```ts
// panel/backend/src/utils/customDomain.ts

const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

/**
 * Validate a customer-supplied custom hostname for v1 (subdomains only).
 * Returns the normalized (lowercased, trimmed) hostname or a user-facing error.
 */
export function validateCustomHostname(
  hostname: string,
  opts: { siamsiteSuffix: string }
): { ok: true; value: string } | { ok: false; error: string } {
  const value = (hostname || '').trim().toLowerCase();
  if (!value) return { ok: false, error: 'กรุณากรอกโดเมน' };
  if (!HOSTNAME_RE.test(value)) return { ok: false, error: 'รูปแบบโดเมนไม่ถูกต้อง (เช่น shop.yourdomain.com)' };
  // Subdomain only: need at least 3 labels (sub + domain + tld). Reject apex like x.com.
  if (value.split('.').length < 3) {
    return { ok: false, error: 'รองรับเฉพาะ subdomain (เช่น shop.yourdomain.com) ยังไม่รองรับโดเมนหลัก' };
  }
  if (value === opts.siamsiteSuffix || value.endsWith(`.${opts.siamsiteSuffix}`)) {
    return { ok: false, error: `ใช้โดเมน ${opts.siamsiteSuffix} เป็นโดเมนของตัวเองไม่ได้` };
  }
  return { ok: true, value };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd panel/backend && npx jest customDomain`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add panel/backend/package.json panel/backend/package-lock.json panel/backend/jest.config.js panel/backend/src/utils/customDomain.ts panel/backend/src/utils/__tests__/customDomain.test.ts
git commit -m "feat(panel): add jest + custom hostname validator"
```

---

### Task 4: Panel backend - Cloudflare custom-hostname status mapper

Maps a Cloudflare custom-hostname API response to our 4-state machine. Pure and unit-tested.

**Files:**
- Modify: `panel/backend/src/utils/customDomain.ts` (append)
- Modify: `panel/backend/src/utils/__tests__/customDomain.test.ts` (append)

**Interfaces:**
- Produces: `type CustomDomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed'`
- Produces: `mapCfHostnameStatus(cf: { status?: string; ssl?: { status?: string } }): CustomDomainStatus`

- [ ] **Step 1: Append the failing test**

```ts
// append to panel/backend/src/utils/__tests__/customDomain.test.ts
import { mapCfHostnameStatus } from '../customDomain';

describe('mapCfHostnameStatus', () => {
  it('active when hostname + ssl both active', () => {
    expect(mapCfHostnameStatus({ status: 'active', ssl: { status: 'active' } })).toBe('active');
  });
  it('pending_dns while ssl awaits validation', () => {
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'pending_validation' } })).toBe('pending_dns');
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'initializing' } })).toBe('pending_dns');
  });
  it('pending_ssl while cert issues/deploys', () => {
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'pending_issuance' } })).toBe('pending_ssl');
    expect(mapCfHostnameStatus({ status: 'active', ssl: { status: 'pending_deployment' } })).toBe('pending_ssl');
  });
  it('failed on blocked/moved/deleted', () => {
    expect(mapCfHostnameStatus({ status: 'blocked', ssl: { status: 'pending_validation' } })).toBe('failed');
    expect(mapCfHostnameStatus({ status: 'moved' })).toBe('failed');
    expect(mapCfHostnameStatus({ status: 'pending', ssl: { status: 'deleted' } })).toBe('failed');
  });
  it('defaults to pending_ssl when unknown', () => {
    expect(mapCfHostnameStatus({})).toBe('pending_ssl');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd panel/backend && npx jest customDomain -t mapCfHostnameStatus`
Expected: FAIL with "mapCfHostnameStatus is not a function".

- [ ] **Step 3: Implement the mapper**

```ts
// append to panel/backend/src/utils/customDomain.ts

export type CustomDomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed';

export function mapCfHostnameStatus(cf: { status?: string; ssl?: { status?: string } }): CustomDomainStatus {
  const hostStatus = cf.status ?? '';
  const sslStatus = cf.ssl?.status ?? '';

  if (['blocked', 'moved', 'deleted', 'pending_deletion'].includes(hostStatus)) return 'failed';
  if (['deleted', 'pending_deletion'].includes(sslStatus)) return 'failed';

  if (hostStatus === 'active' && sslStatus === 'active') return 'active';

  if (['initializing', 'pending_validation'].includes(sslStatus)) return 'pending_dns';
  if (['pending_issuance', 'pending_deployment', 'pending_cleanup'].includes(sslStatus)) return 'pending_ssl';

  return 'pending_ssl';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd panel/backend && npx jest customDomain`
Expected: PASS (all customDomain tests).

- [ ] **Step 5: Commit**

```bash
git add panel/backend/src/utils/customDomain.ts panel/backend/src/utils/__tests__/customDomain.test.ts
git commit -m "feat(panel): map Cloudflare custom-hostname status to state machine"
```

---

### Task 5: Panel backend - Cloudflare for SaaS custom-hostname API methods

Adds CF for SaaS calls to the existing `cloudflare.service.ts`, reusing its IPv4-pinned `request()` + `headers()`.

**Files:**
- Modify: `panel/backend/src/services/cloudflare.service.ts` (add methods before the closing `}` of the class)

**Interfaces:**
- Consumes: existing private `getConfig()`, `isConfigured()`, `request()`, `extractError()`, and `CfConfig` (`{ apiKey, email, zoneId, serverIp }`).
- Produces:
  - `ensureFallbackOrigin(fallbackHost: string): Promise<void>`
  - `createCustomHostname(hostname: string): Promise<{ id: string; status: string; ssl: { status: string } }>`
  - `getCustomHostname(id: string): Promise<{ status: string; ssl: { status: string } }>`
  - `deleteCustomHostname(id: string): Promise<void>`

- [ ] **Step 1: Add the methods**

Insert into the `CloudflareService` class in `panel/backend/src/services/cloudflare.service.ts`, just before the final closing brace of the class:

```ts
  /**
   * One-time: create the proxied fallback-origin record (custom.siamsite.shop -> origin)
   * and register it as the zone's Cloudflare-for-SaaS fallback origin. Idempotent.
   * Cloudflare sends this hostname as the SNI to our origin, so NPM can serve the
   * existing *.siamsite.shop cert for the TLS handshake while routing by Host header.
   */
  async ensureFallbackOrigin(fallbackHost: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }
    // 1. Proxied A record for the fallback host.
    const dnsBase = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${dnsBase}?type=A&name=${encodeURIComponent(fallbackHost)}`, cfg);
      if (!(list.data.result?.length > 0)) {
        await this.request('post', dnsBase, cfg, {
          type: 'A', name: fallbackHost, content: cfg.serverIp, proxied: true, ttl: 1,
        });
      }
      // 2. Register the fallback origin for custom hostnames.
      await this.request(
        'put',
        `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/fallback_origin`,
        cfg,
        { origin: fallbackHost }
      );
      console.log(`[CF] Fallback origin ensured: ${fallbackHost}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /**
   * Create a Cloudflare custom hostname with HTTP DCV (no extra TXT record needed -
   * the single CNAME is enough). Cloudflare auto-issues the edge cert.
   */
  async createCustomHostname(hostname: string): Promise<{ id: string; status: string; ssl: { status: string } }> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames`;
    try {
      const resp = await this.request('post', base, cfg, {
        hostname,
        ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
      });
      const r = resp.data.result;
      return { id: r.id, status: r.status, ssl: { status: r.ssl?.status ?? 'initializing' } };
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Read a custom hostname's status for polling. */
  async getCustomHostname(id: string): Promise<{ status: string; ssl: { status: string } }> {
    const cfg = await this.getConfig();
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/${id}`;
    try {
      const resp = await this.request('get', base, cfg);
      const r = resp.data.result;
      return { status: r.status, ssl: { status: r.ssl?.status ?? '' } };
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Delete a custom hostname (detach). Best-effort: tolerates "not found". */
  async deleteCustomHostname(id: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) return;
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/${id}`;
    try {
      await this.request('delete', base, cfg);
      console.log(`[CF] Deleted custom hostname ${id}`);
    } catch (err) {
      console.warn(`[CF] deleteCustomHostname(${id}) failed:`, this.extractError(err));
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd panel/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add panel/backend/src/services/cloudflare.service.ts
git commit -m "feat(panel): Cloudflare for SaaS custom-hostname API methods"
```

---

### Task 6: Panel backend - NPM attach/detach custom domain

Adds/removes a custom domain on a shop's existing NPM proxy host `domain_names` array, preserving NPM 2.14 constraints.

**Files:**
- Modify: `panel/backend/src/services/npm.service.ts` (add methods before `deleteProxyHost`)

**Interfaces:**
- Consumes: existing private `api()`.
- Produces:
  - `addDomainToProxyHost(shopDomain: string, customDomain: string): Promise<void>`
  - `removeDomainFromProxyHost(shopDomain: string, customDomain: string): Promise<void>`

- [ ] **Step 1: Add the methods**

Insert into `NpmService` in `panel/backend/src/services/npm.service.ts`, just before `deleteProxyHost`:

```ts
  /**
   * Attach a custom domain to an existing shop proxy host by adding it to domain_names.
   * NPM routes by Host header, so the shop is served for both its siamsite subdomain
   * and the custom domain. No new origin cert: Cloudflare terminates the edge cert and
   * connects to origin with SNI = the fallback origin (covered by *.siamsite.shop).
   */
  async addDomainToProxyHost(shopDomain: string, customDomain: string): Promise<void> {
    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as {
      domain_names: string[]; id: number; forward_scheme: string; forward_host: string;
      forward_port: number; access_list_id: number; certificate_id: number; ssl_forced: boolean;
      http2_support: boolean; block_exploits: boolean; caching_enabled: boolean;
      allow_websocket_upgrade: boolean; advanced_config: string;
    }[]).find(h => h.domain_names.includes(shopDomain));
    if (!existing) throw new Error(`ไม่พบ proxy host สำหรับ ${shopDomain} ใน NPM`);

    if (existing.domain_names.includes(customDomain)) return;

    await this.api('put', `/nginx/proxy-hosts/${existing.id}`, {
      domain_names: [...existing.domain_names, customDomain],
      forward_scheme: existing.forward_scheme,
      forward_host: existing.forward_host,
      forward_port: existing.forward_port,
      access_list_id: existing.access_list_id,
      certificate_id: existing.certificate_id,
      ssl_forced: existing.ssl_forced,
      http2_support: existing.http2_support,
      block_exploits: existing.block_exploits,
      caching_enabled: existing.caching_enabled,
      allow_websocket_upgrade: existing.allow_websocket_upgrade,
      advanced_config: existing.advanced_config,
      locations: [],
      enabled: true,
    });
    console.log(`[NPM] Attached ${customDomain} to proxy host ${existing.id} (${shopDomain})`);
  }

  /** Detach a custom domain from a shop proxy host. No-op if absent. */
  async removeDomainFromProxyHost(shopDomain: string, customDomain: string): Promise<void> {
    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as {
      domain_names: string[]; id: number; forward_scheme: string; forward_host: string;
      forward_port: number; access_list_id: number; certificate_id: number; ssl_forced: boolean;
      http2_support: boolean; block_exploits: boolean; caching_enabled: boolean;
      allow_websocket_upgrade: boolean; advanced_config: string;
    }[]).find(h => h.domain_names.includes(shopDomain));
    if (!existing) return;
    if (!existing.domain_names.includes(customDomain)) return;

    await this.api('put', `/nginx/proxy-hosts/${existing.id}`, {
      domain_names: existing.domain_names.filter(d => d !== customDomain),
      forward_scheme: existing.forward_scheme,
      forward_host: existing.forward_host,
      forward_port: existing.forward_port,
      access_list_id: existing.access_list_id,
      certificate_id: existing.certificate_id,
      ssl_forced: existing.ssl_forced,
      http2_support: existing.http2_support,
      block_exploits: existing.block_exploits,
      caching_enabled: existing.caching_enabled,
      allow_websocket_upgrade: existing.allow_websocket_upgrade,
      advanced_config: existing.advanced_config,
      locations: [],
      enabled: true,
    });
    console.log(`[NPM] Detached ${customDomain} from proxy host ${existing.id} (${shopDomain})`);
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd panel/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add panel/backend/src/services/npm.service.ts
git commit -m "feat(panel): NPM attach/detach custom domain to shop proxy host"
```

---

### Task 7: Panel DB migration - custom domain columns

**Files:**
- Create: `panel/database/migrations/014_custom_domain.sql`

- [ ] **Step 1: Write the migration**

```sql
-- panel/database/migrations/014_custom_domain.sql
-- Custom domain (BYOD) support for subscriptions.
ALTER TABLE subscriptions
  ADD COLUMN custom_domain VARCHAR(255) NULL,
  ADD COLUMN custom_hostname_id VARCHAR(64) NULL,
  ADD COLUMN custom_domain_status ENUM('pending_dns','pending_ssl','active','failed') NULL,
  ADD COLUMN custom_domain_added_at DATETIME NULL;

-- Unique when set (MySQL allows multiple NULLs in a UNIQUE index).
CREATE UNIQUE INDEX uq_subscriptions_custom_domain ON subscriptions (custom_domain);
```

- [ ] **Step 2: Apply it manually to panel-mysql**

Run (panel root password is `PANEL_MYSQL_ROOT_PASSWORD` in `deploy/panel.env`):

```bash
docker exec -i panel-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamworld_panel' < panel/database/migrations/014_custom_domain.sql
```

- [ ] **Step 3: Verify columns exist**

```bash
docker exec -i panel-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW COLUMNS FROM siamworld_panel.subscriptions LIKE \"custom_%\""'
```
Expected: 4 rows (`custom_domain`, `custom_hostname_id`, `custom_domain_status`, `custom_domain_added_at`).

- [ ] **Step 4: Commit**

```bash
git add panel/database/migrations/014_custom_domain.sql
git commit -m "feat(panel): migration 014 - custom domain columns on subscriptions"
```

---

### Task 8: Panel backend - custom-domain orchestration service

Ties validation + CF + NPM + DB into a small state machine.

**Files:**
- Create: `panel/backend/src/services/custom-domain.service.ts`

**Interfaces:**
- Consumes: `validateCustomHostname`, `mapCfHostnameStatus`, `CustomDomainStatus` (Tasks 3-4); `cloudflareService.{ensureFallbackOrigin,createCustomHostname,getCustomHostname,deleteCustomHostname}` (Task 5); `npmService.{addDomainToProxyHost,removeDomainFromProxyHost}` (Task 6); `pool` from `../database/connection`; `settingsService`.
- Produces:
  - `requestCustomDomain(subscriptionId: number, hostname: string): Promise<{ customDomain: string; cnameTarget: string; status: CustomDomainStatus }>`
  - `pollCustomDomain(subscriptionId: number): Promise<{ status: CustomDomainStatus }>`
  - `removeCustomDomain(subscriptionId: number): Promise<void>`
  - `getCustomDomain(subscriptionId: number): Promise<{ customDomain: string | null; status: CustomDomainStatus | null; cnameTarget: string }>`

- [ ] **Step 1: Implement the service**

```ts
// panel/backend/src/services/custom-domain.service.ts
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { settingsService } from './settings.service';
import { cloudflareService } from './cloudflare.service';
import { npmService } from './npm.service';
import { validateCustomHostname, mapCfHostnameStatus, CustomDomainStatus } from '../utils/customDomain';

const SIAMSITE_SUFFIX = 'siamsite.shop';
const FALLBACK_ORIGIN = 'custom.siamsite.shop';

class CustomDomainService {
  private async loadSub(subscriptionId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, domain, status, custom_domain, custom_hostname_id, custom_domain_status FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!rows.length) throw new Error('ไม่พบร้านค้านี้');
    return rows[0];
  }

  async getCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    return {
      customDomain: sub.custom_domain ?? null,
      status: (sub.custom_domain_status ?? null) as CustomDomainStatus | null,
      cnameTarget: FALLBACK_ORIGIN,
    };
  }

  async requestCustomDomain(subscriptionId: number, hostname: string) {
    const sub = await this.loadSub(subscriptionId);
    if (sub.status !== 'active') throw new Error('ร้านค้ายังไม่พร้อมใช้งาน (deploy ให้เสร็จก่อน)');
    if (sub.custom_domain) throw new Error('มีโดเมนอยู่แล้ว กรุณาลบก่อนเพิ่มใหม่');

    const v = validateCustomHostname(hostname, { siamsiteSuffix: SIAMSITE_SUFFIX });
    if (!v.ok) throw new Error(v.error);
    const domain = v.value;

    const [dupes] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM subscriptions WHERE custom_domain = ? AND id <> ?',
      [domain, subscriptionId]
    );
    if (dupes.length) throw new Error('โดเมนนี้ถูกใช้ไปแล้ว');

    await cloudflareService.ensureFallbackOrigin(FALLBACK_ORIGIN);
    const ch = await cloudflareService.createCustomHostname(domain);
    const status = mapCfHostnameStatus(ch);

    await pool.execute(
      `UPDATE subscriptions
         SET custom_domain = ?, custom_hostname_id = ?, custom_domain_status = ?, custom_domain_added_at = NOW()
       WHERE id = ?`,
      [domain, ch.id, status, subscriptionId]
    );

    return { customDomain: domain, cnameTarget: FALLBACK_ORIGIN, status };
  }

  async pollCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub.custom_domain || !sub.custom_hostname_id) throw new Error('ยังไม่ได้ตั้งค่าโดเมน');

    const ch = await cloudflareService.getCustomHostname(sub.custom_hostname_id);
    const status = mapCfHostnameStatus(ch);

    // On first transition to active, attach the domain to the shop's NPM proxy host.
    if (status === 'active' && sub.custom_domain_status !== 'active') {
      await npmService.addDomainToProxyHost(sub.domain, sub.custom_domain);
    }

    await pool.execute('UPDATE subscriptions SET custom_domain_status = ? WHERE id = ?', [status, subscriptionId]);
    return { status };
  }

  async removeCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub.custom_domain) return;

    if (sub.custom_domain_status === 'active') {
      await npmService.removeDomainFromProxyHost(sub.domain, sub.custom_domain);
    }
    if (sub.custom_hostname_id) {
      await cloudflareService.deleteCustomHostname(sub.custom_hostname_id);
    }
    await pool.execute(
      `UPDATE subscriptions
         SET custom_domain = NULL, custom_hostname_id = NULL, custom_domain_status = NULL, custom_domain_added_at = NULL
       WHERE id = ?`,
      [subscriptionId]
    );
  }
}

export const customDomainService = new CustomDomainService();
```

- [ ] **Step 2: Typecheck**

Run: `cd panel/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add panel/backend/src/services/custom-domain.service.ts
git commit -m "feat(panel): custom-domain orchestration service"
```

---

### Task 9: Panel backend - subscription routes for custom domain

Exposes the wizard endpoints under the existing owner-scoped subscription router.

**Files:**
- Modify: `panel/backend/src/routes/subscription.routes.ts` (add routes near the other `/:id/...` handlers)

**Interfaces:**
- Consumes: `customDomainService` (Task 8). Reuse the existing ownership check pattern used by `/:id/action` (load subscription, require `subscription.user_id === req.user.id` OR `req.user.role === 'admin'`).

- [ ] **Step 1: Read the existing `/:id/action` handler** to copy the exact auth/ownership pattern.

Run: `sed -n '85,135p' panel/backend/src/routes/subscription.routes.ts`

- [ ] **Step 2: Add the routes**

Add the import at the top of `panel/backend/src/routes/subscription.routes.ts`:

```ts
import { customDomainService } from '../services/custom-domain.service';
```

Add these handlers alongside the other `/:id/...` routes (mirror the ownership guard already used by `/:id/action` - load the subscription, allow the owner or an admin, else 403/404):

```ts
// Read current custom-domain state
router.get('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await assertSubscriptionAccess(req, id); // same guard used by /:id/action
  const data = await customDomainService.getCustomDomain(id);
  res.json({ success: true, data });
}));

// Request a custom domain (creates CF custom hostname, returns the CNAME to add)
router.post('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await assertSubscriptionAccess(req, id);
  const { hostname } = req.body as { hostname?: string };
  const data = await customDomainService.requestCustomDomain(id, hostname ?? '');
  res.json({ success: true, data });
}));

// Poll verification status (and auto-attach to NPM once active)
router.post('/:id/custom-domain/verify', requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await assertSubscriptionAccess(req, id);
  const data = await customDomainService.pollCustomDomain(id);
  res.json({ success: true, data });
}));

// Remove the custom domain
router.delete('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  await assertSubscriptionAccess(req, id);
  await customDomainService.removeCustomDomain(id);
  res.json({ success: true });
}));
```

If a reusable `assertSubscriptionAccess(req, id)` helper does not already exist in this file, extract one from the inline ownership check in `/:id/action` (load subscription by id, throw a 403/404 typed error unless `row.user_id === req.user.id || req.user.role === 'admin'`) and use it in all the `/:id/...` routes including the new ones. Per the panel admin-subscope rule, admins bypass the owner check.

- [ ] **Step 3: Typecheck**

Run: `cd panel/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add panel/backend/src/routes/subscription.routes.ts
git commit -m "feat(panel): custom-domain wizard API routes"
```

---

### Task 10: Panel frontend - custom-domain wizard page

Self-service step-by-step UI: enter domain -> show CNAME -> poll status -> live / remove.

**Files:**
- Create: `panel/frontend/src/app/dashboard/domain/page.tsx`
- Modify: `panel/frontend/src/app/dashboard/page.tsx` (add a link/card to the domain page)

**Interfaces:**
- Consumes: panel API client `panel/frontend/src/lib/api.ts`; backend routes from Task 9 (`GET/POST/DELETE /api/subscriptions/:id/custom-domain`, `POST .../verify`). The subscription id comes from the dashboard's current subscription (same source `dashboard/credentials/page.tsx` already uses).

- [ ] **Step 1: Read sibling dashboard pages for conventions**

Run: `sed -n '1,60p' panel/frontend/src/app/dashboard/credentials/page.tsx`
Note how it: gets the API base, fetches the user's subscription id, renders the dashboard shell, and shows toasts/copy buttons. Match that style (do not introduce a new design system; no em dashes in copy).

- [ ] **Step 2: Build the wizard page**

Create `panel/frontend/src/app/dashboard/domain/page.tsx` as a client component implementing these states from `GET /:id/custom-domain` (`status`: null | pending_dns | pending_ssl | active | failed) and `cnameTarget`:

- **No domain (`custom_domain` null):** input for the domain + helper text ("รองรับเฉพาะ subdomain เช่น shop.yourdomain.com"). Submit -> `POST /:id/custom-domain` with `{ hostname }`. On field error, show the server message inline next to the input.
- **pending_dns:** Step card titled "เพิ่ม CNAME ที่ผู้ให้บริการโดเมน (z.com / Hostinger)" showing a copyable record: name = the subdomain label, type = `CNAME`, value = `cnameTarget` (`custom.siamsite.shop`). Short pointer: "ไปที่ DNS / Zone Editor ของโดเมน เพิ่ม record ด้านบน แล้วกดตรวจสอบ". A "ตรวจสอบสถานะ" button calls `POST /:id/custom-domain/verify`; also auto-poll every 10s while on pending_dns/pending_ssl.
- **pending_ssl:** status badge "กำลังออกใบรับรอง (SSL) รอสักครู่" with the spinner; keep polling.
- **active:** success card with the live URL `https://<custom_domain>` (link) and a "ลบโดเมน" button -> `DELETE /:id/custom-domain` (with a confirm).
- **failed:** error card explaining the CNAME may be missing/incorrect, with a "ตรวจสอบอีกครั้ง" (verify) and "ลบและลองใหม่" (delete) action.

Use the existing API helper for all calls (cookie auth is automatic). All user-facing copy in Thai, no em dashes, errors name the problem.

- [ ] **Step 3: Add an entry point on the dashboard**

In `panel/frontend/src/app/dashboard/page.tsx`, add a card/link "โดเมนของฉัน (Custom Domain)" that routes to `/dashboard/domain`, placed near the existing credentials/renew cards and matching their markup.

- [ ] **Step 4: Typecheck + lint**

Run: `cd panel/frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add panel/frontend/src/app/dashboard/domain/page.tsx panel/frontend/src/app/dashboard/page.tsx
git commit -m "feat(panel): self-service custom-domain wizard UI"
```

---

### Task 11: One-time ops runbook + end-to-end validation

**Files:**
- Create: `docs/superpowers/runbooks/custom-domains-setup.md`

- [ ] **Step 1: Write the runbook**

Document the one-time operator setup and the rebuild steps:

```markdown
# Custom Domains - one-time setup & rollout

## A. Enable Cloudflare for SaaS (siamsite.shop zone)
1. Cloudflare dashboard -> siamsite.shop -> SSL/TLS -> Custom Hostnames -> Enable
   Cloudflare for SaaS (100 hostnames free, then $0.10/hostname/mo).
2. The panel will set the fallback origin automatically on first use
   (custom.siamsite.shop). To pre-create it manually:
   `docker exec panel-backend node -e "require('/app/dist/services/cloudflare.service').cloudflareService.ensureFallbackOrigin('custom.siamsite.shop').then(()=>console.log('ok'))"`

## B. NPM fallback-origin proxy host (TLS handshake target)
Cloudflare connects to origin with SNI = custom.siamsite.shop. NPM must have a proxy
host whose domain_names include custom.siamsite.shop, using the *.siamsite.shop cert
(the same cert other shops use), so the Full(strict) handshake succeeds. Create it once
in NPM (any forward target is fine; it only needs to terminate TLS for the SNI). Verify:
`curl -sI --resolve custom.siamsite.shop:443:<CF_IP> https://custom.siamsite.shop/` returns a TLS response (not handshake error).

## C. Apply panel migration 014 (manual)
`docker exec -i panel-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamworld_panel' < panel/database/migrations/014_custom_domain.sql`

## D. Rebuild shared shop image (host-agnostic WS/CORS)
Per feedback_customer_deploy: rebuild shops via manage-customer.sh (never docker build
directly). Existing shops keep working on their siamsite subdomains after rebuild.

## E. Rebuild panel
`docker compose -f deploy/panel-compose.yml --env-file deploy/panel.env up -d --build --no-deps panel-backend panel-frontend`

## F. End-to-end test on a real test domain
1. In a test shop's dashboard -> Custom Domain, enter shop.<testdomain>.com.
2. Add the shown CNAME at the registrar.
3. Watch status: pending_dns -> pending_ssl -> active.
4. Visit https://shop.<testdomain>.com: shop loads, login works, online-players widget
   connects (WS over the custom domain, check devtools Network -> WS).
5. Remove the domain; confirm it detaches from NPM and the CF custom hostname is gone.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/custom-domains-setup.md
git commit -m "docs: custom-domains one-time setup runbook"
```

- [ ] **Step 3: Execute the end-to-end test (section F)** once everything is deployed, and record the result. Do not mark the feature done until a real custom domain reaches `active` and the shop loads (page + login + WS) on it.

---

## Self-Review

**Spec coverage:**
- Goal/model + per-shop choice -> Tasks 8-10 (DB nullable custom_domain; UI add/remove).
- Cloudflare for SaaS custom hostnames + fallback origin + HTTP DCV -> Task 5, Task 11/A-B.
- TLS-to-origin (SNI=fallback, Host=custom, reuse *.siamsite.shop) -> Task 6 (Host routing), Task 11/B (SNI handshake host).
- Host-agnostic WS (3a) -> Task 2. Host-aware CORS/Socket.IO (3b) -> Task 1.
- Panel orchestration (cloudflare.service, npm.service, custom-domain.service) -> Tasks 5, 6, 8.
- DB columns (manual migration) -> Task 7.
- Self-service wizard UI -> Task 10.
- Validation + status state machine -> Tasks 3-4.
- Error handling (named fields, idempotent detach) -> Tasks 3, 6, 8 (best-effort delete), 10.
- Testing (validation, status mapping, CORS origin, WS derivation, manual e2e) -> Tasks 1-4, 11.
- Rollout order -> Task 11.

**Placeholder scan:** No TBD/TODO; every code step shows full code. The only deliberately descriptive steps are the UI build (Task 10) and the ops runbook prose (Task 11), which are spec'd state-by-state.

**Type consistency:** `CustomDomainStatus` defined in Task 4, consumed in Tasks 8-10. `validateCustomHostname`/`mapCfHostnameStatus` signatures match across Tasks 3-4-8. CF method shapes (`{ id, status, ssl:{status} }`) consistent across Tasks 5-8. NPM method names (`addDomainToProxyHost`/`removeDomainFromProxyHost`) consistent across Tasks 6-8. `isWsOriginAllowed`/`resolveWsUrl` consistent across Tasks 1-2.
