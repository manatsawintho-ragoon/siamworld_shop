import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { subscriptionService } from '../services/subscription.service';
import { installService } from '../services/install.service';

// Routes that ONLY require a valid setup key in the URL (not JWT).
// Mounted at /install. Customers' install scripts hit these directly over HTTPS.
export const publicInstallRouter = Router();

publicInstallRouter.get('/:subId/setup.sh', asyncRoute(async (req, res) => {
  await renderScriptResponse('linux', req, res);
}));

publicInstallRouter.get('/:subId/setup.ps1', asyncRoute(async (req, res) => {
  await renderScriptResponse('windows', req, res);
}));

publicInstallRouter.get('/:subId/dump', asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subId, 10);
  const key = String(req.query.key || '');
  const v = await installService.validateKey(subId, key);
  if (!v) return res.status(410).type('text/plain').send('setup key invalid or expired');
  if (v.keyRow.dump_consumed_at) return res.status(410).type('text/plain').send('dump already downloaded for this key. Generate a new one from the panel');

  // Look up the customer's shop name so we can find their MySQL container.
  const sub = await subscriptionService.getById(subId).catch(() => null);
  if (!sub) return res.status(404).type('text/plain').send('subscription not found');

  try {
    const sql = await installService.generateAuthmeDump(sub.shop_name);
    await installService.consumeDump(v.keyRow.id);
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="authme-${sub.shop_name}.sql"`);
    res.send(sql);
  } catch (e: any) {
    res.status(500).type('text/plain').send(`dump failed: ${e?.message || 'unknown error'}`);
  }
}));

async function renderScriptResponse(os: 'linux' | 'windows', req: any, res: any) {
  const subId = parseInt(req.params.subId, 10);
  const key = String(req.query.key || '');
  const v = await installService.validateKey(subId, key);
  if (!v) return res.status(410).type('text/plain').send('# setup key invalid or expired\n# Generate a new install command from your panel dashboard.\n');

  const sub = await subscriptionService.getById(subId).catch(() => null);
  if (!sub) return res.status(404).type('text/plain').send('# subscription not found\n');

  const script = await installService.renderScript({
    os,
    subscriptionId: subId,
    shopName: sub.shop_name,
    bridgeTokenPlaintext: v.bridgeTokenPlaintext,
    expiresAt: v.keyRow.expires_at,
    plaintextKey: key,
  });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  installService.recordScriptFetch(v.keyRow.id, ip).catch(() => {});

  res.setHeader('Content-Type', os === 'windows' ? 'application/x-powershell; charset=utf-8' : 'text/x-shellscript; charset=utf-8');
  // Allow the customer to curl/iwr it directly; no CORS needed for shell pipes.
  res.send(script);
}

// Routes that require JWT — mounted under the existing /api/bridge prefix
// so the frontend can call it with the same auth pattern as token issue/revoke.
export const authedInstallRouter = Router();

authedInstallRouter.post('/:subscriptionId/install-key', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  // Admins manage any sub's installer flow from the admin credentials view; skip the ownership check for them.
  const ownerId = req.user!.role === 'admin' ? undefined : req.user!.userId;
  const sub = await subscriptionService.getById(subId, ownerId);
  const result = await installService.createSetupKey(sub.id);
  res.status(201).json({
    keyPrefix: result.keyPrefix,
    expiresAt: result.expiresAt,
    expiresInMinutes: 30,
    linuxOneLiner: result.linuxOneLiner,
    windowsOneLiner: result.windowsOneLiner,
    // The plaintext key is included only here, once. The customer-facing UI
    // surfaces the linuxOneLiner / windowsOneLiner which already embed it.
    note: 'Key valid for 30 minutes. Bridge token has been rotated.',
  });
}));
