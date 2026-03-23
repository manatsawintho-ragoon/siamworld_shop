import { config } from '../config';
import { logger } from '../utils/logger';

const EASYSLIP_V2 = 'https://api.easyslip.com/v2';

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
        bank: { type: string; account: string };
      };
    };
    receiver: {
      bank: { id: string; name: string; short: string };
      account: {
        name: { th?: string; en?: string };
        bank: { type: string; account: string };
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

// ── Service ──────────────────────────────────────────────────────────────────

class EasySlipService {
  private get apiKey(): string {
    return config.easyslipApiKey;
  }

  private get authHeader(): string {
    return `Bearer ${this.apiKey}`;
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
    const res = await fetch(`${EASYSLIP_V2}/info`, {
      headers: { Authorization: this.authHeader },
    });
    const json = (await res.json()) as EasySlipResponse;
    if (!json.success) {
      throw new EasySlipApiError(json.error?.code ?? 'UNKNOWN', json.error?.message ?? 'EasySlip error');
    }
    return json.data;
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async callVerify(body: Record<string, unknown>): Promise<BankSlipData> {
    if (!this.apiKey) throw new EasySlipApiError('NO_API_KEY', 'EASYSLIP_API_KEY is not configured');

    const bodyWithDefaults = { checkDuplicate: true, ...body };

    logger.debug('EasySlip verify', { keys: Object.keys(bodyWithDefaults) });

    const res = await fetch(`${EASYSLIP_V2}/verify/bank`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyWithDefaults),
    });

    const json = (await res.json()) as EasySlipResponse;

    if (!json.success || !json.data) {
      const code = json.error?.code ?? 'UNKNOWN';
      const msg  = json.error?.message ?? json.message ?? 'EasySlip verification failed';
      logger.warn('EasySlip verify failed', { code, msg, status: res.status });
      throw new EasySlipApiError(code, msg, res.status);
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

// ── Options type ─────────────────────────────────────────────────────────────

interface VerifyOptions {
  remark?: string;
  matchAccount?: boolean;
  matchAmount?: number;
  checkDuplicate?: boolean;
}

export const easySlipService = new EasySlipService();
