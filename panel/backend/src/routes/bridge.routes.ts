import { Router } from 'express';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { subscriptionService } from '../services/subscription.service';
import { bridgeService } from '../services/bridge.service';

const router = Router();

/**
 * Get bridge status for one of the caller's subscriptions.
 * Returns whether a token exists, whether the plugin is currently online, etc.
 */
// Admins manage any subscription's bridge from the admin credentials view, so they
// bypass the ownership check. Customers remain restricted to their own subs.
function ownerScope(req: any): number | undefined {
  return req.user!.role === 'admin' ? undefined : req.user!.userId;
}

router.get('/:subscriptionId/status', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, ownerScope(req));
  const status = await bridgeService.getStatus(sub.id);
  res.json(status);
}));

/**
 * Issue (or rotate) a bridge token for a subscription.
 * Plaintext token is returned ONCE; only its hash is stored.
 */
router.post('/:subscriptionId/token', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, ownerScope(req));
  const result = await bridgeService.issueToken(sub.id);

  // Issuing a Bridge token means the customer has committed to Bridge mode —
  // the MC plugin no longer needs external MySQL access. Auto-block port at
  // the host firewall (defense in depth on top of CF wildcard proxy).
  // Best-effort and idempotent: failures don't abort the response.
  const harden = await bridgeService.hardenMysqlPort(sub.id).catch(e => ({
    port: 0, applied: false, reason: `error: ${e?.message || 'unknown'}`,
  }));

  // Auto-provision the shop side (internal_key + .env + async rebuild). Idempotent:
  // if internal_key_hash is already set this is a no-op and rebuildStarted=false.
  const provision = await bridgeService.provisionShopBridge(sub.id).catch(e => ({
    provisioned: false, keyPrefix: null, rebuildStarted: false, error: e?.message || 'unknown',
  }));

  res.status(201).json({
    token: result.token,
    prefix: result.prefix,
    note: 'Store this token in your plugin config now, it cannot be retrieved later.',
    hardening: harden,
    provision,
  });
}));

/**
 * Revoke the active bridge token. Forces any live plugin to reconnect with a new token.
 */
router.delete('/:subscriptionId/token', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, ownerScope(req));
  await bridgeService.revokeToken(sub.id);
  res.json({ success: true });
}));

export default router;
