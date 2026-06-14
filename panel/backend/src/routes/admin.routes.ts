import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import fsp from 'fs/promises';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAdmin } from '../middleware/auth';

/** Clamp a query param to a sensible page/limit range; rejects NaN and unbounded fetches. */
function safePagination(rawPage: unknown, rawLimit: unknown, defaultLimit = 20, maxLimit = 100): { page: number; limit: number; offset: number } {
  const page = Math.max(parseInt(String(rawPage)) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(rawLimit)) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}
import { subscriptionService } from '../services/subscription.service';
import { deployService } from '../services/deploy.service';
import { paymentService } from '../services/payment.service';
import { settingsService } from '../services/settings.service';
import { notificationService } from '../services/notification.service';
import { emailService } from '../services/email.service';
import { walletService } from '../services/wallet.service';
import { npmService } from '../services/npm.service';
import { cloudflareService } from '../services/cloudflare.service';
import { pool } from '../database/connection';
import { config } from '../config/index';
import { ValidationError } from '../utils/errors';
import { RowDataPacket } from 'mysql2';

const execAsync = promisify(exec);

const router = Router();
router.use(requireAdmin);

// Dashboard
router.get('/stats', asyncRoute(async (_req, res) => {
  const stats = await subscriptionService.getDashboardStats();
  res.json(stats);
}));

router.get('/stats/charts', asyncRoute(async (_req, res) => {
  const revenue = await subscriptionService.getRevenueChart();
  const growth = await subscriptionService.getUserGrowthChart();
  res.json({ revenue, growth });
}));

router.get('/audit-logs', asyncRoute(async (req, res) => {
  const { page, limit } = safePagination(req.query.page, req.query.limit, 50);
  const result = await subscriptionService.getAuditLogs(page, limit);
  res.json(result);
}));

router.get('/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });

  const [users] = await pool.execute<RowDataPacket[]>(
    'SELECT id, display_name as name, email as detail FROM panel_users WHERE display_name LIKE ? OR email LIKE ? LIMIT 5',
    [`%${q}%`, `%${q}%`]
  );
  const [shops] = await pool.execute<RowDataPacket[]>(
    'SELECT id, shop_name as name, domain as detail FROM subscriptions WHERE shop_name LIKE ? OR domain LIKE ? LIMIT 5',
    [`%${q}%`, `%${q}%`]
  );

  const results = [
    ...users.map(u => ({ ...u, type: 'user' })),
    ...shops.map(s => ({ ...s, type: 'shop' })),
  ];
  res.json({ results });
}));

// Subscriptions
router.get('/subscriptions', asyncRoute(async (req, res) => {
  const { page, limit } = safePagination(req.query.page, req.query.limit);
  const status = req.query.status as string | undefined;
  const result = await subscriptionService.getAllAdmin(page, limit, status);
  res.json(result);
}));

// Sync subscriptions from customers.json into the panel DB (must be before /:id routes)
router.post('/subscriptions/sync-filesystem', asyncRoute(async (req, res) => {
  const deployDir = config.deployDir;
  const customersJson = await fsp.readFile(path.join(deployDir, 'customers.json'), 'utf8');
  const registry = JSON.parse(customersJson) as {
    customers: Array<{ name: string; domain: string; frontend_port: number; backend_port: number; created: string; status: string }>;
  };

  const adminUserId: number = (req as any).user!.userId;
  const imported: string[] = [];
  const skipped: string[] = [];

  for (const c of registry.customers) {
    // Check if already in DB
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM subscriptions WHERE shop_name = ?', [c.name]
    );
    if (existing.length) { skipped.push(c.name); continue; }

    // Read env file for ports and credentials
    const envPath = path.join(deployDir, 'customers', c.name, '.env');
    let mysqlExposedPort = 33000 + c.frontend_port - 3001;
    try {
      const envOut = await fsp.readFile(envPath, 'utf8');
      for (const line of envOut.split('\n')) {
        if (line.startsWith('MYSQL_EXPOSED_PORT=')) {
          const val = parseInt(line.split('=')[1]);
          if (!isNaN(val)) mysqlExposedPort = val;
        }
      }
    } catch { /* env file might not exist */ }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10); // manual import: no expiry

    await pool.execute(
      `INSERT INTO subscriptions
        (user_id, shop_name, domain, frontend_port, backend_port, mysql_exposed_port,
         package_months, price_paid, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'active')`,
      [adminUserId, c.name, c.domain, c.frontend_port, c.backend_port, mysqlExposedPort, expiresAt]
    );
    imported.push(c.name);
  }

  res.json({ success: true, imported, skipped });
}));

