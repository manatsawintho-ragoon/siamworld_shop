/**
 * Subscription expiry notifications, delivered by email (Resend).
 * Replaces the retired LINE Notify integration (LINE shut the Notify API down in 2025).
 */
import { pool } from '../database/connection';
import { settingsService } from './settings.service';
import { emailService } from './email.service';
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
    // Short grace by default (1 day): a shop goes down ~a day after it expires, not 3.
    // Operators can still override per-panel via the auto_suspend_days setting.
    const graceDays = parseInt(settings['auto_suspend_days'] || '1');

    const [subs] = await pool.execute<RowDataPacket[]>(`
      SELECT s.id, s.shop_name, s.domain, s.expires_at, pu.email, pu.display_name
      FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
      WHERE s.status = 'active'
        AND s.expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [graceDays]);

    for (const sub of subs) {
      try {
        const { deployService } = await import('./deploy.service');
        await deployService.stopShop(sub.shop_name);
        await pool.execute('UPDATE subscriptions SET status="suspended" WHERE id=?', [sub.id]);

        await emailService.sendSuspensionNotice({
          shopName: sub.shop_name,
          domain: sub.domain,
          expiresAt: sub.expires_at,
          email: sub.email,
          displayName: sub.display_name,
        });
      } catch (err) {
        console.error('[Suspend]', sub.shop_name, (err as Error).message);
      }
    }
  }
}

export const notificationService = new NotificationService();
