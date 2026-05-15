/**
 * Cloudflare Turnstile (CAPTCHA) verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Reads `enable_turnstile`, `turnstile_site_key`, `turnstile_secret` from panel_settings
 * so an admin can toggle the feature without redeploying.
 */
import https from 'https';
import { URLSearchParams } from 'url';
import { settingsService } from './settings.service';
import { ValidationError } from '../utils/errors';

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function postFormOnce(url: string, form: URLSearchParams): Promise<TurnstileResponse> {
  const body = Buffer.from(form.toString());
  const u = new URL(url);
  return new Promise<TurnstileResponse>((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': body.length,
      },
      // 15s per attempt — Cloudflare CDN through some Thai ISPs has intermittent ~10s stalls.
      timeout: 15_000,
      // Force IPv4: container has IPv4-only egress; Node's happy-eyeballs to IPv6 stalls silently.
      family: 4,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw) as TurnstileResponse); }
        catch { reject(Object.assign(new Error('Invalid JSON from Turnstile'), { code: 'EBADJSON' })); }
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Turnstile request timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

/**
 * POST to Cloudflare siteverify with one transparent retry on transient network errors.
 * Real-world testing on Thai ISP egress showed ~5-10% of requests hit ETIMEDOUT before
 * even reaching Cloudflare; a single retry brings success rate to >99%.
 */
async function postForm(url: string, form: URLSearchParams): Promise<TurnstileResponse> {
  const TRANSIENT = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await postFormOnce(url, form);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      if (attempt === 2 || !TRANSIENT.has(code)) {
        throw err;
      }
      console.warn(`[Turnstile] attempt ${attempt} ${code} — retrying`);
      // brief backoff so we don't hit the same flaky route immediately
      await new Promise(r => setTimeout(r, 300));
    }
  }
  // unreachable
  throw new Error('Turnstile retry exhausted');
}

class TurnstileService {
  /** Public config the frontend needs to render the widget. */
  async getPublicConfig(): Promise<{ enabled: boolean; siteKey: string }> {
    const s = await settingsService.getAll();
    const enabled = s['enable_turnstile'] === '1';
    const siteKey = s['turnstile_site_key'] || '';
    // We expose enabled = false when no site key has been set, even if the toggle is on,
    // so the frontend doesn't try to render a broken widget after a half-finished setup.
    return { enabled: enabled && siteKey.length > 0, siteKey };
  }

  /**
   * Verify a Turnstile token. No-op when the feature is disabled.
   * Throws ValidationError with a user-facing message on failure.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    const s = await settingsService.getAll();
    const enabled = s['enable_turnstile'] === '1';
    const secret = s['turnstile_secret'] || '';
    if (!enabled || !secret) return; // Feature off — nothing to do.

    if (!token || typeof token !== 'string') {
      throw new ValidationError('กรุณายืนยันว่าคุณไม่ใช่บอท');
    }

    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (remoteIp) form.set('remoteip', remoteIp);

    let result: TurnstileResponse;
    try {
      result = await postForm(VERIFY_URL, form);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[Turnstile] verify network error:', e.code || '?', e.message || '(no message)');
      // Fail closed — we'd rather block one user than let bots through during an outage.
      throw new ValidationError('ระบบยืนยันตัวตนไม่ตอบสนอง กรุณาลองใหม่อีกครั้ง');
    }

    if (!result.success) {
      const codes = (result['error-codes'] || []).join(',');
      console.warn('[Turnstile] rejected:', codes);
      // Codes like `timeout-or-duplicate` are recoverable by re-solving; surface a generic message.
      throw new ValidationError('การยืนยัน CAPTCHA ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }
}

export const turnstileService = new TurnstileService();
