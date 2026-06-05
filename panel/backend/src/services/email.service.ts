import axios from 'axios';
import https from 'https';
import { settingsService } from './settings.service';
import type { RowDataPacket } from 'mysql2';

// Container has no IPv6 connectivity. axios doesn't always honor
// `dns.setDefaultResultOrder('ipv4first')`, so pin the socket family.
const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

/** Send a transactional email via Resend's REST API. */
async function resendSend(apiKey: string, payload: Record<string, unknown>): Promise<{ id: string }> {
  const resp = await axios.post('https://api.resend.com/emails', payload, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 20000,
    httpsAgent: ipv4Agent,
  });
  return resp.data as { id: string };
}

interface SubscriptionRow extends RowDataPacket {
  id: number;
  shop_name: string;
  domain: string;
  kind: 'regular' | 'trial' | 'intro';
  package_months: number;
  price_paid: number | string;
  expires_at: Date | string;
  mc_ip: string | null;
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  display_name: string | null;
}

interface SupportLinks {
  supportEmail?: string;
  supportFacebook?: string;
  supportDiscord?: string;
}

class EmailService {
  private async getClient(): Promise<{ apiKey: string; from: string; replyTo?: string } | null> {
    const s = await settingsService.getAll();
    const apiKey = s['resend_api_key'];
    if (!apiKey) return null;
    const fromName = s['email_from_name'] || 'SIAMSITE STORE';
    const fromAddr = s['email_from'] || 'noreply@siamsite.shop';
    const replyTo = s['email_reply_to'] || undefined;
    return {
      apiKey,
      from: `${fromName} <${fromAddr}>`,
      replyTo,
    };
  }

