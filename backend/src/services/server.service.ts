import { pool } from '../database/connection';
import { NotFoundError, ValidationError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import { Rcon } from 'rcon-client';

const HEALTH_TIMEOUT_MS = 5000;

function resolveHost(host: string): string {
  if (process.env.DOCKER === 'true') {
    if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0') {
      return 'host.docker.internal';
    }
  }
  return host;
}

class ServerService {
  async getAll() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, host, port, rcon_port, rcon_password, minecraft_version, max_players, enabled as is_enabled, created_at FROM servers ORDER BY id'
    );
    // Mask encrypted passwords in API responses
    return rows.map((r: any) => ({ ...r, rcon_password: '••••••••' }));
  }

  async getById(id: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM servers WHERE id = ?', [id]
    );
    if (rows.length === 0) throw new NotFoundError('Server not found');
    return { ...rows[0], rcon_password: '••••••••' };
  }

  async create(data: {
    name: string; host: string; port?: number; rcon_port: number;
    rcon_password: string; minecraft_version?: string; max_players?: number;
    is_enabled?: boolean;
  }) {
    const encryptedPassword = encrypt(data.rcon_password);
    const [result] = await pool.execute(
      'INSERT INTO servers (name, host, port, rcon_port, rcon_password, minecraft_version, max_players) VALUES (?,?,?,?,?,?,?)',
      [data.name, resolveHost(data.host), data.port || 25565, data.rcon_port, encryptedPassword, data.minecraft_version || null, data.max_players || 100]
    );
    return this.getById((result as any).insertId);
  }

  async update(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: (string | number)[] = [];
    for (const key of ['name', 'port', 'rcon_port', 'minecraft_version', 'max_players']) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
    }
    // Resolve host for Docker networking
    if (data.host !== undefined) { fields.push('host = ?'); values.push(resolveHost(data.host)); }
    // Encrypt password on update
    if (data.rcon_password !== undefined && data.rcon_password !== '••••••••') {
      fields.push('rcon_password = ?');
      values.push(encrypt(data.rcon_password));
    }
    if (data.is_enabled !== undefined) { fields.push('enabled = ?'); values.push(data.is_enabled ? 1 : 0); }
    if (fields.length === 0) throw new ValidationError('No fields to update');
    values.push(id);
    await pool.execute(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getById(id);
  }

  async delete(id: number) {
    await pool.execute('DELETE FROM servers WHERE id = ?', [id]);
  }

  /** Check real RCON connectivity for ALL servers in parallel (enabled or not). */
  async healthCheckAll(): Promise<{ id: number; healthy: boolean; latency_ms: number }[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, host, rcon_port, rcon_password FROM servers'
    );

    const results = await Promise.allSettled(
      (rows as any[]).map(async (row) => {
        const password = isEncrypted(row.rcon_password) ? decrypt(row.rcon_password) : row.rcon_password;
        const start = Date.now();
        let rcon: Rcon | null = null;
        try {
          rcon = new Rcon({ host: row.host, port: row.rcon_port, password });
          await Promise.race([
            rcon.connect(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), HEALTH_TIMEOUT_MS)
            ),
          ]);
          await rcon.send('list');
          return { id: row.id as number, healthy: true, latency_ms: Date.now() - start };
        } catch {
          return { id: row.id as number, healthy: false, latency_ms: Date.now() - start };
        } finally {
          if (rcon) rcon.end().catch(() => {});
        }
      })
    );

    return results.map((r) =>
      r.status === 'fulfilled' ? r.value : { id: 0, healthy: false, latency_ms: 0 }
    );
  }
}

export const serverService = new ServerService();
