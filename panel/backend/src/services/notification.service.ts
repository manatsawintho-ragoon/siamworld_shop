/**
 * LINE Notify integration for expiry notifications
 */
import axios from 'axios';
import { pool } from '../database/connection';
import { settingsService } from './settings.service';
import { RowDataPacket } from 'mysql2';

class NotificationService {
  private async sendLine(token: string, message: string): Promise<void> {
    try {
      await axios.post('https://notify-api.line.me/api/notify',
        new URLSearchParams({ message }),
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
      );
    } catch (err) {
      console.warn('[LINE Notify]', (err as Error).message);
    }
  }

  async sendExpiryNotifications(): Promise<void> {
    const settings = await settingsService.getAll();
    const adminToken = settings['line_notify_token'];
    const daysConfig = (settings['notify_days_before'] || '7,3,1').split(',').map(d => parseInt(d.trim())).filter(Boolean);

    for (const days of daysConfig) {
      // Find subscriptions expiring in exactly `days` days (not already notified)
      const [subs] = await pool.execute<RowDataPacket[]>(`
        SELECT s.id, s.shop_name, s.domain, s.expires_at,
               pu.display_name, pu.email, pu.line_notify_token
        FROM subscriptions s
        JOIN panel_users pu ON pu.id = s.user_id
        LEFT JOIN expiry_notifications en ON en.subscription_id = s.id AND en.days_before = ?
        WHERE s.status = 'active'
          AND DATE(s.expires_at) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND en.id IS NULL
      `, [days, days]);

      for (const sub of subs) {
        const expiresStr = new Date(sub.expires_at).toLocaleDateString('th-TH');
        const msg = `\n[Siamsite Store] แจ้งเตือน!\nร้าน: ${sub.shop_name} (${sub.domain})\nจะหมดอายุใน ${days} วัน (${expiresStr})\nกรุณาต่ออายุที่ panel.siamsite.shop`;

        // Send to customer
        if (sub.line_notify_token) await this.sendLine(sub.line_notify_token, msg);

        // Send to admin
        if (adminToken) await this.sendLine(adminToken, `\n[Admin] ${sub.display_name} (${sub.email})\n${msg}`);

        // Record sent
        await pool.execute(
          'INSERT IGNORE INTO expiry_notifications (subscription_id, days_before) VALUES (?,?)',
          [sub.id, days]
        );
      }
    }
  }

  async suspendExpired(): Promise<void> {
    const settings = await settingsService.getAll();
    const graceDays = parseInt(settings['auto_suspend_days'] || '3');

    const [subs] = await pool.execute<RowDataPacket[]>(`
      SELECT s.*, pu.line_notify_token
      FROM subscriptions s JOIN panel_users pu ON pu.id = s.user_id
      WHERE s.status = 'active'
        AND s.expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [graceDays]);

    for (const sub of subs) {
      try {
        const { deployService } = await import('./deploy.service');
        await deployService.stopShop(sub.shop_name);
        await pool.execute('UPDATE subscriptions SET status="suspended" WHERE id=?', [sub.id]);

        const adminToken = settings['line_notify_token'];
        const msg = `\n[Siamsite Store] ระงับร้านค้า\nร้าน: ${sub.shop_name} (${sub.domain})\nหมดอายุแล้วและถูกระงับการใช้งาน`;
        if (sub.line_notify_token) await this.sendLine(sub.line_notify_token, msg);
        if (adminToken) await this.sendLine(adminToken, msg);
      } catch (err) {
        console.error('[Suspend]', sub.shop_name, (err as Error).message);
      }
    }
  }

  async testLineNotify(token: string): Promise<boolean> {
    try {
      await this.sendLine(token, '\n[Siamsite Store] ทดสอบการแจ้งเตือน LINE Notify สำเร็จ');
      return true;
    } catch { return false; }
  }
}

export const notificationService = new NotificationService();
