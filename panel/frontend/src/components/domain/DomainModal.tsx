'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RegistrarGuide from './RegistrarGuide';
import DomainStepper from './DomainStepper';
import { Icon, type IconName } from '@/components/ui/icon';

type DomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed';

interface CustomDomain {
  customDomain: string | null;
  status: DomainStatus | null;
  cnameTarget: string;
  shopDomain?: string; // the xxx.siamsite.shop fallback (if API returns it)
}

const SIAMSITE = 'siamsite.shop';
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOSTNAME_RE = new RegExp(`^(?:${LABEL}\\.)+${LABEL}$`);

/** Client-side mirror of the server validateCustomHostname (UX only; server is authoritative). */
function validateClient(raw: string): { value: string } | { error: string; apex?: boolean } {
  const value = (raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\s+/g, '');
  if (!value) return { error: 'กรุณากรอกโดเมน' };
  if (!HOSTNAME_RE.test(value)) return { error: 'รูปแบบโดเมนไม่ถูกต้อง (เช่น shop.yourdomain.com)' };
  if (value.split('.').length < 3) return { error: 'ยังไม่รองรับโดเมนหลัก กรุณาใส่ subdomain เช่น shop.yourdomain.com', apex: true };
  if (value === SIAMSITE || value.endsWith(`.${SIAMSITE}`)) return { error: `ใช้โดเมน ${SIAMSITE} เป็นโดเมนของตัวเองไม่ได้` };
  return { value };
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border cursor-pointer flex-shrink-0 transition-colors ${copied ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
      <Icon name={copied ? 'check' : 'copy'} className={`mr-1`} />{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </button>
  );
}

export default function DomainModal({ subId, isOpen, onClose }: { subId: number | null; isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<CustomDomain | null>(null);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchState = useCallback(async () => {
    if (!subId) return;
    setError('');
    try {
      const res = await api.get(`/api/subscriptions/${subId}/custom-domain`);
      setData(res.data.data);
    } catch {
      setError('ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึง');
    }
  }, [subId]);

  // Load on open; reset on close.
  useEffect(() => {
    if (isOpen && subId) { setData(null); setInput(''); setFieldError(''); fetchState(); }
  }, [isOpen, subId, fetchState]);

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const status = data?.status ?? null;

  const verify = useCallback(async (silent = false) => {
    if (!subId) return;
    try {
      if (!silent) setBusy(true);
      const res = await api.post(`/api/subscriptions/${subId}/custom-domain/verify`);
      setData(d => d ? { ...d, status: res.data.data.status } : d);
      if (!silent) {
        if (res.data.data.status === 'active') toast.success('โดเมนพร้อมใช้งานแล้ว');
        else toast.success('ยังไม่พบ CNAME รอสักครู่แล้วลองอีกครั้ง');
      }
    } catch (err: any) {
      if (!silent) toast.error(err.response?.data?.error || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      if (!silent) setBusy(false);
    }
  }, [subId, toast]);

  // Auto-poll while verification is in progress.
  useEffect(() => {
    if (status !== 'pending_dns' && status !== 'pending_ssl') return;
    const t = setInterval(() => verify(true), 10000);
    return () => clearInterval(t);
  }, [status, verify]);

  const submit = async () => {
    setFieldError('');
    const v = validateClient(input);
    if ('error' in v) { setFieldError(v.error); return; }
    try {
      setBusy(true);
      const res = await api.post(`/api/subscriptions/${subId}/custom-domain`, { hostname: v.value });
      setData(res.data.data);
      toast.success('สร้างคำขอโดเมนแล้ว เพิ่ม CNAME ตามขั้นตอนด้านล่าง');
    } catch (err: any) {
      setFieldError(err.response?.data?.error || 'ไม่สามารถเพิ่มโดเมนได้');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('ยืนยันลบโดเมนนี้? เว็บจะกลับไปใช้โดเมน siamsite เดิม')) return;
    try {
      setBusy(true);
      await api.delete(`/api/subscriptions/${subId}/custom-domain`);
      setData(d => d ? { ...d, customDomain: null, status: null } : d);
      setInput('');
      toast.success('ลบโดเมนแล้ว');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ลบโดเมนไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const host = data?.customDomain || '';
  const cname = data?.cnameTarget || 'custom.siamsite.shop';
  const live = validateClient(input);
  const previewOk = !('error' in live);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 overflow-y-auto bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-2xl my-4 bg-background border border-border rounded-2xl shadow-2xl"
            initial={{ scale: 0.96, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon name="globe" className="text-lg" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">โดเมนของฉัน (Custom Domain)</h2>
                  <p className="text-xs font-semibold text-muted-foreground">ใช้โดเมนของคุณเอง เช่น shop.yourdomain.com</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary cursor-pointer flex-shrink-0">
                <Icon name="xmark" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Stepper */}
              <DomainStepper status={status} />

              {error && (
                <div className="text-center py-8">
                  <Icon name="circle-exclamation" className="text-destructive text-2xl mb-2" />
                  <p className="text-sm font-bold text-destructive">{error}</p>
                </div>
              )}

              {!data && !error && (
                <div className="text-center py-10">
                  <Icon name="spinner" className="text-primary text-2xl animate-spin" />
                </div>
              )}

              {data && (
                <>
                  {/* No domain yet: input + guidance */}
                  {!data.customDomain && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Icon name="lightbulb" className="text-amber-500" />
                        แนะนำให้ใช้ subdomain เช่น <code className="font-mono">shop.</code> / <code className="font-mono">store.</code> / <code className="font-mono">www.</code>
                      </div>
                      <input
                        value={input}
                        onChange={e => { setInput(e.target.value); setFieldError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                        placeholder="shop.yourdomain.com"
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {/* live preview / validation */}
                      {input && previewOk && (
                        <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                          <Icon name="circle-check" /> ลูกค้าจะเข้าผ่าน https://{(live as { value: string }).value}
                        </p>
                      )}
                      {(fieldError || (input && !previewOk)) && (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                            <Icon name="circle-exclamation" /> {fieldError || (live as { error: string }).error}
                          </p>
                          {!fieldError && (live as { apex?: boolean }).apex && (
                            <button type="button" onClick={() => setInput(`shop.${input.trim().toLowerCase()}`)}
                              className="text-xs font-bold text-primary hover:underline cursor-pointer whitespace-nowrap">
                              เติม shop. ให้
                            </button>
                          )}
                        </div>
                      )}
                      <Button onClick={submit} disabled={busy} className="cursor-pointer font-bold rounded-full">
                        {busy ? <Icon name="spinner" className="mr-2 animate-spin" /> : <Icon name="plus" className="mr-2" />} เพิ่มโดเมน
                      </Button>
                    </div>
                  )}

                  {/* pending_dns: registrar guide */}
                  {data.customDomain && data.status === 'pending_dns' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <p className="text-sm font-bold text-foreground mb-1">
                          <Icon name="circle-1" className="mr-1.5 text-amber-600" /> เพิ่ม CNAME ที่ผู้ให้บริการโดเมนของคุณ
                        </p>
                        <p className="text-xs font-medium text-muted-foreground">เลือกค่ายของคุณด้านล่าง แล้วทำตามขั้นตอน (DNS อาจใช้เวลา 5-30 นาที)</p>
                      </div>
                      <RegistrarGuide host={host} cname={cname} />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button onClick={() => verify(false)} disabled={busy} className="cursor-pointer font-bold rounded-full">
                          {busy ? <Icon name="spinner" className="mr-2 animate-spin" /> : <Icon name="rotate-right" className="mr-2" />} ตรวจสอบสถานะ
                        </Button>
                        <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                          <Icon name="trash" className="mr-2" /> ลบโดเมน
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* pending_ssl */}
                  {data.customDomain && data.status === 'pending_ssl' && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 flex items-center gap-4">
                      <Icon name="spinner" className="text-blue-500 text-xl animate-spin" />
                      <div>
                        <p className="text-sm font-bold text-foreground">กำลังออกใบรับรอง (SSL) สำหรับ {host}</p>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">พบ CNAME แล้ว รอสักครู่ ระบบจะเปิดใช้งานอัตโนมัติ</p>
                      </div>
                    </div>
                  )}

                  {/* active */}
                  {data.customDomain && data.status === 'active' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="circle-check" className="text-emerald-600" />
                          <span className="text-sm font-bold text-foreground">โดเมนพร้อมใช้งาน</span>
                          <Badge variant="success" className="font-bold uppercase tracking-widest ml-1">Live</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-background rounded-lg border border-border px-3 py-2">
                          <code className="text-sm font-mono font-semibold truncate">https://{host}</code>
                          <CopyBtn value={`https://${host}`} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild className="cursor-pointer font-bold rounded-full">
                          <a href={`https://${host}`} target="_blank" rel="noopener noreferrer">
                            <Icon name="arrow-up-right-from-square" className="mr-2" /> เปิดเว็บร้านค้า
                          </a>
                        </Button>
                        <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                          <Icon name="trash" className="mr-2" /> ลบโดเมน
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium flex items-start gap-1.5">
                        <Icon name="circle-info" className="mt-0.5" />
                        หากร้านหมดอายุ โดเมนนี้จะหยุดทำงานชั่วคราว ต่ออายุแล้วกลับมาทำงานเองอัตโนมัติ
                      </p>
                    </div>
                  )}

                  {/* failed */}
                  {data.customDomain && data.status === 'failed' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                        <p className="text-sm font-bold text-destructive mb-1"><Icon name="circle-exclamation" className="mr-1.5" /> ตั้งค่าโดเมนไม่สำเร็จ</p>
                        <p className="text-xs font-medium text-muted-foreground">ตรวจสอบว่า {host} ชี้ไปที่ {cname} แล้วลองอีกครั้ง</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => verify(false)} disabled={busy} className="cursor-pointer font-bold rounded-full">
                          <Icon name="rotate-right" className="mr-2" /> ตรวจสอบอีกครั้ง
                        </Button>
                        <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                          <Icon name="trash" className="mr-2" /> ลบและลองใหม่
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