router.post('/subscriptions/:id/fix-npm', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT domain, frontend_port, backend_port FROM subscriptions WHERE id = ?',
    [parseInt(req.params.id)]
  );
  if (!(rows as RowDataPacket[]).length) throw new ValidationError('ไม่พบ subscription');
  const { domain, frontend_port, backend_port } = (rows as RowDataPacket[])[0];
  try {
    await npmService.updateProxyHost(domain, frontend_port, backend_port);
    res.json({ success: true });
  } catch (err: any) {
    const msg = err?.response?.data
      ? JSON.stringify(err.response.data)
      : (err?.message || 'NPM error');
    res.status(500).json({ error: msg });
  }
}));

// Flip the customer's subdomain between Cloudflare-proxied and DNS-only.
// Used to harden a Bridge-mode customer (proxied = CF DDoS protection on)
// or to revert (dns-only = needed by AuthMe-direct customers that expose MySQL
// on the same subdomain).
router.post('/subscriptions/:id/dns-mode', asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.id);
  const mode = req.body?.mode;
  if (mode !== 'proxied' && mode !== 'dns-only') {
    throw new ValidationError("mode must be 'proxied' or 'dns-only'");
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT domain FROM subscriptions WHERE id = ?', [subId]
  );
  const sub = (rows as RowDataPacket[])[0];
  if (!sub) throw new ValidationError('ไม่พบ subscription');
  try {
    const result = await cloudflareService.setProxyMode(sub.domain, mode);
    await subscriptionService.logAudit(
      req.user!.userId, `sub_dns_${mode === 'proxied' ? 'harden' : 'unharden'}`,
      'subscription', subId,
      `DNS mode → ${mode} for ${sub.domain} (changed=${result.changed})`, req.ip
    );
    res.json({ success: true, ...result, domain: sub.domain, mode });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Cloudflare error' });
  }
}));

router.patch('/subscriptions/:id', asyncRoute(async (req, res) => {
  const { domain, expires_at } = req.body;
  await subscriptionService.adminUpdate(parseInt(req.params.id), { domain, expires_at });
  res.json({ success: true });
}));

router.post('/subscriptions/:id/action', asyncRoute(async (req, res) => {
  const { action } = req.body;
  if (!['start','stop','restart','suspend','unsuspend','redeploy'].includes(action)) {
    throw new ValidationError('Invalid action');
  }
  const subId = parseInt(req.params.id);
  await subscriptionService.adminAction(subId, action);
  await subscriptionService.logAudit(req.user!.userId, `sub_${action}`, 'subscription', subId,
    `Admin performed ${action} on subscription ID ${subId}`, req.ip);
  res.json({ success: true });
}));

router.get('/subscriptions/:id/logs', asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id));
  const logs = await deployService.getLogs(sub.shop_name);
  res.json({ logs });
}));

router.get('/subscriptions/:id/stats', asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id));
  const stats = await deployService.getStats(sub.shop_name);
  res.json({ stats });
}));

router.post('/subscriptions/bulk-action', asyncRoute(async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('No subscriptions selected');
  }
  if (!['suspend','delete'].includes(action)) {
    throw new ValidationError('Invalid action');
  }

  const succeeded: number[] = [];
  const failed: { id: number; error: string }[] = [];
  for (const id of ids) {
    try {
      if (action === 'suspend') {
        await subscriptionService.adminAction(id, 'suspend');
      } else if (action === 'delete') {
        await subscriptionService.adminRemove(id);
      }
      succeeded.push(id);
    } catch (err) {
      const msg = (err as Error).message || 'unknown';
      console.error(`Bulk action ${action} failed for id ${id}:`, err);
      failed.push({ id, error: msg });
    }
  }

  await subscriptionService.logAudit(
    req.user!.userId, `bulk_${action}`, 'subscription', undefined,
    `Admin bulk ${action}: ${succeeded.length}/${ids.length} succeeded; failed=${JSON.stringify(failed)}`,
    req.ip,
  );
  // Surface partial failures so the admin UI can show what didn't go through.
  res.status(failed.length ? 207 : 200).json({
    success: failed.length === 0,
    succeeded,
    failed,
  });
}));

