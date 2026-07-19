import { logger } from '../utils/logger';
/**
 * Nginx Proxy Manager API integration
 * Auto-creates proxy host + requests Let's Encrypt SSL
 */
import axios from 'axios';
import { pool } from '../database/connection';
import { settingsService } from './settings.service';
import { RowDataPacket } from 'mysql2';

interface NpmToken { token: string; expires: string }

class NpmService {
  private token: string | null = null;
  private tokenExpiry = 0;

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const s = await settingsService.getAll();
    const baseUrl = s['npm_url'] || 'http://localhost:81';
    const email    = s['npm_email'];
    const password = s['npm_password'];

    if (!email || !password) throw new Error('NPM credentials not configured in panel settings');

    const resp = await axios.post<NpmToken>(`${baseUrl}/api/tokens`,
      { identity: email, secret: password },
      { timeout: 10000 }
    );

    this.token = resp.data.token;
    this.tokenExpiry = Date.now() + 12 * 60 * 60 * 1000;
    return this.token;
  }

  private async api(method: 'get'|'post'|'put'|'delete', path: string, data?: unknown) {
    const s = await settingsService.getAll();
    const baseUrl = s['npm_url'] || 'http://localhost:81';
    const token = await this.getToken();
    const resp = await axios({
      method,
      url: `${baseUrl}/api${path}`,
      data,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    });
    return resp.data;
  }

  private buildAdvancedConfig(forwardHost: string, backendPort: number): string {
    // Custom location blocks do NOT inherit proxy.conf (Host, X-Real-IP, etc.)
    // from NPM's `location /` — those headers must be set explicitly here.
    return [
      `location /api/ {`,
      `    proxy_pass http://${forwardHost}:${backendPort}/api/;`,
      `    proxy_http_version 1.1;`,
      `    proxy_set_header Host $host;`,
      `    proxy_set_header X-Real-IP $remote_addr;`,
      `    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
      `    proxy_set_header X-Forwarded-Proto $scheme;`,
      `    client_max_body_size 10M;`,
      `}`,
      `location /socket.io/ {`,
      `    proxy_pass http://${forwardHost}:${backendPort}/socket.io/;`,
      `    proxy_http_version 1.1;`,
      `    proxy_set_header Upgrade $http_upgrade;`,
      `    proxy_set_header Connection "upgrade";`,
      `    proxy_set_header Host $host;`,
      `}`,
    ].join('\n');
  }

  private baseHostBody(domain: string, forwardHost: string, frontendPort: number, backendPort: number) {
    return {
      domain_names: [domain],
      forward_scheme: 'http',
      forward_host: forwardHost,
      forward_port: frontendPort,
      access_list_id: 0,
      block_exploits: true,
      allow_websocket_upgrade: true,
      http2_support: false,
      caching_enabled: false,
      advanced_config: this.buildAdvancedConfig(forwardHost, backendPort),
      locations: [],
      enabled: true,
    };
  }

  /** Create a new proxy host for a customer shop. */
  async createProxyHost(domain: string, frontendPort: number, backendPort: number): Promise<number> {
    const s = await settingsService.getAll();
    const forwardHost = s['npm_forward_host'] || 'host.docker.internal';

    const result = await this.api('post', '/nginx/proxy-hosts', {
      ...this.baseHostBody(domain, forwardHost, frontendPort, backendPort),
      certificate_id: 0,
      ssl_forced: false,
    });

    const hostId: number = result.id;

    try {
      await this.applySSL(hostId, domain, forwardHost, frontendPort, backendPort);
    } catch (sslErr) {
      logger.warn('[NPM] SSL cert failed (non-critical):', (sslErr as Error).message);
    }

    return hostId;
  }

  /** Update an existing NPM proxy host to use current settings (host, advanced_config, SSL). */
  async updateProxyHost(domain: string, frontendPort: number, backendPort: number): Promise<void> {
    const s = await settingsService.getAll();
    const forwardHost = s['npm_forward_host'] || 'host.docker.internal';

    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as { domain_names: string[]; id: number }[])
      .find(h => h.domain_names.includes(domain));
    if (!existing) throw new Error(`ไม่พบ proxy host สำหรับ ${domain} ใน NPM`);

    const hostId = existing.id;

    // Update forward host + advanced_config (keep ssl off until cert is ready)
    await this.api('put', `/nginx/proxy-hosts/${hostId}`, {
      ...this.baseHostBody(domain, forwardHost, frontendPort, backendPort),
      certificate_id: 0,
      ssl_forced: false,
    });

    // Apply SSL
    await this.applySSL(hostId, domain, forwardHost, frontendPort, backendPort);
  }

  private async applySSL(hostId: number, domain: string, forwardHost: string, frontendPort: number, backendPort: number): Promise<void> {
    const s = await settingsService.getAll();

    const certs = await this.api('get', '/nginx/certificates');
    let cert = (certs as { domain_names: string[]; id: number }[])
      .find(c => c.domain_names.includes(domain));

    if (!cert) {
      // NPM 2.14+ requires meta: {} — letsencrypt fields moved out of meta
      await this.api('post', `/nginx/certificates`, {
        provider: 'letsencrypt',
        domain_names: [domain],
        meta: {},
      });
      const refreshed = await this.api('get', '/nginx/certificates');
      cert = (refreshed as { domain_names: string[]; id: number }[])
        .find(c => c.domain_names.includes(domain));
    }

    if (!cert) throw new Error(`ออก SSL cert สำหรับ ${domain} ไม่สำเร็จ`);

    await this.api('put', `/nginx/proxy-hosts/${hostId}`, {
      ...this.baseHostBody(domain, forwardHost, frontendPort, backendPort),
      certificate_id: cert.id,
      ssl_forced: true,
      http2_support: true,
    });
  }

  /** Reapply correct proxy config to ALL active customer subscriptions in the background. */
  async reapplyAllProxyHosts(): Promise<void> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT domain, frontend_port, backend_port FROM subscriptions WHERE status = 'active'`
    );
    for (const row of rows) {
      try {
        await this.updateProxyHost(row.domain, row.frontend_port, row.backend_port);
        logger.info(`[NPM] Updated proxy for ${row.domain}`);
      } catch (err) {
        logger.error(`[NPM] Failed to update proxy for ${row.domain}:`, (err as Error).message);
      }
    }
  }

  /** Fix the panel's own proxy host — routes /api/ to panel backend port 5000. */
  async updatePanelProxyHost(panelDomain: string): Promise<void> {
    const advancedConfig = `location /api/ {\n    proxy_pass http://127.0.0.1:5000/api/;\n}`;

    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as { domain_names: string[]; id: number; forward_host: string; forward_port: number; certificate_id: number; ssl_forced: boolean; http2_support: boolean; block_exploits: boolean; caching_enabled: boolean; allow_websocket_upgrade: boolean }[])
      .find(h => h.domain_names.includes(panelDomain));
    if (!existing) throw new Error(`ไม่พบ proxy host สำหรับ ${panelDomain} ใน NPM`);

    const s = await settingsService.getAll();
    const forwardHost = s['npm_forward_host'] || 'host.docker.internal';

    await this.api('put', `/nginx/proxy-hosts/${existing.id}`, {
      domain_names: [panelDomain],
      forward_scheme: 'http',
      forward_host: forwardHost,
      forward_port: existing.forward_port,
      access_list_id: 0,
      certificate_id: existing.certificate_id,
      ssl_forced: existing.ssl_forced,
      http2_support: existing.http2_support,
      block_exploits: existing.block_exploits,
      caching_enabled: existing.caching_enabled,
      allow_websocket_upgrade: existing.allow_websocket_upgrade,
      advanced_config: advancedConfig,
      locations: [],
      enabled: true,
    });
  }

  /**
   * Attach a custom domain to an existing shop proxy host by adding it to domain_names.
   * NPM routes by Host header, so the shop is served for both its siamsite subdomain
   * and the custom domain. No new origin cert: Cloudflare terminates the edge cert and
   * connects to origin with SNI = the fallback origin (covered by *.siamsite.shop).
   */
  async addDomainToProxyHost(shopDomain: string, customDomain: string): Promise<void> {
    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as {
      domain_names: string[]; id: number; forward_scheme: string; forward_host: string;
      forward_port: number; access_list_id: number; certificate_id: number; ssl_forced: boolean;
      http2_support: boolean; block_exploits: boolean; caching_enabled: boolean;
      allow_websocket_upgrade: boolean; advanced_config: string;
    }[]).find(h => h.domain_names.includes(shopDomain));
    if (!existing) throw new Error(`ไม่พบ proxy host สำหรับ ${shopDomain} ใน NPM`);

    if (existing.domain_names.includes(customDomain)) return;

    await this.api('put', `/nginx/proxy-hosts/${existing.id}`, {
      domain_names: [...existing.domain_names, customDomain],
      forward_scheme: existing.forward_scheme,
      forward_host: existing.forward_host,
      forward_port: existing.forward_port,
      access_list_id: existing.access_list_id,
      certificate_id: existing.certificate_id,
      ssl_forced: existing.ssl_forced,
      http2_support: existing.http2_support,
      block_exploits: existing.block_exploits,
      caching_enabled: existing.caching_enabled,
      allow_websocket_upgrade: existing.allow_websocket_upgrade,
      advanced_config: existing.advanced_config,
      locations: [],
      enabled: true,
    });
    logger.info(`[NPM] Attached ${customDomain} to proxy host ${existing.id} (${shopDomain})`);
  }

  /** Detach a custom domain from a shop proxy host. No-op if absent. */
  async removeDomainFromProxyHost(shopDomain: string, customDomain: string): Promise<void> {
    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const existing = (hosts as {
      domain_names: string[]; id: number; forward_scheme: string; forward_host: string;
      forward_port: number; access_list_id: number; certificate_id: number; ssl_forced: boolean;
      http2_support: boolean; block_exploits: boolean; caching_enabled: boolean;
      allow_websocket_upgrade: boolean; advanced_config: string;
    }[]).find(h => h.domain_names.includes(shopDomain));
    if (!existing) return;
    if (!existing.domain_names.includes(customDomain)) return;

    await this.api('put', `/nginx/proxy-hosts/${existing.id}`, {
      domain_names: existing.domain_names.filter(d => d !== customDomain),
      forward_scheme: existing.forward_scheme,
      forward_host: existing.forward_host,
      forward_port: existing.forward_port,
      access_list_id: existing.access_list_id,
      certificate_id: existing.certificate_id,
      ssl_forced: existing.ssl_forced,
      http2_support: existing.http2_support,
      block_exploits: existing.block_exploits,
      caching_enabled: existing.caching_enabled,
      allow_websocket_upgrade: existing.allow_websocket_upgrade,
      advanced_config: existing.advanced_config,
      locations: [],
      enabled: true,
    });
    logger.info(`[NPM] Detached ${customDomain} from proxy host ${existing.id} (${shopDomain})`);
  }

  async deleteProxyHost(domain: string): Promise<void> {
    const hosts = await this.api('get', '/nginx/proxy-hosts');
    const host = (hosts as { domain_names: string[]; id: number }[])
      .find(h => h.domain_names.includes(domain));
    if (host) await this.api('delete', `/nginx/proxy-hosts/${host.id}`);
  }
}

export const npmService = new NpmService();
