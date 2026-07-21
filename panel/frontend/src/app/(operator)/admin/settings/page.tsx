'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/ui/icon';

type Settings = Record<string, string>;

/** One settings group. A plain titled card: the old version wrapped each group
 *  in an icon tile with its own hover scale, which added decoration to a screen
 *  whose whole job is reading and editing field values. */
function Section({ title, desc, children }: {
  title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div className="min-w-0">
          <h3 className="admin-section-title">{title}</h3>
          {desc && <p className="admin-meta mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="admin-card-body space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, name, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  const id = `set-${name}`;
  return (
    <div>
      <label htmlFor={id} className="admin-label">{label}</label>
      <input
        id={id}
        type={type}
        className="admin-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(name, e.target.value)}
      />
      {hint && <p className="admin-meta mt-1.5">{hint}</p>}
    </div>
  );
}

function InfoBanner({ variant, children }: { variant: 'warning' | 'info'; children: React.ReactNode }) {
  const cls = variant === 'warning'
    ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
    : 'border-blue-500/30 bg-blue-500/5 text-blue-800 dark:text-blue-300';
  return (
    <p className={`text-[13px] leading-relaxed border rounded-md p-3 ${cls}`}>{children}</p>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fixingNpm, setFixingNpm] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/settings');
      setSettings(r.data);
    } catch {
      toast.error('โหลดล้มเหลว', 'ไม่สามารถดึงข้อมูลตั้งค่าได้');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/admin/settings', settings);
      toast.success('บันทึกสำเร็จ', 'อัปเดตการตั้งค่าระบบแล้ว');
    } catch (err: any) {
      toast.error('บันทึกไม่สำเร็จ', err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const runNotify = async () => {
    if (!confirm('ยืนยันส่งแจ้งเตือนหมดอายุทันที?')) return;
    try {
      await api.post('/api/admin/notify/run', {});
      toast.success('ส่งสำเร็จ', 'กำลังส่งการแจ้งเตือนในเบื้องหลัง');
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถส่งการแจ้งเตือนได้');
    }
  };

  const testEmail = async () => {
    const to = (testEmailTo || settings['email_from'] || '').trim();
    if (!to) {
      toast.error('กรอกอีเมลปลายทาง', 'ระบุอีเมลที่จะส่งทดสอบ');
      return;
    }
    setTestingEmail(true);
    try {
      // Save current settings first so the backend sees the latest API key
      await api.put('/api/admin/settings', settings);
      await api.post('/api/admin/settings/test-email', { to });
      toast.success('ส่งอีเมลทดสอบสำเร็จ', `ส่งไปยัง ${to} แล้ว ตรวจสอบกล่องจดหมาย`);
    } catch (err: any) {
      toast.error('ส่งไม่สำเร็จ', err.response?.data?.error || 'ตรวจสอบ API Key อีกครั้ง');
    } finally {
      setTestingEmail(false);
    }
  };

  const fixNpm = async () => {
    setFixingNpm(true);
    try {
      await api.post('/api/admin/settings/fix-panel-npm', {});
      toast.success('สำเร็จ', 'อัปเดต NPM proxy host ของ Panel แล้ว');
    } catch (err: any) {
      toast.error('ล้มเหลว', err.response?.data?.error || 'ไม่สามารถดำเนินการได้');
    } finally {
      setFixingNpm(false);
    }
  };

  if (loading) return (
    <div className="p-10 text-center">
      <Icon name="circle-notch" className="animate-spin text-primary text-xl" />
      <p className="admin-meta mt-3">กำลังโหลดการตั้งค่า</p>
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">ตั้งค่าระบบ</h2>
          <p className="admin-sub">โครงสร้างพื้นฐาน การชำระเงิน และการแจ้งเตือน</p>
        </div>
        <button type="submit" disabled={saving} className="admin-btn admin-btn-primary">
          {saving ? <Icon name="spinner" className="animate-spin" /> : <Icon name="floppy-disk" />}
          บันทึกการตั้งค่า
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Section title="ข้อมูลแผงควบคุม" desc="ชื่อและโดเมนของแผงควบคุม">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="ชื่อแผงควบคุม" name="panel_name" value={settings['panel_name'] || ''} onChange={set} placeholder="SIAMSITE STORE" />
              <Field label="โดเมนแผงควบคุม" name="panel_domain" value={settings['panel_domain'] || ''} onChange={set} placeholder="panel.siamsite.shop" />
            </div>
          </Section>

          <Section title="ราคาแพ็กเกจ" desc="ราคาค่าบริการรายเดือน หน่วยเป็นบาท">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="1 เดือน" name="price_1month" value={settings['price_1month'] || ''} onChange={set} type="number" placeholder="249" />
              <Field label="3 เดือน" name="price_3months" value={settings['price_3months'] || ''} onChange={set} type="number" placeholder="599" />
              <Field label="6 เดือน" name="price_6months" value={settings['price_6months'] || ''} onChange={set} type="number" placeholder="1099" />
            </div>
          </Section>

          <Section title="ระบบรับชำระเงิน" desc="บัญชี PromptPay และการตรวจสลิปด้วย EasySlip">
            <InfoBanner variant="warning">
              ลูกค้าโอนเงินมาที่บัญชี PromptPay นี้ และระบบใช้ EasySlip ตรวจสอบสลิปอัตโนมัติ ขอ API Key ได้ที่ document.easyslip.com
            </InfoBanner>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="PromptPay ID" name="promptpay_id" value={settings['promptpay_id'] || ''} onChange={set}
                placeholder="0812345678" hint="เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก" />
              <Field label="ชื่อบัญชี PromptPay" name="promptpay_name" value={settings['promptpay_name'] || ''} onChange={set} placeholder="ชื่อ นามสกุล" />
            </div>
            <Field label="EasySlip API Key" name="easyslip_api_key" value={settings['easyslip_api_key'] || ''} onChange={set}
              type="password" placeholder="กรอก API Key" hint="ใช้ตรวจสอบสลิปอัตโนมัติผ่าน EasySlip API" />
          </Section>

          <Section title="CAPTCHA (Cloudflare Turnstile)" desc="ป้องกันบอทที่หน้าเข้าสู่ระบบและสมัครสมาชิก">
            <InfoBanner variant="info">
              สมัครฟรีที่ dash.cloudflare.com เมนู Turnstile เลือก widget mode &quot;Managed&quot; แล้วนำ Site Key และ Secret Key มากรอกด้านล่าง
            </InfoBanner>
            <div className="flex items-center justify-between gap-4 border border-border rounded-md p-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground">เปิดใช้งาน CAPTCHA</p>
                <p className="admin-meta mt-0.5">ต้องกรอกทั้ง Site Key และ Secret Key ก่อนเปิด</p>
              </div>
              <button
                type="button"
                onClick={() => set('enable_turnstile', settings['enable_turnstile'] === '1' ? '0' : '1')}
                aria-pressed={settings['enable_turnstile'] === '1'}
                className={`admin-btn admin-btn-sm shrink-0 ${settings['enable_turnstile'] === '1' ? 'admin-btn-primary' : ''}`}
              >
                {settings['enable_turnstile'] === '1' ? 'เปิดอยู่' : 'ปิดอยู่'}
              </button>
            </div>
            <Field label="Site Key (Public)" name="turnstile_site_key" value={settings['turnstile_site_key'] || ''} onChange={set}
              placeholder="0x4AAAAAAA..." hint="เปิดเผยได้ ใช้ฝั่งหน้าเว็บ" />
            <Field label="Secret Key" name="turnstile_secret" value={settings['turnstile_secret'] || ''} onChange={set}
              type="password" placeholder="0x4AAAAAAA..." hint="ใช้ตรวจ token ฝั่งเซิร์ฟเวอร์ เก็บเป็นความลับ" />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="โครงสร้างพื้นฐาน" desc="การเชื่อมต่อ Nginx Proxy Manager">
            <Field label="URL ของ NPM" name="npm_url" value={settings['npm_url'] || ''} onChange={set} placeholder="http://172.18.0.1:81" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="อีเมลแอดมิน NPM" name="npm_email" value={settings['npm_email'] || ''} onChange={set} type="email" />
              <Field label="รหัสผ่านแอดมิน NPM" name="npm_password" value={settings['npm_password'] || ''} onChange={set} type="password" />
            </div>
            <Field label="IP สำหรับ Forward (Gateway)" name="npm_forward_host" value={settings['npm_forward_host'] || ''} onChange={set}
              placeholder="172.18.0.1" hint="IP ของเครื่องแม่ข่ายที่ใช้ทำ Proxy Forwarding" />
            <button type="button" onClick={fixNpm} disabled={fixingNpm} className="admin-btn w-full">
              {fixingNpm ? <Icon name="spinner" className="animate-spin" /> : <Icon name="wand-magic-sparkles" />}
              ซ่อม NPM Proxy ของแผงควบคุม
            </button>
          </Section>

          <Section title="การแจ้งเตือนหมดอายุ" desc="ส่งอีเมลเตือนลูกค้าก่อนร้านหมดอายุและเมื่อถูกระงับ">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="แจ้งล่วงหน้า (วัน)" name="notify_days_before" value={settings['notify_days_before'] || '3,1'} onChange={set}
                placeholder="3,1" hint="คั่นด้วยคอมม่า เช่น 3,1" />
              <Field label="ระงับหลังหมดอายุ (วัน)" name="auto_suspend_days" value={settings['auto_suspend_days'] || '1'} onChange={set} type="number" />
            </div>
            <button type="button" onClick={runNotify} className="admin-btn w-full">
              <Icon name="paper-plane" /> ส่งแจ้งเตือนทันที
            </button>
          </Section>

          <Section title="อีเมลระบบ (Resend)" desc="อีเมลต้อนรับหลังติดตั้งร้านสำเร็จ">
            <InfoBanner variant="info">
              เมื่อลูกค้าติดตั้งร้านสำเร็จ ระบบจะส่งอีเมลภาษาไทยพร้อมคู่มือเริ่มต้นให้อัตโนมัติ สมัคร API Key ฟรีได้ที่ resend.com (3,000 อีเมลต่อเดือน)
            </InfoBanner>
            <Field label="Resend API Key" name="resend_api_key" value={settings['resend_api_key'] || ''} onChange={set}
              type="password" placeholder="re_..." hint="API Key จาก resend.com เมนู API Keys" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="ชื่อผู้ส่ง" name="email_from_name" value={settings['email_from_name'] || ''} onChange={set} placeholder="SIAMSITE STORE" />
              <Field label="อีเมลผู้ส่ง" name="email_from" value={settings['email_from'] || ''} onChange={set}
                type="email" placeholder="noreply@siamsite.shop" hint="ต้อง verify โดเมนใน Resend ก่อน" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Reply-To (ไม่บังคับ)" name="email_reply_to" value={settings['email_reply_to'] || ''} onChange={set}
                type="email" placeholder="support@siamsite.shop" hint="ปลายทางเมื่อลูกค้ากดตอบกลับ" />
              <Field label="อีเมล Support ที่แสดงในอีเมล" name="support_email" value={settings['support_email'] || ''} onChange={set}
                type="email" placeholder="support@siamsite.shop" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Facebook Page" name="support_facebook" value={settings['support_facebook'] || ''} onChange={set}
                placeholder="https://facebook.com/siamsite" hint="ลิงก์เพจสำหรับติดต่อ support" />
              <Field label="Discord Server" name="support_discord" value={settings['support_discord'] || ''} onChange={set}
                placeholder="https://discord.gg/xxxx" hint="ลิงก์เชิญเข้า Discord" />
            </div>
            <div className="pt-3 border-t border-border space-y-2.5">
              <div>
                <label htmlFor="test-email-to" className="admin-label">ส่งอีเมลทดสอบไปที่</label>
                <input
                  id="test-email-to"
                  type="email"
                  className="admin-input"
                  placeholder="your@email.com"
                  value={testEmailTo}
                  onChange={e => setTestEmailTo(e.target.value)}
                />
              </div>
              <button type="button" onClick={testEmail} disabled={testingEmail} className="admin-btn w-full">
                {testingEmail ? <Icon name="spinner" className="animate-spin" /> : <Icon name="paper-plane" />}
                ส่งอีเมลทดสอบ
              </button>
            </div>
          </Section>

          <Section title="Cloudflare DNS" desc="สร้าง DNS record อัตโนมัติเมื่อติดตั้งร้านใหม่">
            <InfoBanner variant="info">
              ระบบจะสร้าง DNS A record (DNS-only) อัตโนมัติทุกครั้งที่ติดตั้งร้านใหม่ รองรับทั้ง API Token (แนะนำ สิทธิ์ Zone:DNS:Edit เฉพาะ zone นี้) และ Global API Key
            </InfoBanner>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Cloudflare Email" name="cloudflare_email" value={settings['cloudflare_email'] || ''} onChange={set}
                type="email" placeholder="ใส่เฉพาะกรณีใช้ Global API Key" />
              <Field label="API Token หรือ Global API Key" name="cloudflare_api_key" value={settings['cloudflare_api_key'] || ''} onChange={set} type="password" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Cloudflare Zone ID" name="cloudflare_zone_id" value={settings['cloudflare_zone_id'] || ''} onChange={set}
                hint="Zone ID ของโดเมนหลักใน Cloudflare" />
              <Field label="Server Public IP" name="server_ip" value={settings['server_ip'] || ''} onChange={set}
                placeholder="1.2.3.4" hint="Subdomain จะชี้มาที่ IP นี้อัตโนมัติ" />
            </div>
          </Section>
        </div>
      </div>

      {/* Save is repeated at the end of a long form so it is reachable without
          scrolling back to the top. No floating bar: it covered content on a
          phone and needed motion to justify itself. */}
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className="admin-btn admin-btn-primary w-full sm:w-auto">
          {saving ? <Icon name="spinner" className="animate-spin" /> : <Icon name="floppy-disk" />}
          บันทึกการตั้งค่า
        </button>
      </div>
    </form>
  );
}
