import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type NotificationType = 'topup_success' | 'topup_failed';

class NotificationService {
  async create(type: NotificationType, title: string, body?: string): Promise<void> {
    try {
      await pool.execute(
        'INSERT INTO notifications (type, title, body) VALUES (?, ?, ?)',
        [type, title, body ?? null]
      );
    } catch {
      // Never throw — notifications are best-effort
    }
  }

  async getRecent(limit = 30): Promise<{ notifications: RowDataPacket[]; unreadCount: number }> {
    const [notifications] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
      [String(limit)]
    );
    const [countRows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0'
    );
    return { notifications, unreadCount: Number(countRows[0].cnt) };
  }

  async markRead(id: number): Promise<void> {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }

  async markAllRead(): Promise<void> {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
  }
}

export const notificationService = new NotificationService();
