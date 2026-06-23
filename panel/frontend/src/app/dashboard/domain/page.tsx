'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type DomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed';

interface CustomDomain {
  customDomain: string | null;
  status: DomainStatus | null;
  cnameTarget: string;
}

/* ── CopyBtn ── */
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 text-[10px] font-bold uppercase tracking-widest cursor-pointer px-3 flex-shrink-0 ${copied ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' : ''}`}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} mr-1.5`} />
      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </Button>
  );
}

/* ── RecordRow: one DNS record field (label + value + copy) ── */
function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-border/50 last:border-0 last:pb-0 gap-3">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">{label}</span>
      <div className="flex items-center gap-3 min-w-0 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border">
        <span className="text-sm font-mono font-semibold truncate text-foreground">{value}</span>
        <div className="ml-2 pl-3 border-l border-border/50">
          <CopyBtn value={value} />
        </div>
      </div>
    </div>
  );
}

function DomainContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const subId = searchParams.get('id');

  const [data, setData] = useState<CustomDomain | null>(null);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/?auth=login'); }, [user, loading, router]);

  const fetchState = useCallback(async () => {
    if (!subId) return;
    try {
      const res = await api.get(`/api/subscriptions/${subId}/custom-domain`);
      setData(res.data.data);
    } catch {
      setError('ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึง');
    }
  }, [subId]);

  useEffect(() => { if (user && subId) fetchState(); }, [user, subId, fetchState]);

  // Auto-poll while verification is in progress.
  const status = data?.status ?? null;
  useEffect(() => {
    if (status !== 'pending_dns' && status !== 'pending_ssl') return;
    const t = setInterval(() => { verify(true); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, subId]);

  const submit = async () => {
    setFieldError('');
    if (!input.trim()) { setFieldError('กรุณากรอกโดเมน'); return; }
    try {
      setBusy(true);
      const res = await api.post(`/api/subscriptions/${subId}/custom-domain`, { hostname: input.trim() });
      setData(res.data.data);
      toast.success('สร้างคำขอโดเมนแล้ว เพิ่ม CNAME ตามขั้นตอนด้านล่าง');
    } catch (err: any) {
      setFieldError(err.response?.data?.error || 'ไม่สามารถเพิ่มโดเมนได้');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (silent = false) => {
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

  if (loading) return null;

  const host = data?.customDomain || '';
  const cname = data?.cnameTarget || 'custom.siamsite.shop';

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <Link href="/dashboard">
              <i className="fas fa-arrow-left text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">โดเมนของฉัน (Custom Domain)</h1>
            <p className="text-sm font-semibold text-muted-foreground mt-0.5">ใช้โดเมนของคุณเอง เช่น shop.yourdomain.com</p>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5 mb-8">
            <CardContent className="p-6 text-center">
              <i className="fas fa-circle-exclamation text-destructive text-3xl mb-3" />
              <p className="text-sm font-bold text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!data && !error && (
          <div className="py-20 text-center flex flex-col items-center">
            <i className="fas fa-spinner fa-spin text-primary text-3xl mb-4" />
            <p className="text-sm font-semibold text-muted-foreground">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* ── No domain yet: input form ── */}
            {!data.customDomain && (
              <Card className="shadow-sm border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <i className="fas fa-globe" />
                    </div>
                    เพิ่มโดเมนของคุณ
                  </CardTitle>
                  <CardDescription className="font-medium mt-1">
                    รองรับเฉพาะ subdomain (เช่น shop.yourdomain.com) ยังไม่รองรับโดเมนหลัก
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    value={input}
                    onChange={e => { setInput(e.target.value); setFieldError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="shop.yourdomain.com"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {fieldError && (
                    <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <i className="fas fa-circle-exclamation" /> {fieldError}
                    </p>
                  )}
                  <Button onClick={submit} disabled={busy} className="cursor-pointer font-bold rounded-full">
                    {busy ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-plus mr-2" />}
                    เพิ่มโดเมน
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── pending_dns: add the CNAME ── */}
            {data.customDomain && data.status === 'pending_dns' && (
              <Card className="shadow-sm border-amber-500/30 bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                    เพิ่ม CNAME ที่ผู้ให้บริการโดเมน (z.com / Hostinger)
                  </CardTitle>
                  <CardDescription className="font-medium mt-1">
                    ไปที่หน้า DNS / Zone Editor ของโดเมน เพิ่ม record ด้านล่าง แล้วกดตรวจสอบ (DNS อาจใช้เวลาสักครู่)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border bg-background px-4">
                    <RecordRow label="Type" value="CNAME" />
                    <RecordRow label="Name / Host" value={host} />
                    <RecordRow label="Value / Target" value={cname} />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mt-3">
                    หมายเหตุ: บางผู้ให้บริการช่อง Name ให้กรอกเฉพาะส่วนหน้าโดเมน (เช่น <code>shop</code>) ไม่ใช่โดเมนเต็ม
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={() => verify(false)} disabled={busy} className="cursor-pointer font-bold rounded-full">
                      {busy ? <i className="fas fa-spinner fa-spin mr-2" /> : <i className="fas fa-rotate-right mr-2" />}
                      ตรวจสอบสถานะ
                    </Button>
                    <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                      <i className="fas fa-trash mr-2" /> ลบโดเมน
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── pending_ssl: issuing cert ── */}
            {data.customDomain && data.status === 'pending_ssl' && (
              <Card className="shadow-sm border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-6 flex items-center gap-4">
                  <i className="fas fa-spinner fa-spin text-blue-500 text-2xl" />
                  <div>
                    <p className="text-sm font-bold text-foreground">กำลังออกใบรับรอง (SSL) สำหรับ {host}</p>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">พบ CNAME แล้ว รอสักครู่ ระบบจะเปิดใช้งานอัตโนมัติ</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── active ── */}
            {data.customDomain && data.status === 'active' && (
              <Card className="shadow-sm border-emerald-500/30 bg-emerald-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                      <i className="fas fa-circle-check" />
                    </div>
                    โดเมนพร้อมใช้งาน
                    <Badge variant="success" className="font-bold uppercase tracking-widest ml-1">Live</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RecordRow label="URL" value={`https://${host}`} />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild className="cursor-pointer font-bold rounded-full">
                      <a href={`https://${host}`} target="_blank" rel="noopener noreferrer">
                        <i className="fas fa-arrow-up-right-from-square mr-2" /> เปิดเว็บร้านค้า
                      </a>
                    </Button>
                    <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                      <i className="fas fa-trash mr-2" /> ลบโดเมน
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── failed ── */}
            {data.customDomain && data.status === 'failed' && (
              <Card className="shadow-sm border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                      <i className="fas fa-circle-exclamation" />
                    </div>
                    ตั้งค่าโดเมนไม่สำเร็จ
                  </CardTitle>
                  <CardDescription className="font-medium mt-1">
                    CNAME อาจยังไม่ถูกต้องหรือยังไม่ได้เพิ่ม ตรวจสอบว่า {host} ชี้ไปที่ {cname} แล้วลองอีกครั้ง
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button onClick={() => verify(false)} disabled={busy} className="cursor-pointer font-bold rounded-full">
                    <i className="fas fa-rotate-right mr-2" /> ตรวจสอบอีกครั้ง
                  </Button>
                  <Button variant="outline" onClick={remove} disabled={busy} className="cursor-pointer font-bold rounded-full text-destructive border-destructive/30">
                    <i className="fas fa-trash mr-2" /> ลบและลองใหม่
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DomainPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    }>
      <DomainContent />
    </Suspense>
  );
}
