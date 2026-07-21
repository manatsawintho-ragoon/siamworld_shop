import { Server as SocketIO } from 'socket.io';
import Redis from 'ioredis';
import { RconManager } from './rcon-manager';
import { logger } from '../utils/logger';

const REDIS_KEY = 'mc:online_players';

// Per-server player-set TTL. Poll runs every ~10s, so this covers several consecutive
// missed polls — long enough that a short RCON outage doesn't expire the fallback cache
// that purchase/redeem online-checks rely on, short enough to self-heal if the tracker dies.
const PLAYER_CACHE_TTL_SEC = 90;

// First-seen (session) hash TTL. Refreshed every poll; self-heals if the tracker stops.
const SINCE_TTL_SEC = 3600;

// Join/leave event feed (near-realtime, refreshed on the 10s poll cadence).
const EVENTS_KEY = 'mc:events';
// Monotonic counter stamped on every event. A single poll emits a whole batch that
// shares one `ts`, so the timestamp alone cannot order them — `seq` is what makes
// "which one happened last" unambiguous for the admin feed and for incremental polls.
const EVENTS_SEQ_KEY = 'mc:events:seq';
const EVENTS_MAX = 500;        // keep the last N events (feeds the analytics window too)
const EVENTS_TTL_SEC = 48 * 3600;

// Online-count trend: one bucket per minute (peak within the minute), 48h retention.
const TREND_TTL_SEC = 48 * 3600;

// Distinct IGNs seen today — cheap per-poll SADD, powers the "unique players" metric.
const SEEN_TTL_SEC = 48 * 3600;

export interface PlayerEvent {
  type: 'join' | 'leave';
  name: string;
  serverId: number;
  serverName: string;
  ts: number;
  seq: number;
}

export interface TrendBucket {
  ts: number;      // bucket start (epoch ms)
  total: number;   // peak concurrent online within the bucket
  joins: number;
  leaves: number;
}

/**
 * Pure case-insensitive set-diff of two player-name lists. Returns names that
 * joined (in `curr` not `prev`) and left (in `prev` not `curr`), each in the
 * casing of the list they came from. Exported for unit testing.
 */
