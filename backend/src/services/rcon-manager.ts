import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { decrypt, isEncrypted } from '../utils/crypto';
import { rconQueue } from './rcon-queue';
import { rconPool } from './rcon-pool';

/**
 * Vanilla Minecraft commands that plugins commonly override and silence (return empty).
 * ONLY these commands get the 'minecraft:' namespace fallback when they return empty.
 * Plugin commands (cmi, lp, eco, essentials, vault, skript, etc.) must NOT be in this
 * list — they return empty on success by design and must not get the prefix.
 */
const VANILLA_RCON_COMMANDS = new Set([
  'give', 'effect', 'enchant', 'clear', 'tp', 'teleport', 'kill',
  'gamemode', 'gm', 'xp', 'experience', 'summon', 'weather', 'time',
  'title', 'say', 'msg', 'tell', 'w', 'spawnpoint', 'difficulty',
  'gamerule', 'advancement', 'attribute', 'fill', 'setblock', 'clone',
  'item', 'loot', 'scoreboard', 'tag', 'team', 'bossbar', 'particle',
  'playsound', 'stopsound', 'op', 'deop', 'kick', 'ban', 'pardon',
  'whitelist', 'seed', 'list', 'data', 'forceload', 'function',
]);

export interface ServerInfo {
  id: number;
  name: string;
  host: string;
  port: number;
  rcon_port: number;
  rcon_password: string;
  enabled: boolean;
}

export class RconManager {
  private static instance: RconManager;
  private servers: Map<number, ServerInfo> = new Map();
  private onlinePlayers: Map<number, string[]> = new Map();

  static getInstance(): RconManager {
    if (!RconManager.instance) RconManager.instance = new RconManager();
    return RconManager.instance;
  }

