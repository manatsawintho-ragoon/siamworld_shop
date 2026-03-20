import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { decrypt, isEncrypted } from '../utils/crypto';
import { RowDataPacket } from 'mysql2';
import { rconPool } from './rcon-pool';

interface QueueItem {
  id: string;
  serverId: number;
  command: string;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  attempts: number;
  maxRetries: number;
  createdAt: number;
}

const MAX_RETRIES = 3;

/**
 * FIFO RCON Queue System
 * - One queue per server
 * - Retry with backoff (max 3 attempts)
 * - Uses persistent connection pool (no connect/disconnect per command)
 * - Prevents duplicate execution
 * - Logs all commands to DB
 */
export class RconQueue {
  private queues: Map<number, QueueItem[]> = new Map();
  private processing: Map<number, boolean> = new Map();
  private executedCommands: Set<string> = new Set();

  /** Cached server configs — refreshed only when a command fails with auth/connection error */
  private serverConfigs: Map<number, { host: string; port: number; password: string }> = new Map();

  /**
   * Enqueue a command to be executed on a specific server.
   * Returns a promise that resolves with the RCON response.
   */
  async enqueue(
    serverId: number,
    command: string,
    dedupKey?: string
  ): Promise<string> {
    const dedup = dedupKey || `${serverId}:${command}:${Math.floor(Date.now() / 5000)}`;
    if (this.executedCommands.has(dedup)) {
      logger.warn('RCON duplicate command blocked', { serverId, command, dedupKey: dedup });
      throw new Error('Duplicate RCON command blocked');
    }

    return new Promise<string>((resolve, reject) => {
      const item: QueueItem = {
        id: dedup,
        serverId,
        command,
        resolve,
        reject,
        attempts: 0,
        maxRetries: MAX_RETRIES,
        createdAt: Date.now(),
      };

      if (!this.queues.has(serverId)) {
        this.queues.set(serverId, []);
      }
      this.queues.get(serverId)!.push(item);
      this.processQueue(serverId);
    });
  }

  /**
   * Execute multiple commands sequentially on same server, returning all results.
   */
  async enqueueMultiple(
    serverId: number,
    commands: string[],
    baseKey?: string
  ): Promise<string[]> {
    const results: string[] = [];
    for (let i = 0; i < commands.length; i++) {
      const key = baseKey ? `${baseKey}:cmd${i}` : undefined;
      const result = await this.enqueue(serverId, commands[i], key);
      results.push(result);
    }
    return results;
  }

  private async processQueue(serverId: number) {
    if (this.processing.get(serverId)) return;
    this.processing.set(serverId, true);

    const queue = this.queues.get(serverId);
    if (!queue) {
      this.processing.set(serverId, false);
      return;
    }

    while (queue.length > 0) {
      const item = queue[0];

      try {
        item.attempts++;
        const response = await this.executeViaPool(serverId, item.command);

        // Mark as executed (dedup for 30 seconds)
        this.executedCommands.add(item.id);
        setTimeout(() => this.executedCommands.delete(item.id), 30000);

        // Log to DB
        await this.logCommand(serverId, item.command, response, 'success', item.attempts);

        queue.shift();
        item.resolve(response);
      } catch (err) {
        const error = err as Error;

        if (item.attempts < item.maxRetries) {
          const backoff = Math.pow(2, item.attempts - 1) * 1000;
          logger.warn('RCON command failed, retrying', {
            serverId,
            command: item.command,
            attempt: item.attempts,
            maxRetries: item.maxRetries,
            backoffMs: backoff,
            error: error.message,
          });
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          await this.logCommand(serverId, item.command, error.message, 'failed', item.attempts);
          logger.error('RCON command failed after max retries', {
            serverId,
            command: item.command,
            attempts: item.attempts,
            error: error.message,
          });
          queue.shift();
          item.reject(new Error(`RCON command failed after ${item.attempts} attempts: ${error.message}`));
        }
      }
    }

    this.processing.set(serverId, false);
  }

  /**
   * Execute a command via the persistent connection pool.
   * Fetches server config from cache (or DB on first use / after failure).
   */
  private async executeViaPool(serverId: number, command: string): Promise<string> {
    const config = await this.getServerConfig(serverId);
    try {
      return await rconPool.send(serverId, config, command);
    } catch (err) {
      // On failure, invalidate cached config (might have changed) and rethrow
      this.serverConfigs.delete(serverId);
      throw err;
    }
  }

  /**
   * Get server connection config, cached. Falls back to DB.
   */
  private async getServerConfig(serverId: number): Promise<{ host: string; port: number; password: string }> {
    const cached = this.serverConfigs.get(serverId);
    if (cached) return cached;

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT host, rcon_port, rcon_password FROM servers WHERE id = ? AND enabled = 1',
      [serverId]
    );
    if (rows.length === 0) throw new Error(`Server ${serverId} not found or disabled`);

    const server = rows[0];
    const password = isEncrypted(server.rcon_password) ? decrypt(server.rcon_password) : server.rcon_password;
    const config = { host: server.host, port: server.rcon_port, password };
    this.serverConfigs.set(serverId, config);
    return config;
  }

  private async logCommand(
    serverId: number,
    command: string,
    response: string,
    status: 'success' | 'failed',
    attempts: number
  ) {
    try {
      await pool.execute(
        'INSERT INTO rcon_logs (server_id, command, response, status, attempts) VALUES (?,?,?,?,?)',
        [serverId, command, response.substring(0, 2000), status, attempts]
      );
    } catch (err) {
      logger.error('Failed to log RCON command', { error: (err as Error).message });
    }
  }

  /** Get queue status for monitoring */
  getQueueStatus(): Record<number, { queueLength: number; processing: boolean }> {
    const status: Record<number, { queueLength: number; processing: boolean }> = {};
    for (const [serverId, queue] of this.queues) {
      status[serverId] = {
        queueLength: queue.length,
        processing: this.processing.get(serverId) || false,
      };
    }
    return status;
  }
}

export const rconQueue = new RconQueue();
