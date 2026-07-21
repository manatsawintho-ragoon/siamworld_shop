'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { trackFeature } from '@/lib/track';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminActionModal, { AdminAction } from '@/components/credentials/AdminActionModal';
import { Icon, type IconName } from '@/components/ui/icon';

interface Credentials {
  shopName: string; domain: string;
  setupUrl: string; mcIp?: string;
}

/* ── CopyBtn ── */
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 text-[12px] font-medium cursor-pointer px-3 flex-shrink-0 ${copied ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' : ''}`}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      <Icon name={copied ? 'check' : 'copy'} className={`mr-1.5`} />
      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </Button>
  );
}

/* ── CredRow ── */
function CredRow({ label, value, icon, secret }: { label: string; value: string | number; icon?: IconName; secret?: boolean }) {
  const [show, setShow] = useState(false);
  const display = secret && !show ? '••••••••••••' : String(value);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-border/50 last:border-0 last:pb-0 gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        {icon && <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
          <Icon name={icon} className="text-sm" />
        </div>}
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      {/* The value is the thing people came here to read and copy, so it is set
          in mono at a size that survives being read off a phone. */}
      <div className="flex items-center gap-3 min-w-0 bg-secondary/40 px-3 py-2 rounded-lg border border-border">
        <span className={`text-[14px] font-mono truncate ${secret && !show ? 'text-muted-foreground tracking-widest' : 'text-foreground'}`}>{display}</span>
        {secret && (
          <button onClick={() => setShow(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 cursor-pointer">
            <Icon name={show ? 'eye-slash' : 'eye'} className={`text-xs`} />
          </button>
        )}
        <div className="ml-2 pl-3 border-l border-border/50">
          <CopyBtn value={String(value)} />
        </div>
      </div>
    </div>
  );
}

/* ── Shop web-admin credential ── */
interface ShopAdmin {
  username: string;
  password: string;
  rotating?: boolean;
  nextPassword?: string;
  expiresAt?: number;    // epoch ms (server clock) — informational only
  remainingMs?: number;  // ms left in the window; used to anchor a local deadline
  windowSeconds?: number;
}

/** Password row for ROTATING mode: eye toggle + live countdown bar. When the
 *  window passes it shows the pre-fetched next password immediately and asks the
 *  parent to refetch the following window's values (so there is no blank gap). */
function CountdownPasswordRow({ cred, onExpire }: { cred: ShopAdmin; onExpire: () => void }) {
  const [show, setShow] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);
  const total = (cred.windowSeconds ?? 60) * 1000;
  // Anchor the deadline in the CLIENT's clock from the server's relative
  // remainingMs, so an owner whose PC clock is skewed still gets a correct bar.
  const deadlineRef = useRef<number>(Date.now() + (cred.remainingMs ?? total));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  // A fresh credential arrived → re-anchor the deadline + re-arm the refetch guard.
  useEffect(() => {
    deadlineRef.current = Date.now() + (cred.remainingMs ?? total);
    firedRef.current = false;
  }, [cred.remainingMs, cred.password, total]);

  const expired = now >= deadlineRef.current;
  const remaining = Math.max(0, deadlineRef.current - now);
  const secondsLeft = Math.max(0, Math.ceil(remaining / 1000));
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const value = expired && cred.nextPassword ? cred.nextPassword : cred.password;

  useEffect(() => {
    if (expired && !firedRef.current) { firedRef.current = true; onExpire(); }
  }, [expired, onExpire]);

  const barColor = secondsLeft <= 10 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="py-3 border-b border-border/50 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
            <Icon name="key" className="text-sm" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">รหัสผ่าน</span>
        </div>
        <div className="flex items-center gap-3 min-w-0 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border">
          <span className={`text-sm font-semibold truncate font-mono ${show ? 'text-foreground' : 'text-muted-foreground'}`}>
            {show ? value : '••••••••••'}
          </span>
          <button onClick={() => setShow(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 cursor-pointer">
            <Icon name={show ? 'eye-slash' : 'eye'} className={`text-xs`} />
          </button>
          <div className="ml-2 pl-3 border-l border-border/50">
            <CopyBtn value={value} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-300 ease-linear`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums w-28 text-right">
          เปลี่ยนใน {secondsLeft} วิ
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground font-medium mt-2">
        <Icon name="rotate" className="mr-1.5" />รหัสนี้เปลี่ยนทุก 1 นาทีเพื่อความปลอดภัย คัดลอกแล้วรีบเข้าสู่ระบบ
      </p>
    </div>
  );
}

/** The whole "บัญชีแอดมินเว็บ" card. Self-contained: handles loading, error +
 *  retry, rotating vs custom display, and the action buttons per mode. */
function AdminCredentialCard({ cred, error, busy, onRefetch, onRegen, onSetPw }: {
  cred: ShopAdmin | null; error: boolean; busy: boolean;
  onRefetch: () => void; onRegen: () => void; onSetPw: () => void;
}) {
  return (
    <Card className="shadow-sm border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Icon name="user-shield" />
          </div>
          บัญชีแอดมินเว็บ
        </CardTitle>
        <CardDescription className="font-semibold">
          ใช้เข้าหน้าจัดการร้าน (admin) แยกต่างหากจากรหัสในเกม รีเซ็ตได้ทุกเมื่อโดยไม่กระทบรหัส Minecraft
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {error ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              <Icon name="triangle-exclamation" className="mr-2 text-amber-500" />โหลดบัญชีแอดมินไม่สำเร็จ
            </p>
            <Button variant="outline" onClick={onRefetch} className="rounded-full font-medium cursor-pointer">
              <Icon name="rotate-right" className="mr-2" />ลองใหม่
            </Button>
          </div>
        ) : !cred ? (
          <div className="py-6 text-center text-sm font-semibold text-muted-foreground">
            <Icon name="spinner" className="mr-2 animate-spin" />กำลังโหลด...
          </div>
        ) : (
          <>
            <CredRow label="ชื่อผู้ใช้" value={cred.username} icon="user" />
            {cred.rotating ? (
              <CountdownPasswordRow cred={cred} onExpire={onRefetch} />
            ) : (
              <CredRow label="รหัสผ่าน" value={cred.password} icon="key" secret />
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {cred.rotating ? (
                <Button onClick={onSetPw} disabled={busy} className="cursor-pointer font-medium rounded-full">
                  <Icon name="lock" className="mr-2" /> ตั้งรหัสถาวรของคุณเอง
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onSetPw} disabled={busy} className="cursor-pointer font-medium rounded-full">
                    <Icon name="pen" className="mr-2" /> เปลี่ยนรหัส
                  </Button>
                  <Button variant="outline" onClick={onRegen} disabled={busy} className="cursor-pointer font-medium rounded-full">
                    <Icon name="rotate" className="mr-2" /> กลับไปใช้รหัสหมุน
                  </Button>
                </>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground font-medium mt-3">
              <Icon name="circle-info" className="mr-1.5" />
              {cred.rotating
                ? 'แนะนำ: ตั้งรหัสถาวรของคุณเอง จะได้เข้าสู่ระบบได้โดยไม่ต้องเปิดหน้านี้ดูรหัสทุกครั้ง'
                : 'รหัสนี้เป็นรหัสถาวรที่คุณตั้งเอง ใช้เข้าสู่ระบบได้ตลอด'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── StepCard ── */
function StepCard({ n, title, children, done, warn }: { n: number; title: string; children?: React.ReactNode; done?: boolean; warn?: boolean }) {
  return (
    <Card className={`border shadow-none transition-all ${done ? 'bg-emerald-500/5 border-emerald-500/30' : warn ? 'bg-amber-500/5 border-amber-500/30' : 'bg-background border-border'}`}>
      <CardContent className="p-5 flex gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5 ${done ? 'bg-emerald-500 text-white' : warn ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
          {done ? <Icon name="check" className="text-xs" /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium tracking-tight mb-2 ${done ? 'text-emerald-600 dark:text-emerald-400' : warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{title}</p>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── CodeBlock ── */
function CodeBlock({ code, language = 'yaml' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-border mt-2 bg-slate-950">
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-400">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-[12px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer">
          <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs leading-relaxed text-slate-300 overflow-x-auto whitespace-pre font-mono">{code}</pre>
    </div>
  );
}


/* ── CommandCard: label + description + code + big copy button ── */
function CommandCard({ label, desc, code, lang = 'bash', tone = 'neutral' }: {
  label: string; desc: string; code: string; lang?: string;
  tone?: 'neutral' | 'critical' | 'sql' | 'yaml';
}) {
  const [copied, setCopied] = useState(false);
  const accent =
    tone === 'critical' ? 'border-red-500/40 bg-red-500/5'
    : tone === 'sql'    ? 'border-purple-500/40 bg-purple-500/5'
    : tone === 'yaml'   ? 'border-amber-500/40 bg-amber-500/5'
    :                     'border-border bg-background';
  return (
    <div className={`rounded-xl border-2 overflow-hidden ${accent}`}>
      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-border/40">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-tight">{label}</p>
          <p className="text-[13px] text-muted-foreground font-medium mt-0.5 leading-snug">{desc}</p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
            copied ? 'bg-emerald-500 text-white' : 'bg-foreground text-background hover:opacity-90'
          }`}
        >
          <Icon name={copied ? 'check' : 'copy'} className={`text-xs`} />
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่ง'}
        </button>
      </div>
      <pre className="px-4 py-3 text-[12px] leading-relaxed text-slate-200 bg-slate-950 overflow-x-auto whitespace-pre font-mono">
        <span className="text-[12px] text-slate-500 font-sans block mb-1">{lang}</span>
        {code}
      </pre>
    </div>
  );
}

function CredContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const subId = searchParams.get('id');
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [sub, setSub] = useState<any>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'none' | 'bridge'>('none');
  const [osType, setOsType] = useState<'windows' | 'linux'>('linux');
  const [bridgeToken, setBridgeToken] = useState<{ token: string; prefix: string } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{ online: boolean; pluginVersion: string | null; tokenPrefix: string | null } | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [setupTrack, setSetupTrack] = useState<'have' | 'new'>('have');
  const [setupAuthType, setSetupAuthType] = useState<'authme' | 'nlogin'>('authme');
  const [shopAdmin, setShopAdmin] = useState<ShopAdmin | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);

  useEffect(() => { if (!loading && !user) router.push('/?auth=login'); }, [user, loading, router]);
  useEffect(() => {
    if (!user || !subId) return;
    const fetchAll = async () => {
      try {
        const credEndpoint = user.role === 'admin'
          ? `/api/admin/subscriptions/${subId}/credentials`
          : `/api/subscriptions/${subId}/credentials`;
        const subEndpoint = user.role === 'admin' ? null : `/api/subscriptions/${subId}`;
        
        const [credRes, subRes] = await Promise.all([
          api.get(credEndpoint),
          subEndpoint ? api.get(subEndpoint) : Promise.resolve(null)
        ]);
        
        setCreds(credRes.data);
        if (subRes) setSub(subRes.data.subscription);
      } catch (err) {
        setError('ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึง');
      }
    };
    fetchAll();
  }, [user, subId]);

  const handleAction = async (action: string) => {
    try {
      setActionLoading(true);
      await api.post(`/api/subscriptions/${subId}/action`, { action });
      toast.success(`สั่งการ ${action} เรียบร้อยแล้ว รอสักครู่...`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogs = async () => {
    try {
      setActionLoading(true);
      const res = await api.get(`/api/subscriptions/${subId}/logs`);
      setLogs(res.data.logs);
      setShowLogs(true);
    } catch (err: any) {
      toast.error('ไม่สามารถดึง Logs ได้');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchBridgeStatus = async () => {
    if (!subId) return;
    try {
      const res = await api.get(`/api/bridge/${subId}/status`);
      setBridgeStatus({
        online: res.data.online,
        pluginVersion: res.data.pluginVersion,
        tokenPrefix: res.data.tokenPrefix,
      });
    } catch {
      setBridgeStatus({ online: false, pluginVersion: null, tokenPrefix: null });
    }
  };

  useEffect(() => {
    if (mode === 'bridge') fetchBridgeStatus();
  }, [mode, subId]);

  const issueBridgeToken = async () => {
    try {
      const res = await api.post(`/api/bridge/${subId}/token`);
      setBridgeToken({ token: res.data.token, prefix: res.data.prefix });
      await fetchBridgeStatus();
      toast.success('สร้าง token ใหม่แล้ว คัดลอกไปใส่ใน config.yml ของปลั๊กอิน');
      if (res.data.provision?.rebuildStarted) {
        toast.success('กำลังตั้งค่าและ rebuild เว็บไซต์ของคุณ (~30 วินาที)');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ไม่สามารถสร้าง token ได้');
    }
  };

  const revokeBridgeToken = async () => {
    if (!confirm('ยืนยันยกเลิก token? ปลั๊กอินจะถูกตัดการเชื่อมต่อทันที')) return;
    try {
      await api.delete(`/api/bridge/${subId}/token`);
      setBridgeToken(null);
      await fetchBridgeStatus();
      toast.success('ยกเลิก token แล้ว');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ไม่สามารถยกเลิก token ได้');
    }
  };

  const toggleAutoRenew = async () => {
    try {
      const newVal = !sub.auto_renew;
      await api.patch(`/api/subscriptions/${subId}/auto-renew`, { autoRenew: newVal });
      setSub({ ...sub, auto_renew: newVal });
      toast.success(newVal ? 'เปิดต่ออายุอัตโนมัติแล้ว' : 'ปิดต่ออายุอัตโนมัติแล้ว');
    } catch (err: any) {
      toast.error('ไม่สามารถเปลี่ยนการตั้งค่าได้');
    }
  };

  // ── Shop web-admin credential ──
  // Customers see their own; admins (operators) can inspect/manage any shop
  // (backend bypasses the owner check for role=admin on the shop-admin routes).
  const fetchShopAdmin = useCallback(async () => {
    if (!user || !subId) return;
    try {
      setAdminError(false);
      const res = await api.get(`/api/subscriptions/${subId}/shop-admin`);
      setShopAdmin(res.data);
    } catch {
      setAdminError(true);
    }
  }, [user, subId]);

  useEffect(() => { fetchShopAdmin(); }, [fetchShopAdmin]);

  // Modal-driven: the card buttons open AdminActionModal which calls these on confirm.
  const regenAdmin = async () => {
    try {
      setAdminLoading(true);
      const res = await api.post(`/api/subscriptions/${subId}/shop-admin/regenerate`);
      trackFeature('credentials_regenerate');
      setShopAdmin(res.data);
      toast.success('สุ่มรหัสแอดมินใหม่แล้ว');
      setAdminAction(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ไม่สามารถสุ่มรหัสใหม่ได้');
    } finally {
      setAdminLoading(false);
    }
  };

  const setAdminPw = async (pw?: string) => {
    if (!pw || pw.length < 6) { toast.error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'); return; }
    try {
      setAdminLoading(true);
      const res = await api.post(`/api/subscriptions/${subId}/shop-admin/password`, { password: pw });
      setShopAdmin(res.data);
      toast.success('ตั้งรหัสแอดมินใหม่แล้ว');
      setAdminAction(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'ไม่สามารถตั้งรหัสได้');
    } finally {
      setAdminLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── หัวข้อ ── */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <Link href="/dashboard">
              <Icon name="arrow-left" className="text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">ข้อมูลร้านค้า</h1>
            {creds && <p className="text-sm font-semibold text-muted-foreground mt-0.5">{creds.domain}</p>}
          </div>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5 mb-8">
            <CardContent className="p-6 text-center">
              <Icon name="circle-exclamation" className="text-destructive text-3xl mb-3" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!creds && !error && (
          <div className="py-20 text-center flex flex-col items-center">
            <Icon name="spinner" className="text-primary text-3xl mb-4 animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {creds && (
          <div className="space-y-6">

            {/* ── ข้อมูลเว็บไซต์ ── */}
            <Card className="shadow-sm border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="store" />
                  </div>
                  รายละเอียดเว็บไซต์
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <CredRow label="ชื่อร้าน" value={creds.shopName} icon="font" />
                <CredRow label="URL เว็บไซต์" value={`https://${creds.domain}`} icon="globe" />
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="cursor-pointer font-medium rounded-full">
                    <a href={`https://${creds.domain}`} target="_blank" rel="noopener noreferrer">
                      <Icon name="arrow-up-right-from-square" className="mr-2" /> เปิดเว็บร้านค้า
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="cursor-pointer font-medium rounded-full">
                    <a href={creds.setupUrl} target="_blank" rel="noopener noreferrer">
                      <Icon name="wand-magic-sparkles" className="mr-2" /> เริ่มตั้งค่าเว็บครั้งแรก
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── บัญชีแอดมินเว็บ (Customer + Admin/operator) ── */}
            <AdminCredentialCard
              cred={shopAdmin}
              error={adminError}
              busy={adminLoading}
              onRefetch={fetchShopAdmin}
              onRegen={() => setAdminAction('regen')}
              onSetPw={() => setAdminAction('setpw')}
            />

            {/* ── การจัดการเซิร์ฟเวอร์ (เฉพาะ Customer) ── */}
            {sub && (
              <Card className="shadow-sm border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Icon name="server" />
                    </div>
                    การจัดการเซิร์ฟเวอร์
                  </CardTitle>
                  
                  {/* Auto-renew toggle */}
                  <div className="flex items-center gap-3 bg-secondary/50 px-3 py-1.5 rounded-xl border border-border">
                    <span className="text-xs font-medium text-muted-foreground">ต่ออายุอัตโนมัติ</span>
                    <button
                      onClick={toggleAutoRenew}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${sub.auto_renew ? 'bg-emerald-500' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${sub.auto_renew ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleAction('start')} disabled={actionLoading} className="cursor-pointer font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white">
                      <Icon name="play" className="mr-1.5" /> เริ่มเซิร์ฟเวอร์
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('restart')} disabled={actionLoading} className="cursor-pointer font-medium text-amber-600 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500 hover:text-white">
                      <Icon name="rotate-right" className="mr-1.5" /> รีสตาร์ท
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('stop')} disabled={actionLoading} className="cursor-pointer font-medium text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive hover:text-white">
                      <Icon name="stop" className="mr-1.5" /> หยุดเซิร์ฟเวอร์
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleLogs} disabled={actionLoading} className="cursor-pointer font-medium ml-auto">
                      <Icon name="terminal" className="mr-1.5" /> ดู Logs ของระบบ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Logs Modal */}
            {showLogs && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogs(false)}>
                <div className="bg-slate-950 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Icon name="terminal" className="text-blue-400" /> Container Logs
                    </h3>
                    <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">
                      <Icon name="times" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 bg-slate-950">
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">{logs}</pre>
                  </div>
                </div>
              </div>
            )}

            {/* ── เลือกวิธีเชื่อมต่อ AuthMe ── */}
            <Card className="shadow-sm border-border">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                        <Icon name="code-branch" />
                      </div>
                      วิธีเชื่อมต่อฐานข้อมูลเกม (AuthMe / nLogin)
                    </CardTitle>
                    <CardDescription className="mt-1 font-semibold">การเชื่อมต่อเป็น <strong>ทางเลือกเสริม</strong> Bridge รองรับทั้ง <strong>AuthMe</strong> และ <strong>nLogin</strong> ปลั๊กอินจะตรวจจับให้เอง</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[12px] font-extrabold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Optional</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ── A. None ── */}
                  <div onClick={() => setMode('none')}
                    className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative ${mode === 'none'
                      ? 'bg-emerald-500/5 border-emerald-500 shadow-sm'
                      : 'bg-background border-border hover:border-emerald-500/30'}`}>
                    <Badge className="absolute -top-2 left-4 bg-emerald-500 text-white text-[12px] font-extrabold">มือใหม่</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <Icon name="circle-check" className={`text-xl ${mode === 'none' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-semibold ${mode === 'none' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        ไม่เชื่อมต่อ
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      ไม่ต้องตั้งค่าใดๆ ระบบแยกอิสระ<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">✓ ปลอดภัย 100% เซิร์ฟดับเว็บไม่พัง</span>
                    </p>
                  </div>

                  {/* ── B. Bridge ── */}
                  <div onClick={() => setMode('bridge')}
                    className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative ${mode === 'bridge'
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-background border-border hover:border-primary/50'}`}>
                    <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground text-[12px] font-extrabold">แนะนำ</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <Icon name="bolt" className={`text-xl ${mode === 'bridge' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-semibold ${mode === 'bridge' ? 'text-primary' : 'text-foreground'}`}>
                        Bridge Plugin
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      เชื่อมต่อผ่านปลั๊กอิน .jar ตัวเดียว<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">✓ ใช้รหัสเดียวกับในเกมได้ทันที</span>
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* ══════════════════════════════════════════════
                MODE A: NO CONNECTION
            ══════════════════════════════════════════════ */}
            {mode === 'none' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-6 flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0 text-lg">
                      <Icon name="bullseye" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">ไม่ต้องตั้งค่าการเชื่อมต่อใดๆ</h3>
                      <p className="text-sm text-muted-foreground font-medium">
                        เว็บร้านค้าของคุณใช้ฐานข้อมูลแยกต่างหาก ผู้เล่นสามารถลงทะเบียนบนหน้าเว็บเพื่อเริ่มใช้งานได้ทันที
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Icon name="bullhorn" />
                      </div>
                      สิ่งสำคัญที่ต้องแจ้งผู้เล่น
                    </CardTitle>
                    <CardDescription className="font-medium">เพื่อให้ระบบ RCON ส่งไอเท็มถึงผู้เล่นได้ถูกต้อง</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Icon name="key" className="text-amber-500" />
                        ผู้เล่นต้องสมัครเว็บด้วย "ชื่อเดียวกับในเกม"
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">
                        ระบบจะอ้างอิงจาก Username บนเว็บ หากไม่ตรงกัน ผู้เล่นจะไม่ได้รับของเมื่อสั่งซื้อ
                      </p>
                    </div>

                    <div className="space-y-4">
                      <StepCard n={1} title="ประกาศกฎให้ผู้เล่นทราบ">
                        <p className="text-xs text-muted-foreground font-medium mb-2">ตัวอย่างข้อความสำหรับประกาศ:</p>
                        <CodeBlock code={`📢 วิธีซื้อของจากร้านค้าออนไลน์\n1. เข้าเว็บ ${creds?.domain || 'shop.siamsite.shop'} แล้วกดสมัครสมาชิก\n2. ⚠️ ใช้ชื่อ Username ตรงกับชื่อในเกม (ตัวเล็ก/ใหญ่ก็ต้องตรง)\n3. เข้าเกมก่อนซื้อ ระบบจะส่งของให้ทันที`} language="text" />
                      </StepCard>
                      <StepCard n={2} title="ตั้งค่า RCON เพื่อจัดส่งไอเท็ม (เลือกได้)">
                        <CodeBlock code={`enable-rcon=true\nrcon.port=25575\nrcon.password=ตั้งรหัสผ่านเอง`} language="properties" />
                        <p className="text-xs text-muted-foreground font-medium mt-3">แก้ไขไฟล์ `server.properties` ของ Minecraft แล้วเริ่มเซิร์ฟเวอร์ใหม่ จากนั้นนำรหัสผ่านนี้ไปกรอกใน Setup Wizard บนหน้าร้านค้าของคุณ</p>
                      </StepCard>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                MODE B: BRIDGE PLUGIN
            ══════════════════════════════════════════════ */}
            {mode === 'bridge' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* ① OS picker (first thing user sees) */}
                <Card className="shadow-md border-primary/40">
                  <CardHeader className="pb-3 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-lg">1</div>
                      <div>
                        <CardTitle className="text-base">เซิร์ฟ MC ของคุณรันบนระบบไหน?</CardTitle>
                        <CardDescription className="font-medium mt-0.5">เลือกก่อนเริ่ม คู่มือทั้งหน้าจะเปลี่ยนตามระบบที่เลือก</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setOsType('linux')}
                        className={`p-5 rounded-xl border-2 transition-all cursor-pointer text-left flex items-center gap-4 ${
                          osType === 'linux'
                            ? 'bg-foreground text-background border-foreground shadow-md scale-[1.02]'
                            : 'bg-background border-border hover:border-foreground/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl ${osType === 'linux' ? 'bg-amber-400 text-slate-900' : 'bg-amber-500/10 text-amber-600'}`}>
                          <Icon name="linux" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base mb-0.5 flex items-center gap-2">
                            Linux
                            {osType === 'linux' && <Icon name="circle-check" className="text-emerald-400 text-sm" />}
                          </p>
                          <p className={`text-[13px] font-medium ${osType === 'linux' ? 'text-background/70' : 'text-muted-foreground'}`}>
                            Ubuntu, Debian, CentOS
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => setOsType('windows')}
                        className={`p-5 rounded-xl border-2 transition-all cursor-pointer text-left flex items-center gap-4 ${
                          osType === 'windows'
                            ? 'bg-foreground text-background border-foreground shadow-md scale-[1.02]'
                            : 'bg-background border-border hover:border-foreground/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl ${osType === 'windows' ? 'bg-sky-400 text-slate-900' : 'bg-sky-500/10 text-sky-600'}`}>
                          <Icon name="windows" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-base mb-0.5 flex items-center gap-2">
                            Windows
                            {osType === 'windows' && <Icon name="circle-check" className="text-emerald-400 text-sm" />}
                          </p>
                          <p className={`text-[13px] font-medium ${osType === 'windows' ? 'text-background/70' : 'text-muted-foreground'}`}>
                            Windows 10, 11, Server
                          </p>
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* ② Compact status row */}
                <Card className={`shadow-sm ${bridgeStatus?.online ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border'}`}>
                  <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bridgeStatus?.online ? 'bg-emerald-500/20 text-emerald-600' : 'bg-secondary text-muted-foreground'}`}>
                      <Icon name="signal" className="text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">สถานะการเชื่อมต่อ</p>
                        {bridgeStatus?.online ? (
                          <Badge variant="success" className="font-medium px-3"><span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse mr-2" />ออนไลน์</Badge>
                        ) : (
                          <Badge variant="outline" className="font-medium px-3">รอการเชื่อมต่อ</Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground font-medium mt-1">
                        Token: <span className="font-mono font-medium text-foreground">{bridgeStatus?.tokenPrefix || 'ยังไม่มี'}</span>
                        &nbsp;·&nbsp;Version: <span className="font-mono font-medium text-foreground">{bridgeStatus?.pluginVersion || 'ยังไม่มี'}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* ③ Track picker */}
                <Card className="shadow-md border-primary/40">
                  <CardHeader className="pb-3 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-lg">2</div>
                      <div>
                        <CardTitle className="text-base">เซิร์ฟ MC ของคุณตอนนี้เป็นอย่างไร?</CardTitle>
                        <CardDescription className="font-medium mt-0.5">เลือกตามสถานะปัจจุบัน เพื่อแสดงคู่มือที่ตรงกับคุณ</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => setSetupTrack('have')}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          setupTrack === 'have' ? 'bg-emerald-500/10 border-emerald-500 shadow-sm' : 'bg-background border-border hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon name="circle-check" className={`text-lg ${setupTrack === 'have' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${setupTrack === 'have' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>มี AuthMe หรือ nLogin พร้อม MySQL อยู่แล้ว</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">ผู้เล่นสมัครและล็อกอินในเกมได้ปกติ ไปติดตั้ง Bridge ด้านล่างได้เลย</p>
                      </button>
                      <button
                        onClick={() => setSetupTrack('new')}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          setupTrack === 'new' ? 'bg-amber-500/10 border-amber-500 shadow-sm' : 'bg-background border-border hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon name="wrench" className={`text-lg ${setupTrack === 'new' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${setupTrack === 'new' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>เริ่มจากศูนย์ ยังไม่เคยตั้งระบบล็อกอิน</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">ยังไม่มี MySQL หรือ AuthMe/nLogin จะมีคู่มือตั้งครบทุกขั้น พร้อมปุ่มก็อปคำสั่ง</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* ④ Track A: already set up */}
                {setupTrack === 'have' && (
                  <Card className="shadow-sm border-emerald-500/40 bg-emerald-500/5">
                    <CardContent className="p-5 flex gap-4 items-start">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0 text-lg">
                        <Icon name="circle-check" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground mb-1">ดีเลย ไม่ต้องแก้ AuthMe / nLogin / MySQL อะไรเพิ่ม</h4>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                          Bridge อ่านข้อมูล MySQL จาก config ของ AuthMe หรือ nLogin ของคุณให้อัตโนมัติ ในไฟล์ Bridge มีอย่างเดียวที่ต้องใส่คือ <strong className="text-primary">Token</strong> (ขั้น 4 ของการติดตั้ง Bridge ด้านล่าง)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ④ Track B: from scratch */}
                {setupTrack === 'new' && (
                  <>
                    {/* Auth plugin picker */}
                    <Card className="shadow-md border-amber-500/40">
                      <CardHeader className="pb-3 bg-amber-500/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-lg">3</div>
                          <div>
                            <CardTitle className="text-base">เลือกปลั๊กอินล็อกอินที่จะใช้</CardTitle>
                            <CardDescription className="font-medium mt-0.5">ใช้ตัวไหนก็ได้ ทำงานกับ Bridge ได้ทั้งคู่</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setSetupAuthType('authme')}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                              setupAuthType === 'authme' ? 'bg-purple-500/10 border-purple-500 shadow-sm' : 'bg-background border-border hover:border-purple-500/40'
                            }`}
                          >
                            <p className={`text-sm font-medium mb-0.5 ${setupAuthType === 'authme' ? 'text-purple-600' : 'text-foreground'}`}>
                              <Icon name="shield-halved" className="mr-1.5" />AuthMe
                            </p>
                            <p className="text-[12px] text-muted-foreground font-medium">ยอดนิยม ใช้ในเซิร์ฟไทยกว่า 80%</p>
                          </button>
                          <button
                            onClick={() => setSetupAuthType('nlogin')}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                              setupAuthType === 'nlogin' ? 'bg-purple-500/10 border-purple-500 shadow-sm' : 'bg-background border-border hover:border-purple-500/40'
                            }`}
                          >
                            <p className={`text-sm font-medium mb-0.5 ${setupAuthType === 'nlogin' ? 'text-purple-600' : 'text-foreground'}`}>
                              <Icon name="lock" className="mr-1.5" />nLogin
                            </p>
                            <p className="text-[12px] text-muted-foreground font-medium">ตัวใหม่กว่า เซิร์ฟใหม่ๆ ใช้บ่อย</p>
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* MySQL setup */}
                    <Card className="shadow-md border-amber-500/40">
                      <CardHeader className="pb-3 bg-amber-500/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-lg">4</div>
                          <div>
                            <CardTitle className="text-base">ติดตั้ง MySQL และสร้างฐานข้อมูล</CardTitle>
                            <CardDescription className="font-medium mt-0.5">กดปุ่มคัดลอกคำสั่งของแต่ละกล่อง แล้วเอาไปวางใน Terminal / PowerShell ทีละช่อง</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-4">

                        {osType === 'linux' ? (
                          <>
                            <CommandCard
                              label="A. ติดตั้ง MariaDB (MySQL ที่ใช้กันแพร่หลาย)"
                              desc="รันใน Terminal ของเซิร์ฟ Linux ใช้สิทธิ์ sudo"
                              lang="bash (Linux)"
                              code={`sudo apt update
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb`}
                            />
                            <CommandCard
                              label="B. ตั้งรหัสผ่าน root ของ MySQL (ทำครั้งแรกเท่านั้น)"
                              desc="ตอบ Y ทุกข้อ ตั้งรหัส root ที่จำได้ จดไว้"
                              lang="bash (Linux)"
                              code="sudo mysql_secure_installation"
                            />
                          </>
                        ) : (
                          <>
                            <CommandCard
                              label="A. ดาวน์โหลด MySQL Installer สำหรับ Windows"
                              desc="ลิงก์ทางการ ดาวน์โหลด mysql-installer-community รัน .msi เลือกแบบ Server Only"
                              lang="link"
                              code="https://dev.mysql.com/downloads/installer/"
                            />
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                              <p className="text-[12px] font-medium text-blue-700 dark:text-blue-400 mb-1">B. ระหว่างติดตั้ง MySQL Installer:</p>
                              <ul className="text-[13px] text-muted-foreground font-medium space-y-1 list-disc pl-5">
                                <li>เลือก <strong>Server Only</strong> (ไม่ต้องลง Workbench)</li>
                                <li>ตั้ง <strong>root password</strong> และจดไว้</li>
                                <li>Authentication Method เลือก <strong>Use Legacy Authentication</strong> เพื่อความเข้ากันได้</li>
                              </ul>
                            </div>
                          </>
                        )}

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                          <p className="text-[12px] font-extrabold text-red-700 dark:text-red-400 mb-1">
                            <Icon name="circle-exclamation" className="mr-1.5" />ก่อนรันคำสั่งถัดไป
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            แก้ <code className="bg-secondary px-1 py-0.5 rounded">CHANGE_THIS_PASSWORD</code> ในคำสั่งด้านล่าง ให้เป็นรหัสผ่านที่คุณตั้งเอง (จะใช้ในขั้น 5 จดไว้)
                          </p>
                        </div>

                        <CommandCard
                          label="C. เปิด MySQL shell (เข้าโหมดรันคำสั่ง SQL)"
                          desc="ใส่รหัส root ที่ตั้งใน B จะเข้าสู่ prompt mysql>"
                          lang={osType === 'linux' ? 'bash (Linux)' : 'cmd (Windows)'}
                          code={osType === 'linux' ? 'sudo mysql -u root -p' : 'mysql -u root -p'}
                        />

                        <CommandCard
                          tone="sql"
                          label={`D. สร้างฐานข้อมูลและ user สำหรับ ${setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'}`}
                          desc="คัดลอกแล้ววางใน prompt mysql> รวดเดียว แก้ CHANGE_THIS_PASSWORD ก่อนวาง"
                          lang="SQL"
                          code={setupAuthType === 'authme'
                            ? `CREATE DATABASE authme CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'authme'@'localhost' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';
GRANT ALL ON authme.* TO 'authme'@'localhost';
FLUSH PRIVILEGES;
EXIT;`
                            : `CREATE DATABASE nlogin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nlogin'@'localhost' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';
GRANT ALL ON nlogin.* TO 'nlogin'@'localhost';
FLUSH PRIVILEGES;
EXIT;`}
                        />

                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                            <Icon name="circle-check" className="mr-1.5" />ค่าที่ต้องจดไว้ใช้ในขั้น 5
                          </p>
                          <ul className="text-[13px] text-foreground font-medium space-y-0.5 mt-1.5">
                            <li>· Database: <code className="bg-background px-1.5 py-0.5 rounded">{setupAuthType === 'authme' ? 'authme' : 'nlogin'}</code></li>
                            <li>· User: <code className="bg-background px-1.5 py-0.5 rounded">{setupAuthType === 'authme' ? 'authme' : 'nlogin'}</code></li>
                            <li>· Password: <code className="bg-background px-1.5 py-0.5 rounded">รหัสที่คุณตั้งแทน CHANGE_THIS_PASSWORD</code></li>
                            <li>· Host: <code className="bg-background px-1.5 py-0.5 rounded">127.0.0.1</code> &nbsp; Port: <code className="bg-background px-1.5 py-0.5 rounded">3306</code></li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Install + configure auth plugin */}
                    <Card className="shadow-md border-amber-500/40">
                      <CardHeader className="pb-3 bg-amber-500/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-lg">5</div>
                          <div>
                            <CardTitle className="text-base">ติดตั้ง {setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'} และตั้งให้ใช้ MySQL</CardTitle>
                            <CardDescription className="font-medium mt-0.5">วาง .jar ใน plugins, เปิดเซิร์ฟ 1 ครั้ง, แก้ config ใช้ MySQL ที่สร้างในขั้น 4</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-4">
                        <div className="p-3 rounded-xl bg-background border border-border">
                          <p className="text-[12px] font-medium text-foreground mb-1.5">A. ดาวน์โหลดปลั๊กอินจากเว็บทางการ</p>
                          <a
                            href={setupAuthType === 'authme' ? 'https://www.spigotmc.org/resources/authmereloaded.6269/' : 'https://www.spigotmc.org/resources/nlogin.62674/'}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                          >
                            <Icon name="arrow-up-right-from-square" /> เปิด {setupAuthType === 'authme' ? 'AuthMeReloaded' : 'nLogin'} บน SpigotMC
                          </a>
                        </div>

                        <div className="p-3 rounded-xl bg-background border border-border text-[12px] text-muted-foreground font-medium leading-relaxed">
                          <p className="font-medium text-foreground mb-1">B. วาง .jar ในโฟลเดอร์ plugins แล้วเปิดเซิร์ฟ 1 ครั้ง</p>
                          เอาไฟล์ <code>.jar</code> ที่โหลดมา วางใน <code>{osType === 'linux' ? 'plugins/' : 'plugins\\'}</code> ของเซิร์ฟ MC จากนั้น <strong>start เซิร์ฟ</strong> รอจน console บอก <code>Done!</code> แล้ว <strong>stop</strong>. ปลั๊กอินจะสร้าง <code>{osType === 'linux' ? `plugins/${setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'}/config.yml` : `plugins\\${setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'}\\config.yml`}</code> ให้
                        </div>

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                          <p className="text-[12px] font-extrabold text-red-700 dark:text-red-400 mb-1">
                            <Icon name="circle-exclamation" className="mr-1.5" />ก่อนคัดลอก YAML ข้างล่าง
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            แก้ <code className="bg-secondary px-1 py-0.5 rounded">CHANGE_THIS_PASSWORD</code> เป็นรหัสจริงที่คุณตั้งในขั้น 4
                          </p>
                        </div>

                        <CommandCard
                          tone="yaml"
                          label={`C. แทนที่ section ในไฟล์ ${setupAuthType === 'authme' ? 'plugins/AuthMe/config.yml' : 'plugins/nLogin/config.yml'}`}
                          desc={setupAuthType === 'authme'
                            ? 'ค้นหา DataSource: ในไฟล์ แล้วแทนที่ section นั้นด้วยข้อความนี้'
                            : 'ค้นหา database: ในไฟล์ แล้วแทนที่ section นั้นด้วยข้อความนี้'}
                          lang="YAML"
                          code={setupAuthType === 'authme'
                            ? `DataSource:
  backend: MYSQL
  mySQLHost: 127.0.0.1
  mySQLPort: '3306'
  mySQLUsername: authme
  mySQLPassword: 'CHANGE_THIS_PASSWORD'
  mySQLDatabase: authme
  mySQLTablename: authme`
                            : `database:
  type: MySQL
  remote:
    hostname: "127.0.0.1:3306"
    database: "nlogin"
    username: "nlogin"
    password: "CHANGE_THIS_PASSWORD"
  table:
    account:
      table-name: "nlogin"`}
                        />

                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                            <Icon name="circle-check" className="mr-1.5" />D. เปิดเซิร์ฟอีกครั้ง แล้วทดสอบในเกม
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium">
                            เข้าเกม ลอง <code>/register รหัสผ่าน รหัสผ่าน</code> ถ้าผ่านแล้ว ระบบล็อกอินพร้อมใช้งานแล้ว ไปขั้นถัดไปติดตั้ง Bridge
                          </p>
                          {setupAuthType === 'nlogin' && (
                            <p className="text-[13px] text-amber-600 dark:text-amber-400 font-medium mt-2">
                              <Icon name="triangle-exclamation" className="mr-1" /><strong>nLogin:</strong> ตรวจ <code>security.hashing.algorithm</code> ต้องเป็น <code>BCRYPT2A</code> (default) ไม่งั้นฟังก์ชัน reset password จะใช้ไม่ได้
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* ⑤ Install Bridge */}
                <Card className={`shadow-md transition-colors ${osType === 'linux' ? 'border-amber-500/40' : 'border-sky-500/40'}`}>
                  <CardHeader className={`pb-3 ${osType === 'linux' ? 'bg-amber-500/5' : 'bg-sky-500/5'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-extrabold text-lg ${osType === 'linux' ? 'bg-amber-500' : 'bg-sky-500'}`}>
                        {setupTrack === 'have' ? 3 : 6}
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          ติดตั้งปลั๊กอิน Bridge สำหรับ <strong>{osType === 'linux' ? 'Linux' : 'Windows'}</strong>
                          <Icon name={osType === 'linux' ? 'linux' : 'windows'} className={osType === 'linux' ? 'text-amber-600' : 'text-sky-600'} />
                        </CardTitle>
                        <CardDescription className="font-medium mt-0.5">ทำตามทีละขั้น ใช้เวลาประมาณ 3 นาที</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">

                    <StepCard n={1} title="ดาวน์โหลดไฟล์ Bridge">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        กดปุ่มด้านล่างเพื่อโหลด เก็บไว้ก่อน เดี๋ยวเอาไปวางในขั้น 3
                      </p>
                      <Button variant="outline" asChild className="mt-1 cursor-pointer rounded-full font-medium h-10 px-6">
                        <a href="/downloads/siamsite-bridge-1.1.0.jar" download>
                          <Icon name="download" className="mr-2" /> ดาวน์โหลด siamsite-bridge.jar
                        </a>
                      </Button>
                    </StepCard>

                    <StepCard n={2} title="กดสร้าง Token (เก็บไว้ใช้ในขั้น 4)">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Token คือกุญแจของร้านคุณ ปลั๊กอินใช้เชื่อมเข้าร้านนี้ คัดลอกเก็บก่อน
                      </p>
                      {!bridgeToken ? (
                        <Button className="font-medium cursor-pointer rounded-full h-10 px-6 mt-1" onClick={issueBridgeToken}>
                          <Icon name="plus" className="mr-2" /> สร้าง Token
                        </Button>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2 items-center">
                            <code className="flex-1 px-4 py-2.5 bg-slate-950 text-amber-400 rounded-xl text-xs font-mono border border-amber-500/30 truncate">{bridgeToken.token}</code>
                            <CopyBtn value={bridgeToken.token} />
                          </div>
                          <p className="text-[12px] font-medium text-amber-500">
                            <Icon name="triangle-exclamation" className="mr-1.5" /> Token แสดงครั้งเดียว ห้ามปิดหน้าจนกว่าจะคัดลอกเสร็จ
                          </p>
                          <button onClick={revokeBridgeToken} className="text-[12px] font-medium text-destructive hover:underline cursor-pointer">
                            ยกเลิก / สร้างใหม่
                          </button>
                        </div>
                      )}
                    </StepCard>

                    <StepCard n={3} title="วาง .jar ใน plugins แล้วเปิดเซิร์ฟ 1 ครั้ง">
                      {osType === 'linux' ? (
                        <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5">
                          <li>SSH หรือ SFTP เข้าเซิร์ฟ ไปที่โฟลเดอร์ที่เก็บเซิร์ฟ MC</li>
                          <li>ลากไฟล์ <code>siamsite-bridge-1.1.0.jar</code> ที่โหลดมา วางในโฟลเดอร์ <code>plugins/</code></li>
                          <li><strong>เปิดเซิร์ฟ 1 ครั้ง</strong> รอจน console บอก <code>Done!</code> แล้วพิมพ์ <code>stop</code></li>
                        </ol>
                      ) : (
                        <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5">
                          <li>เปิด Windows Explorer ไปที่โฟลเดอร์เซิร์ฟ MC</li>
                          <li>ลากไฟล์ <code>siamsite-bridge-1.1.0.jar</code> ที่โหลดมา วางใน <code>plugins\</code></li>
                          <li><strong>เปิดเซิร์ฟ 1 ครั้ง</strong> double-click <code>run.bat</code> รอจนบอก <code>Done!</code> แล้วพิมพ์ <code>stop</code> ใน CMD</li>
                        </ol>
                      )}
                      <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                          <Icon name="check-circle" className="text-emerald-500 mr-1.5" />
                          จะมีไฟล์ใหม่ที่ <code>{osType === 'linux' ? 'plugins/SiamsiteBridge/config.yml' : 'plugins\\SiamsiteBridge\\config.yml'}</code>
                        </p>
                      </div>
                    </StepCard>

                    <StepCard n={4} title="เปิด config.yml แล้ววาง Token ที่คัดลอกไว้">
                      <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5 mb-3">
                        <li>
                          เปิดไฟล์ <code>{osType === 'linux' ? 'plugins/SiamsiteBridge/config.yml' : 'plugins\\SiamsiteBridge\\config.yml'}</code>
                          {osType === 'linux'
                            ? <span className="block text-[13px] text-muted-foreground mt-0.5">ใช้ nano, vim, VSCode, mcedit แก้ได้</span>
                            : <span className="block text-[13px] text-muted-foreground mt-0.5">คลิกขวาที่ไฟล์ Open with Notepad หรือ Notepad++</span>}
                        </li>
                        <li>หาบรรทัด <code className="bg-red-500/10 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">{`token: "PASTE-YOUR-TOKEN-HERE"`}</code></li>
                        <li><strong className="text-primary">วาง Token จากขั้น 2</strong> แทนข้อความ <code>PASTE-YOUR-TOKEN-HERE</code></li>
                        <li>บันทึก (Ctrl+S) ปิดไฟล์</li>
                      </ol>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-[11px] text-foreground font-medium mb-0.5"><Icon name="circle-check" className="text-emerald-500 mr-1" />ส่วนอื่นในไฟล์ไม่ต้องแก้</p>
                        <p className="text-[13px] text-muted-foreground font-medium">Bridge อ่านข้อมูล MySQL จาก AuthMe / nLogin ของคุณเอง</p>
                      </div>

                      <details className="mt-3 group">
                        <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 list-none">
                          <Icon name="chevron-right" className="text-[10px] transition-transform group-open:rotate-90" />
                          ตั้งค่าขั้นสูง (เกือบทุกคนไม่ต้องใช้)
                        </summary>
                        <div className="mt-2 pl-5 space-y-2">
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            ถ้า Bridge หา config ของ AuthMe / nLogin ไม่เจอ ตั้งเองได้
                          </p>
                          <CommandCard
                            tone="yaml"
                            label="ใส่ค่า MySQL เองในไฟล์ config.yml ของ Bridge"
                            desc="เปลี่ยน auto: true เป็น auto: false แล้วใส่ค่า MySQL"
                            lang="YAML"
                            code={`authme:
  auto: false
  host: 127.0.0.1
  port: 3306
  database: authme
  user: authme
  password: 'รหัสผ่าน-MySQL'
  table: authme

nlogin:
  auto: false
  host: 127.0.0.1
  port: 3306
  database: nlogin
  user: nlogin
  password: 'รหัสผ่าน-MySQL'
  table: nlogin

bridge:
  backend: authme    # หรือ nlogin`}
                          />
                        </div>
                      </details>
                    </StepCard>

                    <StepCard n={5} title="เปิดเซิร์ฟอีกครั้ง เสร็จ">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        เริ่มเซิร์ฟ MC อีก 1 ครั้ง รอ <strong>~10 วินาที</strong> แล้วกลับมาดูแถบสถานะการเชื่อมต่อ ด้านบนสุดของหน้านี้
                      </p>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">
                          <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">ถ้าสำเร็จ</p>
                          <p className="text-[13px] font-medium text-foreground">
                            <Icon name="circle-check" className="text-emerald-500 mr-1" />
                            สถานะ <strong className="text-emerald-600">ออนไลน์</strong> เขียวกะพริบ
                          </p>
                          <p className="text-[13px] font-medium text-muted-foreground mt-1">ผู้เล่นล็อกอินเว็บได้ทันที</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30">
                          <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400 mb-1">ถ้ายังไม่ขึ้น</p>
                          <p className="text-[13px] font-medium text-foreground">พิมพ์ใน console MC:</p>
                          <code className="block mt-1 px-2 py-1 bg-slate-950 text-amber-400 rounded text-[13px] font-mono">/siamsite-bridge status</code>
                        </div>
                      </div>
                    </StepCard>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        )}
      </div>

      <AdminActionModal
        action={adminAction}
        busy={adminLoading}
        onClose={() => { if (!adminLoading) setAdminAction(null); }}
        onConfirm={(pw) => { adminAction === 'setpw' ? setAdminPw(pw) : regenAdmin(); }}
      />
    </div>
  );
}

export default function CredentialsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="spinner" className="text-3xl text-primary animate-spin" />
      </div>
    }>
      <CredContent />
    </Suspense>
  );
}