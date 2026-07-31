import { useCallback, useRef } from 'react';

/**
 * Retry-safe idempotency keys for the money endpoints.
 *
 * The backend dedups /shop/buy, /shop/lootboxes/:id/open and /rewards/:id/redeem
 * on a client-supplied key. That only works if the key is stable across RETRIES
 * of one user intent — every call site used to mint a fresh `crypto.randomUUID()`
 * inline on each click, so a user who retried after a timeout sent a brand new
 * key and got charged a second time. The key looked like protection while
 * providing none.
 *
 * The rule this encodes:
 *   - same intent, retried  -> same key  (server collapses it to one charge)
 *   - new intent            -> new key   (a genuinely separate order)
 *
 * `clear()` is what separates the two, so call it as soon as the server has
 * DEFINITIVELY answered — success or a business error alike. Both mean the next
 * attempt is a new order. Only a network-level failure, where we cannot know
 * whether the request landed, keeps the key alive for a safe retry.
 */

function newKey(): string {
  // randomUUID needs a secure context. Shops are HTTPS, but a plain-HTTP origin
  // (or an old browser) must still produce a usable key rather than throw.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * True when the failure never reached a server response, so the request may or
 * may not have been applied. `api()` attaches `status` to every HTTP error;
 * fetch itself rejects with a bare TypeError when the network drops.
 */
export function isNetworkError(err: unknown): boolean {
  return !(typeof err === 'object' && err !== null && 'status' in err);
}

export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);
  const intentRef = useRef<string>('');

  /**
   * The key for `intent`. Returns the same value while the intent is unchanged
   * and uncleared; mints a fresh one when the intent changes (e.g. the user
   * edited the quantity or the gift recipient, which makes it a different order).
   */
  const take = useCallback((intent: string) => {
    if (keyRef.current === null || intentRef.current !== intent) {
      keyRef.current = newKey();
      intentRef.current = intent;
    }
    return keyRef.current;
  }, []);

  /** The server answered. Whatever comes next is a new order. */
  const clear = useCallback(() => {
    keyRef.current = null;
  }, []);

  return { take, clear };
}
