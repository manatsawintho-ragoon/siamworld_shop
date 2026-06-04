import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../database/connection';
import { bridgeService, BridgeError } from '../services/bridge.service';
import { RowDataPacket } from 'mysql2';

// ── Internal bridge proxy ──────────────────────────────────────────────────
//
// Deployed customer shops call this from their backend container to verify
// AuthMe credentials against the customer's MC server (via the WS bridge).
// The shop knows its own subscription_id and a plaintext API key (in .env);
// the panel stores only sha256(key) so a DB leak doesn't grant impersonation.
//
// Auth: `Authorization: Bearer <plaintext>` — must match subscriptions.internal_key_hash
//       for the :subId in the URL. We pin the key to a subscription so a compromised
//       shop can't query another shop's plugin.

const router = Router();

// Tight rate limit — login endpoints already throttle on the shop side, but a misbehaving
// or compromised shop should not be able to flood the panel bridge.
const limiter = rateLimit({
  windowMs: 60_000,
  max: 600, // 10/s sustained per IP is plenty for a single shop's login flow
  standardHeaders: true,
  legacyHeaders: false,
});

async function authenticateShop(req: Request, res: Response, next: NextFunction) {
  const subId = parseInt(req.params.subId, 10);
  if (!Number.isFinite(subId) || subId <= 0) {
    return res.status(400).json({ ok: false, reason: 'bad_subscription' });
  }
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(\S+)$/);
  if (!m) return res.status(401).json({ ok: false, reason: 'unauthorized' });
  const presented = m[1];
  const hash = crypto.createHash('sha256').update(presented).digest('hex');

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, internal_key_hash, status FROM subscriptions WHERE id = ? LIMIT 1',
    [subId]
  );
  const sub = rows[0];
  if (!sub || !sub.internal_key_hash) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' });
  }
  // Constant-time compare to avoid leaking the hash via timing.
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(sub.internal_key_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' });
  }
  if (sub.status === 'cancelled' || sub.status === 'expired' || sub.status === 'suspended') {
    return res.status(403).json({ ok: false, reason: 'inactive' });
  }
  (req as any).subId = sub.id;
  next();
}

router.use('/:subId', limiter, authenticateShop);

// Forward an opcode call through to the connected plugin.
async function proxy(req: Request, res: Response, op: 'verify_authme' | 'lookup_user' | 'update_password') {
  const subId: number = (req as any).subId;
  try {
    const result = await bridgeService.request(subId, op, req.body, 5000);
    res.json(result);
  } catch (err) {
    if (err instanceof BridgeError) {
      // Map known bridge errors to ok:false so the shop can fall back / surface a friendly message.
      const reason =
        err.code === 'not_connected' ? 'bridge_unreachable' :
        err.code === 'timeout'       ? 'bridge_timeout'     :
        err.code === 'rate_limited'  ? 'bridge_rate_limited':
                                       err.code;
      return res.status(200).json({ ok: false, reason });
    }
    // Surface unexpected errors as 500 — the shop will log + fall back to local.
    res.status(500).json({ ok: false, reason: 'internal' });
  }
}

router.post('/:subId/verify_authme',   (req, res) => proxy(req, res, 'verify_authme'));
router.post('/:subId/lookup_user',     (req, res) => proxy(req, res, 'lookup_user'));
router.post('/:subId/update_password', (req, res) => proxy(req, res, 'update_password'));

export default router;
