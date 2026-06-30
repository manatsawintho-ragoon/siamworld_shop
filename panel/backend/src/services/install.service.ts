import crypto from 'crypto';
import path from 'path';
import { promises as fsp } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { config } from '../config';
import { bridgeService } from './bridge.service';
import { deployService } from './deploy.service';

const execAsync = promisify(exec);

// 30 minutes — short enough to limit replay window, long enough for the customer
// to read the install instructions, copy the command, and paste into their server.
const KEY_TTL_MINUTES = 30;

interface SetupKeyRow extends RowDataPacket {
  id: number;
  subscription_id: number;
  bridge_token_id: number | null;
  enc_bridge_token: Buffer;
  expires_at: Date;
  dump_consumed_at: Date | null;
}

// AES-256-GCM envelope: [12-byte iv][16-byte tag][ciphertext]
function aesEncrypt(key: Buffer, plaintext: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}
function aesDecrypt(key: Buffer, blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const enc = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

interface BridgeTokenRow extends RowDataPacket {
  id: number;
  token_hash: string;
  token_prefix: string;
}

class InstallService {
  /**
   * Issue a one-time installer key for a subscription.
   *
   * Also issues a fresh bridge token, since the token must be embedded in the
   * rendered script (the script can't authenticate against the bridge API later).
   *
   * Returns the plaintext key + the plaintext bridge token. Both are shown ONCE.
   */
  async createSetupKey(subscriptionId: number): Promise<{
    key: string;
    keyPrefix: string;
    bridgeToken: string;
    bridgeTokenPrefix: string;
    expiresAt: Date;
    linuxOneLiner: string;
    windowsOneLiner: string;
  }> {
    // Issue a new bridge token (revokes any existing active token — same behavior
    // as the manual "Issue Token" button on the dashboard).
    const { token: bridgeToken, prefix: bridgeTokenPrefix } = await bridgeService.issueToken(subscriptionId);

    // Look up the row id of the bridge token we just issued.
    const [tokRows] = await pool.execute<BridgeTokenRow[]>(
      'SELECT id, token_hash, token_prefix FROM bridge_tokens WHERE subscription_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1',
      [subscriptionId]
    );
    const bridgeTokenId = tokRows[0]?.id ?? null;

    // 32 random bytes → 43-char base64url. We use the *raw* 32 bytes as the AES-256 key.
    const rawKey = crypto.randomBytes(32);
    const plaintext = rawKey.toString('base64url');
    const prefix = plaintext.slice(0, 8);
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    const expiresAt = new Date(Date.now() + KEY_TTL_MINUTES * 60_000);
    const encBridge = aesEncrypt(rawKey, bridgeToken);

    await pool.execute<ResultSetHeader>(
      `INSERT INTO install_setup_keys
         (subscription_id, key_hash, key_prefix, bridge_token_id, enc_bridge_token, expires_at)
       VALUES (?,?,?,?,?,?)`,
      [subscriptionId, hash, prefix, bridgeTokenId, encBridge, expiresAt]
    );

    const base = config.urls.backend.replace(/\/$/, '');
    const linuxUrl = `${base}/install/${subscriptionId}/setup.sh?key=${plaintext}`;
    const windowsUrl = `${base}/install/${subscriptionId}/setup.ps1?key=${plaintext}`;

    return {
      key: plaintext,
      keyPrefix: prefix,
      bridgeToken,
      bridgeTokenPrefix,
      expiresAt,
      linuxOneLiner: `curl -fsSL '${linuxUrl}' | sudo bash -s -- /path/to/mc-server`,
      windowsOneLiner: `iwr '${windowsUrl}' -OutFile setup.ps1; .\\setup.ps1 -McPath "C:\\path\\to\\mc-server"`,
    };
  }

  /**
   * Validate a setup key. Returns the key row + the bridge token row, or null if invalid/expired.
   * Does NOT consume the key — caller decides when to mark consumed (only the dump endpoint does).
   */
  async validateKey(subscriptionId: number, plaintextKey: string): Promise<{
    keyRow: SetupKeyRow;
    bridgeTokenPlaintext: string;
    bridgeTokenPrefix: string | null;
  } | null> {
    if (!plaintextKey || plaintextKey.length < 16) return null;
    const hash = crypto.createHash('sha256').update(plaintextKey).digest('hex');
    const [rows] = await pool.execute<SetupKeyRow[]>(
      `SELECT id, subscription_id, bridge_token_id, enc_bridge_token, expires_at, dump_consumed_at
       FROM install_setup_keys
       WHERE key_hash = ? AND subscription_id = ?`,
      [hash, subscriptionId]
    );
    const keyRow = rows[0];
    if (!keyRow) return null;
    if (new Date(keyRow.expires_at).getTime() < Date.now()) return null;

    // Decrypt the bridge token using the plaintext setup key (raw 32 bytes).
    let bridgeTokenPlaintext: string;
    try {
      const rawKey = Buffer.from(plaintextKey, 'base64url');
      if (rawKey.length !== 32) return null;
      bridgeTokenPlaintext = aesDecrypt(rawKey, keyRow.enc_bridge_token);
    } catch {
      return null;
    }

    let bridgeTokenPrefix: string | null = null;
    if (keyRow.bridge_token_id) {
      const [tokRows] = await pool.execute<BridgeTokenRow[]>(
        'SELECT token_prefix FROM bridge_tokens WHERE id = ?',
        [keyRow.bridge_token_id]
      );
      bridgeTokenPrefix = tokRows[0]?.token_prefix ?? null;
    }
    return { keyRow, bridgeTokenPlaintext, bridgeTokenPrefix };
  }

  /** Update telemetry after a script fetch. Best-effort, swallows errors. */
  async recordScriptFetch(keyId: number, ip: string): Promise<void> {
    try {
      await pool.execute(
        'UPDATE install_setup_keys SET last_script_ip = ?, last_script_at = NOW() WHERE id = ?',
        [ip.slice(0, 45), keyId]
      );
    } catch { /* swallow */ }
  }

  /** Mark the dump as consumed; the dump endpoint may only be hit once per key. */
  async consumeDump(keyId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE install_setup_keys SET dump_consumed_at = NOW() WHERE id = ? AND dump_consumed_at IS NULL',
      [keyId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Render the bash or powershell template with the customer's vars substituted in.
   * The plaintext bridge token is embedded in the script — that token is the
   * SAME one returned at createSetupKey time, but we can't recover it later, so
   * the caller MUST pass it in. (This is why the install-key endpoint returns it.)
   */
  async renderScript(opts: {
    os: 'linux' | 'windows';
    subscriptionId: number;
    shopName: string;
    bridgeTokenPlaintext: string;
    expiresAt: Date;
    plaintextKey: string;
  }): Promise<string> {
    const file = opts.os === 'windows' ? 'setup.ps1.tpl' : 'setup.sh.tpl';
    // Templates live next to the compiled service file under dist/install-templates/
    // or under src/install-templates/ during ts-node-dev. __dirname covers both.
    const tplPath = path.resolve(__dirname, '../install-templates', file);
    let tpl = await fsp.readFile(tplPath, 'utf8');

    const base = config.urls.backend.replace(/\/$/, '');
    const dumpUrl = `${base}/install/${opts.subscriptionId}/dump?key=${opts.plaintextKey}`;
    const scriptUrl = `${base}/install/${opts.subscriptionId}/setup.${opts.os === 'windows' ? 'ps1' : 'sh'}?key=${opts.plaintextKey}`;
    const panelWs = config.urls.frontend.replace(/^https?:/, 'wss:').replace(/\/$/, '') + '/bridge';
    const bridgeJarUrl = `${config.urls.frontend.replace(/\/$/, '')}/downloads/siamsite-bridge-1.1.0.jar`;

    const replacements: Record<string, string> = {
      SUB_ID: String(opts.subscriptionId),
      SHOP_NAME: opts.shopName,
      BRIDGE_TOKEN: opts.bridgeTokenPlaintext,
      DUMP_URL: dumpUrl,
      SCRIPT_URL: scriptUrl,
      BRIDGE_JAR_URL: bridgeJarUrl,
      PANEL_WS: panelWs,
      EXPIRES_AT: opts.expiresAt.toISOString(),
    };
    for (const [k, v] of Object.entries(replacements)) {
      tpl = tpl.split(`{{${k}}}`).join(v);
    }
    return tpl;
  }

  /**
   * Dump the AuthMe table from the customer's panel-hosted MySQL container.
   * Output: a full `mysqldump` SQL stream including CREATE TABLE + INSERT rows.
   *
   * Runs `docker exec sw-{shopname}-mysql-1 mysqldump …`. This relies on the panel
   * container being able to talk to docker (sock mounted). We use the customer's
   * MYSQL_USER credentials from their .env so we don't need root.
   */
  async generateAuthmeDump(shopName: string): Promise<string> {
    const env = await deployService.getCustomerEnv(shopName);
    const mysqlUser = env['MYSQL_USER'] || 'siamworld';
    const mysqlPass = env['MYSQL_PASSWORD'];
    const mysqlDb   = env['MYSQL_DATABASE'] || 'siamworld';
    if (!mysqlPass) throw new Error(`MYSQL_PASSWORD not found in customer env for ${shopName}`);

    // --single-transaction: consistent snapshot without locking InnoDB
    // --skip-comments: smaller output
    // --no-tablespaces: avoids RELOAD privilege requirement
    const cmd = [
      'docker', 'exec',
      `sw-${shopName}-mysql-1`,
      'mysqldump',
      '--single-transaction',
      '--skip-lock-tables',
      '--skip-comments',
      '--no-tablespaces',
      '--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',
      `-u${mysqlUser}`,
      `-p${mysqlPass}`,
      mysqlDb,
      'authme',
    ];
    // Important: pass args via spawn-style array to avoid shell interpretation of $.
    const { stdout, stderr } = await execAsync(cmd.map(quoteArg).join(' '), {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    });
    if (stderr && !/Using a password on the command line/i.test(stderr)) {
      // mysqldump emits a harmless warning about -p on the command line; ignore that one.
      if (stderr.trim().length > 0) throw new Error(`mysqldump stderr: ${stderr.slice(0, 200)}`);
    }
    if (!stdout || !stdout.includes('INSERT INTO') && !stdout.includes('CREATE TABLE')) {
      throw new Error('mysqldump produced empty or invalid output');
    }
    return stdout;
  }
}

function quoteArg(s: string): string {
  // Wrap each arg in single quotes; escape any embedded single quotes.
  // This is safe because we never need shell expansion in any of the args.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export const installService = new InstallService();
