'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import TimeRemaining from '@/components/TimeRemaining';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { Icon, type IconName } from '@/components/ui/icon';

interface Sub {
  id: number; shop_name: string; domain: string; status: string;
  expires_at: string; package_months: number; price_paid: number;
  display_name: string; email: string; frontend_port: number;
  mc_ip?: string; deploy_log?: string;
  custom_domain?: string | null;
  custom_domain_status?: 'pending_dns' | 'pending_ssl' | 'active' | 'failed' | null;
}

// Custom-domain badge styling per status (matches the domain flow's 4-state machine).
const CUSTOM_DOMAIN_META: Record<string, { label: string; badge: string }> = {
  active:      { label: 'ใช้งานได้',  badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white' },
  pending_dns: { label: 'รอ DNS',     badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500 hover:text-white' },
  pending_ssl: { label: 'รอ SSL',     badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500 hover:text-white' },
  failed:      { label: 'ล้มเหลว',     badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500 hover:text-white' },
};
const customDomainMeta = (status?: string | null) =>
  CUSTOM_DOMAIN_META[status || ''] || { label: 'รอตรวจสอบ', badge: 'bg-secondary text-secondary-foreground border-border hover:bg-slate-900 hover:text-white' };

const FILTER_TABS = [
  { value: '',           label: 'ทั้งหมด',        icon: 'list' },
  { value: 'active',     label: 'ใช้งานอยู่',     icon: 'circle-check' },
  { value: 'deploying',  label: 'กำลังติดตั้ง',  icon: 'rocket' },
  { value: 'suspended',  label: 'ถูกระงับ',     icon: 'ban' },
  { value: 'expired',    label: 'หมดอายุ',      icon: 'clock' },
];

const PAGE_SIZE = 30;

function Content() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initStatus = searchParams.get('status') || '';
  const [subs, setSubs] = useState<Sub[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initStatus);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [manageSub, setManageSub] = useState<Sub | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [logsSub, setLogsSub] = useState<Sub | null>(null);
  const [logsData, setLogsData] = useState('');
  const [statsData, setStatsData] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await api.get('/api/admin/subscriptions', {
        params: {
          page,
          status: status || undefined,
          search: searchTerm || undefined,
          limit: PAGE_SIZE,
        },
      });
      setSubs(r.data.subscriptions);
      setTotal(r.data.total);
    } catch {
      if (!silent) toast.error('โหลดล้มเหลว', 'ไม่สามารถดึงข้อมูลร้านค้าได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, status, searchTerm, toast]);

  useEffect(() => { load(); }, [page, status, searchTerm]);
  useEffect(() => { setPage(1); setSelectedIds([]); }, [status, searchTerm]);

  useEffect(() => {
    if (!manageSub) return;
    const fresh = subs.find(s => s.id === manageSub.id);
    if (!fresh) return;
    if (
      fresh.status !== manageSub.status ||
      fresh.mc_ip !== manageSub.mc_ip ||
      fresh.expires_at !== manageSub.expires_at
    ) setManageSub(fresh);
  }, [subs, manageSub]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const submitSearch = () => setSearchTerm(searchInput.trim());

  const toggleSelectAll = () => {
    if (selectedIds.length === subs.length) setSelectedIds([]);
    else setSelectedIds(subs.map(s => s.id));
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(prev => prev.filter(i => i !== id));
    else setSelectedIds(prev => [...prev, id]);
  };

  const handleBulkAction = async (action: 'suspend' | 'delete') => {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`ต้องการลบ ${selectedIds.length} ร้านค้าที่เลือกอย่างถาวรใช่หรือไม่?`)) return;
    setActionLoading(-1);
    try {
      await api.post('/api/admin/subscriptions/bulk-action', { ids: selectedIds, action });
      toast.success('สำเร็จ', `ดำเนินการเรียบร้อยแล้ว`);
      setSelectedIds([]);
      load();
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถดำเนินการได้');
    } finally {
      setActionLoading(null);
    }
  };

  const viewLogs = async (sub: Sub) => {
    setLogsSub(sub);
    setLogsData('กำลังโหลด...');
    setStatsData('กำลังโหลด...');
    setShowLogsModal(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/api/admin/subscriptions/${sub.id}/logs`),
        api.get(`/api/admin/subscriptions/${sub.id}/stats`)
      ]);
      setLogsData(logsRes.data.logs);
      setStatsData(statsRes.data.stats);
    } catch {
      setLogsData('โหลดข้อมูลล้มเหลว');
      setStatsData('โหลดข้อมูลล้มเหลว');
    }
  };

  const doAction = async (id: number, action: string) => {
    setActionLoading(id);
    try {
      if (action === 'remove') {
        await api.delete(`/api/admin/subscriptions/${id}`);
      } else if (action === 'fix-npm') {
        await api.post(`/api/admin/subscriptions/${id}/fix-npm`);
      } else if (action === 'dns-harden' || action === 'dns-unharden') {
        const mode = action === 'dns-harden' ? 'proxied' : 'dns-only';
        await api.post(`/api/admin/subscriptions/${id}/dns-mode`, { mode });
      } else {
        await api.post(`/api/admin/subscriptions/${id}/action`, { action });
      }
      toast.success('สำเร็จ', `ดำเนินการเรียบร้อยแล้ว`);
      if (action === 'remove' || action === 'redeploy') setManageSub(null);
      load();
    } catch (err: any) {
      toast.error('ล้มเหลว', err.response?.data?.error || 'ไม่สามารถดำเนินการได้');
    } finally {
      setActionLoading(null);
    }
  };

  const updateMcIp = async (sub: Sub, value: string) => {
    setActionLoading(sub.id);
    try {
      await api.patch(`/api/admin/subscriptions/${sub.id}/mc-ip`, { mcIp: value.trim() || null });
      toast.success('สำเร็จ', `อัปเดต MC IP เรียบร้อยแล้ว`);
      load();
    } catch {
      toast.error('ล้มเหลว', 'ไม่สามารถอัปเดตได้');
    } finally {
      setActionLoading(null);
    }
  };

  const promptMcIp = (sub: Sub) => {
    const input = window.prompt(`กรอก IP ของ Minecraft Server`, sub.mc_ip || '');
    if (input !== null) updateMcIp(sub, input);
  };

  const adjustTime = async (
    sub: Sub,
    payload: { deltaDays: number; category: string | null; reason: string | null; notifyCustomer: boolean },
  ) => {
    setActionLoading(sub.id);
    try {
      await api.post(`/api/admin/subscriptions/${sub.id}/adjust-time`, payload);
      toast.success('สำเร็จ', `ปรับเวลา ${payload.deltaDays > 0 ? '+' : ''}${payload.deltaDays} วันแล้ว`);
      await load(true);
    } catch (err: any) {
      toast.error('ล้มเหลว', err.response?.data?.error || 'ไม่สามารถปรับเวลาได้');
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const exportPDF = () => {
    window.print();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">ร้านค้าทั้งหมด</h2>
          <p className="admin-sub">จัดการร้านค้าลูกค้า {total.toLocaleString('th-TH')} ร้าน</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="admin-btn">
            <Icon name="arrows-rotate" className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          <button onClick={exportPDF} className="admin-btn">
            <Icon name="file-pdf" /> พิมพ์รายงาน
          </button>
        </div>
      </div>

      <div className="admin-card admin-card-body">
        <div className="admin-toolbar">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5" role="group" aria-label="กรองตามสถานะ">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatus(tab.value)}
                aria-pressed={status === tab.value}
                className={`admin-btn admin-btn-sm ${status === tab.value ? 'admin-btn-primary' : ''}`}
              >
                <Icon name={tab.icon as IconName} className="text-[13px]" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 sm:ml-auto sm:w-[340px]">
            <input
              type="search"
              placeholder="ค้นหาร้าน โดเมน หรืออีเมล"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitSearch()}
              className="admin-input"
            />
            <button onClick={submitSearch} className="admin-btn shrink-0" aria-label="ค้นหา">
              <Icon name="magnifying-glass" className="text-[13px]" />
            </button>
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="admin-card admin-card-body border-primary/40 bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[14px] font-medium text-foreground">เลือกไว้ {selectedIds.length} ร้าน</p>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setSelectedIds([])} className="admin-btn admin-btn-sm flex-1 sm:flex-none">ยกเลิก</button>
              <button onClick={() => handleBulkAction('suspend')} disabled={actionLoading === -1} className="admin-btn admin-btn-sm flex-1 sm:flex-none">ระงับ</button>
              <button onClick={() => handleBulkAction('delete')} disabled={actionLoading === -1} className="admin-btn admin-btn-sm admin-btn-danger flex-1 sm:flex-none">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-card"><SkeletonTable rows={10} /></div>
      ) : subs.length === 0 ? (
        <div className="admin-card p-10">
          <EmptyState icon="store-slash" title="ไม่พบข้อมูลร้านค้า" description="ลองเปลี่ยนเงื่อนไขการค้นหา" actionLabel="กลับหน้าหลัก" actionHref="/admin" />
        </div>
      ) : (
        <div className="admin-card">
          <div className="p-3 md:p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="เลือกทั้งหมด"
                      checked={selectedIds.length === subs.length && subs.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 cursor-pointer accent-primary"
                    />
                  </th>
                  <th>ร้านค้า / เจ้าของ</th>
                  <th>โดเมน</th>
                  <th>สถานะ</th>
                  <th>แพ็กเกจ</th>
                  <th>เวลาที่เหลือ</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(sub => (
                  <tr key={sub.id}>
                    <td data-label="เลือก">
                      <input
                        type="checkbox"
                        aria-label={`เลือก ${sub.shop_name}`}
                        checked={selectedIds.includes(sub.id)}
                        onChange={() => toggleSelect(sub.id)}
                        className="w-4 h-4 cursor-pointer accent-primary"
                      />
                    </td>
                    <td data-label="ร้านค้า">
                      <span className="block font-medium text-foreground break-words">{sub.shop_name}</span>
                      <span className="block admin-meta break-all">{sub.display_name} ({sub.email})</span>
                    </td>
                    <td data-label="โดเมน">
                      <button
                        onClick={() => { navigator.clipboard.writeText(sub.domain); toast.info('คัดลอกแล้ว', sub.domain); }}
                        className="text-primary hover:underline cursor-pointer break-all text-left"
                      >
                        {sub.domain}
                      </button>
                      <span className="flex flex-wrap gap-1.5 mt-1.5 md:justify-start justify-end">
                        <span className="admin-chip">พอร์ต {sub.frontend_port}</span>
                        <button
                          onClick={() => promptMcIp(sub)}
                          className="admin-chip cursor-pointer hover:border-primary"
                          title="ตั้งค่า IP เซิร์ฟเวอร์มายคราฟสำหรับ firewall"
                        >
                          {sub.mc_ip || 'ยังไม่ตั้ง MC IP'}
                        </button>
                        {sub.custom_domain ? (
                          <button
                            onClick={() => { navigator.clipboard.writeText(sub.custom_domain!); toast.info('คัดลอกแล้ว', sub.custom_domain!); }}
                            className={`admin-chip cursor-pointer max-w-full ${customDomainMeta(sub.custom_domain_status).badge}`}
                            title={`โดเมนของลูกค้า: ${sub.custom_domain}`}
                          >
                            <span className="truncate">{sub.custom_domain}</span>
                            <span className="opacity-70 shrink-0">({customDomainMeta(sub.custom_domain_status).label})</span>
                          </button>
                        ) : (
                          <span className="admin-chip text-muted-foreground">ไม่มีโดเมนเอง</span>
                        )}
                      </span>
                    </td>
                    <td data-label="สถานะ"><StatusBadge status={sub.status} /></td>
                    <td data-label="แพ็กเกจ">
                      <span className="admin-num">{sub.package_months} เดือน</span>
                      <span className="admin-meta admin-num ml-1.5">฿{Number(sub.price_paid).toLocaleString()}</span>
                    </td>
                    <td data-label="เวลาที่เหลือ"><TimeRemaining date={sub.expires_at} /></td>
                    <td data-label="" className="md:text-right">
                      <span className="flex gap-2 md:justify-end">
                        <button onClick={() => viewLogs(sub)} title="ดู logs และการใช้ทรัพยากร" className="admin-btn admin-btn-sm flex-1 md:flex-none">
                          <Icon name="terminal" className="text-[13px]" /> Logs
                        </button>
                        <Link href={`/dashboard/credentials?id=${sub.id}`} title="ข้อมูลล็อกอิน" className="admin-btn admin-btn-sm flex-1 md:flex-none">
                          <Icon name="key" className="text-[13px]" /> รหัส
                        </Link>
                        <button onClick={() => setManageSub(sub)} disabled={actionLoading === sub.id} className="admin-btn admin-btn-sm admin-btn-primary flex-1 md:flex-none">
                          {actionLoading === sub.id ? <Icon name="spinner" className="animate-spin" /> : <Icon name="gear" className="text-[13px]" />}
                          จัดการ
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-border">
              <p className="admin-meta">
                แสดง {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} จาก {total} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <Icon name="chevron-left" className="text-[11px]" /> ก่อนหน้า
                </button>
                <span className="admin-meta admin-num">{page} / {pages}</span>
                <button className="admin-btn admin-btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                  ถัดไป <Icon name="chevron-right" className="text-[11px]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {manageSub && (
        <ManageModal
          sub={manageSub}
          loading={actionLoading === manageSub.id}
          onAction={(action) => doAction(manageSub.id, action)}
          onSetMcIp={(value) => updateMcIp(manageSub, value)}
          onAdjustTime={(payload) => adjustTime(manageSub, payload)}
          onClose={() => setManageSub(null)}
        />
      )}

      {showLogsModal && logsSub && createPortal(
        <div className="admin-shell fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-950/70" onClick={() => setShowLogsModal(false)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-xl z-10">
            <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h3 className="admin-section-title">Logs และการใช้ทรัพยากร</h3>
                <p className="admin-meta truncate">{logsSub.shop_name}</p>
              </div>
              <button onClick={() => setShowLogsModal(false)} className="admin-btn admin-btn-sm shrink-0" aria-label="ปิด">
                <Icon name="times" className="text-[13px]" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <section>
                <h4 className="admin-label">การใช้ทรัพยากรของคอนเทนเนอร์</h4>
                {/* The only place a horizontal scroller is right: log output is
                    pre-formatted and must not be re-wrapped or it stops lining up. */}
                <pre className="text-[12px] font-mono bg-secondary border border-border p-3 rounded-md overflow-x-auto whitespace-pre leading-relaxed">
                  {statsData}
                </pre>
              </section>
              <section>
                <h4 className="admin-label">Log ล่าสุดของแอปพลิเคชัน</h4>
                <pre className="text-[12px] font-mono bg-secondary border border-border p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-[45vh]">
                  {logsData}
                </pre>
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ManageModal({
  sub, loading, onAction, onSetMcIp, onAdjustTime, onClose,
}: {
  sub: Sub;
  loading: boolean;
  onAction: (action: string) => void;
  onSetMcIp: (value: string) => void;
  onAdjustTime: (payload: { deltaDays: number; category: string | null; reason: string | null; notifyCustomer: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [mcIpInput, setMcIpInput] = useState(sub.mc_ip || '');

  useEffect(() => { setMcIpInput(sub.mc_ip || ''); }, [sub.id]);

  useEffect(() => {
    setMounted(true);
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!mounted) return null;

  const mcIpDirty = (mcIpInput.trim() || null) !== (sub.mc_ip || null);
  const mcIpValid = !mcIpInput.trim() || /^(\d{1,3}\.){3}\d{1,3}$/.test(mcIpInput.trim());
  const isSuspended = sub.status === 'suspended';

  return createPortal(
    <div className="admin-shell fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/55" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg flex flex-col bg-card border border-border rounded-t-xl sm:rounded-xl shadow-xl z-10 max-h-[92vh]">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{sub.shop_name}</p>
            <div className="mt-1"><StatusBadge status={sub.status} /></div>
          </div>
          <button onClick={onClose} className="admin-btn admin-btn-sm shrink-0" aria-label="ปิด">
            <Icon name="times" className="text-[13px]" />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a href={`https://${sub.domain}/admin`} target="_blank" rel="noopener noreferrer" className="admin-btn">
              <Icon name="arrow-up-right-from-square" className="text-[13px]" /> เปิดหน้าร้าน
            </a>
            <Link href={`/dashboard/credentials?id=${sub.id}`} className="admin-btn">
              <Icon name="key" className="text-[13px]" /> ข้อมูลล็อกอิน
            </Link>
          </div>

          <div className="border border-border rounded-md p-3.5">
            <label htmlFor="mc-ip" className="admin-label">IP เซิร์ฟเวอร์มายคราฟ (firewall)</label>
            <div className="flex gap-2">
              <input
                id="mc-ip"
                type="text"
                inputMode="decimal"
                value={mcIpInput}
                onChange={e => setMcIpInput(e.target.value)}
                placeholder="1.2.3.4 (เว้นว่างเพื่อปิด)"
                className="admin-input"
              />
              <button
                onClick={() => onSetMcIp(mcIpInput)}
                disabled={loading || !mcIpDirty || !mcIpValid}
                className="admin-btn admin-btn-primary shrink-0"
              >
                บันทึก
              </button>
            </div>
            {!mcIpValid && mcIpInput && (
              <p className="text-[13px] text-destructive mt-1.5">รูปแบบ IP ไม่ถูกต้อง</p>
            )}
          </div>

          <AdjustTimeSection sub={sub} loading={loading} onAdjustTime={onAdjustTime} />

          <div>
            <span className="admin-label">การควบคุมระบบ</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ActionTile icon="rotate" label="รีสตาร์ท" disabled={loading} onClick={() => onAction('restart')} />
              <ActionTile icon="play" label="เริ่มระบบ" disabled={loading} onClick={() => onAction('start')} />
              <ActionTile icon="stop" label="หยุดระบบ" disabled={loading} onClick={() => onAction('stop')} />
              <ActionTile icon="wand-magic-sparkles" label="ซ่อม NPM" disabled={loading} onClick={() => onAction('fix-npm')} />
              <ActionTile icon="rocket" label="ติดตั้งใหม่" disabled={loading} onClick={() => onAction('redeploy')} />
              <ActionTile
                icon="shield-halved" label="กัน DDoS (CF Proxy)"
                disabled={loading}
                onClick={() => {
                  if (confirm(
                    'เปลี่ยน DNS ของร้านนี้เป็น Cloudflare Proxied?\n\n' +
                    'ได้: ซ่อน origin IP ป้องกัน DDoS attack\n' +
                    'เสีย: MySQL port (33XXX) จะใช้จากภายนอกไม่ได้ ใช้ได้เฉพาะลูกค้าที่ใช้ Bridge\n' +
                    'ระวัง: Let\'s Encrypt cert จะ renew ไม่ผ่าน HTTP-01 ในครั้งถัดไป เปลี่ยน NPM มาใช้ Cloudflare Origin Certificate ก่อนหมดอายุ\n\n' +
                    'หลังกด ต้องทำต่อ: รัน deploy/harden-mysql-port.sh เพื่อปิด MySQL port ที่ host firewall\n' +
                    'รายละเอียดทั้งหมดใน deploy/OPERATIONS-DDOS-HARDEN.md\n\n' +
                    'แนะนำเฉพาะลูกค้า Bridge เท่านั้น'
                  )) onAction('dns-harden');
                }}
              />
              <ActionTile
                icon="shield-xmark" label="ปลดกัน (DNS-only)"
                disabled={loading}
                onClick={() => {
                  if (confirm('คืน DNS เป็น DNS-only (เปิด MySQL port กลับมา)?\n\nใช้สำหรับลูกค้าที่ยังใช้ AuthMe direct')) onAction('dns-unharden');
                }}
              />
              {isSuspended ? (
                <ActionTile icon="circle-check" label="ปลดระงับ" disabled={loading} onClick={() => onAction('unsuspend')} />
              ) : (
                <ActionTile icon="ban" label="ระงับใช้งาน" disabled={loading} onClick={() => onAction('suspend')} />
              )}
            </div>
          </div>

          <div className="pt-1 border-t border-border">
            <button onClick={() => onAction('remove')} disabled={loading} className="admin-btn admin-btn-danger w-full mt-4">
              <Icon name="trash" className="text-[13px]" /> ลบร้านค้าถาวร
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-2.5 bg-primary text-primary-foreground text-[13px] font-medium flex items-center justify-center gap-2 shrink-0">
            <Icon name="spinner" className="animate-spin" /> กำลังดำเนินการ
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const ADJUST_CATEGORIES: { value: string; label: string }[] = [
  { value: 'compensation', label: 'ชดเชย' },
  { value: 'promotion',    label: 'โปรโมชั่น' },
  { value: 'correction',   label: 'แก้ไขข้อมูล' },
  { value: 'goodwill',     label: 'น้ำใจ' },
];

function fmtDate(d: string | Date | null): string {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

interface Adjustment {
  id: number; delta_days: number; old_expires_at: string | null; new_expires_at: string | null;
  category: string | null; reason: string | null; notify_customer: number; created_at: string; admin_name: string | null;
}

function AdjustTimeSection({
  sub, loading, onAdjustTime,
}: {
  sub: Sub;
  loading: boolean;
  onAdjustTime: (payload: { deltaDays: number; category: string | null; reason: string | null; notifyCustomer: boolean }) => Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [category, setCategory] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(false);
  const [history, setHistory] = useState<Adjustment[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get(`/api/admin/subscriptions/${sub.id}/adjustments`);
      setHistory(r.data.adjustments || []);
    } catch { /* non-critical */ }
  }, [sub.id]);

  useEffect(() => {
    setDelta(0); setCategory(''); setReason(''); setNotify(false);
    loadHistory();
  }, [sub.id, loadHistory]);

  const preview = delta !== 0
    ? new Date(new Date(sub.expires_at).getTime() + delta * 86400000)
    : null;

  const submit = async () => {
    if (delta === 0) return;
    try {
      await onAdjustTime({
        deltaDays: delta,
        category: category || null,
        reason: reason.trim() || null,
        notifyCustomer: notify,
      });
      setDelta(0); setCategory(''); setReason(''); setNotify(false);
      loadHistory();
    } catch { /* toast handled upstream */ }
  };

  return (
    <div className="border border-border rounded-md p-3.5 space-y-3">
      <span className="admin-label">ปรับเวลาหมดอายุ (ชดเชย / โปรโมชั่น)</span>

      <div className="grid grid-cols-3 gap-2">
        {[1, 7, 30].map(p => (
          <button key={`plus-${p}`} onClick={() => setDelta(d => d + p)} className="admin-btn admin-btn-sm">
            +{p} วัน
          </button>
        ))}
        {[1, 7].map(p => (
          <button key={`minus-${p}`} onClick={() => setDelta(d => d - p)} className="admin-btn admin-btn-sm">
            -{p} วัน
          </button>
        ))}
        <button onClick={() => setDelta(0)} className="admin-btn admin-btn-sm">รีเซ็ต</button>
      </div>

      <div>
        <label htmlFor="adj-days" className="admin-label">จำนวนวัน (ใส่ค่าติดลบเพื่อหักเวลา)</label>
        <input
          id="adj-days"
          type="number"
          inputMode="numeric"
          value={delta || ''}
          onChange={e => setDelta(parseInt(e.target.value) || 0)}
          placeholder="0"
          className="admin-input admin-num"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor="adj-cat" className="admin-label">ประเภท (ไม่บังคับ)</label>
          <select id="adj-cat" value={category} onChange={e => setCategory(e.target.value)} className="admin-select">
            <option value="">ไม่ระบุ</option>
            {ADJUST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-[14px] cursor-pointer select-none sm:mt-6">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="w-4 h-4 accent-primary cursor-pointer" />
          แจ้งลูกค้าเป็น popup
        </label>
      </div>

      <div>
        <label htmlFor="adj-reason" className="admin-label">เหตุผล (ไม่บังคับ)</label>
        <textarea
          id="adj-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="เช่น ชดเชยเซิร์ฟล่ม 2 ชม."
          className="admin-textarea"
          style={{ minHeight: '4rem' }}
        />
      </div>

      {preview && (
        <p className="text-[13px] border border-border rounded-md px-3 py-2">
          หมดอายุใหม่: <span className="font-medium text-foreground">{fmtDate(preview)}</span>
          <span className="text-muted-foreground"> (เดิม {fmtDate(sub.expires_at)})</span>
        </p>
      )}

      <button onClick={submit} disabled={loading || delta === 0} className="admin-btn admin-btn-primary w-full">
        ยืนยันปรับเวลา
      </button>

      {history.length > 0 && (
        <div className="pt-2 border-t border-border">
          <span className="admin-label">ประวัติการปรับล่าสุด</span>
          <ul className="divide-y divide-border">
            {history.slice(0, 5).map(h => {
              const cat = ADJUST_CATEGORIES.find(c => c.value === h.category);
              return (
                <li key={h.id} className="py-2 flex items-baseline gap-2 flex-wrap text-[13px]">
                  <span className={`admin-num font-medium ${h.delta_days > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {h.delta_days > 0 ? '+' : ''}{h.delta_days} วัน
                  </span>
                  {cat && <span className="admin-chip">{cat.label}</span>}
                  {h.notify_customer ? <span className="admin-meta">แจ้งลูกค้าแล้ว</span> : null}
                  {h.reason && <span className="text-muted-foreground break-words">{h.reason}</span>}
                  <span className="admin-meta ml-auto whitespace-nowrap">{fmtDate(h.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A control-system action. All tiles look identical on purpose: the label is
 *  what tells them apart, and a grid of ten differently tinted icons was
 *  slower to read, not faster. */
function ActionTile({
  icon, label, disabled, onClick,
}: {
  icon: IconName; label: string;
  disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="admin-btn justify-start text-left">
      <Icon name={icon} className="text-[14px] text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function CustomersPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
