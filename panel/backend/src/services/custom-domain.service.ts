import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { cloudflareService } from './cloudflare.service';
import { npmService } from './npm.service';
import { validateCustomHostname, mapCfHostnameStatus, CustomDomainStatus } from '../utils/customDomain';

const SIAMSITE_SUFFIX = 'siamsite.shop';
const FALLBACK_ORIGIN = 'custom.siamsite.shop';

class CustomDomainService {
  private async loadSub(subscriptionId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, domain, status, custom_domain, custom_hostname_id, custom_domain_status FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!rows.length) throw new Error('ไม่พบร้านค้านี้');
    return rows[0];
  }

  async getCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    return {
      customDomain: sub.custom_domain ?? null,
      status: (sub.custom_domain_status ?? null) as CustomDomainStatus | null,
      cnameTarget: FALLBACK_ORIGIN,
    };
  }

  async requestCustomDomain(subscriptionId: number, hostname: string) {
    const sub = await this.loadSub(subscriptionId);
    if (sub.status !== 'active') throw new Error('ร้านค้ายังไม่พร้อมใช้งาน (deploy ให้เสร็จก่อน)');
    if (sub.custom_domain) throw new Error('มีโดเมนอยู่แล้ว กรุณาลบก่อนเพิ่มใหม่');

    const v = validateCustomHostname(hostname, { siamsiteSuffix: SIAMSITE_SUFFIX });
    if (!v.ok) throw new Error(v.error);
    const domain = v.value;

    const [dupes] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM subscriptions WHERE custom_domain = ? AND id <> ?',
      [domain, subscriptionId]
    );
    if (dupes.length) throw new Error('โดเมนนี้ถูกใช้ไปแล้ว');

    await cloudflareService.ensureFallbackOrigin(FALLBACK_ORIGIN);
    const ch = await cloudflareService.createCustomHostname(domain);
    const status = mapCfHostnameStatus(ch);

    await pool.execute(
      `UPDATE subscriptions
         SET custom_domain = ?, custom_hostname_id = ?, custom_domain_status = ?, custom_domain_added_at = NOW()
       WHERE id = ?`,
      [domain, ch.id, status, subscriptionId]
    );

    return { customDomain: domain, cnameTarget: FALLBACK_ORIGIN, status };
  }

  async pollCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub.custom_domain || !sub.custom_hostname_id) throw new Error('ยังไม่ได้ตั้งค่าโดเมน');

    const ch = await cloudflareService.getCustomHostname(sub.custom_hostname_id);
    const status = mapCfHostnameStatus(ch);

    // On first transition to active, attach the domain to the shop's NPM proxy host.
    if (status === 'active' && sub.custom_domain_status !== 'active') {
      await npmService.addDomainToProxyHost(sub.domain, sub.custom_domain);
    }

    await pool.execute('UPDATE subscriptions SET custom_domain_status = ? WHERE id = ?', [status, subscriptionId]);
    return { status };
  }

  /**
   * Shop suspended: take the custom domain offline by detaching it from the NPM proxy
   * host, but KEEP the Cloudflare custom hostname and DB fields so a renew/unsuspend can
   * restore it without the customer re-doing DNS. Best-effort (never throws).
   */
  async onSuspend(shopDomain: string, customDomain: string | null, status: string | null): Promise<void> {
    if (!customDomain || status !== 'active') return;
    try {
      await npmService.removeDomainFromProxyHost(shopDomain, customDomain);
    } catch (err) {
      logger.warn('[CustomDomain] onSuspend detach failed:', (err as Error).message);
    }
  }

  /**
   * Shop resumed (unsuspend/renew): re-attach the custom domain to the NPM proxy host.
   * Only when it was active. Best-effort (never throws). addDomainToProxyHost is idempotent.
   */
  async onResume(shopDomain: string, customDomain: string | null, status: string | null): Promise<void> {
    if (!customDomain || status !== 'active') return;
    try {
      await npmService.addDomainToProxyHost(shopDomain, customDomain);
    } catch (err) {
      logger.warn('[CustomDomain] onResume reattach failed:', (err as Error).message);
    }
  }

  /**
   * Shop being torn down (manual delete or auto-delete after grace): delete the Cloudflare
   * custom hostname so it stops consuming the for-SaaS hostname quota/billing. The NPM proxy
   * host itself is removed by deployService.removeShop, so no NPM detach is needed here.
   * Best-effort (never throws).
   */
  async onTeardown(customHostnameId: string | null): Promise<void> {
    if (!customHostnameId) return;
    try {
      await cloudflareService.deleteCustomHostname(customHostnameId);
    } catch (err) {
      logger.warn('[CustomDomain] onTeardown CF delete failed:', (err as Error).message);
    }
  }

  async removeCustomDomain(subscriptionId: number) {
    const sub = await this.loadSub(subscriptionId);
    if (!sub.custom_domain) return;

    if (sub.custom_domain_status === 'active') {
      await npmService.removeDomainFromProxyHost(sub.domain, sub.custom_domain);
    }
    if (sub.custom_hostname_id) {
      await cloudflareService.deleteCustomHostname(sub.custom_hostname_id);
    }
    await pool.execute(
      `UPDATE subscriptions
         SET custom_domain = NULL, custom_hostname_id = NULL, custom_domain_status = NULL, custom_domain_added_at = NULL
       WHERE id = ?`,
      [subscriptionId]
    );
  }
}

export const customDomainService = new CustomDomainService();