  private formatExpiry(d: Date | string): string {
    const dt = new Date(d);
    return dt.toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private kindLabel(kind: SubscriptionRow['kind'], months: number): string {
    if (kind === 'trial') return 'ทดลองฟรี 7 วัน';
    if (kind === 'intro') return 'โปรเดือนแรก ฿99';
    return `แพ็กเกจ ${months} เดือน`;
  }

  /** HTML welcome/confirmation email — Sarabun/Prompt, amber+white, compact (no scrolling). */
  private buildWelcomeHtml(sub: SubscriptionRow, user: UserRow, support: SupportLinks): string {
    const { supportEmail, supportFacebook, supportDiscord } = support;
    // Fall back to email username if display_name is empty OR encoding-corrupted (lots of ???).
    const rawName = user.display_name || '';
    const qMarks  = (rawName.match(/\?/g) || []).length;
    const displayName = (!rawName || qMarks > 3) ? user.email.split('@')[0] : rawName;
    const setupUrl    = `https://${sub.domain}/admin/setup`;
    const panelUrl    = 'https://panel.siamsite.shop';
    const kindLabel   = this.kindLabel(sub.kind, sub.package_months);
    const expires     = this.formatExpiry(sub.expires_at);
    const mcIp        = sub.mc_ip || 'ยังไม่ระบุ';
    const priceTxt    = Number(sub.price_paid) > 0 ? `฿${Number(sub.price_paid).toLocaleString('th-TH')}` : 'ฟรี';

    // Amber + white tokens
    const INK    = '#1F1B16';
    const MUTED  = '#8A7F73';
    const HAIR   = '#F1E9DD';
    const SOFT   = '#FFFBF2';
    const AMBER  = '#D97706';
    const FONT_TH = `'Sarabun','Prompt',-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif`;

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>ติดตั้งร้าน ${escapeHtml(sub.shop_name)} เสร็จ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FFFBF2;font-family:${FONT_TH};color:${INK};-webkit-font-smoothing:antialiased;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">

  <!-- Card -->
  <div style="background:#FFFFFF;border:1px solid ${HAIR};border-radius:14px;overflow:hidden;">

    <!-- Header bar (amber) -->
    <div style="background:${AMBER};padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-family:'Prompt',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;color:#FFFFFF;text-transform:uppercase;">SIAMSITE STORE</div>
      <div style="font-family:'Prompt',sans-serif;font-size:11px;font-weight:500;color:#FFE4B8;letter-spacing:0.04em;">ติดตั้งสำเร็จ</div>
    </div>

    <!-- Headline + intro -->
    <div style="padding:28px 28px 16px;">
      <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:${INK};">
        ร้าน <span style="color:${AMBER};">${escapeHtml(sub.shop_name)}</span> พร้อมใช้งานแล้ว
      </h1>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.65;color:${MUTED};">
        สวัสดีคุณ ${escapeHtml(displayName)} กดปุ่มด้านล่างเพื่อตั้งค่าครั้งแรก ใช้เวลาไม่ถึง 5 นาที
      </p>
    </div>

    <!-- CTA -->
    <div style="padding:4px 28px 24px;">
      <a href="${escapeHtml(setupUrl)}" style="display:inline-block;background:${AMBER};color:#FFFFFF;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:14px;font-family:${FONT_TH};">
        ตั้งค่าร้านค้าของคุณ
      </a>
      <div style="margin-top:10px;font-size:12px;color:${MUTED};font-family:'Prompt',sans-serif;">
        ไปที่ Setup Wizard: <a href="${escapeHtml(setupUrl)}" style="color:${AMBER};text-decoration:none;">${escapeHtml(sub.domain)}/admin/setup</a>
      </div>
    </div>

    <!-- Info grid -->
    <div style="padding:0 28px 8px;">
      <div style="background:${SOFT};border:1px solid ${HAIR};border-radius:10px;padding:16px 18px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${miniRow('แพ็กเกจ', escapeHtml(kindLabel), MUTED, INK)}
          ${miniRow('ราคา', priceTxt, MUTED, INK)}
          ${miniRow('หมดอายุ', escapeHtml(expires), MUTED, AMBER)}
          ${miniRow('Minecraft IP', `<span style="font-family:'Prompt',monospace;">${escapeHtml(mcIp)}</span>`, MUTED, INK, true)}
        </table>
      </div>
    </div>

    ${sub.kind === 'trial' ? `
    <!-- Trial note -->
    <div style="margin:16px 28px 0;padding:12px 14px;background:${SOFT};border-left:3px solid ${AMBER};border-radius:6px;font-size:12px;color:${INK};line-height:1.6;">
      <b style="font-family:'Prompt',sans-serif;color:${AMBER};">ทดลองฟรี</b> หมดอายุ ${escapeHtml(expires)} จากนั้นต่ออายุได้ที่ Panel
    </div>` : ''}
    ${sub.kind === 'intro' ? `
    <div style="margin:16px 28px 0;padding:12px 14px;background:${SOFT};border-left:3px solid ${AMBER};border-radius:6px;font-size:12px;color:${INK};line-height:1.6;">
      <b style="font-family:'Prompt',sans-serif;color:${AMBER};">โปรเดือนแรก ฿99</b> เดือนถัดไปราคาปกติ ฿350/เดือน
    </div>` : ''}

    <!-- Thank you + closing -->
    <div style="padding:24px 28px 8px;">
      <p style="margin:0;font-size:14px;color:${INK};line-height:1.7;">
        ขอบคุณที่ไว้วางใจ <b style="color:${AMBER};">SIAMSITE STORE</b> เป็นแพลตฟอร์มสำหรับร้านค้า Minecraft ของคุณ
        ทีมงานพร้อมช่วยเหลือทุกขั้นตอน ขอให้ร้านของคุณขายดีและเติบโตอย่างต่อเนื่อง
      </p>
    </div>

    <!-- Help / support -->
    <div style="padding:16px 28px 24px;">
      <div style="background:${SOFT};border:1px solid ${HAIR};border-radius:10px;padding:18px 20px;">
        <div style="font-family:'Prompt',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;color:${AMBER};text-transform:uppercase;margin-bottom:10px;">
          ติดต่อช่วยเหลือ
        </div>
        <p style="margin:0 0 12px;font-size:13px;color:${MUTED};line-height:1.65;">
          พบปัญหาหรือต้องการคำแนะนำ ติดต่อทีมงานได้ตามช่องทางด้านล่าง
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${supportFacebook ? `<tr>
            <td style="padding:6px 0;color:${MUTED};width:90px;font-family:'Prompt',sans-serif;">Facebook</td>
            <td style="padding:6px 0;"><a href="${escapeHtml(supportFacebook)}" style="color:${AMBER};text-decoration:none;">${escapeHtml(supportFacebook.replace(/^https?:\/\/(www\.)?/, ''))}</a></td>
          </tr>` : ''}
          ${supportDiscord ? `<tr>
            <td style="padding:6px 0;color:${MUTED};font-family:'Prompt',sans-serif;">Discord</td>
            <td style="padding:6px 0;"><a href="${escapeHtml(supportDiscord)}" style="color:${AMBER};text-decoration:none;">${escapeHtml(supportDiscord.replace(/^https?:\/\/(www\.)?/, ''))}</a></td>
          </tr>` : ''}
          ${supportEmail ? `<tr>
            <td style="padding:6px 0;color:${MUTED};font-family:'Prompt',sans-serif;">อีเมล</td>
            <td style="padding:6px 0;"><a href="mailto:${escapeHtml(supportEmail)}" style="color:${AMBER};text-decoration:none;">${escapeHtml(supportEmail)}</a></td>
          </tr>` : ''}
          <tr>
            <td style="padding:6px 0;color:${MUTED};font-family:'Prompt',sans-serif;">Help Center</td>
            <td style="padding:6px 0;"><a href="${escapeHtml(panelUrl)}/dashboard/support" style="color:${AMBER};text-decoration:none;">เปิดตั๋วช่วยเหลือใน Panel</a></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${MUTED};font-family:'Prompt',sans-serif;">Panel</td>
            <td style="padding:6px 0;"><a href="${escapeHtml(panelUrl)}" style="color:${AMBER};text-decoration:none;">panel.siamsite.shop</a></td>
          </tr>
        </table>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:16px 8px 0;text-align:center;font-size:11px;color:${MUTED};font-family:'Prompt',sans-serif;letter-spacing:0.04em;">
    ขอบคุณที่เลือกใช้ SIAMSITE STORE · © ${new Date().getFullYear()}
  </div>

</div>
</body>
</html>`;
  }

  /** Plain-text fallback. */
  private buildWelcomeText(sub: SubscriptionRow, user: UserRow, support: SupportLinks): string {
    const rawName = user.display_name || '';
    const qMarks  = (rawName.match(/\?/g) || []).length;
    const displayName = (!rawName || qMarks > 3) ? user.email.split('@')[0] : rawName;
    const setupUrl = `https://${sub.domain}/admin/setup`;
    const expires  = this.formatExpiry(sub.expires_at);
    const lines = [
      `สวัสดีคุณ ${displayName}`,
      ``,
      `ร้าน "${sub.shop_name}" พร้อมใช้งานแล้ว`,
      `ตั้งค่าครั้งแรก: ${setupUrl}`,
      ``,
      `แพ็กเกจ: ${this.kindLabel(sub.kind, sub.package_months)}`,
      `หมดอายุ: ${expires}`,
      ``,
      `ขอบคุณที่ไว้วางใจ SIAMSITE STORE`,
      `ขอให้ร้านของคุณขายดีและเติบโตอย่างต่อเนื่อง`,
      ``,
      `ติดต่อช่วยเหลือ:`,
    ];
    if (support.supportFacebook) lines.push(`  Facebook: ${support.supportFacebook}`);
    if (support.supportDiscord)  lines.push(`  Discord: ${support.supportDiscord}`);
    if (support.supportEmail)    lines.push(`  อีเมล: ${support.supportEmail}`);
    lines.push(`  Help Center: https://panel.siamsite.shop/dashboard/support`);
    lines.push(`  Panel: https://panel.siamsite.shop`);
    return lines.join('\n');
  }

  /** Send a welcome/confirmation email after a shop is deployed. No-op if Resend not configured. */
  async sendDeployWelcome(sub: SubscriptionRow, user: UserRow): Promise<void> {
    const cfg = await this.getClient();
    if (!cfg) {
      console.log('[Email] Resend not configured — skipping welcome email for', sub.shop_name);
      return;
    }
    if (!user.email) {
      console.log('[Email] User has no email — skipping welcome email');
      return;
    }
    const s = await settingsService.getAll();
    const support: SupportLinks = {
      supportEmail:    s['support_email'] || undefined,
      supportFacebook: s['support_facebook'] || undefined,
      supportDiscord:  s['support_discord'] || undefined,
    };
    const html = this.buildWelcomeHtml(sub, user, support);
    const text = this.buildWelcomeText(sub, user, support);

    try {
      const payload: Record<string, unknown> = {
        from: cfg.from,
        to: [user.email],
        subject: `ติดตั้งร้าน ${sub.shop_name} เสร็จสมบูรณ์: เริ่มต้นใช้งาน`,
        html,
        text,
      };
      if (cfg.replyTo) payload.reply_to = cfg.replyTo;
      const result = await resendSend(cfg.apiKey, payload);
      console.log(`[Email] Welcome email sent to ${user.email} for shop ${sub.shop_name} (id: ${result.id})`);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: unknown }; message?: string };
      console.error('[Email] sendDeployWelcome failed:', e.response?.status ?? '', JSON.stringify(e.response?.data ?? {}) || e.message);
    }
  }

  /** Send a test email to verify Resend configuration. Throws on failure (route surfaces the error). */
  async sendTest(toEmail: string): Promise<{ id: string }> {
    const cfg = await this.getClient();
    if (!cfg) throw new Error('Resend ยังไม่ได้ตั้งค่า: กรุณาใส่ API Key ก่อน');

    const payload: Record<string, unknown> = {
      from: cfg.from,
      to: [toEmail],
      subject: 'ทดสอบการส่งอีเมล · SIAMSITE STORE',
      html: `<div style="font-family:'Sarabun','Prompt',sans-serif;padding:32px 28px;max-width:480px;margin:32px auto;background:#FFFFFF;border:1px solid #F1E9DD;border-radius:14px;color:#1F1B16;">
        <div style="background:#D97706;color:#fff;font-family:'Prompt',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;padding:6px 12px;border-radius:6px;display:inline-block;text-transform:uppercase;margin-bottom:14px;">TEST</div>
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;">ส่งอีเมลทำงานปกติ</h2>
        <p style="margin:0;color:#8A7F73;line-height:1.65;font-size:13px;">ระบบ Resend ของ SIAMSITE STORE พร้อมส่งอีเมลให้ลูกค้าหลังติดตั้งร้าน</p>
        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #F1E9DD;font-family:'Prompt',sans-serif;font-size:11px;color:#8A7F73;letter-spacing:0.04em;">${new Date().toLocaleString('th-TH')}</div>
      </div>`,
      text: 'การตั้งค่า Resend ของ SIAMSITE STORE ทำงานปกติ',
    };
    if (cfg.replyTo) payload.reply_to = cfg.replyTo;

    try {
      return await resendSend(cfg.apiKey, payload);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string; name?: string } }; message?: string };
      const cfMsg = e.response?.data?.message;
      throw new Error(cfMsg || e.message || 'ส่งล้มเหลว');
    }
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function miniRow(label: string, value: string, muted: string, valueColor: string, last = false): string {
  return `<tr>
    <td style="padding:5px 0;${last ? '' : ''}color:${muted};width:110px;font-family:'Prompt',sans-serif;font-size:12px;letter-spacing:0.02em;">${escapeHtml(label)}</td>
    <td style="padding:5px 0;color:${valueColor};font-weight:500;text-align:right;">${value}</td>
  </tr>`;
}

function miniStep(n: number, title: string, hint: string, amber: string, ink: string, muted: string, last = false): string {
  return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;${last ? '' : ''}">
    <div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#FFF4DE;color:${amber};font-family:'Prompt',sans-serif;font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center;">${n}</div>
    <div style="flex:1;font-size:13px;color:${ink};line-height:1.5;">
      <b style="font-weight:600;">${escapeHtml(title)}</b>
      <span style="color:${muted};font-size:12px;"> · ${escapeHtml(hint)}</span>
    </div>
  </div>`;
}

export const emailService = new EmailService();
