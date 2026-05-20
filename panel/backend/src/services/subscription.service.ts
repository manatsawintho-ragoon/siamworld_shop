import { exec } from 'child_process';
import { promisify } from 'util';
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { pool } from '../database/connection';
import { walletService } from './wallet.service';
import { deployService } from './deploy.service';
import { settingsService } from './settings.service';
import { npmService } from './npm.service';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { config } from '../config';

const execAsync = promisify(exec);

const PACKAGE_MONTHS: Record<number, string> = { 1: 'price_1month', 3: 'price_3months', 6: 'price_6months' };

export type SubscriptionKind = 'regular' | 'trial' | 'intro';

class SubscriptionService {
  async getPackages() {
    const s = await settingsService.getAll();
    const p1 = Number(s['price_1month']  || 350);
    const p3 = Number(s['price_3months'] || 945);
    const p6 = Number(s['price_6months'] || 1785);
    return [
      { kind: 'regular' as const, months: 1, price: p1, label: '1 เดือน', save: 0 },
      { kind: 'regular' as const, months: 3, price: p3, label: '3 เดือน', save: p1 * 3 - p3 },
      { kind: 'regular' as const, months: 6, price: p6, label: '6 เดือน', save: p1 * 6 - p6 },
    ];
  }

  /** Promotional offers shown above regular pricing on the landing page. */
  async getPromos() {
    const s = await settingsService.getAll();
    const enableTrial = s['enable_trial'] !== '0';
    const enableIntro = s['enable_intro'] !== '0';
    const promos: Array<{
      kind: SubscriptionKind;
      months: number;
      days?: number;
      price: number;
      label: string;
      regularPrice: number;
    }> = [];
    const regularPrice = Number(s['price_1month'] || 350);
    if (enableTrial) {
      promos.push({
        kind: 'trial',
        months: 0,
        days: Number(s['trial_days'] || 7),
        price: 0,
        label: `ทดลองฟรี ${Number(s['trial_days'] || 7)} วัน`,
        regularPrice,
      });
    }
    if (enableIntro) {
      promos.push({
        kind: 'intro',
        months: 1,
        price: Number(s['intro_price'] || 99),
        label: 'เดือนแรกพิเศษ',
        regularPrice,
      });
    }
    return promos;
  }

  /** EasySlip API fee disclosure — surfaced separately from package price. */
  async getEasyslipFee() {
    const s = await settingsService.getAll();
    return Number(s['easyslip_fee'] || 0.396);
  }

  async create(userId: number, shopName: string, packageMonths: number, mcIp?: string, kind: SubscriptionKind = 'regular', clientIp?: string) {
    // Validate name
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(shopName)) {
      throw new ValidationError('ชื่อร้านต้องเป็นตัวพิมพ์เล็ก a-z 0-9 ขีด ความยาว 3-30 ตัวอักษร');
    }
    if (mcIp && !/^(\d{1,3}\.){3}\d{1,3}$/.test(mcIp)) {
      throw new ValidationError('รูปแบบ IP ไม่ถูกต้อง');
    }

    const settings = await settingsService.getAll();
    const panelDomain = settings['panel_domain'] || 'siamsite.shop';
    const domain = `${shopName}.${panelDomain}`;

    // Resolve price + duration based on kind
    let price: number;
    let durationDays = 0;
    let durationMonths = 0;
    if (kind === 'trial') {
      if (settings['enable_trial'] === '0') throw new ValidationError('ทดลองฟรีปิดให้บริการชั่วคราว');
      price = 0;
      durationDays = Number(settings['trial_days'] || 7);
    } else if (kind === 'intro') {
      if (settings['enable_intro'] === '0') throw new ValidationError('โปรโมชั่นเดือนแรกปิดให้บริการชั่วคราว');
      if (packageMonths !== 1) throw new ValidationError('โปรโมชั่นเดือนแรกใช้ได้กับแพ็กเกจ 1 เดือนเท่านั้น');
      price = Number(settings['intro_price'] || 99);
      durationMonths = 1;
    } else {
      const priceKey = PACKAGE_MONTHS[packageMonths];
      if (!priceKey) throw new ValidationError('แพ็กเกจไม่ถูกต้อง');
      price = Number(settings[priceKey]);
      durationMonths = packageMonths;
    }

