import { Server as SocketIO } from 'socket.io';
import Redis from 'ioredis';
import { RconManager } from './rcon-manager';
import { logger } from '../utils/logger';

const REDIS_KEY = 'mc:online_players';

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

        // Store individual server players in Redis SET for fast lookup
        const redisKey = `mc:server:${id}:players`;
        // Store truncation flag so isPlayerOnline can use direct RCON check when needed
        const truncKey = `mc:server:${id}:truncated`;
        const multi = this.redis.multi();
        multi.del(redisKey);
        if (data.players.length > 0) {
          multi.sadd(redisKey, ...data.players.map((p) => p.toLowerCase()));
        }
        multi.set(truncKey, truncated ? '1' : '0', 'EX', 30);
        multi.expire(redisKey, 30); // TTL 30s, auto-cleanup if tracker stops
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
      // RCON unreachable (cooldown, ECONNRESET, timeout, etc). Trust the polling
      // cache as a safety net so transient pool failures don't block real users.
      // Cache TTL is 30s; if the poll just succeeded the player will still be in it.
      logger.warn('Direct RCON check failed, falling back to cached poll', {
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
