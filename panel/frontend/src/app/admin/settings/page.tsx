'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

type Settings = Record<string, string>;

function Section({ icon, title, desc, children, delay = 0 }: {
  icon: string; title: string; desc?: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="rounded-3xl border-border shadow-sm overflow-hidden bg-white dark:bg-card group hover:border-primary/20 transition-all duration-500">
        <CardHeader className="px-6 py-6 border-b border-border/60 bg-secondary/10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <i className={`fas ${icon} text-lg`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-bold tracking-tight uppercase leading-tight">{title}</CardTitle>
              {desc && <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">{desc}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Field({
  label, name, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string; name: string; value: string;
  onChange: (k: string, v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  const [reveal, setReveal] = useState(false);
  const isSecret = type === 'password';
  const inputType = isSecret && !reveal ? 'password' : 'text';

  return (
    <div className="space-y-1.5 group/field">
      <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest ml-1 transition-colors group-focus-within/field:text-primary">
        {label}
      </label>
      <div className="relative">
        <input
          type={inputType}
          className={`w-full bg-secondary/30 border-2 border-transparent rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground placeholder:text-muted-foreground/40 ${isSecret ? 'pr-12' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(name, e.target.value)}
        />
        {isSecret && (
          <button 
            type="button" 
            onClick={() => setReveal(r => !r)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <i className={`fas ${reveal ? 'fa-eye-slash' : 'fa-eye'} text-[10px]`} />
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[9px] text-muted-foreground flex items-start gap-1.5 leading-relaxed font-bold uppercase tracking-wider ml-1 opacity-50">
          <i className="fas fa-circle-info text-primary/60 text-[8px] mt-0.5 flex-shrink-0" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}

function InfoBanner({ variant, children }: { variant: 'warning' | 'info'; children: React.ReactNode }) {
  const cls = variant === 'warning'
    ? 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400'
    : 'bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400';
  const icon = variant === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  const iconCls = variant === 'warning' ? 'text-amber-500' : 'text-blue-500';
  
  return (
    <div className={`flex items-start gap-3 p-4 border-2 rounded-2xl shadow-sm ${cls}`}>
      <div className={`w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm ${iconCls}`}>
        <i className={`fas ${icon} text-sm`} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider leading-relaxed">{children}</p>
    </div>
  );
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
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

  const testLine = async () => {
    setTestingLine(true);
    try {
      await api.post('/api/admin/settings/test-line', { token: settings['line_notify_token'] });
      toast.success('เชื่อมต่อสำเร็จ', 'LINE Notify ส่งข้อความทดสอบแล้ว');
    } catch {
      toast.error('เชื่อมต่อล้มเหลว', 'ตรวจสอบ Access Token อีกครั้ง');
    } finally {
      setTestingLine(false);
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
      toast.success('ส่งอีเมลทดสอบสำเร็จ', `ส่งไปยัง ${to} แล้ว — ตรวจสอบกล่องจดหมาย`);
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
    <div className="p-12 text-center flex flex-col items-center gap-6">
      <div className="w-16 h-16 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary text-2xl">
         <i className="fas fa-circle-notch fa-spin" />
      </div>
      <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">System Initialization...</p>
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-6 pb-32">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-4 mb-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-all" asChild>
              <Link href="/admin">
                <i className="fas fa-arrow-left text-xs" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Settings <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <i className="fas fa-sliders text-primary text-xs" />
            กำหนดค่าโครงสร้างพื้นฐาน, การชำระเงิน, และระบบการแจ้งเตือน
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button type="submit" disabled={saving} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/20 active:scale-95 transition-all">
             {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-floppy-disk" />} 
             บันทึกการตั้งค่า
           </Button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* Panel info */}
          <Section icon="fa-id-card" title="ข้อมูลแผงควบคุม" desc="System Branding & Control Domain" delay={0.1}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="ชื่อแผงควบคุม" name="panel_name" value={settings['panel_name'] || ''} onChange={set} placeholder="SIAMSITE STORE" />
              <Field label="โดเมนแผงควบคุม" name="panel_domain" value={settings['panel_domain'] || ''} onChange={set} placeholder="panel.siamsite.shop" />
            </div>
          </Section>

          {/* Pricing */}
          <Section icon="fa-tag" title="ราคาแพ็กเกจ" desc="Subscription Model Pricing (THB)" delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="1 เดือน (1 Month)" name="price_1month" value={settings['price_1month'] || ''} onChange={set} type="number" placeholder="350" />
              <Field label="3 เดือน (3 Months)" name="price_3months" value={settings['price_3months'] || ''} onChange={set} type="number" placeholder="900" />
              <Field label="6 เดือน (6 Months)" name="price_6months" value={settings['price_6months'] || ''} onChange={set} type="number" placeholder="1700" />
            </div>
          </Section>

          {/* Payment */}
          <Section icon="fa-qrcode" title="ระบบรับชำระเงิน" desc="Merchant & EasySlip Integration" delay={0.3}>
            <InfoBanner variant="warning">
              ลูกค้าโอนเงินมาที่บัญชี PromptPay นี้ และระบบใช้ EasySlip ตรวจสอบสลิปอัตโนมัติ
              API Key ขอได้ที่ document.easyslip.com
            </InfoBanner>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="PromptPay ID" name="promptpay_id" value={settings['promptpay_id'] || ''} onChange={set}
                placeholder="0812345678" hint="เบอร์โทร 10 หลัก หรือเลขประจำตัว 13 หลัก" />
              <Field label="ชื่อบัญชี PromptPay" name="promptpay_name" value={settings['promptpay_name'] || ''} onChange={set} placeholder="ชื่อ นามสกุล" />
            </div>
            <Field label="EasySlip API Key" name="easyslip_api_key" value={settings['easyslip_api_key'] || ''} onChange={set}
              type="password" placeholder="••••••••••••••••" hint="ใช้สำหรับตรวจสอบสลิปอัตโนมัติผ่าน EasySlip API" />
          </Section>
        </div>

        <div className="space-y-8">
          {/* Infrastructure */}
          <Section icon="fa-server" title="โครงสร้างพื้นฐาน" desc="Nginx Proxy Manager Config" delay={0.4}>
            <Field label="URL ของ NPM (Internal/Public)" name="npm_url" value={settings['npm_url'] || ''} onChange={set} placeholder="http://172.18.0.1:81" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="อีเมลแอดมิน NPM" name="npm_email" value={settings['npm_email'] || ''} onChange={set} type="email" />
              <Field label="รหัสผ่านแอดมิน NPM" name="npm_password" value={settings['npm_password'] || ''} onChange={set} type="password" />
            </div>
            <Field label="IP สำหรับ Forward (Gateway)" name="npm_forward_host" value={settings['npm_forward_host'] || ''} onChange={set}
              placeholder="172.18.0.1" hint="IP ของเครื่องแม่ข่ายในการทำ Proxy Forwarding" />
            <div className="pt-4 border-t border-border/60">
              <Button type="button" variant="outline" onClick={fixNpm} disabled={fixingNpm} className="w-full font-bold h-12 rounded-xl bg-slate-50 border-2 hover:bg-white active:scale-95 transition-all text-[10px] uppercase tracking-wider gap-2">
                {fixingNpm ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-wand-magic-sparkles" />} 
                Repair System NPM Proxy
              </Button>
            </div>
          </Section>

          {/* Notifications */}
          <Section icon="fa-bell" title="การแจ้งเตือน" desc="LINE Notify Webhook Integration" delay={0.5}>
            <Field label="LINE Notify Token" name="line_notify_token" value={settings['line_notify_token'] || ''} onChange={set} type="password" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="แจ้งล่วงหน้า (วัน)" name="notify_days_before" value={settings['notify_days_before'] || '7,3,1'} onChange={set} placeholder="7,3,1" hint="คั่นด้วยเครื่องหมายคอมม่า ," />
              <Field label="ระงับหลังหมดอายุ (วัน)" name="auto_suspend_days" value={settings['auto_suspend_days'] || '3'} onChange={set} type="number" />
            </div>
            <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row gap-3">
              <Button type="button" variant="outline" onClick={testLine} disabled={testingLine} className="flex-1 h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all gap-2 bg-white border-2">
                {testingLine ? <i className="fas fa-spinner fa-spin" /> : <i className="fab fa-line text-emerald-500 text-lg" />} 
                Test Connection
              </Button>
              <Button type="button" variant="secondary" onClick={runNotify} className="flex-1 h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all gap-2 shadow-sm">
                <i className="fas fa-paper-plane text-primary text-[10px]" /> Send Now
              </Button>
            </div>
          </Section>

          {/* Email (Resend) */}
          <Section icon="fa-envelope" title="อีเมลยืนยัน (Resend)" desc="Welcome Email After Deploy" delay={0.55}>
            <InfoBanner variant="info">
              เมื่อลูกค้า deploy ร้านสำเร็จ ระบบจะส่งอีเมลภาษาไทยพร้อมคู่มือเริ่มต้นใช้งานให้อัตโนมัติ
              สมัคร API Key ฟรีได้ที่ <b>resend.com</b> (3,000 อีเมล/เดือน)
            </InfoBanner>
            <Field label="Resend API Key" name="resend_api_key" value={settings['resend_api_key'] || ''} onChange={set}
              type="password" placeholder="re_••••••••••••" hint="API Key จาก resend.com → API Keys" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="ชื่อผู้ส่ง (From Name)" name="email_from_name" value={settings['email_from_name'] || ''} onChange={set}
                placeholder="SIAMSITE STORE" />
              <Field label="อีเมลผู้ส่ง (From)" name="email_from" value={settings['email_from'] || ''} onChange={set}
                type="email" placeholder="noreply@siamsite.shop" hint="ต้อง verify โดเมนใน Resend ก่อน" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Reply-To (ตัวเลือก)" name="email_reply_to" value={settings['email_reply_to'] || ''} onChange={set}
                type="email" placeholder="support@siamsite.shop" hint="เมื่อลูกค้ากดตอบกลับ จะส่งมาที่อีเมลนี้" />
              <Field label="อีเมล Support (โชว์ในอีเมล)" name="support_email" value={settings['support_email'] || ''} onChange={set}
                type="email" placeholder="support@siamsite.shop" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Facebook Page" name="support_facebook" value={settings['support_facebook'] || ''} onChange={set}
                placeholder="https://facebook.com/siamsite" hint="URL Facebook Page สำหรับติดต่อ support" />
              <Field label="Discord Server" name="support_discord" value={settings['support_discord'] || ''} onChange={set}
                placeholder="https://discord.gg/xxxx" hint="ลิงก์เชิญเข้า Discord server" />
            </div>
            <div className="pt-4 border-t border-border/60 space-y-3">
              <input
                type="email"
                className="w-full bg-secondary/30 border-2 border-transparent rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground placeholder:text-muted-foreground/40"
                placeholder="ส่งทดสอบไปอีเมลนี้ (เช่น your@email.com)"
                value={testEmailTo}
                onChange={e => setTestEmailTo(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={testEmail} disabled={testingEmail} className="w-full h-12 rounded-xl font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all gap-2 bg-white border-2">
                {testingEmail ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane text-primary text-base" />}
                ส่งอีเมลทดสอบ
              </Button>
            </div>
          </Section>

          {/* Cloudflare DNS */}
          <Section icon="fa-cloud" title="Cloudflare DNS" desc="Automated Record Orchestration" delay={0.6}>
            <InfoBanner variant="info">
              ระบบจะสร้าง DNS A record (DNS-only) อัตโนมัติทุกครั้งเมื่อ deploy ร้านค้าใหม่
              รองรับทั้ง <b>API Token</b> (แนะนำ — สิทธิ์ Zone:DNS:Edit เฉพาะ zone นี้) และ <b>Global API Key</b>
            </InfoBanner>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Cloudflare Email" name="cloudflare_email" value={settings['cloudflare_email'] || ''} onChange={set} type="email" placeholder="ใส่เฉพาะถ้าใช้ Global API Key" />
              <Field label="API Token หรือ Global API Key" name="cloudflare_api_key" value={settings['cloudflare_api_key'] || ''} onChange={set} type="password" placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Cloudflare Zone ID" name="cloudflare_zone_id" value={settings['cloudflare_zone_id'] || ''} onChange={set}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" hint="Zone ID ของโดเมนหลักใน Cloudflare" />
              <Field label="Server Public IP" name="server_ip" value={settings['server_ip'] || ''} onChange={set}
                placeholder="1.2.3.4" hint="DNS จะชี้ Subdomain มาที่ไอพีนี้อัตโนมัติ" />
            </div>
          </Section>
        </div>
      </div>

      {/* Floating Save Bar */}
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-0 right-0 z-50 px-6 pointer-events-none"
        >
          <div className="max-w-xl mx-auto pointer-events-auto">
            <div className="bg-slate-950/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-3 flex items-center justify-between gap-4">
               <div className="hidden md:flex items-center gap-3 ml-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary shadow-inner">
                    <i className="fas fa-microchip text-sm" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">System Engine</p>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Ready for updates</p>
                  </div>
               </div>
               <Button type="submit" disabled={saving} className="flex-1 h-12 rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 group relative overflow-hidden">
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check-double text-[10px]" />} 
                    {saving ? 'Saving...' : 'Commit Settings'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary group-hover:scale-110 transition-transform duration-500" />
               </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </form>
  );
}
