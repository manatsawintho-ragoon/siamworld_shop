import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { subscriptionService } from '../services/subscription.service';
import { deployService } from '../services/deploy.service';
import { customDomainService } from '../services/custom-domain.service';
import { shopAdminCredentialService } from '../services/shop-admin-credential.service';
import { ValidationError } from '../utils/errors';
import { pool } from '../database/connection';

const router = Router();

router.get('/packages', asyncRoute(async (_req, res) => {
  const [packages, promos, easyslipFee] = await Promise.all([
    subscriptionService.getPackages(),
    subscriptionService.getPromos(),
    subscriptionService.getEasyslipFee(),
  ]);
  res.json({ packages, promos, easyslipFee });
}));

router.get('/public-stats', asyncRoute(async (_req, res) => {
  const stats = await subscriptionService.getPublicStats();
  res.json(stats);
}));

router.get('/public-shops', asyncRoute(async (_req, res) => {
  const shops = await subscriptionService.getPublicShopNames();
  res.json({ shops });
}));

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  const [subs, eligibility, promos, easyslipFee] = await Promise.all([
    subscriptionService.getMySubscriptions(req.user!.userId),
    subscriptionService.getMyEligibility(req.user!.userId),
    subscriptionService.getPromos(),
    subscriptionService.getEasyslipFee(),
  ]);
  res.json({ subscriptions: subs, ...eligibility, promos, easyslipFee });
}));

// Customer popups for operator time adjustments (compensation / promo). Must be
// declared before the `/:id` routes so "notifications" is not captured as an id.
router.get('/notifications', requireAuth, asyncRoute(async (req, res) => {
  const notifications = await subscriptionService.getCustomerNotifications(req.user!.userId);
  res.json({ notifications });
}));

router.post('/notifications/:id/seen', requireAuth, asyncRoute(async (req, res) => {
  await subscriptionService.markNotificationSeen(req.user!.userId, parseInt(req.params.id));
  res.json({ success: true });
}));

router.post('/', requireAuth, asyncRoute(async (req, res) => {
  const { shopName, packageMonths, mcIp, kind } = req.body;
  const subKind = (kind === 'trial' || kind === 'intro') ? kind : 'regular';
  // Trial uses 0-month placeholder; intro is always 1 month; regular requires 1/3/6
  const months = subKind === 'trial' ? 0 : parseInt(packageMonths || (subKind === 'intro' ? '1' : ''));
  if (!shopName || !mcIp) throw new ValidationError('กรุณากรอกข้อมูลให้ครบ');
  if (subKind === 'regular' && !months) throw new ValidationError('กรุณาเลือกแพ็กเกจ');
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(String(mcIp).trim())) throw new ValidationError('รูปแบบ IP ไม่ถูกต้อง');
  const result = await subscriptionService.create(
    req.user!.userId,
    shopName.toLowerCase().trim(),
    months,
    String(mcIp).trim(),
    subKind,
    req.ip
  );
  res.status(201).json(result);
}));

router.post('/:id/renew', requireAuth, asyncRoute(async (req, res) => {
  const { packageMonths, kind } = req.body;
  const renewKind: 'regular' | 'intro' = kind === 'intro' ? 'intro' : 'regular';
  const months = renewKind === 'intro' ? 1 : parseInt(packageMonths || '');
  if (renewKind === 'regular' && !months) throw new ValidationError('กรุณาเลือกแพ็กเกจ');
  const result = await subscriptionService.renew(req.user!.userId, parseInt(req.params.id), months, renewKind);
  res.json(result);
}));

router.get('/:id', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  res.json({ subscription: sub });
}));

router.get('/:id/logs', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const logs = await deployService.getLogs(sub.shop_name);
  res.json({ logs });
}));

router.get('/:id/stats', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const stats = await deployService.getStats(sub.shop_name);
  res.json({ stats });
}));

router.post('/:id/action', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const { action } = req.body;
  
  if (!['start','stop','restart'].includes(action)) {
    throw new ValidationError('Invalid action');
  }

  if (sub.status === 'suspended' || sub.status === 'cancelled') {
    throw new ValidationError('ร้านถูกระงับการใช้งานหรือยกเลิก ไม่สามารถจัดการได้');
  }

  if (action === 'start') {
    await deployService.startShop(sub.shop_name);
    await pool.execute('UPDATE subscriptions SET status="active" WHERE id=?', [sub.id]);
  }
  if (action === 'stop') {
    await deployService.stopShop(sub.shop_name);
  }
  if (action === 'restart') {
    await deployService.restartShop(sub.shop_name);
  }
  
  res.json({ success: true });
}));

router.patch('/:id/auto-renew', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const { autoRenew } = req.body;
  await subscriptionService.updateAutoRenew(sub.id, Boolean(autoRenew));
  res.json({ success: true, autoRenew: Boolean(autoRenew) });
}));

router.get('/:id/credentials', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
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
    mcIp: sub.mc_ip || null,
  });
}));

// ── Shop web-admin credential ─────────────────────────────────────────────────
// Lets the shop owner see + reset the dedicated admin login (decoupled from the
// Minecraft/AuthMe password). Ownership enforced via getById(id, userId).

router.get('/:id/shop-admin', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const cred = await shopAdminCredentialService.getOrProvision(sub.shop_name);
  res.json({ success: true, username: cred.username, password: cred.password });
}));

router.post('/:id/shop-admin/regenerate', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const cred = await shopAdminCredentialService.regenerate(sub.shop_name);
  res.json({ success: true, username: cred.username, password: cred.password });
}));

router.post('/:id/shop-admin/password', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const password = String(req.body?.password ?? '');
  if (password.length < 6) throw new ValidationError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
  const cred = await shopAdminCredentialService.setPassword(sub.shop_name, password);
  res.json({ success: true, username: cred.username, password: cred.password });
}));

// ── Custom domain (BYOD) ──────────────────────────────────────────────────────
// Ownership is enforced by subscriptionService.getById(id, userId) (throws if not
// the owner), same guard as every other /:id route.

router.get('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const data = await customDomainService.getCustomDomain(sub.id);
  res.json({ success: true, data });
}));

router.post('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const { hostname } = req.body as { hostname?: string };
  const data = await customDomainService.requestCustomDomain(sub.id, hostname ?? '');
  res.json({ success: true, data });
}));

router.post('/:id/custom-domain/verify', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  const data = await customDomainService.pollCustomDomain(sub.id);
  res.json({ success: true, data });
}));

router.delete('/:id/custom-domain', requireAuth, asyncRoute(async (req, res) => {
  const sub = await subscriptionService.getById(parseInt(req.params.id), req.user!.userId);
  await customDomainService.removeCustomDomain(sub.id);
  res.json({ success: true });
}));

export default router;
