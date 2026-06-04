import { Server as SocketIO } from 'socket.io';
import Redis from 'ioredis';
import { RconManager } from './rcon-manager';
import { logger } from '../utils/logger';

const REDIS_KEY = 'mc:online_players';

// Per-server player-set TTL. Poll runs every ~10s, so this covers several consecutive
// missed polls — long enough that a short RCON outage doesn't expire the fallback cache
// that purchase/redeem online-checks rely on, short enough to self-heal if the tracker dies.
const PLAYER_CACHE_TTL_SEC = 90;

export class PlayerTracker {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private rconManager: RconManager,
    private io: SocketIO,
    private redis: Redis
  ) {}

  start(pollMs: number = 10000) {
    logger.info('Player tracker started', { pollMs });
    // Initial poll
    this.poll();
    this.interval = setInterval(() => this.poll(), pollMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private async poll() {
    try {
      const serverData = await this.rconManager.pollAllServers();

      // Build payload for redis + websocket
      const payload: Record<string, { serverName: string; players: string[]; count: number; truncated: boolean }> = {};
      let totalOnline = 0;

      for (const [id, data] of serverData) {
        const truncated = data.total > data.players.length;
        payload[String(id)] = {
          serverName: data.serverName,
          players: data.players,
          count: data.total,       // true count from RCON header, not just known names
          truncated,               // true when plugin truncated the name list
        };
        totalOnline += data.total;

        // If RCON was unreachable this tick, DON'T touch the per-server cache. Wiping it
        // here on a transient timeout is what made purchase/redeem checks wrongly report
        // an online player as offline. Leave the last good set to age out at its TTL so
        // verifyPlayerOnline's fallback still works during brief RCON blips.
        if (!data.ok) continue;

        // Store individual server players in Redis SET for fast lookup
        const redisKey = `mc:server:${id}:players`;
        // Store truncation flag so isPlayerOnline can use direct RCON check when needed
        const truncKey = `mc:server:${id}:truncated`;
        const multi = this.redis.multi();
        multi.del(redisKey);
        if (data.players.length > 0) {
          multi.sadd(redisKey, ...data.players.map((p) => p.toLowerCase()));
        }
        multi.set(truncKey, truncated ? '1' : '0', 'EX', PLAYER_CACHE_TTL_SEC);
        multi.expire(redisKey, PLAYER_CACHE_TTL_SEC); // auto-cleanup if tracker stops
        await multi.exec();
      }

      // Store full payload in Redis for API access
      await this.redis.set(REDIS_KEY, JSON.stringify({ servers: payload, totalOnline, updatedAt: Date.now() }), 'EX', 30);

      // Broadcast to WebSocket subscribers
      this.io.to('players').emit('players:update', { servers: payload, totalOnline });
    } catch (err) {
      logger.warn('Player tracker poll failed', { error: (err as Error).message });
    }
  }

  /** Get current online players (from Redis cache or live) */
  async getOnlinePlayers(): Promise<{ servers: Record<string, { serverName: string; players: string[]; count: number }>; totalOnline: number }> {
    try {
      const cached = await this.redis.get(REDIS_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}

    // Fallback to cached in-memory
    const data = this.rconManager.getAllCachedPlayers();
    const servers: Record<string, { serverName: string; players: string[]; count: number }> = {};
    let totalOnline = 0;
    for (const [id, info] of Object.entries(data)) {
      servers[id] = info;
      totalOnline += info.count;
    }
    return { servers, totalOnline };
  }

  /**
   * Authoritative check for purchases/redemptions — always queries RCON directly.
   * Falls back to cache only if RCON is unreachable.
   */
  async verifyPlayerOnline(serverId: number, username: string): Promise<boolean> {
    try {
      return await this.rconManager.checkPlayerOnlineDirect(serverId, username);
    } catch (err) {
      // RCON unreachable (cooldown, ECONNRESET, timeout) OR the live read was
      // inconclusive (player list truncated and the case-sensitive per-player check
      // couldn't confirm them). Trust the polling cache as a safety net so neither a
      // transient pool failure nor a truncated list wrongly blocks a real online player.
      // Cache TTL is 90s; if a recent poll succeeded the player will still be in it.
      logger.warn('Direct RCON check failed/inconclusive, falling back to cached poll', {
        serverId, username, error: (err as Error).message,
      });
      return this.isPlayerOnline(serverId, username);
    }
  }

  /** Fast check if player is online on a specific server (from Redis) */
  async isPlayerOnline(serverId: number, username: string): Promise<boolean> {
    try {
      const inCache = await this.redis.sismember(`mc:server:${serverId}:players`, username.toLowerCase());
      if (inCache === 1) return true;

      // Not found in cached name list — check if the list was truncated by a plugin.
      // If truncated, the player might still be online but beyond the truncation cutoff.
      // Use a direct RCON 'execute if entity' check to verify.
      const truncated = await this.redis.get(`mc:server:${serverId}:truncated`);
      if (truncated === '1') {
        logger.debug('Player list truncated, using direct RCON check', { serverId, username });
        return this.rconManager.checkPlayerOnlineDirect(serverId, username);
      }

      return false;
    } catch {
      // Fallback to RCON live check
      return this.rconManager.isPlayerOnline(serverId, username);
    }
  }
}