router.get('/subscriptions/:id/credentials', asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id));
  const env = await deployService.getCustomerEnv(sub.shop_name);
  const mysqlPort = parseInt(env['MYSQL_EXPOSED_PORT'] || '') || sub.mysql_exposed_port;
  res.json({
    shopName: sub.shop_name,
    domain: sub.domain,
    mysqlHost: sub.domain,
    mysqlPort,
    mysqlUser: env['MYSQL_USER'] || 'siamworld',
    mysqlPassword: env['MYSQL_PASSWORD'] || '',
    mysqlDatabase: env['MYSQL_DATABASE'] || 'siamworld',
    setupUrl: `https://${sub.domain}/admin/setup`,
  });
}));

router.patch('/subscriptions/:id/mc-ip', asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.id);
  const { mcIp } = req.body;

  if (mcIp && !/^(\d{1,3}\.){3}\d{1,3}$/.test(mcIp)) {
    throw new ValidationError('รูปแบบ IP ไม่ถูกต้อง');
  }

  // Get current mc_ip and mysql_exposed_port
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT mc_ip, mysql_exposed_port FROM subscriptions WHERE id = ?', [subId]
  );
  if (!rows.length) throw new ValidationError('ไม่พบ subscription');
  const { mc_ip: oldIp, mysql_exposed_port } = rows[0];

  const nsenter = (cmd: string) => execAsync(`nsenter -t 1 -m -u -i -n -p -- sh -c ${JSON.stringify(cmd)}`);

  // Remove old DOCKER-USER rule if existed
  if (oldIp && mysql_exposed_port) {
    try {
      await nsenter(`/usr/sbin/iptables -D DOCKER-USER -p tcp --dport ${mysql_exposed_port} -s "${oldIp}" -j ACCEPT 2>/dev/null || true`);
    } catch { /* non-critical */ }
  }

  // Add new DOCKER-USER rule if mcIp provided
  if (mcIp && mysql_exposed_port) {
    try {
      await nsenter(`/usr/sbin/iptables -I DOCKER-USER 1 -p tcp --dport ${mysql_exposed_port} -s "${mcIp}" -j ACCEPT`);
      await nsenter(`/usr/sbin/netfilter-persistent save 2>/dev/null || true`);
    } catch (err) {
      throw new ValidationError(`เพิ่ม Firewall rule ล้มเหลว: ${(err as Error).message}`);
    }
  }

  await pool.execute('UPDATE subscriptions SET mc_ip = ? WHERE id = ?', [mcIp || null, subId]);
  await subscriptionService.logAudit(req.user!.userId, 'update_mc_ip', 'subscription', subId,
    `Updated mc_ip from ${oldIp || 'null'} to ${mcIp || 'null'}`, req.ip);

  res.json({ success: true });
}));

router.delete('/subscriptions/:id', asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.id);
  await subscriptionService.adminRemove(subId);
  await subscriptionService.logAudit(req.user!.userId, 'remove_subscription', 'subscription', subId, `Admin removed subscription ID ${subId}`, req.ip);
  res.json({ success: true });
}));

// Payments / Slips
router.get('/slips', asyncRoute(async (req, res) => {
  const { page, limit } = safePagination(req.query.page, req.query.limit);
  const status = req.query.status as string | undefined;
  const result = await paymentService.getAllSlips(status, page, limit);
  res.json(result);
}));

router.get('/slips/:id/image', asyncRoute(async (req, res) => {
  const slipId = parseInt(req.params.id);
  if (!slipId) throw new ValidationError('Invalid slip id');
  const result = await paymentService.getSlipImage(slipId);
  res.json(result);
}));

router.post('/slips/:id/verify', asyncRoute(async (req, res) => {
  const slipId = parseInt(req.params.id);
  const adminId = req.user!.userId;
  await paymentService.adminVerifySlip(slipId);
  await subscriptionService.logAudit(adminId, 'verify_slip', 'payment_slip', slipId, `Admin manually verified slip ID ${slipId}`, req.ip);
  res.json({ success: true });
}));

router.post('/slips/:id/reject', asyncRoute(async (req, res) => {
  const slipId = parseInt(req.params.id);
  const { reason } = req.body;
  const adminId = req.user!.userId;
  await paymentService.adminRejectSlip(slipId, reason || 'Admin rejected');
  await subscriptionService.logAudit(adminId, 'reject_slip', 'payment_slip', slipId, `Admin rejected slip ID ${slipId}. Reason: ${reason}`, req.ip);
  res.json({ success: true });
}));