export function diffPlayers(prev: string[], curr: string[]): { joined: string[]; left: string[] } {
  const prevSet = new Set(prev.map((n) => n.toLowerCase()));
  const currSet = new Set(curr.map((n) => n.toLowerCase()));
  return {
    joined: curr.filter((n) => !prevSet.has(n.toLowerCase())),
    left: prev.filter((n) => !currSet.has(n.toLowerCase())),
  };
}

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

        // Track first-seen timestamps so the admin panel can show login time +
        // session playtime. Hash `mc:since:<id>`: lowercased name → first-seen epoch ms.
        try {
          const sinceKey = `mc:since:${id}`;
          const currentLower = data.players.map((p) => p.toLowerCase());
          const existing = await this.redis.hgetall(sinceKey);
          const sinceMulti = this.redis.multi();
          const now = Date.now();
          for (const name of currentLower) {
            if (!existing[name]) sinceMulti.hset(sinceKey, name, String(now));
          }
          // Only evict left players when we have a COMPLETE list. A truncated list
          // must not drop still-online players beyond the cutoff (would reset their timer).
          if (!truncated) {
            for (const name of Object.keys(existing)) {
              if (!currentLower.includes(name)) sinceMulti.hdel(sinceKey, name);
            }
          }
          sinceMulti.expire(sinceKey, SINCE_TTL_SEC); // self-heal if tracker dies
          await sinceMulti.exec();

          // Join/leave feed — only from COMPLETE lists (truncated lists shuffle names
          // in/out of the cutoff and would emit false events). Skip the very first
          // poll (empty `existing`) so we don't report every online player as a join.
          if (!truncated && Object.keys(existing).length > 0) {
            const { joined, left } = diffPlayers(Object.keys(existing), data.players);
            if (joined.length > 0 || left.length > 0) {
              // Reserve a contiguous seq range up-front so every event in this batch
              // carries a distinct, strictly increasing number even though they all
              // share the same wall-clock `ts`.
              const count = joined.length + left.length;
              const endSeq = await this.redis.incrby(EVENTS_SEQ_KEY, count);
              let seq = endSeq - count + 1;

              const evMulti = this.redis.multi();
              for (const name of joined) {
                evMulti.rpush(EVENTS_KEY, JSON.stringify({ type: 'join', name, serverId: Number(id), serverName: data.serverName, ts: now, seq: seq++ }));
              }
              for (const name of left) {
                evMulti.rpush(EVENTS_KEY, JSON.stringify({ type: 'leave', name, serverId: Number(id), serverName: data.serverName, ts: now, seq: seq++ }));
              }
              evMulti.ltrim(EVENTS_KEY, -EVENTS_MAX, -1);
              evMulti.expire(EVENTS_KEY, EVENTS_TTL_SEC);
              await evMulti.exec();
            }
          }

          // Distinct-players-today set (best-effort, drives the unique-players metric).
          if (data.players.length > 0) {
            const seenKey = `mc:seen:${new Date().toISOString().slice(0, 10)}`;
            await this.redis.sadd(seenKey, ...data.players.map((p) => p.toLowerCase()));
            await this.redis.expire(seenKey, SEEN_TTL_SEC);
          }
        } catch { /* non-fatal — timing display is best-effort */ }
      }

      // Track peak online for today (max total seen). 48h expiry auto-rotates the daily key.
      try {
        const dateKey = `mc:peak:${new Date().toISOString().slice(0, 10)}`;
        const prev = await this.redis.get(dateKey);
        if (!prev || totalOnline > parseInt(prev, 10)) {
          await this.redis.set(dateKey, String(totalOnline), 'EX', 60 * 60 * 48);
        }
      } catch { /* non-fatal */ }

      // Online-count trend: one bucket per minute (keep the peak within each minute)
      // so the panel can draw a sparkline without storing every 10s tick.
      try {
        const date = new Date().toISOString().slice(0, 10);
        const trendKey = `mc:trend:${date}`;
        const minute = String(Math.floor(Date.now() / 60000));
        const prevMin = await this.redis.hget(trendKey, minute);
        if (!prevMin || totalOnline > parseInt(prevMin, 10)) {
          await this.redis.hset(trendKey, minute, String(totalOnline));
        }
        await this.redis.expire(trendKey, TREND_TTL_SEC);
      } catch { /* non-fatal */ }

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

  /** First-seen timestamps (lowercased name → epoch ms) for one server's online players. */
  async getSinceMap(serverId: number): Promise<Record<string, number>> {
    try {
      const h = await this.redis.hgetall(`mc:since:${serverId}`);
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(h)) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) out[k] = n;
      }
      return out;
    } catch {
      return {};
    }
  }

  /** Peak simultaneous online count recorded so far today. */
  async getPeakToday(): Promise<number> {
    try {
      const v = await this.redis.get(`mc:peak:${new Date().toISOString().slice(0, 10)}`);
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Recent join/leave events, newest first (up to `limit`).
   * Pass `afterSeq` to get only events newer than one already shown — this is what
   * lets the admin feed poll on a fast cadence without re-sending the whole list.
   */
  async getRecentEvents(limit = 40, afterSeq?: number): Promise<PlayerEvent[]> {
    try {
      // Read a wider slice than `limit` when filtering by seq so a burst of events
      // between polls isn't silently clipped.
      const span = afterSeq != null ? EVENTS_MAX : limit;
      const raw = await this.redis.lrange(EVENTS_KEY, -span, -1);
      const out: PlayerEvent[] = [];
      for (const s of raw) {
        try {
          const ev = JSON.parse(s) as PlayerEvent;
          if (afterSeq != null && Number(ev.seq || 0) <= afterSeq) continue;
          out.push(ev);
        } catch { /* skip malformed */ }
      }
      // Newest first, ordered by seq (falls back to ts for pre-upgrade events).
      out.sort((a, b) => (Number(b.seq || 0) - Number(a.seq || 0)) || (b.ts - a.ts));
      return out.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Online-count trend as ascending {ts, total} points, one per minute.
   * Spans today plus yesterday so ranges longer than the current day stay continuous.
   */
  async getTrend(limit = 180): Promise<{ ts: number; total: number }[]> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
      const keys = [yesterday, today].map((d) => `mc:trend:${d.toISOString().slice(0, 10)}`);
      const merged: Record<string, string> = {};
      for (const key of keys) {
        Object.assign(merged, await this.redis.hgetall(key));
      }
      const points = Object.entries(merged)
        .map(([min, total]) => ({ ts: parseInt(min, 10) * 60000, total: parseInt(total, 10) }))
        .filter((p) => !Number.isNaN(p.ts) && !Number.isNaN(p.total))
        .sort((a, b) => a.ts - b.ts);
      return points.slice(-limit);
    } catch {
      return [];
    }
  }

  /** Count of distinct IGNs seen on any server today. */
  async getUniqueToday(): Promise<number> {
    try {
      return await this.redis.scard(`mc:seen:${new Date().toISOString().slice(0, 10)}`);
    } catch {
      return 0;
    }
  }

  /**
   * Analytics for the online chart: concurrency trend and join/leave flow rolled up
   * into fixed-width buckets over `rangeMin` minutes, plus summary stats.
   *
   * `bucketMin` widens with the range so a 48h view stays readable (and the payload
   * small) instead of shipping ~2900 one-minute points.
   */
  async getAnalytics(rangeMin: number, bucketMin: number): Promise<{
    buckets: TrendBucket[];
    stats: {
      peak: number; peakTs: number | null; avg: number; low: number;
      joins: number; leaves: number; net: number; uniqueToday: number;
      turnover: number;
    };
  }> {
    const now = Date.now();
    const from = now - rangeMin * 60000;
    const bucketMs = bucketMin * 60000;
    const bucketOf = (ts: number) => Math.floor(ts / bucketMs) * bucketMs;

    // Seed every bucket in range so gaps render as real zeros, not as a skipped x-axis.
    const map = new Map<number, TrendBucket>();
    for (let t = bucketOf(from); t <= bucketOf(now); t += bucketMs) {
      map.set(t, { ts: t, total: 0, joins: 0, leaves: 0 });
    }

    const trend = await this.getTrend(48 * 60);
    for (const p of trend) {
      if (p.ts < from) continue;
      const b = map.get(bucketOf(p.ts));
      if (b) b.total = Math.max(b.total, p.total); // peak concurrency within the bucket
    }

    const events = await this.getRecentEvents(EVENTS_MAX);
    let joins = 0, leaves = 0;
    for (const e of events) {
      if (e.ts < from) continue;
      const b = map.get(bucketOf(e.ts));
      if (e.type === 'join') { joins++; if (b) b.joins++; }
      else { leaves++; if (b) b.leaves++; }
    }

    const buckets = [...map.values()].sort((a, b) => a.ts - b.ts);
    const totals = buckets.map((b) => b.total);
    const active = totals.filter((t) => t > 0);
    let peak = 0, peakTs: number | null = null;
    for (const b of buckets) {
      if (b.total > peak) { peak = b.total; peakTs = b.ts; }
    }
    const uniqueToday = await this.getUniqueToday();

    return {
      buckets,
      stats: {
        peak,
        peakTs,
        avg: active.length ? Math.round((active.reduce((a, b) => a + b, 0) / active.length) * 10) / 10 : 0,
        low: active.length ? Math.min(...active) : 0,
        joins,
        leaves,
        net: joins - leaves,
        uniqueToday,
        // Sessions started per hour over the window — a rough churn/traffic rate.
        turnover: rangeMin > 0 ? Math.round((joins / (rangeMin / 60)) * 10) / 10 : 0,
      },
    };
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