  async initializeFromDB() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, host, port, rcon_port, rcon_password, enabled FROM servers WHERE enabled = 1'
    );
    for (const row of rows) {
      const password = isEncrypted(row.rcon_password) ? decrypt(row.rcon_password) : row.rcon_password;
      const server: ServerInfo = { ...row as ServerInfo, rcon_password: password };
      this.servers.set(row.id, server);
      logger.info('RCON server registered', { id: row.id, name: row.name, host: row.host });
    }
  }

  async reloadServers() {
    // Disconnect old servers that are no longer enabled
    const oldIds = Array.from(this.servers.keys());
    this.servers.clear();
    await this.initializeFromDB();
    const newIds = new Set(this.servers.keys());
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        await rconPool.disconnect(id);
      }
    }
  }

  getServer(serverId: number): ServerInfo | undefined {
    return this.servers.get(serverId);
  }

  getAllServers(): ServerInfo[] {
    return Array.from(this.servers.values());
  }

  private getRconConfig(server: ServerInfo) {
    return { host: server.host, port: server.rcon_port, password: server.rcon_password };
  }

  /** Execute a single RCON command (uses queue for retry + logging) */
  async sendCommand(serverId: number, command: string): Promise<string> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found or disabled`);
    return rconQueue.enqueue(serverId, command);
  }

  /**
   * Execute a raw RCON command bypassing the queue (for health checks, player list).
   * Uses the persistent connection pool — NO connect/disconnect per call.
   */
  async sendCommandDirect(serverId: number, command: string): Promise<string> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found or disabled`);
    return rconPool.send(serverId, this.getRconConfig(server), command);
  }

  /** Execute product commands (multi-line) with {username}/{player} replacement via queue */
  async executeProductCommands(serverId: number, commandTemplate: string, username: string): Promise<string[]> {
    const sanitized = username.replace(/[^a-zA-Z0-9_]/g, '');
    const commands = commandTemplate
      .split('\n')
      .map((c) => c.trim()
        .replace(/\{username\}/gi, sanitized)
        .replace(/\{player\}/gi, sanitized)
      )
      .filter(Boolean);

    const baseKey = `product:${serverId}:${sanitized}:${Date.now()}`;
    const results: string[] = [];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const key = `${baseKey}:cmd${i}`;
      let response = await rconQueue.enqueue(serverId, cmd, key);

      // If response is empty AND the command is a vanilla Minecraft command (not a plugin
      // command like cmi/lp/eco/essentials), retry with 'minecraft:' namespace to bypass
      // plugin overrides that intercept vanilla commands and return empty.
      // Plugin commands (cmi, lp, eco, essentials, etc.) must NOT get this prefix —
      // they work without it when CMI/plugin returns empty on success.
      const firstWord = cmd.split(/\s+/)[0].toLowerCase().replace(/^\//, '');
      if (response.trim() === '' && VANILLA_RCON_COMMANDS.has(firstWord)) {
        try {
          const mcCmd = `minecraft:${cmd.startsWith('/') ? cmd.slice(1) : cmd}`;
          const mcResponse = await rconQueue.enqueue(serverId, mcCmd, `${key}:mc`);
          if (
            mcResponse &&
            mcResponse.trim() !== '' &&
            !mcResponse.toLowerCase().includes('unknown') &&
            !mcResponse.toLowerCase().includes('invalid')
          ) {
            response = mcResponse;
            logger.info('RCON vanilla command succeeded via minecraft: namespace', { serverId, cmd, response });
          }
        } catch {
          // Fallback also failed — keep original empty response
        }
      }

      results.push(response);
    }

    return results;
  }

  /**
   * Get list of online players on a server via RCON 'list' command (direct, no queue).
   * Returns both the known player names AND the true total count from the response header.
   * Some plugins truncate the name list (e.g. at 14) but keep the header count accurate.
   */
  async getOnlinePlayersData(serverId: number, throwOnError = false): Promise<{ players: string[]; total: number }> {
    try {
      // Try 'minecraft:list' first — bypasses plugin overrides that silence plain 'list'
      // Fall back to plain 'list' for proxies (BungeeCord/Velocity) that don't understand namespaced commands
      let response = await this.sendCommandDirect(serverId, 'minecraft:list');
      logger.debug('RCON minecraft:list raw response', { serverId, response });

      if (!response || response.trim() === '' || response.includes('Unknown') || response.includes('unknown')) {
        response = await this.sendCommandDirect(serverId, 'list');
        logger.debug('RCON list fallback raw response', { serverId, response });
      }

      if (!response || response.trim() === '') return { players: [], total: 0 };

      // Strip Minecraft color/format codes (§X) and ANSI escape sequences before parsing
      const clean = response
        .replace(/§[0-9a-fk-or]/gi, '')
        .replace(/\u001b\[[0-9;]*m/g, '');

      // Parse true online count from header: "There are X of a max Y players online:"
      // Even if the name list is truncated by plugins, the header count is accurate.
      let total = 0;
      const countMatch = clean.match(/there\s+are\s+(\d+)/i);
      if (countMatch) total = parseInt(countMatch[1], 10);

      const match = clean.match(/:\s*(.+)$/s);
      if (!match || !match[1] || match[1].trim() === '') return { players: [], total };

      const players = match[1]
        .split(',')
        .map((p) => p
          .replace(/\[.*?\]/g, '')  // strip BungeeCord [ServerName] prefix
          .replace(/\s*\([0-9a-f-]{36}\)/gi, '')  // strip UUID (list uuids format)
          .trim()
        )
        .filter((p) => /^[a-zA-Z0-9_]{1,16}$/.test(p)); // valid Minecraft names only, drop '...' artifacts

      // If header count is larger than known names, list was truncated — log it
      if (total > players.length) {
        logger.debug('RCON player list truncated by server plugin', { serverId, total, known: players.length });
      }

      return { players, total: Math.max(total, players.length) };
    } catch (err) {
      logger.warn('Failed to get online players', { serverId, error: (err as Error).message });
      // Strict mode lets the caller (verifyPlayerOnline) distinguish "RCON broken"
      // from "0 players online" so it can fall back to the cached poll.
      if (throwOnError) throw err;
      return { players: [], total: 0 };
    }
  }

  /** Get list of online players on a server (name list only, for backward compat) */
  async getOnlinePlayers(serverId: number): Promise<string[]> {
    return (await this.getOnlinePlayersData(serverId)).players;
  }

  /**
   * Check if a specific player is online via direct RCON command.
   * Uses 'execute if entity @a[name=X]' which works even when 'list' is truncated.
   * Falls back to name-list search if execute is not available.
   */
  async checkPlayerOnlineDirect(serverId: number, username: string): Promise<boolean> {
    const sanitized = username.replace(/[^a-zA-Z0-9_]/g, '');
    const lower = sanitized.toLowerCase();
    try {
      // 'execute if entity @a[name=X,limit=1]' returns "Test passed" if player is online.
      // This is the ONLY truncation-proof signal: it works regardless of how many players
      // are online. A "passed" is authoritative. The name selector is case-sensitive, so
      // a non-"passed" result is NOT a reliable "offline" — the player's website-username
      // case may differ from their in-game IGN (AuthMe is case-insensitive). In that case
      // we fall through to the list-based case-insensitive check below.
      const response = await this.sendCommandDirect(
        serverId,
        `execute if entity @a[name=${sanitized},limit=1]`
      );
      if (response && response.toLowerCase().includes('passed')) {
        return true;
      }
    } catch {
      // execute command not available (BungeeCord/Velocity, 1.8) — fall through to the list
      // path. The list path uses throwOnError=true so verifyPlayerOnline knows to
      // consult the Redis cache when RCON itself is unreachable.
    }

    const { players, total } = await this.getOnlinePlayersData(serverId, true);
    if (players.some((p) => p.toLowerCase() === lower)) return true;

    // Player wasn't in the returned name list. If that list was TRUNCATED (a plugin or
    // RCON packet limit cut it short — header count > names we parsed), we cannot conclude
    // the player is offline: the case-sensitive execute check above couldn't confirm them
    // either. Returning a hard `false` here is exactly what wrongly blocked genuinely-online
    // players ("works for some players, not others, varies by day" = depends on whether the
    // player's stored case matches their IGN AND whether they landed inside the truncation
    // cutoff). Throw instead so verifyPlayerOnline falls back to the independent poll cache.
    if (total > players.length) {
      throw new Error(`Online check inconclusive: player list truncated (${players.length}/${total})`);
    }

    // Complete list, RCON healthy, player genuinely absent → confidently offline.
    return false;
  }

  /** Check if a specific player is online on a server */
  async isPlayerOnline(serverId: number, username: string): Promise<boolean> {
    const players = await this.getOnlinePlayers(serverId);
    const lower = username.toLowerCase();
    return players.some((p) => p.toLowerCase() === lower);
  }

  /**
   * Poll all servers and update online players cache.
   *
   * `ok` distinguishes a real RCON failure from a genuinely-empty server. This matters:
   * `getOnlinePlayersData` returns `{players:[], total:0}` for BOTH cases, so without this
   * flag the PlayerTracker would wipe its Redis cache on a transient RCON timeout and then
   * report online players as offline — blocking real purchases. On failure we preserve the
   * last-known player list so the tracker can keep the cache intact for its TTL.
   */
  async pollAllServers(): Promise<Map<number, { serverName: string; players: string[]; total: number; ok: boolean }>> {
    const result = new Map<number, { serverName: string; players: string[]; total: number; ok: boolean }>();
    for (const [id, server] of this.servers) {
      try {
        const data = await this.getOnlinePlayersData(id, true); // throw on RCON failure
        this.onlinePlayers.set(id, data.players);
        result.set(id, { serverName: server.name, players: data.players, total: data.total, ok: true });
      } catch {
        // RCON unreachable this tick — keep the last-known players so a transient blip
        // doesn't erase the cache that purchase/redeem checks fall back on.
        const lastKnown = this.onlinePlayers.get(id) || [];
        result.set(id, { serverName: server.name, players: lastKnown, total: lastKnown.length, ok: false });
      }
    }
    return result;
  }

  /** Health check a specific server (direct, no queue) */
  async healthCheck(serverId: number): Promise<boolean> {
    try {
      await this.sendCommandDirect(serverId, 'list');
      return true;
    } catch {
      return false;
    }
  }

  getCachedPlayers(serverId: number): string[] {
    return this.onlinePlayers.get(serverId) || [];
  }

  getAllCachedPlayers(): Record<number, { serverName: string; players: string[]; count: number }> {
    const out: Record<number, { serverName: string; players: string[]; count: number }> = {};
    for (const [id, server] of this.servers) {
      const players = this.onlinePlayers.get(id) || [];
      out[id] = { serverName: server.name, players, count: players.length };
    }
    return out;
  }

  /** Get RCON queue status for monitoring */
  getQueueStatus() {
    return rconQueue.getQueueStatus();
  }

  /** Get connection pool status */
  getPoolStatus() {
    return rconPool.getStatus();
  }

  /** Gracefully shutdown all RCON connections */
  async shutdown() {
    await rconPool.shutdown();
  }
}