// Users
router.get('/users', asyncRoute(async (req, res) => {
  const { page, limit, offset } = safePagination(req.query.page, req.query.limit, 50);
  const search = String(req.query.search || '').trim();
  const role = String(req.query.role || '').trim();

  const where: string[] = [];
  const params: (string | number)[] = [];
  if (search) {
    where.push('(display_name LIKE ? OR email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (role === 'customer' || role === 'admin') {
    where.push('role = ?');
    params.push(role);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // LIMIT/OFFSET are inlined because mysql2's server-side prepared statements (execute)
  // reject integer parameters for those positions on MySQL 8.x. Values are integers
  // produced by safePagination(), so interpolation is injection-safe here.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, email, display_name, phone, wallet_balance, role, avatar_url, created_at
     FROM panel_users ${whereSql}
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [count] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM panel_users ${whereSql}`,
    params
  );
  const [counts] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(role = 'admin') AS admins,
       SUM(role = 'customer') AS customers,
       COALESCE(SUM(wallet_balance), 0) AS wallet_total
     FROM panel_users`
  );
  res.json({
    users: rows,
    total: count[0].total,
    summary: {
      total: Number(counts[0].total) || 0,
      admins: Number(counts[0].admins) || 0,
      customers: Number(counts[0].customers) || 0,
      walletTotal: Number(counts[0].wallet_total) || 0,
    },
  });
}));

router.get('/users/:id/wallet/history', asyncRoute(async (req, res) => {
  const userId = parseInt(req.params.id);
  const { limit, offset } = safePagination(req.query.page, req.query.limit, 10);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, type, amount, balance_after, description, reference_id, created_at
     FROM wallet_transactions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [userId]
  );
  const [count] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM wallet_transactions WHERE user_id = ?', [userId]
  );
  res.json({ transactions: rows, total: count[0].total });
}));

router.put('/users/:id', asyncRoute(async (req, res) => {
  const targetUserId = parseInt(req.params.id);
  const adminId = req.user!.userId;
  const { displayName, email, role } = req.body;
  if (!displayName && !email && !role) throw new ValidationError('No fields to update');
  if (role && !['customer', 'admin'].includes(role)) throw new ValidationError('role must be customer or admin');

  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (displayName) { fields.push('display_name = ?'); values.push(displayName.trim()); }
  if (email)       { fields.push('email = ?');        values.push(email.trim().toLowerCase()); }
  if (role)        { fields.push('role = ?');          values.push(role); }
  values.push(targetUserId);

  await pool.execute(`UPDATE panel_users SET ${fields.join(', ')} WHERE id = ?`, values);
  await subscriptionService.logAudit(adminId, 'edit_user', 'user', targetUserId,
    `Admin updated user ID ${targetUserId}: ${JSON.stringify({ displayName, email, role })}`, req.ip);
  res.json({ success: true });
}));

router.post('/users/:id/wallet', asyncRoute(async (req, res) => {
  const { amount, type, description } = req.body;
  if (!amount || !type) throw new ValidationError('กรุณากรอกข้อมูลให้ครบ');
  const parsedAmount = parseFloat(amount);
  if (!isFinite(parsedAmount) || parsedAmount <= 0) throw new ValidationError('จำนวนเงินไม่ถูกต้อง');
  const targetUserId = parseInt(req.params.id);
  const adminId = req.user!.userId;

  let balanceAfter: number;
  if (type === 'credit') {
    balanceAfter = await walletService.credit(targetUserId, parsedAmount, 'manual_credit', description || 'Admin credit');
    await subscriptionService.logAudit(adminId, 'wallet_credit', 'user', targetUserId, `Admin added ฿${parsedAmount} to user ID ${targetUserId}. Reason: ${description || '-'}`, req.ip);
  } else if (type === 'debit') {
    balanceAfter = await walletService.debit(targetUserId, parsedAmount, 'manual_debit', description || 'Admin debit');
    await subscriptionService.logAudit(adminId, 'wallet_debit', 'user', targetUserId, `Admin removed ฿${parsedAmount} from user ID ${targetUserId}. Reason: ${description || '-'}`, req.ip);
  } else {
    throw new ValidationError('type ต้องเป็น credit หรือ debit');
  }
  res.json({ success: true, balanceAfter });
}));

