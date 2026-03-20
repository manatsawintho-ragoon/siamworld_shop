import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { decrypt, isEncrypted } from '../utils/crypto';
import { rconQueue } from './rcon-queue';
import { rconPool } from './rcon-pool';

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

    return rconQueue.enqueueMultiple(serverId, commands, `product:${serverId}:${sanitized}:${Date.now()}`);
  }

  /** Get list of online players on a server via RCON 'list' command (direct, no queue) */
  async getOnlinePlayers(serverId: number): Promise<string[]> {
    try {
      const response = await this.sendCommandDirect(serverId, 'list');
      const match = response.match(/:\s*(.+)$/);
      if (!match || !match[1] || match[1].trim() === '') return [];
      return match[1].split(',').map((p) => p.trim()).filter(Boolean);
    } catch (err) {
      logger.warn('Failed to get online players', { serverId, error: (err as Error).message });
      return [];
    }
  }

  /** Check if a specific player is online on a server */
  async isPlayerOnline(serverId: number, username: string): Promise<boolean> {
    const players = await this.getOnlinePlayers(serverId);
    const lower = username.toLowerCase();
    return players.some((p) => p.toLowerCase() === lower);
  }

  /** Poll all servers and update online players cache */
  async pollAllServers(): Promise<Map<number, { serverName: string; players: string[] }>> {
    const result = new Map<number, { serverName: string; players: string[] }>();
    for (const [id, server] of this.servers) {
      const players = await this.getOnlinePlayers(id);
      this.onlinePlayers.set(id, players);
      result.set(id, { serverName: server.name, players });
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
