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
router.get('/:subscriptionId/status', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, req.user!.userId);
  const status = await bridgeService.getStatus(sub.id);
  res.json(status);
}));

/**
 * Issue (or rotate) a bridge token for a subscription.
 * Plaintext token is returned ONCE; only its hash is stored.
 */
router.post('/:subscriptionId/token', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, req.user!.userId);
  const result = await bridgeService.issueToken(sub.id);
  res.status(201).json({
    token: result.token,
    prefix: result.prefix,
    note: 'Store this token in your plugin config now — it cannot be retrieved later.',
  });
}));

/**
 * Revoke the active bridge token. Forces any live plugin to reconnect with a new token.
 */
router.delete('/:subscriptionId/token', requireAuth, asyncRoute(async (req, res) => {
  const subId = parseInt(req.params.subscriptionId, 10);
  const sub = await subscriptionService.getById(subId, req.user!.userId);
  await bridgeService.revokeToken(sub.id);
  res.json({ success: true });
}));

export default router;
