import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { deployService } from './deploy.service';
import { encryptWithSecret, decryptWithSecret, looksEncrypted } from '../utils/shopCrypto';

const execAsync = promisify(exec);

/**
 * Reads / provisions / regenerates a shop's dedicated web-admin credential.
 *
 * The credential lives in the shop's own MySQL (`users.admin_password_enc`,
 * migration 029), encrypted with the shop's ENCRYPTION_KEY. We reach the shop
 * DB the same way deploy ops do — `docker exec` into `sw-<shop>-mysql-1` — so
 * there is no extra network exposure and no new secret handshake.
 *
 * Provisioning is lazy + idempotent: existing shops (which only had authme
 * admins) get a dedicated credential the first time the owner opens the panel
 * card. The authme admin keeps working in parallel — this is purely additive.
 */

/** Single-quote a value for safe embedding in a shell command. */
function sq(s: string): string {
  return `'` + s.replace(/'/g, `'\\''`) + `'`;
}

/** Random password from an unambiguous alphabet (no O/0/I/l/1). */
function randomPassword(len = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

export interface ShopAdminCredential {
  username: string;
  password: string;
  provisioned: boolean; // true if this call created the credential
}

class ShopAdminCredentialService {
  /** Run a SQL statement inside the shop's mysql container; returns stdout. */
  private async runSql(shopName: string, env: Record<string, string>, sql: string): Promise<string> {
    const user = env.MYSQL_USER || 'siamworld';
    const pass = env.MYSQL_PASSWORD || '';
    const db = env.MYSQL_DATABASE || 'siamworld';
    const container = `sw-${shopName}-mysql-1`;
    const cmd = `docker exec -i ${sq(container)} mysql -N -B -u${sq(user)} -p${sq(pass)} ${sq(db)} -e ${sq(sql)}`;
    const { stdout } = await execAsync(cmd, { timeout: 30000 });
    return stdout;
  }

  private secretOf(env: Record<string, string>): string {
    const secret = env.ENCRYPTION_KEY || env.JWT_SECRET;
    if (!secret) throw new Error('ไม่พบ ENCRYPTION_KEY ของร้าน ไม่สามารถจัดการรหัสแอดมินได้');
    return secret;
  }

  /** Existing dedicated-admin username for this shop, or null. */
  private async currentUsername(shopName: string, env: Record<string, string>): Promise<string | null> {
    const out = (await this.runSql(
      shopName, env,
      'SELECT username FROM users WHERE admin_password_enc IS NOT NULL ORDER BY id ASC LIMIT 1'
    )).trim();
    return out || null;
  }

  private async generateUniqueUsername(shopName: string, env: Record<string, string>): Promise<string> {
    const base = shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin';
    for (let i = 0; i < 25; i++) {
      const cand = `${base}${10 + Math.floor(Math.random() * 90)}`;
      const out = (await this.runSql(
        shopName, env,
        `SELECT (SELECT COUNT(*) FROM users WHERE LOWER(username)=LOWER('${cand}')) + ` +
        `(SELECT COUNT(*) FROM authme WHERE LOWER(username)=LOWER('${cand}'))`
      )).trim();
      if (out === '0') return cand;
    }
    return `${base}${Date.now().toString().slice(-6)}`;
  }

  private async provision(shopName: string, env: Record<string, string>, secret: string): Promise<ShopAdminCredential> {
    const username = await this.generateUniqueUsername(shopName, env); // safe charset by construction
    const password = randomPassword();
    const enc = encryptWithSecret(password, secret); // hex:hex:hex, safe to embed
    await this.runSql(
      shopName, env,
      `INSERT INTO users (username,email,role,admin_password_enc) VALUES ('${username}',NULL,'admin','${enc}'); ` +
      `INSERT INTO wallets (user_id,balance) VALUES (LAST_INSERT_ID(),0.00)`
    );
    return { username, password, provisioned: true };
  }

  private async writePassword(shopName: string, env: Record<string, string>, secret: string, username: string, password: string): Promise<void> {
    if (!USERNAME_RE.test(username)) throw new Error('ชื่อแอดมินไม่ถูกต้อง');
    const enc = encryptWithSecret(password, secret);
    await this.runSql(shopName, env, `UPDATE users SET admin_password_enc='${enc}' WHERE username='${username}'`);
  }

  /** Read the current credential, provisioning one if the shop has none yet. */
  async getOrProvision(shopName: string): Promise<ShopAdminCredential> {
    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);

    const out = (await this.runSql(
      shopName, env,
      'SELECT username, admin_password_enc FROM users WHERE admin_password_enc IS NOT NULL ORDER BY id ASC LIMIT 1'
    )).trim();

    if (out) {
      const [username, enc] = out.split('\t');
      if (username && enc && looksEncrypted(enc)) {
        return { username, password: decryptWithSecret(enc, secret), provisioned: false };
      }
      // Row exists but value is unreadable (e.g. key rotated) — reset its password.
      if (username && USERNAME_RE.test(username)) {
        const password = randomPassword();
        await this.writePassword(shopName, env, secret, username, password);
        return { username, password, provisioned: false };
      }
    }

    return this.provision(shopName, env, secret);
  }

  /** Generate a fresh random password for the existing credential (or create one). */
  async regenerate(shopName: string): Promise<ShopAdminCredential> {
    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);
    const username = await this.currentUsername(shopName, env);
    if (!username) return this.provision(shopName, env, secret);
    const password = randomPassword();
    await this.writePassword(shopName, env, secret, username, password);
    return { username, password, provisioned: false };
  }

  /** Set a custom password for the existing credential (or create one with it). */
  async setPassword(shopName: string, newPassword: string): Promise<ShopAdminCredential> {
    if (!newPassword || newPassword.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
    if (newPassword.length > 100) throw new Error('รหัสผ่านยาวเกินไป');
    const env = await deployService.getCustomerEnv(shopName);
    const secret = this.secretOf(env);
    let username = await this.currentUsername(shopName, env);
    if (!username) {
      const created = await this.provision(shopName, env, secret);
      username = created.username;
    }
    await this.writePassword(shopName, env, secret, username, newPassword);
    return { username, password: newPassword, provisioned: false };
  }
}

export const shopAdminCredentialService = new ShopAdminCredentialService();
