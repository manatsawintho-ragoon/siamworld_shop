import nodemailer, { Transporter } from 'nodemailer';
import { settingsService } from './settings.service';
import { logger } from '../utils/logger';

/**
 * Email sender. Reads SMTP credentials from the encrypted settings table so
 * the admin can configure them at runtime. If SMTP is not configured, every
 * send() returns false and logs a warning — callers should fall back to a
 * "cannot deliver email" UX rather than crashing.
 *
 * Implementation notes:
 * - We rebuild the transporter on every send() because the settings might
 *   have just been changed in the admin UI. Cost is negligible (~ms).
 * - We never log the full SMTP password, only whether it's set.
 * - From-address validation: if smtp_from is empty, fall back to smtp_user.
 */
class EmailService {
  async isConfigured(): Promise<boolean> {
    const host = await settingsService.get('smtp_host');
    const user = await settingsService.get('smtp_user');
    const pass = await settingsService.get('smtp_password');
    return !!(host && user && pass);
  }

  /** Returns true on success, false on failure. Never throws. */
  async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      logger.warn('Email skipped: invalid recipient', { to: maskEmail(to) });
      return false;
    }

    const transporter = await this.buildTransporter();
    if (!transporter) return false;

    const from = (await settingsService.get('smtp_from')) || (await settingsService.get('smtp_user')) || 'no-reply@example.com';
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''),
      });
      logger.info('Email sent', { to: maskEmail(to), subject });
      return true;
    } catch (err) {
      logger.error('Email send failed', { to: maskEmail(to), error: (err as Error).message });
      return false;
    }
  }

  private async buildTransporter(): Promise<Transporter | null> {
    const host = await settingsService.get('smtp_host');
    const port = parseInt((await settingsService.get('smtp_port')) || '587', 10);
    const user = await settingsService.get('smtp_user');
    const pass = await settingsService.get('smtp_password');
    const secure = (await settingsService.get('smtp_secure')) === '1';

    if (!host || !user || !pass) {
      logger.warn('Email skipped: SMTP not configured');
      return null;
    }
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      // Reasonable network timeouts so a misconfigured SMTP server doesn't hang requests.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
  }
}

/** "alice@example.com" → "a***e@example.com" — used for logs only. */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export const emailService = new EmailService();
