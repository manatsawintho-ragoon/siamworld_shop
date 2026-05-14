# Siamsite Bridge — WebSocket Protocol v1

The bridge decouples the deployed shop website from the customer's AuthMe MySQL.
The customer's MC plugin opens **one outbound WSS connection** to the panel and
keeps it alive. The panel relays auth queries from the deployed shop website
through that connection. The plugin runs queries against its **local** AuthMe DB
and returns results.

This means the customer's MC server has **zero dependency** on the panel for
gameplay or AuthMe login. If the panel goes down, only the *web* shop is
affected — players keep playing.

## Endpoint

```
wss://panel.siamsite.shop/bridge?token=<plugin_token>&v=<plugin_version>
```

- TLS terminated by NPM. Plain `ws://` only allowed in dev.
- Token is per-subscription, issued from the panel dashboard, rotatable.
- `v` is informational so the panel can warn on outdated plugins.

## Connection lifecycle

1. Plugin opens WS with `token` query param.
2. Panel validates token against `bridge_tokens` table:
   - Unknown / revoked → close with code `4401 unauthorized`.
   - Subscription expired/cancelled → close with code `4403 inactive`.
3. Panel sends `hello` frame within 1s.
4. Plugin echoes `hello_ack` with its plugin version and host info.
5. From here the connection is bidirectional request/response.
6. **Heartbeat**: panel sends ping every 30s; plugin must reply pong within 10s.
7. On any error, plugin reconnects with exponential backoff (1s, 2s, 4s, 8s, max 60s) + jitter.

## Frame envelope

Every frame is a single UTF-8 JSON object:

```jsonc
{
  "id":   "string",   // request correlation id; UUIDv4 from sender
  "op":   "string",   // opcode (see below)
  "kind": "req"|"res"|"evt",
  "data": {...},      // op-specific payload
  "err":  null | { "code": "string", "message": "string" } // only on res
}
```

- Requests carry `id` so responses can be matched.
- Events (`kind: "evt"`) have no response — used for one-shot signals.
- Max frame size: 64 KiB. Larger payloads are an error.

## Opcodes

### `hello` (panel → plugin, evt)
Sent immediately after auth. Payload includes `serverTime` (ms epoch),
`subscriptionId`, `shopName`. Plugin replies with `hello_ack`.

### `hello_ack` (plugin → panel, evt)
```jsonc
{
  "pluginVersion": "1.0.0",
  "javaVersion": "17.0.9",
  "mcServer": "Paper-1.20.4-#420",
  "authmeTable": "authme",
  "tz": "Asia/Bangkok"
}
```

### `ping` / `pong` (bidirectional, evt)
Liveness only. Empty data.

### `verify_authme` (panel → plugin, req)
Verify a username + password against the local AuthMe table. **Bcrypt verify
runs on the plugin side so panel never sees the stored hash.**

Request:
```json
{ "username": "Steve", "password": "..." }
```

Response (success):
```json
{ "ok": true, "userId": 42, "email": "steve@example.com" }
```

Response (fail):
```json
{ "ok": false, "reason": "bad_password"|"unknown_user"|"banned" }
```

### `lookup_user` (panel → plugin, req)
Read user metadata without password. Used by the shop UI to fetch profile
fields (last login, registration date, IP) without verifying creds.

Request:
```json
{ "username": "Steve" }
```

Response:
```json
{
  "exists": true,
  "userId": 42,
  "email": "steve@example.com",
  "regdate": 1700000000000,
  "lastLogin": 1730000000000
}
```

### `update_password` (panel → plugin, req)
For "forgot password" flows. Plugin re-hashes with AuthMe-compatible bcrypt
($2a$10$...) and writes to local DB. Idempotent.

Request:
```json
{ "username": "Steve", "newPassword": "..." }
```

Response:
```json
{ "ok": true }
```

### `health` (panel → plugin, req)
Returns plugin's view of its own DB. Used for the "bridge online" indicator
in the customer dashboard.

Response:
```json
{
  "dbReachable": true,
  "authmeRows": 1234,
  "lastError": null,
  "uptimeMs": 86400000
}
```

## Error codes

| code | meaning |
|---|---|
| `unauthorized` | Bad / revoked token |
| `inactive` | Subscription expired or suspended |
| `not_connected` | No plugin connection for this subscription |
| `timeout` | Plugin did not respond within 5s |
| `db_error` | Plugin's local MySQL query failed |
| `bad_request` | Malformed frame or unknown opcode |
| `rate_limited` | Caller exceeded request budget |
| `unsupported` | Plugin version too old for this opcode |

## Plugin-side performance requirements

**Hard rules** the plugin author must follow:

1. **Never block the MC main thread.** All WS I/O and DB queries run on a
   dedicated `BukkitScheduler.runTaskAsynchronously` worker pool, sized 4.
2. **Bounded request queue.** Max 256 in-flight requests; reject `rate_limited`
   if exceeded. The panel will retry.
3. **Local DB connection pool size = 4.** AuthMe itself uses ~2; the bridge
   adds at most 4 more. Total ~6 connections to the local MySQL.
4. **No reflection or classpath scanning at runtime.** All work is plain JDBC
   + the `Java-WebSocket` library.
5. **Bcrypt cost stays at AuthMe's default (10).** Verify takes ~100ms; OK on
   an async thread but never on main.

## Panel-side timeouts and budgets

- Per-request timeout: 5 seconds.
- Per-connection in-flight cap: 256 requests.
- Per-subscription requests/min: 1200 (20 rps sustained).
- Idle timeout: 90 seconds without ping/pong → close with `4408 idle`.

## Security

- Token: 32-byte URL-safe random, stored hashed (sha256) at rest in
  `bridge_tokens.token_hash`. Plaintext returned only at issue time.
- Token rotation: customer can rotate at any time from the dashboard;
  old token rejected immediately.
- Replay protection: each request has a unique `id`; panel rejects duplicate
  ids within a 60-second window.
- The plugin **never** receives the user's plaintext password from anywhere
  except a `verify_authme` request, which it discards immediately after
  bcrypt-verify.

## Versioning

- Protocol version is implicit in the WS path (`/bridge` = v1). Future
  breaking changes go to `/bridge/v2`.
- Within v1, new opcodes can be added; plugins that don't recognize them
  reply with `unsupported` error code so callers can fall back.
