import cron from 'node-cron';
import { notificationService } from './notification.service';

export function startCronJobs(): void {
  // Run daily at 09:00 — check expiry & send LINE notifications
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running expiry notifications...');
    try { await notificationService.sendExpiryNotifications(); }
    catch (err) { console.error('[Cron] Notification error:', err); }
  });

  // Run daily at 02:00 — suspend shops overdue by grace period
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Checking for expired shops to suspend...');
    try { await notificationService.suspendExpired(); }
    catch (err) { console.error('[Cron] Suspend error:', err); }
  });

  console.log('[Cron] Jobs scheduled (notify: 09:00, suspend: 02:00)');
}
