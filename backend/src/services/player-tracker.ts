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
      const payload: Record<string, { serverName: string; players: string[]; count: number }> = {};
      let totalOnline = 0;

      for (const [id, data] of serverData) {
        payload[String(id)] = {
          serverName: data.serverName,
          players: data.players,
          count: data.players.length,
        };
        totalOnline += data.players.length;

        // Store individual server players in Redis SET for fast lookup
        const redisKey = `mc:server:${id}:players`;
        const multi = this.redis.multi();
        multi.del(redisKey);
        if (data.players.length > 0) {
          multi.sadd(redisKey, ...data.players.map((p) => p.toLowerCase()));
        }
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

  /** Fast check if player is online on a specific server (from Redis) */
  async isPlayerOnline(serverId: number, username: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(`mc:server:${serverId}:players`, username.toLowerCase());
      return result === 1;
    } catch {
      // Fallback to RCON live check
      return this.rconManager.isPlayerOnline(serverId, username);
    }
  }
}
