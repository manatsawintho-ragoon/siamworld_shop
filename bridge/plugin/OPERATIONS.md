# SiamsiteBridge — Operations Manual

How to run, monitor, and recover the bridge plugin. For one-off install
steps the customer sees, point them at [`../INSTALL.md`](../INSTALL.md).
For protocol-level details, see [`../protocol.md`](../protocol.md).

## TL;DR

```
plugins/
└── SiamsiteBridge/
    └── config.yml          ← paste token here; everything else has sensible defaults
```

Restart the server (or `/siamsite-bridge reload`). The console prints:

```
[SiamsiteBridge] SiamsiteBridge 1.0.0 enabled.
[SiamsiteBridge] Loaded AuthMe MySQL credentials from plugins/AuthMe/config.yml
[SiamsiteBridge] Connected to wss://panel.siamsite.shop/bridge
```

If you see all three lines, you're done.

## In-game / console commands

All require permission `siamsitebridge.admin` (op by default).

| Command                    | Purpose                                                  |
|----------------------------|----------------------------------------------------------|
| `/siamsite-bridge status`  | Show current connection state + last error               |
| `/siamsite-bridge stats`   | Counters: requests handled, errors, reconnects, uptime   |
| `/siamsite-bridge reload`  | Re-read `config.yml` and reconnect with fresh settings   |
| `/siamsite-bridge reconnect` | Drop and immediately re-open the WS connection         |

Aliases: `/ssbridge`, `/ssb`.

## Configuration reference

`plugins/SiamsiteBridge/config.yml` (auto-created on first start):

| Key                              | Default                              | What it does                          |
|----------------------------------|--------------------------------------|---------------------------------------|
| `panel.url`                      | `wss://panel.siamsite.shop/bridge`   | Endpoint. Don't change unless support tells you to. |
| `panel.token`                    | `PASTE-YOUR-TOKEN-HERE`              | From the panel dashboard's Bridge tab. |
| `authme.auto`                    | `true`                               | Read AuthMe's MySQL config automatically. |
| `authme.{host,port,database,user,password,table}` | —          | Used only when `authme.auto: false`.  |
| `bridge.connection_pool_size`    | `4`                                  | Max JDBC conns to AuthMe DB.          |
| `bridge.worker_threads`          | `4`                                  | Bridge async pool size.               |
| `bridge.reconnect_initial_ms`    | `1000`                               | First retry delay after disconnect.   |
| `bridge.reconnect_max_ms`        | `60000`                              | Upper bound for exponential backoff.  |
| `bridge.max_inflight`            | `256`                                | Hard cap on concurrent panel requests.|

## What "Connected" looks like (server-side observability)

- Console log: `Connected to wss://panel.siamsite.shop/bridge`.
- `/siamsite-bridge status` reports `OPEN`.
- Panel dashboard's Bridge card shows **Online** + plugin version.
- `bridge_tokens.last_seen` in the panel DB ticks forward every ~30s.

## State machine

```
IDLE ──connect()──▶ CONNECTING ──handshake OK──▶ OPEN
   ▲                   │                          │
   │                   ▼                          ▼
   └── shutdown ── CLOSED        BACKOFF ◀── disconnect / error
                                    │
                                    └── timer expires → CONNECTING
```

Backoff is exponential with up to 30% jitter, doubling from
`reconnect_initial_ms` to `reconnect_max_ms`. On a `4401 unauthorized`
or `4403 inactive` close we jump straight to the max — those won't fix
themselves by retrying faster — but we keep trying so a re-issued token
gets picked up without an operator-restart.

## Troubleshooting

### Console: `panel.token is not set`
Paste your token from the panel dashboard into `config.yml`. Then
`/siamsite-bridge reload`.

### Console: `Bridge error: Token rejected (4401)`
The token in `config.yml` is wrong, was rotated, or was revoked. Issue
a new one in the panel dashboard and reload.

### Console: `Bridge error: Subscription inactive (4403)`
Your subscription has lapsed. Renew it in the panel; the plugin reconnects
automatically once the subscription is reactivated.

### Console: `Could not auto-detect AuthMe config`
The plugin couldn't find `plugins/AuthMe/config.yml` or it's not configured
for MySQL. Either:
- Configure AuthMe to use MySQL (recommended for most servers), **or**
- Set `authme.auto: false` and fill in `authme.host/port/database/user/password/table`
  manually.

### Console: `AuthMe hash algorithm 'pbkdf2' not supported by bridge`
The plugin handles bcrypt and AuthMe-SHA256 — the two algorithms 99% of
servers use. If you're on `pbkdf2`, `argon2`, etc., let support know and
we'll prioritize adding it.

### `/siamsite-bridge stats` shows reconnects climbing
Some firewalls / NAT routers silently kill long-lived TCP. The plugin
self-heals (you'll still get reconnects), but if the count is climbing
faster than ~once an hour, consider switching the panel from WSS to a
keepalive-friendlier path or contact support.

### TPS drop after installing the plugin
This shouldn't happen — all DB and WS work runs on a separate 4-thread
pool, never the main thread. If you see a TPS hit, run
`/siamsite-bridge stats` and send the output + the last 200 lines of
console log to support; we treat any main-thread block as a P1 bug.

### Panel says "Online" but auth always returns `unknown_user`
Your AuthMe table name is not the default `authme`. Either set
`authme.table: "<your_table>"` in `config.yml` and reload, or — if you're
using `authme.auto: true` — set `mySQLTablename` correctly in AuthMe's
own `config.yml`.

### Panel says "Offline" but the plugin console says Connected
The panel deployment was restarted and the plugin is mid-reconnect. Wait
up to 60s. Otherwise check `/siamsite-bridge status` and the panel's
network reachability.

## Token rotation

1. Panel dashboard → Bridge → **Issue new token**.
2. Old token is revoked the instant the new one is issued.
3. Paste the new token into `plugins/SiamsiteBridge/config.yml`.
4. `/siamsite-bridge reload`.
5. `/siamsite-bridge status` should show `OPEN`.

No downtime for players in any of those steps — AuthMe stays local.

## Capacity & limits

- Max concurrent panel requests per plugin: **256** (hard-rejected over
  that with `rate_limited`).
- Per-request DB time on a healthy server: typical < 50 ms for lookups,
  ~100 ms for bcrypt verifies.
- Tested at **200 requests/sec sustained** without measurable TPS impact
  on a Paper 1.20.4 server with 1k AuthMe rows.

## Logs you'll see

| Log line                                                         | Meaning                                    |
|------------------------------------------------------------------|--------------------------------------------|
| `Connected to wss://...`                                         | Healthy state, traffic flowing             |
| `Disconnected (code=4408, reason=idle)`                          | Network dropped the connection; will retry |
| `Bridge error: …`                                                | Anything that increments the error counter |
| `Malformed frame from panel`                                     | Protocol mismatch — usually means the panel and plugin are on different protocol versions. Update the jar. |
| `Dispatch failed for op=verify_authme`                           | DB query threw; panel sees `db_error`      |

## Uninstall

1. Stop the server.
2. Remove `plugins/siamsite-bridge-*.jar` and `plugins/SiamsiteBridge/`.
3. (Optional) Revoke the token in the panel dashboard so it can never
   be used again.

AuthMe and your MC server are not affected.