    const expiresAt = new Date();
    if (durationDays > 0) expiresAt.setDate(expiresAt.getDate() + durationDays);
    if (durationMonths > 0) expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // ── Atomic block: lock user, validate eligibility, debit wallet, insert subscription.
    // Previously each step had its own transaction so a failure mid-flow could debit the
    // user without creating the shop. With a single tx, any error rolls everything back.
    const conn = await pool.getConnection();
    let subscriptionId: number;
    try {
      await conn.beginTransaction();

      // Lock the user row first — also gives us a serialized eligibility check.
      const [userRows] = await conn.execute<RowDataPacket[]>(
        'SELECT used_trial, used_intro FROM panel_users WHERE id = ? FOR UPDATE',
        [userId]
      );
      const u = userRows[0];
      if (!u) throw new NotFoundError('ไม่พบบัญชี');

      if (kind === 'trial' || kind === 'intro') {
        if (kind === 'trial' && u.used_trial) throw new ConflictError('คุณใช้สิทธิ์ทดลองฟรีไปแล้ว');
        if (kind === 'intro' && u.used_intro) throw new ConflictError('คุณใช้สิทธิ์โปรเดือนแรกไปแล้ว');

        // IP cap: bucket by CURRENT request IP against past claim IPs (claimed_*_ip),
        // not the signup_ip — that's what trapped users who registered+claimed from
        // different IPs. claimed_*_ip is backfilled from signup_ip for existing rows.
        if (clientIp) {
          const ipCol = kind === 'trial' ? 'claimed_trial_ip' : 'claimed_intro_ip';
          const [ipRows] = await conn.execute<RowDataPacket[]>(
            `SELECT id FROM panel_users WHERE ${ipCol} = ? AND id <> ? LIMIT 1`,
            [clientIp, userId]
          );
          if (ipRows.length) {
            throw new ConflictError(
              kind === 'trial'
                ? 'IP นี้เคยใช้สิทธิ์ทดลองฟรีแล้ว'
                : 'IP นี้เคยใช้สิทธิ์โปรเดือนแรกแล้ว'
            );
          }
        }
      }

      // Debit wallet inside the same tx (skip for free trial)
      if (price > 0) {
        const desc = kind === 'intro'
          ? `โปรเดือนแรก ฿${price} (${domain})`
          : `สั่งซื้อแพ็กเกจ ${packageMonths} เดือน (${domain})`;
        await walletService.debitWithin(conn, userId, price, 'purchase', desc);
      }

      // Insert subscription (shop_name UNIQUE — duplicate name throws ER_DUP_ENTRY)
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO subscriptions
          (user_id, shop_name, domain, frontend_port, backend_port, mysql_exposed_port,
           package_months, kind, price_paid, expires_at, status, mc_ip)
         VALUES (?,?,?,0,0,0,?,?,?,?,"pending",?)`,
        [userId, shopName, domain, durationMonths || 0, kind, price, expiresAt, mcIp || null]
      );
      subscriptionId = result.insertId;

      // Mark eligibility as consumed + record the claim IP
      if (kind === 'trial') {
        await conn.execute(
          'UPDATE panel_users SET used_trial = 1, claimed_trial_ip = COALESCE(?, claimed_trial_ip) WHERE id = ?',
          [clientIp || null, userId]
        );
      } else if (kind === 'intro') {
        await conn.execute(
          'UPDATE panel_users SET used_intro = 1, claimed_intro_ip = COALESCE(?, claimed_intro_ip) WHERE id = ?',
          [clientIp || null, userId]
        );
      }

      await conn.commit();
    } catch (err: unknown) {
      await conn.rollback();
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictError('ชื่อร้านนี้ถูกใช้งานแล้ว');
      }
      throw err;
    } finally {
      conn.release();
    }

    // Async deploy — only after the row is committed, so a deploy failure can't strand a debit.
    deployService.deployAsync(subscriptionId, shopName, domain, mcIp);

    return {
      subscriptionId,
      shopName,
      domain,
      packageMonths: durationMonths,
      kind,
      price,
      expiresAt,
      status: 'deploying',
    };
  }

  async renew(userId: number, subscriptionId: number, packageMonths: number, kind: 'regular' | 'intro' = 'regular') {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [subscriptionId, userId]
    );
    const sub = rows[0];
    if (!sub) throw new NotFoundError('ไม่พบแพ็กเกจ');
    if (['cancelled'].includes(sub.status)) throw new ValidationError('ไม่สามารถต่ออายุแพ็กเกจนี้ได้');

    const settings = await settingsService.getAll();

    let price: number;
    let renewMonths: number;
    let debitDesc: string;

    if (kind === 'intro') {
      // Intro renewal: only valid for trial subs by users who have not used intro
      if (sub.kind !== 'trial') {
        throw new ValidationError('โปรเดือนแรกใช้ได้กับร้านที่กำลังทดลองเท่านั้น');
      }
      if (settings['enable_intro'] === '0') {
        throw new ValidationError('โปรโมชั่นเดือนแรกปิดให้บริการชั่วคราว');
      }
      const [userRow] = await pool.execute<RowDataPacket[]>(
        'SELECT used_intro FROM panel_users WHERE id = ?', [userId]
      );
      if (!userRow[0]) throw new NotFoundError('ไม่พบบัญชี');
      if (userRow[0].used_intro) throw new ConflictError('คุณใช้สิทธิ์โปรเดือนแรกไปแล้ว');

      price = Number(settings['intro_price'] || 99);
      renewMonths = 1;
      debitDesc = `โปรเดือนแรก ฿${price} ต่ออายุ (${sub.domain})`;
    } else {
      const priceKey = PACKAGE_MONTHS[packageMonths];
      if (!priceKey) throw new ValidationError('แพ็กเกจไม่ถูกต้อง');
      price = Number(settings[priceKey]);
      renewMonths = packageMonths;
      debitDesc = `ต่ออายุ ${packageMonths} เดือน (${sub.domain})`;
    }

    await walletService.debit(userId, price, 'renewal', debitDesc);

    // Extend from current expiry or now (whichever is later)
    const base = new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
    base.setMonth(base.getMonth() + renewMonths);

    // Upgrade kind off "trial" once paid (so future renewals follow normal pricing rules)
    const newKind = sub.kind === 'trial' ? (kind === 'intro' ? 'intro' : 'regular') : sub.kind;

    await pool.execute(
      'UPDATE subscriptions SET expires_at=?, status="active", renewed_at=NOW(), kind=?, package_months=? WHERE id=?',
      [base, newKind, renewMonths, subscriptionId]
    );

    if (kind === 'intro') {
      await pool.execute('UPDATE panel_users SET used_intro = 1 WHERE id = ?', [userId]);
    }

    // If was suspended, restart docker
    if (sub.status === 'suspended' || sub.status === 'expired') {
      try { await deployService.startShop(sub.shop_name); } catch { /* non-critical */ }
      await pool.execute('UPDATE subscriptions SET status="active" WHERE id=?', [subscriptionId]);
    }

    return { expiresAt: base, price };
  }

  async getMyEligibility(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT used_trial, used_intro FROM panel_users WHERE id = ?', [userId]
    );
    const u = rows[0];
    return {
      usedTrial: !!(u?.used_trial),
      usedIntro: !!(u?.used_intro),
    };
  }

  async getMySubscriptions(userId: number) {
    // Skip heavy columns (deploy_log can be hundreds of KB) and trust DB status —
    // we used to fork `docker inspect` per row which was O(N) per dashboard load.
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, user_id, shop_name, domain, frontend_port, backend_port, mysql_exposed_port,
              package_months, kind, price_paid, starts_at, expires_at, status, mc_ip,
              created_at, renewed_at, auto_renew
       FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  /** On-demand: real-time docker state for a single shop. Cached so dashboards can poll cheaply. */
  async getDockerStatus(shopName: string): Promise<string> {
    return deployService.getShopStatus(shopName);
  }

  async getById(subscriptionId: number, userId?: number) {
    const where = userId ? 'id = ? AND user_id = ?' : 'id = ?';
    const params = userId ? [subscriptionId, userId] : [subscriptionId];
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM subscriptions WHERE ${where}`, params);
    if (!rows[0]) throw new NotFoundError('ไม่พบแพ็กเกจ');
    return rows[0];
  }

  async updateAutoRenew(subscriptionId: number, autoRenew: boolean) {
    await pool.execute('UPDATE subscriptions SET auto_renew=? WHERE id=?', [autoRenew, subscriptionId]);
  }

  // ── Admin ─────────────────────────────────────────────────
  async getAllAdmin(page = 1, limit = 20, status?: string) {
    const safeLimit = Math.min(Math.max(limit | 0, 1), 100);
    const safePage = Math.max(page | 0, 1);
    const offset = (safePage - 1) * safeLimit;
    // LIMIT/OFFSET inlined — see payment.service.ts for rationale.
    if (status) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT s.*, pu.email, pu.display_name
           FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
          WHERE s.status = ?
          ORDER BY s.created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`,
        [status]
      );
      const [count] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM subscriptions s WHERE s.status = ?',
        [status]
      );
      return { subscriptions: rows, total: count[0].total };
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT s.*, pu.email, pu.display_name
         FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
        ORDER BY s.created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`
    );
    const [count] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM subscriptions s'
    );
    return { subscriptions: rows, total: count[0].total };
  }

  async adminAction(subscriptionId: number, action: 'start'|'stop'|'restart'|'suspend'|'unsuspend'|'redeploy') {
    const sub = await this.getById(subscriptionId);
    switch (action) {
      case 'redeploy':
        await deployService.deployAsync(subscriptionId, sub.shop_name, sub.domain, sub.mc_ip || undefined);
        break;
      case 'start':
        // If never deployed or cancelled (no containers), run full deploy
        if (sub.status === 'pending' || sub.status === 'cancelled') {
          await deployService.deployAsync(subscriptionId, sub.shop_name, sub.domain);
        } else {
          await deployService.startShop(sub.shop_name);
          await pool.execute('UPDATE subscriptions SET status="active" WHERE id=?', [subscriptionId]);
        }
        break;
      case 'stop':
      case 'suspend':
        await deployService.stopShop(sub.shop_name);
        await pool.execute('UPDATE subscriptions SET status="suspended" WHERE id=?', [subscriptionId]);
        break;
      case 'restart':
        await deployService.restartShop(sub.shop_name);
        break;
      case 'unsuspend':
        await deployService.startShop(sub.shop_name);
        await pool.execute('UPDATE subscriptions SET status="active" WHERE id=?', [subscriptionId]);
        break;
    }
  }

  async adminRemove(subscriptionId: number) {
    const sub = await this.getById(subscriptionId);
    await deployService.removeShop(sub.shop_name, sub.domain, sub.mc_ip || undefined, sub.mysql_exposed_port || undefined);
    await pool.execute('DELETE FROM subscriptions WHERE id=?', [subscriptionId]);
  }

  async adminUpdate(subscriptionId: number, data: { domain?: string; expires_at?: string }) {
    const sub = await this.getById(subscriptionId);
    const updates: string[] = [];
    const params: any[] = [];

    if (data.domain !== undefined && data.domain !== sub.domain) {
      const newDomain = data.domain;
      if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(newDomain)) {
        throw new ValidationError('รูปแบบ domain ไม่ถูกต้อง');
      }
      updates.push('domain=?');
      params.push(newDomain);

      const deployDir = config.deployDir;
      const envFile = path.join(deployDir, 'customers', sub.shop_name, '.env');

      // 1. Update .env file (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, CORS_ORIGIN)
      if (fs.existsSync(envFile)) {
        let envContent = await fsp.readFile(envFile, 'utf8');
        envContent = envContent
          .replace(/^NEXT_PUBLIC_API_URL=.*/m, `NEXT_PUBLIC_API_URL=https://${newDomain}/api`)
          .replace(/^NEXT_PUBLIC_WS_URL=.*/m,  `NEXT_PUBLIC_WS_URL=wss://${newDomain}`)
          .replace(/^CORS_ORIGIN=.*/m,          `CORS_ORIGIN=https://${newDomain}`);
        await fsp.writeFile(envFile, envContent, 'utf8');
      }

      // 2. Update customers.json using jq (safe for special chars)
      try {
        const jsonFile = path.join(deployDir, 'customers.json');
        await execAsync(
          `jq --arg name ${JSON.stringify(sub.shop_name)} --arg domain ${JSON.stringify(newDomain)} \
           '(.customers[] | select(.name == $name) | .domain) |= $domain' \
           "${jsonFile}" > /tmp/sw_customers_tmp.json && mv /tmp/sw_customers_tmp.json "${jsonFile}"`
        );
      } catch { /* non-critical */ }

      // 3. Delete old NPM proxy, create new
      try { await npmService.deleteProxyHost(sub.domain); } catch { /* non-critical */ }
      try { await npmService.updateProxyHost(newDomain, sub.frontend_port, sub.backend_port); } catch { /* non-critical */ }

      // 4. Rebuild frontend container (NEXT_PUBLIC_* are baked into the Next.js build)
      //    Run async — takes a few minutes, status will show rebuilding in docker
      const composeFile = path.join(deployDir, 'docker-compose.customer.yml');
      if (fs.existsSync(envFile)) {
        execAsync(
          `docker compose --project-name "sw-${sub.shop_name}" --env-file "${envFile}" -f "${composeFile}" up -d --build frontend`,
          { timeout: 10 * 60 * 1000 }
        ).catch(err => console.error(`[adminUpdate] docker rebuild failed for ${sub.shop_name}:`, err));
      }
    }

    if (data.expires_at !== undefined) {
      updates.push('expires_at=?');
      params.push(new Date(data.expires_at));
    }

    if (updates.length === 0) return;
    params.push(subscriptionId);
    await pool.execute(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id=?`, params);
  }

  async getDashboardStats() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM subscriptions WHERE status='active') as active_shops,
        (SELECT COUNT(*) FROM subscriptions WHERE status='deploying') as deploying,
        (SELECT COUNT(*) FROM subscriptions WHERE status='suspended') as suspended,
        (SELECT COUNT(*) FROM subscriptions WHERE DATE(expires_at) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND status='active') as expiring_soon,
        (SELECT COUNT(*) FROM panel_users) as total_users,
        (SELECT COALESCE(SUM(amount),0) FROM wallet_transactions WHERE type='topup' AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) as revenue_30d,
        (SELECT COUNT(*) FROM payment_slips WHERE status='pending') as pending_slips
    `);
    return rows[0];
  }

  async getRevenueChart() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date, 
        CAST(SUM(amount) AS DOUBLE) as total 
      FROM wallet_transactions 
      WHERE type='topup' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY date
      ORDER BY date ASC
    `);
    return rows;
  }

  async getUserGrowthChart() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date, 
        COUNT(*) as count 
      FROM panel_users 
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY date
      ORDER BY date ASC
    `);
    return rows;
  }

  async getAuditLogs(page: number = 1, limit: number = 50) {
    const safeLimit = Math.min(Math.max(limit | 0, 1), 200);
    const safePage = Math.max(page | 0, 1);
    const offset = (safePage - 1) * safeLimit;
    const [logs] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*, u.display_name, u.email
       FROM audit_logs l
       LEFT JOIN panel_users u ON l.user_id = u.id
       ORDER BY l.created_at DESC
       LIMIT ${safeLimit} OFFSET ${offset}`
    );

    const [total] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM audit_logs');

    return { logs, total: total[0].count };
  }

  async logAudit(userId: number | null, action: string, targetType?: string, targetId?: number, details?: string, ip?: string) {
    try {
      await pool.execute(
        'INSERT INTO audit_logs (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, action, targetType || null, targetId || null, details || null, ip || null]
      );
    } catch (e) {
      console.error('Failed to log audit:', e);
    }
  }

  async getPublicStats() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM subscriptions WHERE status != 'cancelled') as total_shops,
        (SELECT COUNT(*) FROM panel_users) as total_users,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions WHERE type='purchase') as total_purchase_amount,
        (SELECT COUNT(*) FROM wallet_transactions WHERE type='purchase') as real_orders_count
    `);
    const stats = rows[0];
    
    // Realistic "Total Items Purchased" using a smaller, more believable baseline 
    // + real transactions from the database.
    const baseItemsCount = 25400; 
    const totalOrders = baseItemsCount + Number(stats.real_orders_count);


    return {
      total_shops: stats.total_shops,
      total_users: stats.total_users,
      total_orders: totalOrders,
      uptime: '99.98%',
      delivery_speed: 'ประมาณ 3-5 นาที' // Realistic deployment/setup time
    };
  }

  async getPublicShopNames(): Promise<{ name: string; domain: string }[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT shop_name, domain FROM subscriptions WHERE status = 'active' ORDER BY created_at ASC`
    );
    return rows.map(r => ({ name: r.shop_name as string, domain: r.domain as string }));
  }
}

export const subscriptionService = new SubscriptionService();
