'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Credentials {
  shopName: string; domain: string;
  mysqlHost: string; mysqlPort: number; mysqlUser: string; mysqlPassword: string; mysqlDatabase: string;
  setupUrl: string; mcIp?: string;
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

/* ── CredRow ── */
function CredRow({ label, value, icon, secret }: { label: string; value: string | number; icon?: string; secret?: boolean }) {
  const [show, setShow] = useState(false);
  const display = secret && !show ? '••••••••••••' : String(value);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-border/50 last:border-0 last:pb-0 gap-3">
      <div className="flex items-center gap-3 flex-shrink-0">
        {icon && <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
          <i className={`fas ${icon} text-sm`} />
        </div>}
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-center gap-3 min-w-0 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border">
        <span className={`text-sm font-semibold truncate ${secret && !show ? 'text-muted-foreground' : 'text-foreground'}`}>{display}</span>
        {secret && (
          <button onClick={() => setShow(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 cursor-pointer">
            <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
          </button>
        )}
        <div className="ml-2 pl-3 border-l border-border/50">
          <CopyBtn value={String(value)} />
        </div>
      </div>
    </div>
  );
}

/* ── StepCard ── */
function StepCard({ n, title, children, done, warn }: { n: number; title: string; children?: React.ReactNode; done?: boolean; warn?: boolean }) {
  return (
    <Card className={`border shadow-none transition-all ${done ? 'bg-emerald-500/5 border-emerald-500/30' : warn ? 'bg-amber-500/5 border-amber-500/30' : 'bg-background border-border'}`}>
      <CardContent className="p-5 flex gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${done ? 'bg-emerald-500 text-white' : warn ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'}`}>
          {done ? <i className="fas fa-check text-xs" /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold tracking-tight mb-2 ${done ? 'text-emerald-600 dark:text-emerald-400' : warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{title}</p>
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
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer">
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs leading-relaxed text-slate-300 overflow-x-auto whitespace-pre font-mono">{code}</pre>
    </div>
  );
}

/* ── PhaseHeader ── */
function PhaseHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center flex-shrink-0">
        <i className={icon} />
      </div>
      <span className="text-sm font-bold uppercase tracking-widest text-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
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
  const [mode, setMode] = useState<'none' | 'bridge' | 'advanced'>('none');
  const [advancedSubMode, setAdvancedSubMode] = useState<'panel' | 'ha'>('panel');
  const [bridgeToken, setBridgeToken] = useState<{ token: string; prefix: string } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{ online: boolean; pluginVersion: string | null; tokenPrefix: string | null } | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
      toast.success('สร้าง token ใหม่แล้ว — คัดลอกไปใส่ใน config.yml ของปลั๊กอิน');
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

  if (loading) return null;

  const panelConfig = creds ? `DataSource:
  backend: MYSQL
  caching: false
  mySQLHost: ${creds.mysqlHost}
  mySQLPort: '${creds.mysqlPort}'
  mySQLUseSSL: false
  mySQLCheckServerCertificate: false
  mySQLAllowPublicKeyRetrieval: true
  mySQLUsername: ${creds.mysqlUser}
  mySQLPassword: '${creds.mysqlPassword}'
  mySQLDatabase: ${creds.mysqlDatabase}
  mySQLTablename: authme
  poolSize: 10
  maxLifetime: 1770
  keepaliveTime: 60000` : '';

  const haConfig = creds ? `DataSource:
  backend: MYSQL
  caching: false
  mySQLHost: 127.0.0.1
  mySQLPort: '3306'
  mySQLUseSSL: false
  mySQLCheckServerCertificate: false
  mySQLAllowPublicKeyRetrieval: true
  mySQLUsername: ${creds.mysqlUser}
  mySQLPassword: '${creds.mysqlPassword}'
  mySQLDatabase: ${creds.mysqlDatabase}
  mySQLTablename: authme
  poolSize: 10
  maxLifetime: 1770
  keepaliveTime: 60000` : '';

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── หัวข้อ ── */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" className="rounded-full cursor-pointer h-10 w-10 border-border" asChild>
            <Link href="/dashboard">
              <i className="fas fa-arrow-left text-muted-foreground" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ข้อมูลร้านค้า</h1>
            {creds && <p className="text-sm font-semibold text-muted-foreground mt-0.5">{creds.domain}</p>}
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

        {!creds && !error && (
          <div className="py-20 text-center flex flex-col items-center">
            <i className="fas fa-spinner fa-spin text-primary text-3xl mb-4" />
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
                    <i className="fas fa-store" />
                  </div>
                  รายละเอียดเว็บไซต์
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <CredRow label="ชื่อร้าน" value={creds.shopName} icon="fa-font" />
                <CredRow label="URL เว็บไซต์" value={`https://${creds.domain}`} icon="fa-globe" />
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="cursor-pointer font-bold rounded-full">
                    <a href={`https://${creds.domain}`} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-arrow-up-right-from-square mr-2" /> เปิดเว็บร้านค้า
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="cursor-pointer font-bold rounded-full">
                    <a href={creds.setupUrl} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-wand-magic-sparkles mr-2" /> เข้าสู่ Setup Wizard
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── การจัดการเซิร์ฟเวอร์ (เฉพาะ Customer) ── */}
            {sub && (
              <Card className="shadow-sm border-blue-500/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <i className="fas fa-server" />
                    </div>
                    การจัดการเซิร์ฟเวอร์
                  </CardTitle>
                  
                  {/* Auto-renew toggle */}
                  <div className="flex items-center gap-3 bg-secondary/50 px-3 py-1.5 rounded-xl border border-border">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ต่ออายุอัตโนมัติ</span>
                    <button
                      onClick={toggleAutoRenew}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${sub.auto_renew ? 'bg-emerald-500' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sub.auto_renew ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleAction('start')} disabled={actionLoading} className="cursor-pointer font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white">
                      <i className="fas fa-play mr-1.5" /> เริ่มเซิร์ฟเวอร์
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('restart')} disabled={actionLoading} className="cursor-pointer font-bold text-amber-600 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500 hover:text-white">
                      <i className="fas fa-rotate-right mr-1.5" /> รีสตาร์ท
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('stop')} disabled={actionLoading} className="cursor-pointer font-bold text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive hover:text-white">
                      <i className="fas fa-stop mr-1.5" /> หยุดเซิร์ฟเวอร์
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleLogs} disabled={actionLoading} className="cursor-pointer font-bold ml-auto">
                      <i className="fas fa-terminal mr-1.5" /> ดู Logs ของระบบ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Logs Modal */}
            {showLogs && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={() => setShowLogs(false)}>
                <div className="bg-slate-950 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      <i className="fas fa-terminal text-blue-400" /> Container Logs
                    </h3>
                    <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800">
                      <i className="fas fa-times" />
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
                        <i className="fas fa-code-branch" />
                      </div>
                      วิธีเชื่อมต่อฐานข้อมูลเกม (AuthMe)
                    </CardTitle>
                    <CardDescription className="mt-1 font-semibold">การเชื่อมต่อเป็น <strong>ทางเลือกเสริม</strong> — หากไม่เชื่อมต่อ ผู้เล่นสมัครสมาชิกบนเว็บได้ปกติ</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Optional</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* ── A. None ── */}
                  <div onClick={() => setMode('none')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${mode === 'none'
                      ? 'bg-emerald-500/5 border-emerald-500 shadow-sm'
                      : 'bg-background border-border hover:border-emerald-500/30'}`}>
                    <Badge className="absolute -top-2 left-4 bg-emerald-500 text-white text-[9px] uppercase tracking-widest font-extrabold">มือใหม่</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <i className={`fas fa-circle-check text-xl ${mode === 'none' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-bold ${mode === 'none' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        ไม่เชื่อมต่อ
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      ไม่ต้องตั้งค่าใดๆ ระบบแยกอิสระ<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">✓ ปลอดภัย 100% เซิร์ฟดับเว็บไม่พัง</span>
                    </p>
                  </div>

                  {/* ── B. Bridge ── */}
                  <div onClick={() => setMode('bridge')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative ${mode === 'bridge'
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-background border-border hover:border-primary/50'}`}>
                    <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground text-[9px] uppercase tracking-widest font-extrabold">แนะนำ</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <i className={`fas fa-bolt text-xl ${mode === 'bridge' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-bold ${mode === 'bridge' ? 'text-primary' : 'text-foreground'}`}>
                        Bridge Plugin
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      เชื่อมต่อผ่านปลั๊กอิน .jar ตัวเดียว<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-1 block">✓ ใช้รหัสเดียวกับในเกมได้ทันที</span>
                    </p>
                  </div>

                  {/* ── C. Advanced ── */}
                  <div onClick={() => setMode('advanced')}
                    className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'advanced'
                      ? 'bg-slate-500/5 border-slate-500 shadow-sm'
                      : 'bg-background border-border hover:border-slate-400'}`}>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <i className={`fas fa-screwdriver-wrench text-xl ${mode === 'advanced' ? 'text-slate-500 dark:text-slate-400' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-bold ${mode === 'advanced' ? 'text-slate-600 dark:text-slate-300' : 'text-foreground'}`}>
                        ขั้นสูง (Advanced)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      เชื่อมต่อ MySQL โดยตรง<br />
                      <span className="text-amber-600 dark:text-amber-500 font-bold mt-1 block">⚠ ต้องมีทักษะในการตั้งค่า</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ══════════════════════════════════════════════
                MODE A — NO CONNECTION
            ══════════════════════════════════════════════ */}
            {mode === 'none' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-6 flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0 text-lg">
                      <i className="fas fa-bullseye" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">ไม่ต้องตั้งค่าการเชื่อมต่อใดๆ</h3>
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
                        <i className="fas fa-bullhorn" />
                      </div>
                      สิ่งสำคัญที่ต้องแจ้งผู้เล่น
                    </CardTitle>
                    <CardDescription className="font-medium">เพื่อให้ระบบ RCON ส่งไอเท็มถึงผู้เล่นได้ถูกต้อง</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                        <i className="fas fa-key text-amber-500" />
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
                MODE B — BRIDGE PLUGIN
            ══════════════════════════════════════════════ */}
            {mode === 'bridge' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-lg">
                      <i className="fas fa-bolt" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">Bridge Plugin</h3>
                      <p className="text-sm text-muted-foreground font-medium">
                        เพียงนำปลั๊กอิน .jar ไปติดตั้งและใส่ Token ระบบจะเชื่อมต่อกับ AuthMe ให้โดยอัตโนมัติ ผู้เล่นสามารถล็อกอินด้วยรหัสผ่านเดียวกับในเกมได้เลย
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Status */}
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${bridgeStatus?.online ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                          <i className="fas fa-signal" />
                        </div>
                        สถานะการเชื่อมต่อ
                      </CardTitle>
                      {bridgeStatus?.online ? (
                        <Badge variant="success" className="font-bold px-3 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse mr-2" />ออนไลน์</Badge>
                      ) : (
                        <Badge variant="outline" className="font-bold px-3 uppercase tracking-widest">รอการเชื่อมต่อ</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Token Prefix</p>
                        <p className="text-sm font-semibold text-foreground">{bridgeStatus?.tokenPrefix || '—'}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Plugin Version</p>
                        <p className="text-sm font-semibold text-foreground">{bridgeStatus?.pluginVersion || '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Steps */}
                <Card className="shadow-sm border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <i className="fas fa-list-check" />
                      </div>
                      ขั้นตอนการติดตั้ง
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StepCard n={1} title="ดาวน์โหลดปลั๊กอิน">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        ไฟล์เดียวจบ รองรับ Minecraft 1.16 ขึ้นไป (Paper / Spigot / Bukkit) ต้องมี AuthMe ติดตั้งอยู่แล้ว
                      </p>
                      <Button variant="outline" asChild className="mt-1 cursor-pointer rounded-full font-bold h-10 px-6">
                        <a href="/downloads/siamsite-bridge-1.0.0.jar" download>
                          <i className="fas fa-download mr-2" /> ดาวน์โหลด siamsite-bridge-1.0.0.jar
                        </a>
                      </Button>
                    </StepCard>

                    <StepCard n={2} title="สร้าง Token">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Token เป็นรหัสเฉพาะของร้านคุณ ใช้ให้ปลั๊กอินรู้ว่าจะเชื่อมเข้ากับร้านไหน
                      </p>
                      {!bridgeToken ? (
                        <Button className="font-bold cursor-pointer rounded-full h-10 px-6 mt-1" onClick={issueBridgeToken}>
                          <i className="fas fa-plus mr-2" /> สร้าง Token ใหม่
                        </Button>
                      ) : (
                        <div className="mt-2 space-y-3">
                          <div className="flex gap-2 items-center">
                            <code className="flex-1 px-4 py-2.5 bg-slate-950 text-amber-400 rounded-xl text-xs font-mono border border-amber-500/30 truncate">{bridgeToken.token}</code>
                            <CopyBtn value={bridgeToken.token} />
                          </div>
                          <p className="text-[10px] font-bold text-amber-500">
                            <i className="fas fa-triangle-exclamation mr-1.5" /> Token นี้แสดงเพียงครั้งเดียว กด Copy แล้วเก็บไว้ก่อน
                          </p>
                          <button onClick={revokeBridgeToken} className="text-[10px] font-bold text-destructive hover:underline cursor-pointer">
                            ยกเลิก / สร้างใหม่
                          </button>
                        </div>
                      )}
                    </StepCard>

                    <StepCard n={3} title="ลากไฟล์เข้า plugins แล้วเปิดเซิร์ฟเวอร์ 1 ครั้ง">
                      <p className="text-xs text-muted-foreground font-medium">
                        เอาไฟล์ <code>.jar</code> ที่โหลดมาใส่ในโฟลเดอร์ <code>plugins/</code> ของเซิร์ฟเวอร์ MC แล้วเปิดเซิร์ฟเวอร์ขึ้นมา 1 รอบ ปลั๊กอินจะสร้างไฟล์ตั้งค่าให้เองที่ <code>plugins/SiamsiteBridge/config.yml</code> (เปิดแล้วปิดเลยก็ได้)
                      </p>
                    </StepCard>

                    <StepCard n={4} title="วาง Token ลงในไฟล์ตั้งค่า">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        เปิดไฟล์ <code>plugins/SiamsiteBridge/config.yml</code> แก้บรรทัด <code>token</code> ให้เป็นค่าที่ copy มาจากขั้นที่ 2 ส่วนอื่นไม่ต้องแตะ
                      </p>
                      <CodeBlock code={`panel:\n  url: wss://panel.siamsite.shop/bridge\n  token: "วาง-token-ที่-copy-ไว้-ตรงนี้"`} language="yaml" />
                    </StepCard>

                    <StepCard n={5} title="รีสตาร์ทเซิร์ฟเวอร์ — เสร็จ">
                      <p className="text-xs text-muted-foreground font-medium">
                        รีสตาร์ทเซิร์ฟเวอร์ MC อีก 1 ครั้ง สถานะ <strong>"รอการเชื่อมต่อ"</strong> ด้านบนจะเปลี่ยนเป็น <strong className="text-emerald-600">ออนไลน์</strong> ภายในไม่กี่วินาที ถ้าไม่ขึ้น ลองพิมพ์ <code>/siamsite-bridge status</code> ใน console เซิร์ฟเวอร์เพื่อดูว่าติดอะไร
                      </p>
                    </StepCard>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                MODE C — ADVANCED
            ══════════════════════════════════════════════ */}
            {mode === 'advanced' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div onClick={() => setAdvancedSubMode('panel')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${advancedSubMode === 'panel' ? 'bg-blue-500/5 border-blue-500 shadow-sm' : 'bg-background border-border hover:border-blue-500/50'}`}>
                    <h4 className={`text-sm font-bold uppercase tracking-tight mb-1 ${advancedSubMode === 'panel' ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>เชื่อมฐานข้อมูลโดยตรง</h4>
                    <p className="text-xs text-muted-foreground font-medium">เชื่อมต่อ AuthMe เข้ากับระบบ MySQL ของร้านค้าโดยตรง</p>
                  </div>
                  <div onClick={() => setAdvancedSubMode('ha')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${advancedSubMode === 'ha' ? 'bg-emerald-500/5 border-emerald-500 shadow-sm' : 'bg-background border-border hover:border-emerald-500/50'}`}>
                    <h4 className={`text-sm font-bold uppercase tracking-tight mb-1 ${advancedSubMode === 'ha' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>Self-hosted HA</h4>
                    <p className="text-xs text-muted-foreground font-medium">จัดการ Replication ระบบ MySQL แบบ High Availability</p>
                  </div>
                </div>

                {advancedSubMode === 'panel' && (
                  <>
                    <Card className="shadow-sm border-border">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <i className="fas fa-database" />
                          </div>
                          ข้อมูลฐานข้อมูล MySQL
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <CredRow label="Host" value={creds.mysqlHost} icon="fa-server" />
                        <CredRow label="Port" value={creds.mysqlPort} icon="fa-network-wired" />
                        <CredRow label="User" value={creds.mysqlUser} icon="fa-user" />
                        <CredRow label="Password" value={creds.mysqlPassword} icon="fa-lock" secret />
                        <CredRow label="Database" value={creds.mysqlDatabase} icon="fa-table" />
                        <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl">
                          <p className="text-xs text-primary font-bold"><i className="fas fa-triangle-exclamation mr-1.5" /> Port ต้องใช้ <strong>{creds.mysqlPort}</strong> (ไม่ใช่ 3306) เนื่องจากเป็นพอร์ตเฉพาะสำหรับเซิร์ฟเวอร์ของคุณ</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm border-border">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                            <i className="fas fa-map" />
                          </div>
                          คู่มือการเชื่อมต่อ
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <PhaseHeader icon="fas fa-plug text-primary" label="1. ตั้งค่าปลั๊กอิน AuthMe" />
                        <StepCard n={1} title="ตั้งค่า DataSource ใน config.yml">
                          <p className="text-xs text-muted-foreground font-medium mb-2">แก้ไขส่วนการเชื่อมต่อฐานข้อมูลตามโค้ดด้านล่าง</p>
                          <CodeBlock code={panelConfig} />
                        </StepCard>
                        
                        <PhaseHeader icon="fas fa-terminal text-blue-500" label="2. เปิดใช้งาน RCON" />
                        <StepCard n={2} title="ตั้งค่า server.properties">
                          <CodeBlock code={`enable-rcon=true\nrcon.port=25575\nrcon.password=ตั้งรหัสผ่านเอง`} language="properties" />
                          <p className="text-xs text-muted-foreground font-medium mt-2">จดรหัสผ่านนี้เพื่อนำไปกรอกในหน้า Setup Wizard บนร้านค้าออนไลน์ของคุณ</p>
                        </StepCard>
                      </CardContent>
                    </Card>

                    <Card className={`shadow-sm ${creds.mcIp ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${creds.mcIp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            <i className="fas fa-shield-halved" />
                          </div>
                          Firewall ความปลอดภัย
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {creds.mcIp ? (
                          <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <i className="fas fa-circle-check text-emerald-500 mt-0.5 text-lg" />
                            <div>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">อนุญาตเฉพาะ IP สำเร็จ</p>
                              <p className="text-xs text-emerald-600/80 font-medium">ฐานข้อมูลอนุญาตการเชื่อมต่อเฉพาะจากไอพี {creds.mcIp} เท่านั้น</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                              <i className="fas fa-triangle-exclamation text-amber-500 mt-0.5 text-lg" />
                              <div>
                                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">ยังไม่ได้ระบุ IP ของเซิร์ฟเวอร์</p>
                                <p className="text-xs text-amber-600/80 font-medium">ฐานข้อมูลยังคงเปิดรับการเชื่อมต่อจากทุกไอพี กรุณาระบุไอพีของเซิร์ฟเวอร์ผ่าน Setup Wizard เพื่อเพิ่มความปลอดภัย</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {advancedSubMode === 'ha' && (
                  <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-6">
                      <h3 className="font-bold text-emerald-600 mb-2 flex items-center gap-2">
                        <i className="fas fa-circle-info" /> High Availability Mode
                      </h3>
                      <p className="text-sm text-emerald-600/80 font-medium leading-relaxed">
                        โหมดนี้สำหรับการทำ Self-hosted MySQL บน Windows Server ผ่าน VPN Replication หากต้องการใช้งาน กรุณาติดต่อแอดมินโดยตรงที่แฟนเพจเพื่อดำเนินการตั้งค่าระบบให้สมบูรณ์
                      </p>
                      <Button asChild className="mt-4 font-bold rounded-full cursor-pointer h-10 px-6">
                        <a href="https://www.facebook.com/siamsitestore" target="_blank" rel="noopener noreferrer">
                          <i className="fab fa-facebook mr-2" /> ติดต่อแอดมิน
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default function CredentialsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    }>
      <CredContent />
    </Suspense>
  );
}