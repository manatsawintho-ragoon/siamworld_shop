import { pool } from '../database/connection';
import { NotFoundError, ValidationError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto';
import { Rcon } from 'rcon-client';

const HEALTH_TIMEOUT_MS = 5000;

/** Sentinel returned to clients in place of the real (encrypted) password. */
const PASSWORD_MASK = '••••••••';

export type RconFailCode = 'auth' | 'timeout' | 'refused' | 'dns' | 'reset' | 'unknown';

/**
 * Turn a raw RCON/socket error into an actionable code + Thai message so the admin
 * UI can tell the customer *why* RCON is down (wrong password vs server down vs
 * firewall) instead of just a red "offline". This is the difference between a
 * self-served fix and a support ticket.
 */
function classifyRconError(err: unknown): { code: RconFailCode; reason: string } {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();

  if (msg.includes('auth')) {
    return { code: 'auth', reason: 'รหัส RCON ไม่ถูกต้อง: ตรวจ rcon.password ใน server.properties ให้ตรงกับที่ตั้งในร้าน' };
  }
  if (msg.includes('econnrefused') || msg.includes('refused')) {
    return { code: 'refused', reason: 'เซิร์ฟเวอร์ปฏิเสธการเชื่อมต่อ: RCON ยังไม่เปิด (enable-rcon=true?) หรือ RCON port ผิด' };
  }
  if (msg.includes('enotfound') || msg.includes('eai_again') || msg.includes('getaddrinfo')) {
    return { code: 'dns', reason: 'หา host ไม่เจอ: ตรวจ IP/โดเมนของเซิร์ฟเวอร์ให้ถูกต้อง' };
  }
  if (msg.includes('econnreset')) {
    return { code: 'reset', reason: 'การเชื่อมต่อถูกตัด: เซิร์ฟเวอร์เพิ่งรีสตาร์ท หรือ RCON ไม่เสถียร' };
  }
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return { code: 'timeout', reason: 'เชื่อมต่อ RCON ไม่ได้ (timeout): เซิร์ฟเวอร์อาจปิดอยู่, firewall บล็อก RCON port, หรือ host/port ผิด' };
  }
  return { code: 'unknown', reason: 'เชื่อมต่อ RCON ไม่ได้: ' + (err instanceof Error ? err.message : 'unknown error') };
}

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
    return rows.map((r: any) => ({ ...r, rcon_password: PASSWORD_MASK }));
  }

  async getById(id: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM servers WHERE id = ?', [id]
    );
    if (rows.length === 0) throw new NotFoundError('Server not found');
    return { ...rows[0], rcon_password: PASSWORD_MASK };
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
    // Encrypt password on update — but ONLY when a real new password was supplied.
    // The real password never leaves the server (getAll/getById mask it as PASSWORD_MASK),
    // so an edit that doesn't touch the field must leave the stored password untouched.
    // Skip the mask, empty, and whitespace-only values; otherwise re-saving the form after
    // changing some *other* field would overwrite the password with garbage (the mask) or
    // wipe it (empty string → encrypt('')). This is what corrupted honeyland's stored creds.
    if (
      data.rcon_password !== undefined &&
      data.rcon_password !== PASSWORD_MASK &&
      String(data.rcon_password).trim() !== ''
    ) {
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
  async healthCheckAll(): Promise<{ id: number; healthy: boolean; latency_ms: number; code: RconFailCode | null; reason: string | null }[]> {
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
          return { id: row.id as number, healthy: true, latency_ms: Date.now() - start, code: null, reason: null };
        } catch (err) {
          // Keep the *reason* — a red dot with no explanation is what turns every RCON
          // hiccup into a support ticket. The admin UI surfaces this to the customer.
          const { code, reason } = classifyRconError(err);
          return { id: row.id as number, healthy: false, latency_ms: Date.now() - start, code, reason };
        } finally {
          if (rcon) rcon.end().catch(() => {});
        }
      })
    );

    return results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: 0, healthy: false, latency_ms: 0, code: 'unknown' as RconFailCode, reason: 'เชื่อมต่อ RCON ไม่ได้' }
    );
  }
}

export const serverService = new ServerService();
