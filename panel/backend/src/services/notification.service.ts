/**
 * Subscription expiry notifications, delivered by email (Resend).
 * Replaces the retired LINE Notify integration (LINE shut the Notify API down in 2025).
 */
import { pool } from '../database/connection';
import { settingsService } from './settings.service';
import { emailService } from './email.service';
import { customDomainService } from './custom-domain.service';
import { resolveLifecycleDays } from '../utils/lifecycle';
import { RowDataPacket } from 'mysql2';

class NotificationService {
  /** Email customers whose shop expires in exactly 3 or 1 day(s), once per threshold. */
  async sendExpiryNotifications(): Promise<void> {
    const settings = await settingsService.getAll();
    const daysConfig = (settings['notify_days_before'] || '3,1')
      .split(',').map(d => parseInt(d.trim())).filter(Boolean);

    for (const days of daysConfig) {
      // Find subscriptions expiring in exactly `days` days (not already notified for this threshold)
      const [subs] = await pool.execute<RowDataPacket[]>(`
        SELECT s.id, s.shop_name, s.domain, s.expires_at,
               pu.display_name, pu.email
        FROM subscriptions s
        JOIN panel_users pu ON pu.id = s.user_id
        LEFT JOIN expiry_notifications en ON en.subscription_id = s.id AND en.days_before = ?
        WHERE s.status = 'active'
          AND DATE(s.expires_at) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND en.id IS NULL
      `, [days, days]);

      for (const sub of subs) {
        await emailService.sendExpiryReminder({
          shopName: sub.shop_name,
          domain: sub.domain,
          expiresAt: sub.expires_at,
          email: sub.email,
          displayName: sub.display_name,
        }, days);

        // Record sent so the next daily run doesn't re-notify for the same threshold
        await pool.execute(
          'INSERT IGNORE INTO expiry_notifications (subscription_id, days_before) VALUES (?,?)',
          [sub.id, days]
        );
      }
    }
  }

  /** Suspend shops past the grace period and email the customer that the shop is down. */
  async suspendExpired(): Promise<void> {
    const settings = await settingsService.getAll();
    const { suspendDays, deleteDays } = resolveLifecycleDays(settings);

    const [subs] = await pool.execute<RowDataPacket[]>(`
      SELECT s.id, s.shop_name, s.domain, s.expires_at,
             s.custom_domain, s.custom_domain_status,
             pu.email, pu.display_name
      FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
      WHERE s.status = 'active'
        AND s.expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [suspendDays]);

    for (const sub of subs) {
      try {
        const { deployService } = await import('./deploy.service');
        await deployService.stopShop(sub.shop_name);
        await pool.execute('UPDATE subscriptions SET status="suspended" WHERE id=?', [sub.id]);

        // Take the custom domain offline but keep the CF hostname (restored on renew).
        await customDomainService.onSuspend(sub.domain, sub.custom_domain, sub.custom_domain_status);

        // The shop is permanently deleted `deleteDays` after expiry — warn the customer.
        const deleteAt = new Date(new Date(sub.expires_at).getTime() + deleteDays * 86400000);
        await emailService.sendSuspensionNotice({
          shopName: sub.shop_name,
          domain: sub.domain,
          expiresAt: sub.expires_at,
          email: sub.email,
          displayName: sub.display_name,
        }, deleteAt);
      } catch (err) {
        console.error('[Suspend]', sub.shop_name, (err as Error).message);
      }
    }
  }

  /**
   * Permanently delete shops that have been suspended and remain unrenewed past
   * `auto_delete_days` (default 7) after expiry. DESTRUCTIVE: removes containers, the
   * MySQL data volume, the custom domain (CF hostname), DNS, firewall rules, and the
   * subscription row. Guards: only `status='suspended'` shops (already past suspend +
   * emailed) and only past the delete threshold, which is always > the suspend threshold.
   */
  async deleteExpired(): Promise<void> {
    const settings = await settingsService.getAll();
    const { deleteDays } = resolveLifecycleDays(settings);

    const [subs] = await pool.execute<RowDataPacket[]>(`
      SELECT s.id, s.shop_name, s.domain, s.expires_at, s.mc_ip, s.mysql_exposed_port,
             s.custom_hostname_id, pu.email, pu.display_name
      FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
      WHERE s.status = 'suspended'
        AND s.expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [deleteDays]);

    for (const sub of subs) {
      try {
        const { deployService } = await import('./deploy.service');
        // Permanent teardown: containers + data volume + NPM proxy host + DNS + firewall.
        await deployService.removeShop(
          sub.shop_name, sub.domain, sub.mc_ip || undefined, sub.mysql_exposed_port || undefined
        );
        // Delete the Cloudflare custom hostname so it stops consuming for-SaaS quota.
        await customDomainService.onTeardown(sub.custom_hostname_id);
        // Drop the subscription record last (point of no return).
        await pool.execute('DELETE FROM subscriptions WHERE id=?', [sub.id]);
        console.log(`[Delete] Permanently removed expired shop ${sub.shop_name} (id ${sub.id})`);

        await emailService.sendDeletionNotice({
          shopName: sub.shop_name,
          domain: sub.domain,
          expiresAt: sub.expires_at,
          email: sub.email,
          displayName: sub.display_name,
        });
      } catch (err) {
        console.error('[Delete]', sub.shop_name, (err as Error).message);
      }
    }
  }
}

export const notificationService = new NotificationService();
