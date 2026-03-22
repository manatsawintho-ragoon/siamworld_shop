import mysql from 'mysql2/promise';
import { Rcon } from 'rcon-client';
import { pool } from '../database/connection';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { ValidationError } from '../utils/errors';

interface AuthMeConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  table: string;
}

interface RconConfig {
  host: string;
  rcon_port: number;
  rcon_password: string;
}

class SetupService {
  /**
   * Translate localhost/127.0.0.1 to host.docker.internal when running in Docker.
   */
  private resolveHost(host: string): string {
    if (process.env.DOCKER === 'true') {
      if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0') {
        return 'host.docker.internal';
      }
    }
    return host;
  }

  /**
   * Test an AuthMe MySQL database connection.
   * Returns true if connection succeeds and the AuthMe table exists.
   */
  async testAuthMeConnection(config: AuthMeConfig): Promise<{ success: boolean; message: string; playerCount?: number }> {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: this.resolveHost(config.host),
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 10000,
      });
      await conn.execute('SELECT 1');

      // Check if AuthMe table exists
      const [tables] = await conn.execute<RowDataPacket[]>(
        'SHOW TABLES LIKE ?', [config.table || 'authme']
      );
      if (tables.length === 0) {
        return { success: false, message: `Table '${config.table || 'authme'}' not found in database '${config.database}'` };
      }

      // Count players
      const [rows] = await conn.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM \`${(config.table || 'authme').replace(/[^a-zA-Z0-9_]/g, '')}\``
      );
      const playerCount = rows[0]?.count || 0;

      return { success: true, message: `Connected! Found ${playerCount} player(s) in AuthMe table.`, playerCount };
    } catch (err) {
      const error = err as Error;
      logger.warn('AuthMe connection test failed', { host: config.host, error: error.message });
      return { success: false, message: `Connection failed: ${error.message}` };
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }

  /**
   * Test an RCON connection to a Minecraft server.
   */
  async testRconConnection(config: RconConfig): Promise<{ success: boolean; message: string; players?: string[] }> {
    let rcon: Rcon | null = null;
    try {
      rcon = new Rcon({
        host: this.resolveHost(config.host),
        port: config.rcon_port,
        password: config.rcon_password,
      });

      await Promise.race([
        rcon.connect(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000)),
      ]);

      const response = await Promise.race([
        rcon.send('list'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Command timeout')), 10000)),
      ]);

      // Parse player list
      const match = response.match(/There are (\d+) of a max of (\d+) players online/);
      const playersMatch = response.match(/:\s*(.+)$/);
      const players = playersMatch && playersMatch[1].trim()
        ? playersMatch[1].split(',').map(p => p.trim()).filter(Boolean)
        : [];

      return {
        success: true,
        message: match ? `Connected! ${match[1]}/${match[2]} players online.` : `Connected! Response: ${response}`,
        players,
      };
    } catch (err) {
      const error = err as Error;
      logger.warn('RCON connection test failed', { host: config.host, port: config.rcon_port, error: error.message });
      return { success: false, message: `RCON connection failed: ${error.message}` };
    } finally {
      try { if (rcon) await rcon.end(); } catch {}
    }
  }

  /**
   * Save a server configuration with encrypted passwords.
   * Creates or updates base on server name.
   */
  async saveServerConfig(data: {
    name: string;
    host: string;
    port?: number;
    rcon_port: number;
    rcon_password: string;
    minecraft_version?: string;
    max_players?: number;
  }): Promise<{ serverId: number }> {
    if (!data.name || !data.host || !data.rcon_port || !data.rcon_password) {
      throw new ValidationError('Missing required server configuration fields');
    }

    // Encrypt the RCON password
    const encryptedPassword = encrypt(data.rcon_password);

    const [result] = await pool.execute(
      `INSERT INTO servers (name, host, port, rcon_port, rcon_password, minecraft_version, max_players)
       VALUES (?,?,?,?,?,?,?)`,
      [
        data.name,
        this.resolveHost(data.host),
        data.port || 25565,
        data.rcon_port,
        encryptedPassword,
        data.minecraft_version || null,
        data.max_players || 100,
      ]
    );
    const serverId = (result as any).insertId;

    logger.info('Server config saved via setup wizard', { serverId, name: data.name });
    return { serverId };
  }

  /**
   * Get setup status — check if at least one server is configured.
   */
  async getSetupStatus(): Promise<{
    isConfigured: boolean;
    serverCount: number;
    hasAdmin: boolean;
  }> {
    const [servers] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM servers');
    const [admins] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");

    return {
      isConfigured: servers[0].count > 0,
      serverCount: servers[0].count,
      hasAdmin: admins[0].count > 0,
    };
  }

  /**
   * Decrypt an RCON password for use (internal only — never expose to API).
   */
  decryptPassword(encrypted: string): string {
    if (!isEncrypted(encrypted)) return encrypted; // plain text fallback for legacy data
    return decrypt(encrypted);
  }
}

export const setupService = new SetupService();
