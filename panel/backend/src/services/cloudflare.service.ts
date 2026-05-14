import axios, { AxiosRequestConfig } from 'axios';
import { settingsService } from './settings.service';

type CfConfig = {
  apiKey: string;
  email: string;
  zoneId: string;
  serverIp: string;
};

class CloudflareService {
  private async getConfig(): Promise<CfConfig> {
    const s = await settingsService.getAll();
    return {
      apiKey:   s['cloudflare_api_key']  || '',
      email:    s['cloudflare_email']    || '',
      zoneId:   s['cloudflare_zone_id']  || '',
      serverIp: s['server_ip']           || '',
    };
  }

  private isConfigured(cfg: CfConfig): boolean {
    return !!(cfg.apiKey && cfg.zoneId && cfg.serverIp);
  }

  /**
   * Cloudflare supports two auth schemes:
   *  - API Token (modern, recommended): `Authorization: Bearer <token>` — no email needed.
   *  - Global API Key (legacy):          `X-Auth-Key` + `X-Auth-Email`.
   * Global API Keys are exactly 37 hex chars. Anything else we treat as an API token.
   */
  private headers(cfg: CfConfig): Record<string, string> {
    const isGlobalKey = /^[a-f0-9]{37}$/.test(cfg.apiKey);
    const base = { 'Content-Type': 'application/json' };
    if (isGlobalKey && cfg.email) {
      return { ...base, 'X-Auth-Key': cfg.apiKey, 'X-Auth-Email': cfg.email };
    }
    return { ...base, Authorization: `Bearer ${cfg.apiKey}` };
  }

  private extractError(err: unknown): string {
    const e = err as { code?: string; message?: string; response?: { status?: number; data?: { errors?: Array<{ message?: string; code?: number }> } } };
    const status = e.response?.status;
    const cfErrs = e.response?.data?.errors;
    if (cfErrs && cfErrs.length) {
      return `HTTP ${status ?? '?'} — ${cfErrs.map(x => `${x.code ?? '?'}: ${x.message ?? ''}`).join('; ')}`;
    }
    if (status) return `HTTP ${status} — ${e.message ?? 'unknown'}`;
    if (e.code) return `${e.code} — ${e.message ?? 'unknown'}`;
    return e.message ?? 'unknown error';
  }

  private async request(method: AxiosRequestConfig['method'], url: string, cfg: CfConfig, data?: unknown) {
    return axios.request({
      method,
      url,
      data,
      headers: this.headers(cfg),
      timeout: 15000,
    });
  }

  /**
   * Ensure a DNS-only (not proxied) A record exists for a subdomain.
   * Used for customer subdomains: NPM terminates SSL via Let's Encrypt, and the
   * MySQL port must bypass Cloudflare proxy (Cloudflare only proxies HTTP).
   * Throws on failure so callers can surface the real reason in deploy_log.
   */
  async ensureDbDnsRecord(subdomain: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing in panel_settings)');
    }

    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${base}?type=A&name=${encodeURIComponent(subdomain)}`, cfg);
      if (list.data.result?.length > 0) {
        const record = list.data.result[0];
        if (record.proxied || record.content !== cfg.serverIp) {
          await this.request('patch', `${base}/${record.id}`, cfg, {
            content: cfg.serverIp,
            proxied: false,
            ttl: 3600,
          });
          console.log(`[CF] Updated ${subdomain} → ${cfg.serverIp} (DNS-only)`);
        } else {
          console.log(`[CF] DNS-only record for ${subdomain} already exists`);
        }
        return;
      }

      await this.request('post', base, cfg, {
        type:    'A',
        name:    subdomain,
        content: cfg.serverIp,
        proxied: false,
        ttl:     3600,
      });
      console.log(`[CF] Created DNS-only A record: ${subdomain} → ${cfg.serverIp}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Create proxied A record for subdomain → serverIp. No-op if record exists. Throws on failure. */
  async createDnsRecord(subdomain: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }

    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${base}?type=A&name=${encodeURIComponent(subdomain)}`, cfg);
      if (list.data.result?.length > 0) {
        console.log(`[CF] DNS record for ${subdomain} already exists`);
        return;
      }

      await this.request('post', base, cfg, {
        type:    'A',
        name:    subdomain,
        content: cfg.serverIp,
        proxied: true,
        ttl:     1,
      });
      console.log(`[CF] Created proxied A record: ${subdomain} → ${cfg.serverIp}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Delete A record for subdomain. Best-effort (does not throw if CF not configured). */
  async deleteDnsRecord(subdomain: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) return;

    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${base}?type=A&name=${encodeURIComponent(subdomain)}`, cfg);
      for (const record of list.data.result || []) {
        await this.request('delete', `${base}/${record.id}`, cfg);
        console.log(`[CF] Deleted DNS A record: ${subdomain} (id: ${record.id})`);
      }
    } catch (err) {
      console.warn(`[CF] deleteDnsRecord(${subdomain}) failed:`, this.extractError(err));
    }
  }
}

export const cloudflareService = new CloudflareService();
