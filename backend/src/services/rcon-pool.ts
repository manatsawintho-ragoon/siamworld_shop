import { Rcon } from 'rcon-client';
import { logger } from '../utils/logger';

interface PoolEntry {
  rcon: Rcon;
  connected: boolean;
  lastUsed: number;
  serverId: number;
  config: RconConnConfig;
}

interface RconConnConfig {
  host: string;
  port: number;
  password: string;
}

const CONNECT_TIMEOUT_MS = 10000;
const COMMAND_TIMEOUT_MS = 10000;
const RECONNECT_DELAY_MS = 3000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle → close
const FAILURE_COOLDOWN_MS = 60_000; // After connection failure, wait 60s before retrying

/**
 * Persistent RCON Connection Pool
 *
 * Maintains ONE long-lived connection per server_id.
 * - Lazy initialization (connects on first use)
 * - Auto-reconnect on disconnect
 * - Prevents concurrent connect attempts to same server
 * - Idle timeout closes unused connections
 * - Graceful shutdown
 */
export class RconPool {
  private static instance: RconPool;

  private pool: Map<number, PoolEntry> = new Map();

  /** Guards against concurrent connect() calls for the same server */
  private connecting: Map<number, Promise<Rcon>> = new Map();

  /** Tracks last failure time per server to avoid spamming failed connections */
  private failedAt: Map<number, number> = new Map();

  /** Timer for idle connection cleanup */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Sweep idle connections every 60 seconds
    this.cleanupTimer = setInterval(() => this.sweepIdle(), 60_000);
  }

  static getInstance(): RconPool {
    if (!RconPool.instance) RconPool.instance = new RconPool();
    return RconPool.instance;
  }

  // ─── Public API ────────────────────────────────────────────

  /**
   * Send a command on a persistent connection.
   * Connects lazily if needed, reconnects if disconnected.
   */
  async send(serverId: number, config: RconConnConfig, command: string): Promise<string> {
    const rcon = await this.acquire(serverId, config);

    const response = await Promise.race([
      rcon.send(command),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RCON command timeout')), COMMAND_TIMEOUT_MS)
      ),
    ]);

    // Touch last-used timestamp
    const entry = this.pool.get(serverId);
    if (entry) entry.lastUsed = Date.now();

    return response;
  }

  /**
   * Update config for a server (e.g. after admin changes password).
   * Drops the existing connection so next call reconnects with new creds.
   */
  async updateConfig(serverId: number, config: RconConnConfig) {
    await this.disconnect(serverId);
    // Next send() call will connect with the new config
    logger.info('RCON pool: config updated, connection will reconnect', { serverId });
  }

  /**
   * Gracefully close a single server connection.
   */
  async disconnect(serverId: number) {
    const entry = this.pool.get(serverId);
    if (entry) {
      entry.connected = false;
      try { await entry.rcon.end(); } catch {}
      this.pool.delete(serverId);
    }
    this.connecting.delete(serverId);
    this.failedAt.delete(serverId);
  }

  /**
   * Gracefully close ALL connections (for shutdown).
   */
  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const ids = Array.from(this.pool.keys());
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
    logger.info('RCON pool: all connections closed');
  }

  /**
   * Check if a server has an active connection.
   */
  isConnected(serverId: number): boolean {
    const entry = this.pool.get(serverId);
    return !!entry?.connected;
  }

  /**
   * Get pool status for monitoring.
   */
  getStatus(): Record<number, { connected: boolean; idleMs: number }> {
    const out: Record<number, { connected: boolean; idleMs: number }> = {};
    const now = Date.now();
    for (const [id, entry] of this.pool) {
      out[id] = { connected: entry.connected, idleMs: now - entry.lastUsed };
    }
    return out;
  }

  // ─── Internal ──────────────────────────────────────────────

  /**
   * Acquire a connected Rcon instance for the given server.
   * Reuses existing connection or creates a new one.
   * Prevents duplicate concurrent connects to the same server.
   */
  private async acquire(serverId: number, config: RconConnConfig): Promise<Rcon> {
    // 1. Check existing healthy connection
    const entry = this.pool.get(serverId);
    if (entry?.connected) {
      return entry.rcon;
    }

    // 2. If recently failed, don't retry too soon (prevents RCON spam)
    const lastFail = this.failedAt.get(serverId);
    if (lastFail && Date.now() - lastFail < FAILURE_COOLDOWN_MS) {
      throw new Error('RCON connection on cooldown after failure');
    }

    // 3. If a connect attempt is already in flight, wait for it
    const pending = this.connecting.get(serverId);
    if (pending) {
      return pending;
    }

    // 4. Create a new connection (guarded)
    const connectPromise = this.createConnection(serverId, config);
    this.connecting.set(serverId, connectPromise);

    try {
      const rcon = await connectPromise;
      this.failedAt.delete(serverId); // Clear cooldown on success
      return rcon;
    } catch (err) {
      // Record failure time for cooldown
      this.failedAt.set(serverId, Date.now());
      this.pool.delete(serverId);
      throw err;
    } finally {
      this.connecting.delete(serverId);
    }
  }

  private async createConnection(serverId: number, config: RconConnConfig): Promise<Rcon> {
    // Remove stale entry if any
    const old = this.pool.get(serverId);
    if (old) {
      try { await old.rcon.end(); } catch {}
      this.pool.delete(serverId);
    }

    const rcon = new Rcon({
      host: config.host,
      port: config.port,
      password: config.password,
    });

    // Connect with timeout
    await Promise.race([
      rcon.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RCON connect timeout')), CONNECT_TIMEOUT_MS)
      ),
    ]);

    const entry: PoolEntry = {
      rcon,
      connected: true,
      lastUsed: Date.now(),
      serverId,
      config,
    };
    this.pool.set(serverId, entry);

    // Listen for disconnect → mark as not connected, attempt silent reconnect
    rcon.on('end', () => {
      if (entry.connected) {
        entry.connected = false;
        logger.warn('RCON pool: connection lost', { serverId });
        // Schedule a silent reconnect so next send() doesn't wait for cold connect
        setTimeout(() => {
          this.silentReconnect(serverId, config);
        }, RECONNECT_DELAY_MS);
      }
    });

    logger.info('RCON pool: connection established', { serverId, host: config.host, port: config.port });
    return rcon;
  }

  /**
   * Try to silently re-establish a connection in the background.
   * If it fails, that's fine — next send() will retry.
   */
  private async silentReconnect(serverId: number, config: RconConnConfig) {
    // Don't reconnect if already connected or already connecting
    if (this.pool.get(serverId)?.connected) return;
    if (this.connecting.has(serverId)) return;

    try {
      await this.acquire(serverId, config);
    } catch (err) {
      logger.debug('RCON pool: silent reconnect failed (will retry on next use)', {
        serverId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Close connections that have been idle for too long.
   */
  private sweepIdle() {
    const now = Date.now();
    for (const [serverId, entry] of this.pool) {
      if (entry.connected && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        logger.info('RCON pool: closing idle connection', { serverId, idleMs: now - entry.lastUsed });
        entry.connected = false;
        entry.rcon.end().catch(() => {});
        this.pool.delete(serverId);
      }
    }
  }
}

export const rconPool = RconPool.getInstance();
