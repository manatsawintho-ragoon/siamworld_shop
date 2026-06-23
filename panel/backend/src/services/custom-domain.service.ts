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
