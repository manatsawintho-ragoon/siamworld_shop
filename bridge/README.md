# Siamsite Bridge

A small Bukkit/Spigot/Paper plugin (`siamsite-bridge.jar`) that opens a
single **outbound WSS** connection from the customer's Minecraft server to
`panel.siamsite.shop`. The panel relays AuthMe queries from the deployed
shop website through that connection. The plugin runs the actual queries
against the **local** AuthMe MySQL and returns results.

Result: the customer's MC server has zero dependency on the panel. If the
panel goes down, players keep playing without interruption. No Tailscale,
no port forwarding, no public IP.

```
Customer MC server                    Panel
┌──────────────────┐                 ┌──────────────────────────┐
│ AuthMe → LOCAL   │                 │  Deployed shop website   │
│         MySQL    │                 │           │              │
│           ▲      │                 │           ▼              │
│ SiamsiteBridge   │── outbound WSS ▶│  bridge.service.ts       │
│ (token-authed)   │   (always       │  (registry by sub_id)    │
└──────────────────┘    open)        └──────────────────────────┘
```

## Contents of this directory

| File                                     | Audience            | Purpose                                      |
|------------------------------------------|---------------------|----------------------------------------------|
| [`INSTALL.md`](INSTALL.md)               | MC server operator  | "I bought the panel. How do I install the plugin?" |
| [`protocol.md`](protocol.md)             | Engineer / reviewer | WS frame format, opcodes, error codes, perf rules |
| [`plugin/README.md`](plugin/README.md)   | Plugin developer    | Source layout, build commands, multi-version strategy |
| [`plugin/OPERATIONS.md`](plugin/OPERATIONS.md) | MC server operator | Day-2 ops: commands, troubleshooting, capacity, rotation |
| [`plugin/`](plugin/)                     | Source code         | Maven project: `mvn -B clean package`        |

## Where the other halves live

- **Panel gateway**: `panel/backend/src/services/bridge.service.ts` —
  WebSocket server that authenticates plugins, registers connections by
  `subscription_id`, and exposes `request(subId, op, data)` to other panel
  services.
- **Panel routes**: `panel/backend/src/routes/bridge.routes.ts` —
  `GET /api/bridge/:subId/status`, `POST /api/bridge/:subId/token`,
  `DELETE /api/bridge/:subId/token`.
- **Token storage**: migration `panel/database/migrations/007_bridge_tokens.sql`
  defines `bridge_tokens` — sha256-hashed tokens with prefix, last_seen,
  plugin_version, revoked_at.
- **Customer dashboard UI**: `panel/frontend/src/app/dashboard/credentials/page.tsx`
  has the **Issue Token** / **Status** / install steps.

## Versioning

- **Plugin version** (`1.1.0`) is independent. The same jar runs on any
  Minecraft server 1.16+, including Folia (declares `folia-supported: true`) —
  see [`plugin/README.md`](plugin/README.md) for why this works without
  conditional code.
- **Protocol version** (currently v1) is path-scoped in the WS URL:
  `wss://panel.siamsite.shop/bridge`. Future breaking wire changes go to
  `/bridge/v2`, letting two plugin generations coexist during rollout.
- Within v1, new opcodes can be added freely; plugins that don't recognize
  one reply with the `unsupported` error code so the panel can fall back.