// Settings
router.get('/settings', asyncRoute(async (_req, res) => {
  const settings = await settingsService.getAll();
  // Mask sensitive fields for display
  const safe = { ...settings };
  if (safe['easyslip_api_key']) safe['easyslip_api_key'] = '••••••••' + safe['easyslip_api_key'].slice(-4);
  if (safe['npm_password'])     safe['npm_password']     = '••••••••';
  if (safe['turnstile_secret']) safe['turnstile_secret'] = '••••••••';
  res.json(safe);
}));

router.put('/settings', asyncRoute(async (req, res) => {
  const allowed = [
    'panel_name','panel_domain',
    'promptpay_id','promptpay_name',
    'easyslip_api_key',
    'price_1month','price_3months','price_6months',
    'npm_url','npm_email','npm_password','npm_forward_host',
    'notify_days_before','auto_suspend_days',
    'cloudflare_api_key','cloudflare_email','cloudflare_zone_id','server_ip',
    'resend_api_key','email_from','email_from_name','email_reply_to',
    'support_email','support_facebook','support_discord','support_line',
    'enable_turnstile','turnstile_site_key','turnstile_secret',
  ];
  const prev = await settingsService.getAll();
  const data: Record<string, string> = {};
  // Secret-style fields are returned masked from GET /settings (•••• or prefix+••••).
  // If the admin saves the form without retyping the secret, the masked value would
  // overwrite the real one. Detect masked values and skip them so the prior value is preserved.
  const MASKED = /^•+$/;          // pure bullets (npm_password, smtp_password)
  const SUFFIX_MASK = /^•+.{2,8}$/; // prefix-masked (easyslip_api_key)
  const isMasked = (v: string) => !v || MASKED.test(v) || SUFFIX_MASK.test(v);
  const SECRET_KEYS = new Set(['npm_password','smtp_password','easyslip_api_key','cloudflare_api_key','resend_api_key','turnstile_secret']);
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    const next = String(req.body[key]);
    if (SECRET_KEYS.has(key) && isMasked(next) && prev[key]) continue;
    data[key] = next;
  }
  await settingsService.setMany(data);
  await subscriptionService.logAudit(req.user!.userId, 'update_settings', 'settings', undefined, `Admin updated system settings: ${Object.keys(data).join(', ')}`, req.ip);

  // If any NPM-related setting changed, reapply proxy config for all active customers
  const npmKeys = ['npm_url', 'npm_email', 'npm_password', 'npm_forward_host'];
  const npmChanged = npmKeys.some(k => data[k] !== undefined && data[k] !== prev[k]);
  if (npmChanged) {
    npmService.reapplyAllProxyHosts().catch(err =>
      console.error('[NPM] reapplyAllProxyHosts failed:', err)
    );
  }

  res.json({ success: true });
}));

// Fix panel's own NPM proxy host advanced_config
router.post('/settings/fix-panel-npm', asyncRoute(async (req, res) => {
  const s = await settingsService.getAll();
  const panelDomain = s['panel_domain'];
  if (!panelDomain) throw new ValidationError('ไม่พบ panel_domain ใน settings');
  try {
    await npmService.updatePanelProxyHost(panelDomain);
    res.json({ success: true });
  } catch (err: any) {
    const msg = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'NPM error');
    res.status(500).json({ error: msg });
  }
}));

// Manual trigger notifications
router.post('/notify/run', asyncRoute(async (_req, res) => {
  notificationService.sendExpiryNotifications().catch(console.error);
  res.json({ success: true, message: 'กำลังส่งการแจ้งเตือน...' });
}));

// Test email (Resend)
router.post('/settings/test-email', asyncRoute(async (req, res) => {
  const { to } = req.body;
  if (!to) throw new ValidationError('กรุณาระบุอีเมลปลายทาง');
  const result = await emailService.sendTest(String(to).trim());
  res.json({ success: true, id: result.id });
}));

// Notifications
router.get('/notifications/unread', asyncRoute(async (_req, res) => {
  const [tickets] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM tickets WHERE status = 'open'"
  );
  const [slips] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM payment_slips WHERE status = 'pending'"
  );
  res.json({
    tickets: tickets[0].count || 0,
    slips: slips[0].count || 0,
    total: (tickets[0].count || 0) + (slips[0].count || 0)
  });
}));

export default router;
