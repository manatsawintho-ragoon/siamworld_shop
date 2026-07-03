import http2 from 'http2';
import dns from 'dns';
import { config } from '../config';
import { logger } from '../utils/logger';
import { settingsService } from './settings.service';

const EASYSLIP_HOSTNAME = 'api.easyslip.com';

// Resolve hostname to IPv4 first to avoid containers without IPv6 routing timing out
// when DNS returns an AAAA record (Cloudflare returns IPv6 first).
function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses?.length) reject(err ?? new Error('No IPv4 address'));
      else resolve(addresses[0]);
    });
  });
}

// Use HTTP/2 to avoid Cloudflare TLS-fingerprint blocking of Node.js http1 clients
async function http2Request(path: string, method: 'GET' | 'POST', apiKey: string, body?: string): Promise<{ status: number; json: unknown }> {
  // Force IPv4 — containers often lack IPv6 routes, causing ETIMEDOUT when DNS
  // returns an AAAA record (e.g. Cloudflare). SNI must still send the real hostname.
  const ipv4 = await resolveIPv4(EASYSLIP_HOSTNAME);

  return new Promise((resolve, reject) => {
    const session = http2.connect(`https://${ipv4}`, { servername: EASYSLIP_HOSTNAME });
    const timer = setTimeout(() => {
      session.destroy();
      reject(new Error('Request timeout'));
    }, 30000);
    session.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    const bodyBuf = body ? Buffer.from(body) : undefined;
    const req = session.request({
      ':method': method,
      ':path':   path,
      'authorization':  `Bearer ${apiKey}`,
      'content-type':   'application/json',
      ...(bodyBuf ? { 'content-length': String(bodyBuf.length) } : {}),
    });
    req.on('error', (e) => { clearTimeout(timer); session.destroy(); reject(e); });

    let status = 0;
    req.on('response', (headers) => { status = headers[':status'] as number; });

    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      clearTimeout(timer);
      session.destroy();
      try { resolve({ status, json: JSON.parse(raw) }); }
      catch { reject(new Error('Invalid JSON response')); }
    });

    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ── EasySlip response types ──────────────────────────────────────────────────

export interface BankSlipData {
  isDuplicate: boolean;
  remark?: string;
  rawSlip: {
    payload?: string;
    transRef: string;
    date: string;                     // ISO 8601 with TZ
    amount: {
      amount: number;
      local: { amount: number; currency: string };
    };
    fee: number;
    sender: {
      bank: { id: string; name: string; short: string };
      account: {
        name: { th?: string; en?: string };
        bank?: { type: string; account: string };
        proxy?: { type: string; account: string };
      };
    };
    receiver: {
      bank: { id: string; name: string; short: string };
      account: {
        name: { th?: string; en?: string };
        bank?: { type: string; account: string };
        proxy?: { type: string; account: string };
      };
    };
  };
}

export interface EasySlipError {
  code: string;
  message: string;
}

interface EasySlipResponse {
  success: boolean;
  data?: BankSlipData;
  error?: EasySlipError;
  message?: string;
}

// ── Options type ─────────────────────────────────────────────────────────────

export interface VerifyOptions {
  remark?: string;
  /** Ask EasySlip to validate receiver against accounts registered in developer portal */
  matchAccount?: boolean;
  matchAmount?: number;
  checkDuplicate?: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

class EasySlipService {
  private async resolveApiKey(): Promise<string> {
    try {
      const dbKey = await settingsService.get('easyslip_api_key');
      if (dbKey) return dbKey;
    } catch {}
    return config.easyslipApiKey;
  }

  /** Verify a bank transfer slip by base64 image. */
  async verifyByBase64(base64: string, opts: VerifyOptions = {}): Promise<BankSlipData> {
    return this.callVerify({ base64, ...opts });
  }

  /** Verify a bank transfer slip by public image URL. */
  async verifyByUrl(url: string, opts: VerifyOptions = {}): Promise<BankSlipData> {
    return this.callVerify({ url, ...opts });
  }

  /** Verify a bank transfer slip by QR payload string. */
  async verifyByPayload(payload: string, opts: VerifyOptions = {}): Promise<BankSlipData> {
    return this.callVerify({ payload, ...opts });
  }

  /** Verify using a raw buffer (image file bytes) — sends as base64 internally. */
  async verifyByBuffer(buffer: Buffer, mimeType: string, opts: VerifyOptions = {}): Promise<BankSlipData> {
    const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return this.verifyByBase64(base64, opts);
  }

  /** Fetch account/quota info — does NOT consume quota. */
  async getInfo(): Promise<unknown> {
    const apiKey = await this.resolveApiKey();
    const { json } = await http2Request('/v2/info', 'GET', apiKey) as any;
    if (!json.success) {
      throw new EasySlipApiError(json.error?.code ?? 'UNKNOWN', json.error?.message ?? 'EasySlip error');
    }
    return json.data;
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async callVerify(body: Record<string, unknown>): Promise<BankSlipData> {
    const apiKey = await this.resolveApiKey();
    if (!apiKey) throw new EasySlipApiError('NO_API_KEY', 'EASYSLIP_API_KEY is not configured');

    // Always enable EasySlip's own duplicate detection.
    // matchAccount is NOT enabled here — in a SaaS setup each shop has a different
    // PromptPay account configured in their own admin settings, so we cannot register
    // them all in one EasySlip developer portal. Receiver validation is handled in
    // payment.service.ts (Layer 5) using each shop's stored promptpay_id setting.
    const bodyWithDefaults = {
      checkDuplicate: true,
      ...body,
    };

    logger.debug('EasySlip verify', { keys: Object.keys(bodyWithDefaults) });

    let status: number;
    let json: any;
    try {
      const res = await http2Request('/v2/verify/bank', 'POST', apiKey, JSON.stringify(bodyWithDefaults));
      status = res.status;
      json = res.json;
    } catch (err: any) {
      logger.warn('EasySlip connection error', { error: err.message, code: err.code });
      throw new EasySlipApiError('CONNECTION_ERROR', `ไม่สามารถเชื่อมต่อระบบตรวจสลิปได้: ${err.message}`, 503);
    }

    if (!json.success || !json.data) {
      const code = json.error?.code ?? 'UNKNOWN';
      const msg  = json.error?.message ?? json.message ?? 'EasySlip verification failed';
      logger.warn('EasySlip verify failed', { code, msg, status });
      throw new EasySlipApiError(code, msg, status);
    }

    return json.data;
  }
}

// ── Custom error class ───────────────────────────────────────────────────────

export class EasySlipApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'EasySlipApiError';
  }
}

export const easySlipService = new EasySlipService();
