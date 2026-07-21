'use client';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
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
  const t = useTranslations('credentials');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-7 text-[12px] font-medium cursor-pointer px-3 flex-shrink-0 ${copied ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10' : ''}`}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      <Icon name={copied ? 'check' : 'copy'} className={`mr-1.5`} />
      {copied ? t('copied') : t('copy')}
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
  const t = useTranslations('credentials');
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
          <span className="text-xs font-medium text-muted-foreground">{t('password')}</span>
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
          {t('changeIn')} {secondsLeft} {t('sec')}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground font-medium mt-2">
        <Icon name="rotate" className="mr-1.5" />{t('rotatingHint')}</p>
    </div>
  );
}

/** The whole "บัญชีแอดมินเว็บ" card. Self-contained: handles loading, error +
 *  retry, rotating vs custom display, and the action buttons per mode. */
function AdminCredentialCard({ cred, error, busy, onRefetch, onRegen, onSetPw }: {
  cred: ShopAdmin | null; error: boolean; busy: boolean;
  onRefetch: () => void; onRegen: () => void; onSetPw: () => void;
}) {
  const t = useTranslations('credentials');
  return (
    <Card className="shadow-sm border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Icon name="user-shield" />
          </div>{t('webAdmin')}</CardTitle>
        <CardDescription className="font-semibold">{t('adminPurpose')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {error ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              <Icon name="triangle-exclamation" className="mr-2 text-amber-500" />{t('adminLoadFailed')}</p>
            <Button variant="outline" onClick={onRefetch} className="rounded-full font-medium cursor-pointer">
              <Icon name="rotate-right" className="mr-2" />{t('retry')}</Button>
          </div>
        ) : !cred ? (
          <div className="py-6 text-center text-sm font-semibold text-muted-foreground">
            <Icon name="spinner" className="mr-2 animate-spin" />{t('loading')}</div>
        ) : (
          <>
            <CredRow label={t('username')} value={cred.username} icon="user" />
            {cred.rotating ? (
              <CountdownPasswordRow cred={cred} onExpire={onRefetch} />
            ) : (
              <CredRow label={t('password')} value={cred.password} icon="key" secret />
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              {cred.rotating ? (
                <Button onClick={onSetPw} disabled={busy} className="cursor-pointer font-medium rounded-full">
                  <Icon name="lock" className="mr-2" />{t('setOwnPassword')}</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onSetPw} disabled={busy} className="cursor-pointer font-medium rounded-full">
                    <Icon name="pen" className="mr-2" />{t('changePassword')}</Button>
                  <Button variant="outline" onClick={onRegen} disabled={busy} className="cursor-pointer font-medium rounded-full">
                    <Icon name="rotate" className="mr-2" />{t('backToRotating')}</Button>
                </>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground font-medium mt-3">
              <Icon name="circle-info" className="mr-1.5" />
              {cred.rotating
                ? t('setOwnPasswordTip')
                : t('permanentHint')}
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
  const t = useTranslations('credentials');
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden border border-border mt-2 bg-slate-950">
      <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-400">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-[12px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer">
          <Icon name={copied ? 'check' : 'copy'} /> {copied ? t('copied') : t('copy')}
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
  const t = useTranslations('credentials');
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
          {copied ? t('copied') : t('copyCommand')}
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
  const t = useTranslations('credentials');
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
        setError(t('notFound'));
      }
    };
    fetchAll();
  }, [user, subId]);

  const handleAction = async (action: string) => {
    try {
      setActionLoading(true);
      await api.post(`/api/subscriptions/${subId}/action`, { action });
      toast.success(t('commandDone', { action }));
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
      toast.error(t('logsFailed'));
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
      toast.success(t('tokenCreated'));
      if (res.data.provision?.rebuildStarted) {
        toast.success(t('rebuilding'));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('tokenCreateFailed'));
    }
  };

  const revokeBridgeToken = async () => {
    if (!confirm(t('revokeConfirm'))) return;
    try {
      await api.delete(`/api/bridge/${subId}/token`);
      setBridgeToken(null);
      await fetchBridgeStatus();
      toast.success(t('tokenRevoked'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('tokenRevokeFailed'));
    }
  };

  const toggleAutoRenew = async () => {
    try {
      const newVal = !sub.auto_renew;
      await api.patch(`/api/subscriptions/${subId}/auto-renew`, { autoRenew: newVal });
      setSub({ ...sub, auto_renew: newVal });
      toast.success(newVal ? t('autoRenewOn') : t('autoRenewOff'));
    } catch (err: any) {
      toast.error(t('settingsFailed'));
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
      toast.success(t('passwordRandomised'));
      setAdminAction(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('randomiseFailed'));
    } finally {
      setAdminLoading(false);
    }
  };

  const setAdminPw = async (pw?: string) => {
    if (!pw || pw.length < 6) { toast.error(t('passwordTooShort')); return; }
    try {
      setAdminLoading(true);
      const res = await api.post(`/api/subscriptions/${subId}/shop-admin/password`, { password: pw });
      setShopAdmin(res.data);
      toast.success(t('passwordSet'));
      setAdminAction(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('passwordFailed'));
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
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('shopInfo')}</h1>
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
            <p className="text-sm font-semibold text-muted-foreground">{t('loadingData')}</p>
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
                  </div>{t('siteDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <CredRow label={t('shopName')} value={creds.shopName} icon="font" />
                <CredRow label="URL {t('website')}" value={`https://${creds.domain}`} icon="globe" />
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="cursor-pointer font-medium rounded-full">
                    <a href={`https://${creds.domain}`} target="_blank" rel="noopener noreferrer">
                      <Icon name="arrow-up-right-from-square" className="mr-2" /> {t('openShopSite')}
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="cursor-pointer font-medium rounded-full">
                    <a href={creds.setupUrl} target="_blank" rel="noopener noreferrer">
                      <Icon name="wand-magic-sparkles" className="mr-2" />{t('startFirstSetup')}</a>
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
                    </div>{t('serverManagement')}</CardTitle>
                  
                  {/* Auto-renew toggle */}
                  <div className="flex items-center gap-3 bg-secondary/50 px-3 py-1.5 rounded-xl border border-border">
                    <span className="text-xs font-medium text-muted-foreground">{t('autoRenew')}</span>
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
                      <Icon name="play" className="mr-1.5" />{t('startServer')}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('restart')} disabled={actionLoading} className="cursor-pointer font-medium text-amber-600 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500 hover:text-white">
                      <Icon name="rotate-right" className="mr-1.5" />{t('restart')}</Button>
                    <Button variant="outline" size="sm" onClick={() => handleAction('stop')} disabled={actionLoading} className="cursor-pointer font-medium text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive hover:text-white">
                      <Icon name="stop" className="mr-1.5" />{t('stopServer')}</Button>
                    <Button variant="secondary" size="sm" onClick={handleLogs} disabled={actionLoading} className="cursor-pointer font-medium ml-auto">
                      <Icon name="terminal" className="mr-1.5" />{t('viewLogs')}</Button>
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
                      {t('howConnectDb')}
                    </CardTitle>
                    <CardDescription className="mt-1 font-semibold">{t('connectedAs')}<strong>{t('optionalExtra')}</strong> Bridge {t('supportsBoth')} <strong>AuthMe</strong>{t('and')}<strong>nLogin</strong>{t('autoDetect')}</CardDescription>
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
                    <Badge className="absolute -top-2 left-4 bg-emerald-500 text-white text-[12px] font-extrabold">{t('beginner')}</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <Icon name="circle-check" className={`text-xl ${mode === 'none' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-semibold ${mode === 'none' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>{t('notConnected')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{t('noExtraSetup')}<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">✓ {t('safe100')}</span>
                    </p>
                  </div>

                  {/* ── B. Bridge ── */}
                  <div onClick={() => setMode('bridge')}
                    className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative ${mode === 'bridge'
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-background border-border hover:border-primary/50'}`}>
                    <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground text-[12px] font-extrabold">{t('recommended')}</Badge>
                    <div className="flex items-center gap-3 mb-3 mt-1">
                      <Icon name="bolt" className={`text-xl ${mode === 'bridge' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-base font-semibold ${mode === 'bridge' ? 'text-primary' : 'text-foreground'}`}>
                        Bridge Plugin
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">{t('onePluginJar')}<br />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">✓ {t('sameAsGame')}</span>
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
                      <h3 className="font-semibold text-foreground mb-1">{t('noConnSetup')}</h3>
                      <p className="text-sm text-muted-foreground font-medium">{t('separateDb')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Icon name="bullhorn" />
                      </div>{t('importantForPlayers')}</CardTitle>
                    <CardDescription className="font-medium">{t('forRcon')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Icon name="key" className="text-amber-500" />
                        {t('playersMustRegister')} t('sameNameAsGame')
                      </p>
                      <p className="text-xs text-muted-foreground font-medium">{t('usernameMustMatch')}</p>
                    </div>

                    <div className="space-y-4">
                      <StepCard n={1} title={t('announceRules')}>
                        <p className="text-xs text-muted-foreground font-medium mb-2">{t('announceSample')}</p>
                        <CodeBlock code={t('announceBody', { domain: creds?.domain || 'shop.siamsite.shop' })} language="text" />
                      </StepCard>
                      <StepCard n={2} title={t('rconOptional')}>
                        <CodeBlock code={`enable-rcon=true\nrcon.port=25575\nrcon.password={t('setPassword')}`} language="properties" />
                        <p className="text-xs text-muted-foreground font-medium mt-3">{t('edit')} `server.properties` {t('ofMinecraftThen')}{t('startServer')}{t('newThenTake')}{t('password')}{t('pasteInWizard')}</p>
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
                        <CardTitle className="text-base">{t('serverOsQ')}</CardTitle>
                        <CardDescription className="font-medium mt-0.5">{t('chooseFirst')}</CardDescription>
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
                        <p className="text-sm font-medium text-foreground">{t('connStatus')}</p>
                        {bridgeStatus?.online ? (
                          <Badge variant="success" className="font-medium px-3"><span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse mr-2" />{t('online')}</Badge>
                        ) : (
                          <Badge variant="outline" className="font-medium px-3">{t('waitingConn')}</Badge>
                        )}
                      </div>
                      <p className="text-[13px] text-muted-foreground font-medium mt-1">
                        Token: <span className="font-mono font-medium text-foreground">{bridgeStatus?.tokenPrefix || t('none')}</span>
                        &nbsp;·&nbsp;Version: <span className="font-mono font-medium text-foreground">{bridgeStatus?.pluginVersion || t('none')}</span>
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
                        <CardTitle className="text-base">{t('serverStateQ')}</CardTitle>
                        <CardDescription className="font-medium mt-0.5">{t('chooseByStatus')}</CardDescription>
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
                          <span className={`text-sm font-medium ${setupTrack === 'have' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}>{t('hasAuthme')}</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">{t('playersCanRegister')}</p>
                      </button>
                      <button
                        onClick={() => setSetupTrack('new')}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer text-left ${
                          setupTrack === 'new' ? 'bg-amber-500/10 border-amber-500 shadow-sm' : 'bg-background border-border hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon name="wrench" className={`text-lg ${setupTrack === 'new' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${setupTrack === 'new' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>{t('fromScratch')}</span>
                        </div>
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">{t('none')} MySQL {t('or')} AuthMe/nLogin {t('fullGuideHint')}</p>
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
                        <h4 className="font-semibold text-foreground mb-1">{t('noNeedEdit')}</h4>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                          Bridge {t('readsAuthmeConfig')} {t('or')} nLogin {t('bridgeOnlyNeeds')} <strong className="text-primary">Token</strong> ({t('step4Below')}
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
                            <CardTitle className="text-base">{t('choosePlugin')}</CardTitle>
                            <CardDescription className="font-medium mt-0.5">{t('eitherWorks')}</CardDescription>
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
                            <p className="text-[12px] text-muted-foreground font-medium">{t('popularTh')}</p>
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
                            <p className="text-[12px] text-muted-foreground font-medium">{t('newerCommon')}</p>
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
                            <CardTitle className="text-base">{t('installMysql')}</CardTitle>
                            <CardDescription className="font-medium mt-0.5">{t('runEachBox')}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-4">

                        {osType === 'linux' ? (
                          <>
                            <CommandCard
                              label="A. {t('installMariadb')}"
                              desc={t('runInTerminal')}
                              lang="bash (Linux)"
                              code={`sudo apt update
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb`}
                            />
                            <CommandCard
                              label="B. {t('setRootPassword')}"
                              desc={t('answerY')}
                              lang="bash (Linux)"
                              code="sudo mysql_secure_installation"
                            />
                          </>
                        ) : (
                          <>
                            <CommandCard
                              label="A. {t('downloadMysqlWin')}"
                              desc={t('mysqlInstallerLink')}
                              lang="link"
                              code="https://dev.mysql.com/downloads/installer/"
                            />
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                              <p className="text-[12px] font-medium text-blue-700 dark:text-blue-400 mb-1">B. {t('duringInstall')}</p>
                              <ul className="text-[13px] text-muted-foreground font-medium space-y-1 list-disc pl-5">
                                <li>{t('select')}<strong>Server Only</strong> ({t('noWorkbench')}</li>
                                <li>{t('set')} <strong>root password</strong>{t('writeDown')}</li>
                                <li>Authentication Method {t('select')} <strong>Use Legacy Authentication</strong>{t('forCompatibility')}</li>
                              </ul>
                            </div>
                          </>
                        )}

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                          <p className="text-[12px] font-extrabold text-red-700 dark:text-red-400 mb-1">
                            <Icon name="circle-exclamation" className="mr-1.5" />{t('beforeNextCmd')}
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            {t('fix')} <code className="bg-secondary px-1 py-0.5 rounded">CHANGE_THIS_PASSWORD</code>{t('replacePassword')}</p>
                        </div>

                        <CommandCard
                          label="C. {t('openMysqlShell')}"
                          desc="{t('enterRootPassword')}>"
                          lang={osType === 'linux' ? 'bash (Linux)' : 'cmd (Windows)'}
                          code={osType === 'linux' ? 'sudo mysql -u root -p' : 'mysql -u root -p'}
                        />

                        <CommandCard
                          tone="sql"
                          label={t('dbUserFor', { plugin: setupAuthType === 'authme' ? 'AuthMe' : 'nLogin' })}
                          desc="{t('pasteInMysql')}> {t('changeBeforePaste')}"
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
                            <Icon name="circle-check" className="mr-1.5" />{t('valuesForStep5')}</p>
                          <ul className="text-[13px] text-foreground font-medium space-y-0.5 mt-1.5">
                            <li>· Database: <code className="bg-background px-1.5 py-0.5 rounded">{setupAuthType === 'authme' ? 'authme' : 'nlogin'}</code></li>
                            <li>· User: <code className="bg-background px-1.5 py-0.5 rounded">{setupAuthType === 'authme' ? 'authme' : 'nlogin'}</code></li>
                            <li>· Password: <code className="bg-background px-1.5 py-0.5 rounded">{t('yourPasswordInstead')}</code></li>
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
                            <CardTitle className="text-base">{t('install')} {setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'} {t('setToUseMysql')}</CardTitle>
                            <CardDescription className="font-medium mt-0.5">{t('dropJarComma')} {t('openServerOnce')}, {t('editMysqlStep4')}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-5 space-y-4">
                        <div className="p-3 rounded-xl bg-background border border-border">
                          <p className="text-[12px] font-medium text-foreground mb-1.5">A. {t('downloadPlugin')}</p>
                          <a
                            href={setupAuthType === 'authme' ? 'https://www.spigotmc.org/resources/authmereloaded.6269/' : 'https://www.spigotmc.org/resources/nlogin.62674/'}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                          >
                            <Icon name="arrow-up-right-from-square" /> {t('open')} {setupAuthType === 'authme' ? 'AuthMeReloaded' : 'nLogin'} {t('onSpigot')}
                          </a>
                        </div>

                        <div className="p-3 rounded-xl bg-background border border-border text-[12px] text-muted-foreground font-medium leading-relaxed">
                          <p className="font-medium text-foreground mb-1">B. {t('dropJar')}</p>
                          {t('takeFile')} <code>.jar</code> {t('downloadedPutIn')} <code>{osType === 'linux' ? 'plugins/' : 'plugins\\'}</code> {t('ofMcServerThen')} <strong>start {t('server')}</strong>{t('waitUntilConsole')}<code>Done!</code> {t('then')} <strong>stop</strong>. {t('pluginWillCreate')} <code>{osType === 'linux' ? `plugins/${setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'}/config.yml` : `plugins\\${setupAuthType === 'authme' ? 'AuthMe' : 'nLogin'}\\config.yml`}</code> {t('make')}
                        </div>

                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                          <p className="text-[12px] font-extrabold text-red-700 dark:text-red-400 mb-1">
                            <Icon name="circle-exclamation" className="mr-1.5" />{t('before')}{t('copy')} YAML {t('belowText')}
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            {t('fix')} <code className="bg-secondary px-1 py-0.5 rounded">CHANGE_THIS_PASSWORD</code>{t('realPasswordStep4')}</p>
                        </div>

                        <CommandCard
                          tone="yaml"
                          label={`C. {t('replaceSection')} ${setupAuthType === 'authme' ? 'plugins/AuthMe/config.yml' : 'plugins/nLogin/config.yml'}`}
                          desc={setupAuthType === 'authme'
                            ? t('findDataSource')
                            : t('findDatabase')}
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
                            <Icon name="circle-check" className="mr-1.5" />D. {t('restartServer')}
                          </p>
                          <p className="text-[13px] text-muted-foreground font-medium">{t('goInGameTry')}<code>/register {t('password')} {t('password')}</code>{t('loginReady')}</p>
                          {setupAuthType === 'nlogin' && (
                            <p className="text-[13px] text-amber-600 dark:text-amber-400 font-medium mt-2">
                              <Icon name="triangle-exclamation" className="mr-1" /><strong>nLogin:</strong> {t('check')} <code>security.hashing.algorithm</code> {t('mustBe')} <code>BCRYPT2A</code> (default) {t('resetPasswordNote')}
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
                        <CardTitle className="text-base flex items-center gap-2">{t('installBridge')}<strong>{osType === 'linux' ? 'Linux' : 'Windows'}</strong>
                          <Icon name={osType === 'linux' ? 'linux' : 'windows'} className={osType === 'linux' ? 'text-amber-600' : 'text-sky-600'} />
                        </CardTitle>
                        <CardDescription className="font-medium mt-0.5">{t('setupGuideTime')}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-4">

                    <StepCard n={1} title={t('downloadBridgeFile')}>
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        {t('downloadHint')}
                      </p>
                      <Button variant="outline" asChild className="mt-1 cursor-pointer rounded-full font-medium h-10 px-6">
                        <a href="/downloads/siamsite-bridge-1.1.0.jar" download>
                          <Icon name="download" className="mr-2" />{t('downloadBridge')}</a>
                      </Button>
                    </StepCard>

                    <StepCard n={2} title="{t('press')}{t('createToken')} ({t('createTokenStep')}">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        Token {t('tokenIsKey')}
                      </p>
                      {!bridgeToken ? (
                        <Button className="font-medium cursor-pointer rounded-full h-10 px-6 mt-1" onClick={issueBridgeToken}>
                          <Icon name="plus" className="mr-2" />{t('createToken')}</Button>
                      ) : (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2 items-center">
                            <code className="flex-1 px-4 py-2.5 bg-slate-950 text-amber-400 rounded-xl text-xs font-mono border border-amber-500/30 truncate">{bridgeToken.token}</code>
                            <CopyBtn value={bridgeToken.token} />
                          </div>
                          <p className="text-[12px] font-medium text-amber-500">
                            <Icon name="triangle-exclamation" className="mr-1.5" /> Token {t('showOnce')}
                          </p>
                          <button onClick={revokeBridgeToken} className="text-[12px] font-medium text-destructive hover:underline cursor-pointer">{t('revokeOrNew')}</button>
                        </div>
                      )}
                    </StepCard>

                    <StepCard n={3} title="{t('dropJarThen')}{t('openServerOnce')}">
                      {osType === 'linux' ? (
                        <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5">
                          <li>SSH {t('sftpToServer')}</li>
                          <li>{t('dragFile')}<code>siamsite-bridge-1.1.0.jar</code>{t('putDownloadedIn')}<code>plugins/</code></li>
                          <li><strong>{t('openServerOnce')}</strong>{t('waitUntilConsole')}<code>Done!</code> {t('thenType')} <code>stop</code></li>
                        </ol>
                      ) : (
                        <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5">
                          <li>{t('openExplorer')}</li>
                          <li>{t('dragFile')}<code>siamsite-bridge-1.1.0.jar</code> {t('downloadedPutIn')} <code>plugins\</code></li>
                          <li><strong>{t('openServerOnce')}</strong> double-click <code>run.bat</code> {t('waitUntilSays')} <code>Done!</code> {t('thenType')} <code>stop</code> {t('inCmd')}</li>
                        </ol>
                      )}
                      <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                          <Icon name="check-circle" className="text-emerald-500 mr-1.5" />
                          {t('newFileAt')} <code>{osType === 'linux' ? 'plugins/SiamsiteBridge/config.yml' : 'plugins\\SiamsiteBridge\\config.yml'}</code>
                        </p>
                      </div>
                    </StepCard>

                    <StepCard n={4} title={t('pasteToken')}>
                      <ol className="text-xs text-muted-foreground font-medium space-y-1.5 list-decimal pl-5 mb-3">
                        <li>{t('openFile')}<code>{osType === 'linux' ? 'plugins/SiamsiteBridge/config.yml' : 'plugins\\SiamsiteBridge\\config.yml'}</code>
                          {osType === 'linux'
                            ? <span className="block text-[13px] text-muted-foreground mt-0.5">{t('useAnyEditor')}</span>
                            : <span className="block text-[13px] text-muted-foreground mt-0.5">{t('rightClickNotepad')}</span>}
                        </li>
                        <li>{t('findLine')}<code className="bg-red-500/10 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">{`token: "PASTE-YOUR-TOKEN-HERE"`}</code></li>
                        <li><strong className="text-primary">{t('pasteTokenStep')}</strong>{t('insteadOf')}<code>PASTE-YOUR-TOKEN-HERE</code></li>
                        <li>{t('saveClose')}</li>
                      </ol>
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <p className="text-[11px] text-foreground font-medium mb-0.5"><Icon name="circle-check" className="text-emerald-500 mr-1" />{t('noOtherEdits')}</p>
                        <p className="text-[13px] text-muted-foreground font-medium">Bridge {t('readsMysql')}</p>
                      </div>

                      <details className="mt-3 group">
                        <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 list-none">
                          <Icon name="chevron-right" className="text-[10px] transition-transform group-open:rotate-90" />{t('advancedSetup')}</summary>
                        <div className="mt-2 pl-5 space-y-2">
                          <p className="text-[13px] text-muted-foreground font-medium leading-relaxed">
                            {t('bridgeFallback')}
                          </p>
                          <CommandCard
                            tone="yaml"
                            label={t('manualMysql')}
                            desc={t('changeAutoFalse')}
                            lang="YAML"
                            code={`authme:
  auto: false
  host: 127.0.0.1
  port: 3306
  database: authme
  user: authme
  password: '{t('password')}-MySQL'
  table: authme

nlogin:
  auto: false
  host: 127.0.0.1
  port: 3306
  database: nlogin
  user: nlogin
  password: '{t('password')}-MySQL'
  table: nlogin

bridge:
  backend: authme    # {t('or')} nlogin`}
                          />
                        </div>
                      </details>
                    </StepCard>

                    <StepCard n={5} title="{t('restartDone')}">
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        {t('startMcWait')} <strong>~10 {t('seconds')}</strong>{t('checkStatusBar')}</p>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">
                          <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">{t('ifSuccess')}</p>
                          <p className="text-[13px] font-medium text-foreground">
                            <Icon name="circle-check" className="text-emerald-500 mr-1" />{t('status')}<strong className="text-emerald-600">{t('online')}</strong>{t('greenBlink')}</p>
                          <p className="text-[13px] font-medium text-muted-foreground mt-1">{t('playersLoginNow')}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30">
                          <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400 mb-1">{t('ifNotYet')}</p>
                          <p className="text-[13px] font-medium text-foreground">{t('typeInConsole')}</p>
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