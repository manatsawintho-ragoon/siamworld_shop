import { config } from '../config';
import { logger } from '../utils/logger';

// ── Shop → panel bridge client ────────────────────────────────────────────
//
// The deployed shop calls panel's internal bridge API to verify MC AuthMe
// credentials without seeing the bcrypt hash. Panel forwards the request to
// the customer's bridge plugin over WS. Wire format mirrors the bridge
// protocol opcodes 1:1.
//
// Failure modes are folded into the response shape so callers can branch
// without a try/catch:
//   { ok: true,  userId, email }
//   { ok: false, reason: 'bad_password' | 'unknown_user' | 'banned' }
//   { ok: false, reason: 'bridge_unreachable' | 'bridge_timeout' | 'internal' }
//
// `unknown_user` and `bridge_unreachable` both let the caller fall back to
// local DB lookup so legacy pre-bridge accounts keep working and a flaky
// plugin doesn't lock players out of the shop.

export interface VerifyAuthmeResult {
  ok: boolean;
  userId?: number;
  email?: string | null;
  reason?: string;
}

const HTTP_TIMEOUT_MS = 8000; // panel's internal route caps the WS request at 5s; pad for round-trip.

async function call(op: 'verify_authme' | 'lookup_user' | 'update_password', body: object): Promise<any> {
  if (!config.bridge.enabled) {
    return { ok: false, reason: 'bridge_disabled' };
  }
  const url = `${config.bridge.url}/api/internal/bridge/${config.bridge.subscriptionId}/${op}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.bridge.key}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) {
      logger.error('Bridge auth rejected by panel — check PANEL_BRIDGE_KEY', { op, status: res.status });
      return { ok: false, reason: 'unauthorized' };
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      return { ok: false, reason: 'bad_response' };
    }
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn('Bridge call timed out', { op });
      return { ok: false, reason: 'bridge_timeout' };
    }
    logger.warn('Bridge call failed', { op, error: err?.message });
    return { ok: false, reason: 'bridge_unreachable' };
  } finally {
    clearTimeout(t);
  }
}

export const bridgeClient = {
  async verifyAuthme(username: string, password: string): Promise<VerifyAuthmeResult> {
    return call('verify_authme', { username, password });
  },
  async lookupUser(username: string) {
    return call('lookup_user', { username });
  },
  async updatePassword(username: string, newPassword: string) {
    return call('update_password', { username, newPassword });
  },
};
