'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';

/**
 * Per-registrar CNAME setup guide. Pure presentational: given the customer's chosen
 * hostname and our CNAME target, it shows the exact fields to enter at each registrar,
 * with the registrar's own field labels and gotchas. A generic fallback covers the rest.
 */

interface Registrar {
  id: string;
  label: string;
  /** Where in that registrar's UI to find the DNS editor. */
  path: string;
  /** Field labels that registrar uses, in (label -> which value) form. */
  fields: { label: string; value: 'type' | 'name' | 'target'; hint?: string };
  /** Registrar-specific warning/note, if any. */
  note?: string;
  warn?: boolean;
}

const REGISTRARS: Registrar[] = [
  { id: 'generic',    label: 'ทั่วไป / อื่นๆ', path: 'เข้าหน้าจัดการ DNS / Zone Editor ของผู้ให้บริการโดเมน แล้วเพิ่ม record ใหม่',
    fields: { label: 'Host/Name', value: 'name' },
    note: 'บางค่ายช่อง Name ให้กรอกเฉพาะส่วนหน้า (เช่น shop) ไม่ใช่โดเมนเต็ม' },
  { id: 'zcom',       label: 'z.com (GMO)', path: 'เข้า z.com → DNS設定 / DNS Settings ของโดเมน → เพิ่ม record',
    fields: { label: 'ホスト名 (Host)', value: 'name', hint: 'กรอกเฉพาะส่วนหน้า เช่น shop' } },
  { id: 'hostinger',  label: 'Hostinger', path: 'hPanel → Domains → DNS / Nameservers → Manage DNS records → Add record',
    fields: { label: 'Name', value: 'name', hint: 'กรอกเฉพาะส่วนหน้า เช่น shop, TTL = 14400' } },
  { id: 'cloudflare', label: 'Cloudflare', path: 'Cloudflare → เลือกโดเมน → DNS → Records → Add record',
    fields: { label: 'Name', value: 'name' },
    warn: true,
    note: 'สำคัญ: ตั้ง Proxy status = "DNS only" (เมฆสีเทา) ห้ามเป็นเมฆสีส้ม ไม่งั้นจะ error 1014 / SSL วน' },
  { id: 'godaddy',    label: 'GoDaddy', path: 'GoDaddy → My Products → DNS → Add → CNAME',
    fields: { label: 'Name', value: 'name', hint: 'กรอกเฉพาะส่วนหน้า เช่น shop' } },
  { id: 'namecheap',  label: 'Namecheap', path: 'Namecheap → Domain List → Manage → Advanced DNS → Add New Record → CNAME Record',
    fields: { label: 'Host', value: 'name', hint: 'กรอกเฉพาะส่วนหน้า เช่น shop' } },
];

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border cursor-pointer flex-shrink-0 transition-colors ${copied ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' : 'border-border text-muted-foreground hover:bg-secondary'}`}
    >
      <Icon name={copied ? 'check' : 'copy'} className={`mr-1`} />{copied ? 'คัดลอก' : 'คัดลอก'}
    </button>
  );
}

function ValueRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground/80 mt-0.5">{hint}</div>}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <code className="text-sm font-mono font-semibold text-foreground truncate bg-secondary/40 px-2 py-1 rounded">{value}</code>
        <CopyBtn value={value} />
      </div>
    </div>
  );
}

/** Subdomain portion the user types in the "Name/Host" field (everything before the
 *  registrable domain). For shop.yourdomain.com -> "shop". */
function nameLabel(host: string): string {
  const parts = host.split('.');
  return parts.length > 2 ? parts.slice(0, -2).join('.') : host;
}

export default function RegistrarGuide({ host, cname }: { host: string; cname: string }) {
  const [sel, setSel] = useState('generic');
  const reg = REGISTRARS.find(r => r.id === sel) || REGISTRARS[0];
  const name = nameLabel(host);

  return (
    <div className="space-y-3">
      {/* registrar selector */}
      <div className="flex flex-wrap gap-1.5">
        {REGISTRARS.map(r => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSel(r.id)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${sel === r.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-muted-foreground">{reg.path}</p>

      {/* the three values */}
      <div className="rounded-xl border border-border bg-background px-4">
        <ValueRow label="Type" value="CNAME" />
        <ValueRow label={reg.fields.label} value={name} hint={reg.fields.hint} />
        <ValueRow label="Value / Target / Points to" value={cname} />
      </div>

      {reg.note && (
        <div className={`flex items-start gap-2 text-xs font-semibold rounded-lg px-3 py-2 ${reg.warn ? 'bg-amber-500/10 text-amber-700 border border-amber-500/30' : 'bg-secondary/50 text-muted-foreground'}`}>
          <Icon name={reg.warn ? 'triangle-exclamation' : 'circle-info'} className={`mt-0.5`} />
          <span>{reg.note}</span>
        </div>
      )}

      {sel !== 'generic' && (
        <button type="button" onClick={() => setSel('generic')} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
          ไม่เจอเมนูตามนี้? ดูแบบทั่วไป
        </button>
      )}
    </div>
  );
}
