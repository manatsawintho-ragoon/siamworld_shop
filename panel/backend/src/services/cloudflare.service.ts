import { logger } from '../utils/logger';
import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import { settingsService } from './settings.service';

// Container has no IPv6 connectivity. axios/node may resolve api.cloudflare.com to an
// AAAA record and hang until ETIMEDOUT (this silently broke DNS creation on every
// customer deploy). Pin the socket to IPv4 — same workaround as email.service.ts.
const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

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
      return `HTTP ${status ?? '?'}: ${cfErrs.map(x => `${x.code ?? '?'}: ${x.message ?? ''}`).join('; ')}`;
    }
    if (status) return `HTTP ${status}: ${e.message ?? 'unknown'}`;
    if (e.code) return `${e.code}: ${e.message ?? 'unknown'}`;
    return e.message ?? 'unknown error';
  }

  private async request(method: AxiosRequestConfig['method'], url: string, cfg: CfConfig, data?: unknown) {
    return axios.request({
      method,
      url,
      data,
      headers: this.headers(cfg),
      timeout: 15000,
      httpsAgent: ipv4Agent,
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
          logger.info(`[CF] Updated ${subdomain} → ${cfg.serverIp} (DNS-only)`);
        } else {
          logger.info(`[CF] DNS-only record for ${subdomain} already exists`);
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
      logger.info(`[CF] Created DNS-only A record: ${subdomain} → ${cfg.serverIp}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /**
   * Ensure a PROXIED (orange-cloud) A record exists for a customer's WEB subdomain,
   * creating it or flipping an existing dns-only record to proxied.
   *
   * Web traffic must go through Cloudflare: the host firewall (harden-web-ports.sh)
   * DROPs non-Cloudflare IPs on 80/443, so a dns-only web record is unreachable
   * ("took too long to respond"). This is the correct record for the shop domain.
   * MySQL/AuthMe uses the SEPARATE dns-only `db.siamsite.shop` subdomain, so proxying
   * the web domain never affects the DB connection. Throws on failure.
   */
  async ensureWebDnsRecord(subdomain: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing in panel_settings)');
    }

    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${base}?type=A&name=${encodeURIComponent(subdomain)}`, cfg);
      if (list.data.result?.length > 0) {
        const record = list.data.result[0];
        if (!record.proxied || record.content !== cfg.serverIp) {
          // CF requires TTL=1 (auto) for proxied records.
          await this.request('patch', `${base}/${record.id}`, cfg, {
            content: cfg.serverIp,
            proxied: true,
            ttl: 1,
          });
          logger.info(`[CF] Updated ${subdomain} → ${cfg.serverIp} (proxied)`);
        } else {
          logger.info(`[CF] Proxied record for ${subdomain} already exists`);
        }
        return;
      }

      await this.request('post', base, cfg, {
        type:    'A',
        name:    subdomain,
        content: cfg.serverIp,
        proxied: true,
        ttl:     1,
      });
      logger.info(`[CF] Created proxied A record: ${subdomain} → ${cfg.serverIp}`);
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
        logger.info(`[CF] DNS record for ${subdomain} already exists`);
        return;
      }

      await this.request('post', base, cfg, {
        type:    'A',
        name:    subdomain,
        content: cfg.serverIp,
        proxied: true,
        ttl:     1,
      });
      logger.info(`[CF] Created proxied A record: ${subdomain} → ${cfg.serverIp}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /**
   * Flip the existing A record for {@code subdomain} to a different proxy mode.
   * - {@code mode: 'proxied'} → orange-cloud (CF terminates TLS, hides origin IP).
   * - {@code mode: 'dns-only'} → grey-cloud (resolves direct to origin, allows
   *   non-HTTP ports like MySQL).
   *
   * Used by the admin "DNS hardening" action so a Bridge-mode subscription can
   * stop leaking the origin IP without redeploying. No-op if the record is
   * already in the requested mode. Throws if Cloudflare is not configured or
   * the record doesn't exist.
   *
   * NB: Switching to proxied breaks any external TCP listener on the same
   * subdomain (Cloudflare only proxies HTTP/HTTPS/WS). The caller must
   * separately block the customer's exposed MySQL port at the host firewall
   * before flipping — otherwise the MC plugin still has a path to MySQL via
   * the origin IP (which is still discoverable from other DNS-only records).
   * The ops doc covers the firewall step.
   */
  async setProxyMode(subdomain: string, mode: 'proxied' | 'dns-only'): Promise<{ changed: boolean; recordId: string }> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }
    const wantProxied = mode === 'proxied';
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${base}?type=A&name=${encodeURIComponent(subdomain)}`, cfg);
      const record = list.data.result?.[0];
      if (!record) {
        throw new Error(`No A record found for ${subdomain}`);
      }
      if (record.proxied === wantProxied) {
        return { changed: false, recordId: record.id };
      }
      // CF requires TTL=1 (auto) for proxied records; 3600 is fine for DNS-only.
      await this.request('patch', `${base}/${record.id}`, cfg, {
        proxied: wantProxied,
        ttl: wantProxied ? 1 : 3600,
      });
      logger.info(`[CF] ${subdomain} → ${mode} (record ${record.id})`);
      return { changed: true, recordId: record.id };
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
        logger.info(`[CF] Deleted DNS A record: ${subdomain} (id: ${record.id})`);
      }
    } catch (err) {
      logger.warn(`[CF] deleteDnsRecord(${subdomain}) failed:`, this.extractError(err));
    }
  }

  /**
   * One-time: create the proxied fallback-origin record (custom.siamsite.shop -> origin)
   * and register it as the zone's Cloudflare-for-SaaS fallback origin. Idempotent.
   * Cloudflare sends this hostname as the SNI to our origin, so NPM can serve the
   * existing *.siamsite.shop cert for the TLS handshake while routing by Host header.
   */
  async ensureFallbackOrigin(fallbackHost: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }
    // 1. Proxied A record for the fallback host.
    const dnsBase = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/dns_records`;
    try {
      const list = await this.request('get', `${dnsBase}?type=A&name=${encodeURIComponent(fallbackHost)}`, cfg);
      if (!(list.data.result?.length > 0)) {
        await this.request('post', dnsBase, cfg, {
          type: 'A', name: fallbackHost, content: cfg.serverIp, proxied: true, ttl: 1,
        });
      }
      // 2. Register the fallback origin for custom hostnames.
      await this.request(
        'put',
        `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/fallback_origin`,
        cfg,
        { origin: fallbackHost }
      );
      logger.info(`[CF] Fallback origin ensured: ${fallbackHost}`);
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /**
   * Create a Cloudflare custom hostname with HTTP DCV (no extra TXT record needed -
   * the single CNAME is enough). Cloudflare auto-issues the edge cert.
   */
  async createCustomHostname(hostname: string): Promise<{ id: string; status: string; ssl: { status: string } }> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new Error('Cloudflare not configured (api_key / zone_id / server_ip missing)');
    }
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames`;
    try {
      const resp = await this.request('post', base, cfg, {
        hostname,
        ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
      });
      const r = resp.data.result;
      return { id: r.id, status: r.status, ssl: { status: r.ssl?.status ?? 'initializing' } };
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Read a custom hostname's status for polling. */
  async getCustomHostname(id: string): Promise<{ status: string; ssl: { status: string } }> {
    const cfg = await this.getConfig();
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/${id}`;
    try {
      const resp = await this.request('get', base, cfg);
      const r = resp.data.result;
      return { status: r.status, ssl: { status: r.ssl?.status ?? '' } };
    } catch (err) {
      throw new Error(this.extractError(err));
    }
  }

  /** Delete a custom hostname (detach). Best-effort: tolerates "not found". */
  async deleteCustomHostname(id: string): Promise<void> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) return;
    const base = `https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}/custom_hostnames/${id}`;
    try {
      await this.request('delete', base, cfg);
      logger.info(`[CF] Deleted custom hostname ${id}`);
    } catch (err) {
      logger.warn(`[CF] deleteCustomHostname(${id}) failed:`, this.extractError(err));
    }
  }
}

export const cloudflareService = new CloudflareService();
