# SiamsiteBridge — Developer Guide

Bukkit/Spigot/Paper plugin that opens a single **outbound WSS** connection
to `panel.siamsite.shop` and answers AuthMe queries from the local MySQL.
The customer's MC server never accepts an inbound connection from us; the
panel never sees the AuthMe password hash.

For operator-facing setup, read [`OPERATIONS.md`](OPERATIONS.md). For end-user
install instructions (the one we link from the panel dashboard), read
[`../INSTALL.md`](../INSTALL.md). The wire protocol is documented in
[`../protocol.md`](../protocol.md).

## Layout

```
bridge/plugin/
├── pom.xml                       # Maven build, Java 17, shaded fat jar
├── README.md                     # this file
├── OPERATIONS.md                 # how to run, monitor, troubleshoot
└── src/main/
    ├── resources/
    │   ├── plugin.yml            # api-version 1.16 → runs on 1.16+
    │   └── config.yml            # default config shipped to operators
    └── java/shop/siamsite/bridge/
        ├── SiamsiteBridgePlugin.java   # JavaPlugin entry, /command, restart()
        ├── auth/
        │   ├── AuthmeCredentials.java
        │   ├── AuthmeConfigReader.java # auto-reads plugins/AuthMe/config.yml
        │   └── PasswordVerifier.java   # bcrypt + AuthMe SHA256
        ├── db/
        │   ├── AuthmeRepository.java   # HikariCP + JDBC (max 4 conns)
        │   └── AuthmeUser.java
        ├── ws/
        │   ├── BridgeClient.java       # WSS client + reconnect + heartbeat
        │   ├── ConnectionState.java
        │   └── Frame.java              # JSON envelope
        ├── opcode/
        │   └── OpcodeRouter.java       # verify_authme, lookup_user, …
        ├── util/
        │   └── AsyncExecutor.java      # 4-thread bounded async pool
        └── cmd/
            └── BridgeCommand.java      # /siamsite-bridge status|stats|reload|reconnect
```

## Build

Requires JDK 17+ and Maven 3.9+.

```bash
cd bridge/plugin
mvn -B clean package
```

Output: `target/siamsite-bridge-1.0.0.jar` (shaded fat jar, ~2–3 MB).

To install on a local test server:

```bash
cp target/siamsite-bridge-1.0.0.jar /path/to/server/plugins/
```

## Why a single artifact for multiple Minecraft versions?

The jar targets **Bukkit API 1.16** (declared in `plugin.yml` via
`api-version: '1.16'`). We only call APIs that have been stable across the
entire 1.16 → 1.21+ range:

- `JavaPlugin` lifecycle and config IO
- `BukkitScheduler.runTaskAsynchronously` (implicit — we use our own pool
  but never touch the main thread anyway)
- `YamlConfiguration.loadConfiguration(File)` for reading AuthMe's config
- `getServer().getBukkitVersion()` / `getName()` for diagnostics

There is **zero NMS / OBC / reflection code**, no version-specific imports,
and no class shading from Bukkit itself. As a result, the same jar runs on
Spigot, Paper, Purpur, Pufferfish, Folia, and any 1.16+ derivative. If
Mojang ever ships a 2.0 that genuinely breaks the API, we'll cut a new
plugin artifact and the panel will gate distribution by detected MC
version.

The protocol version is path-scoped in the WS URL (`/bridge` = v1). Future
breaking wire changes go to `/bridge/v2`, allowing two plugin builds to
coexist for the rollout window.

## Tested against

| Server  | Versions known-working                          |
|---------|-------------------------------------------------|
| Paper   | 1.16.5, 1.18.2, 1.19.4, 1.20.4, 1.21.x          |
| Spigot  | 1.16.5, 1.20.4                                  |
| Purpur  | 1.20.4                                          |

Earlier than 1.16 is not supported because `api-version` was introduced in
1.13 and the Bukkit ConfigurationSerialization scheme used by AuthMe 5.x
assumes 1.16+ class structures.

## Dependencies (shaded into the jar)

| Library             | Purpose                                       |
|---------------------|-----------------------------------------------|
| Java-WebSocket 1.5  | The actual WSS client                         |
| Gson 2.11           | Frame JSON parse/serialize                    |
| HikariCP 5.1        | Bounded JDBC pool (max 4 conns)               |
| mysql-connector-j 8.4 | JDBC driver                                 |
| at.favre.lib bcrypt | Verify + hash `$2a$10$…` for AuthMe parity    |
| slf4j-nop           | Silence HikariCP's "no logger" warning        |

All are **relocated** under `shop.siamsite.bridge.shaded.*` so they cannot
clash with the same libraries shipped by another plugin on the server.

## Concurrency model

- The main MC thread is **never** used for bridge work — only the bridge's
  own pool (`siamsite-bridge-*` threads, default size 4).
- Inbound WS frames are accepted by Java-WebSocket's reader thread and
  immediately handed to the async pool for parsing and DB work.
- Outbound frames can be sent from any thread; Java-WebSocket internally
  serializes writes.
- The DB pool is sized 4, independent from AuthMe's own pool. Combined
  worst-case load on the customer's MySQL is `AuthMe (≈2) + Bridge (4) = 6`
  connections. Plenty of headroom for typical 1k–10k row AuthMe tables.

## Adding a new opcode

1. Add the opcode + schema to [`../protocol.md`](../protocol.md) (and bump
   `protocol-version` if it's a breaking change).
2. Implement the handler in `OpcodeRouter.dispatch()`. Return a `Frame`
   built with `Frame.response(...)` or `Frame.errorResponse(...)`.
3. If the handler does I/O, do **not** touch the main thread.
4. Send a test request from the panel — it surfaces via
   `bridgeService.request(subscriptionId, '<op>', data)`.

## Code style

- Java 17. Use records sparingly — Bukkit/Gson reflection still expects
  plain classes in many places, so keep DB rows and frames as POJOs.
- No checked exceptions across opcode boundaries — convert to a bridge
  `err.code` instead.
- All `Logger` calls go through the plugin's own logger so the operator
  sees `[SiamsiteBridge]` as the source.
