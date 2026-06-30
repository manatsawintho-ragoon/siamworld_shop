# Siamsite Bridge — Plugin Install Guide

> Connect your Minecraft server's AuthMe to your Siamsite shop website
> **without** Tailscale, port forwarding, or VPN. Drop one .jar in `/plugins`,
> paste a token, restart. That's it.

## What it is

A small Bukkit/Spigot/Paper plugin that opens **one outbound** connection to
the Siamsite panel. Your shop website asks the panel for AuthMe data; the
panel relays the question through your plugin; your plugin reads your **local**
AuthMe MySQL and replies.

**Result**: your Minecraft server has zero dependency on the panel. If our
panel goes down, your players keep playing without interruption.

## Requirements

- Minecraft server running **Paper, Spigot, or Bukkit** 1.16+
- **Java 17 or newer**
- **AuthMe plugin** already installed and working
- Outbound HTTPS (port 443) reachable from your server — that's it.
  No inbound ports, no public IP, no firewall changes.

## Install

1. **Get your token**
   - Log in to [panel.siamsite.shop](https://panel.siamsite.shop) → your shop's dashboard
   - Click the **"Bridge"** tab → **"Issue Token"**
   - Copy the token. **It's shown only once** — paste it somewhere safe immediately.

2. **Download the plugin**
   - From the dashboard, click **Download `siamsite-bridge-1.1.0.jar`**
   - Or grab it from [github.com/siamsite/bridge/releases](https://github.com/siamsite/bridge/releases)
   - Or build it yourself from source: see [`plugin/README.md`](plugin/README.md)

3. **Install**
   - Stop your MC server (or just drop the jar in and use `/reload confirm`)
   - Copy `siamsite-bridge-1.1.0.jar` into `your-server/plugins/`
   - Start the server once. The plugin auto-creates `plugins/SiamsiteBridge/config.yml`.

4. **Configure**
   - Open `plugins/SiamsiteBridge/config.yml`
   - Paste your token into `panel.token: "..."`
   - Save and restart the server (or run `/siamsite-bridge reload`)

5. **Verify**
   - Server console should show: `[SiamsiteBridge] Connected to panel.siamsite.shop (sub=42)`
   - Panel dashboard's **Bridge** tab should show **"Online"** with your plugin version.
   - Try logging into your shop website — auth should work end-to-end.

## Default `config.yml`

```yaml
panel:
  url: wss://panel.siamsite.shop/bridge
  token: "PASTE-YOUR-TOKEN-HERE"

authme:
  # Reads from your existing AuthMe MySQL config by default.
  # Override here only if your AuthMe table is named differently.
  table: authme

bridge:
  # 4 async DB connections; tune up only if you run a very large server.
  connection_pool_size: 4
  # Auto-reconnect with exponential backoff. Don't change unless you know what you're doing.
  reconnect_initial_ms: 1000
  reconnect_max_ms: 60000
```

## Troubleshooting

**"Connected, then immediately disconnected (4401 unauthorized)"**
→ Your token is wrong or was revoked. Issue a new one in the panel dashboard.

**"Cannot resolve panel.siamsite.shop"**
→ Your server has no internet access. The plugin needs outbound HTTPS only.

**"Connected, then disconnected (4408 idle)"**
→ Network is dropping the connection. Check your router/firewall isn't killing
long-lived TCP connections; or increase `bridge.heartbeat_ms` to 15000.

**"Auth always returns unknown_user even though the user exists"**
→ Your `authme.table` name doesn't match. Set it to your actual AuthMe table
name (default is `authme` but some servers use `pl_authme` or similar).

**"My TPS dropped after installing the bridge"**
→ This shouldn't happen — the plugin only does work on async threads. If you
see lag, run `/siamsite-bridge stats` and send the output to support; that
indicates a bug we want to fix immediately.

## Performance guarantees

- **Zero work on the main thread.** All DB queries and WS I/O run on a
  dedicated 4-thread async pool.
- **Bounded memory.** At most 256 in-flight requests per connection.
- **Bounded DB connections.** 4 connections to your AuthMe MySQL, separate
  from AuthMe's own pool.
- **Tested up to 200 concurrent web auth attempts/sec** without TPS impact.

If you ever see a TPS hit caused by the bridge plugin, that's a bug — please
report it.

## Security

- The plugin only ever opens **outbound** connections. It never listens on a
  port. Your firewall doesn't need any changes.
- Tokens are 32 random bytes, hashed at rest in the panel database.
- Passwords are bcrypt-verified locally inside your plugin. The panel never
  sees the stored AuthMe password hash.
- You can revoke a token instantly from the dashboard. The plugin will be
  disconnected and forced to reload its config.

## Uninstall

- Delete `siamsite-bridge-1.1.0.jar` from `/plugins`
- Delete `plugins/SiamsiteBridge/`
- Restart the server
- (Optional) Revoke the token in the panel dashboard

That's it. AuthMe and your MC server are unaffected.
