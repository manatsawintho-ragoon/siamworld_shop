'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  user_id: number;
  username: string;
  role: string;
  action_type: string;
  description: string;
  amount: number | null;
  ref_id: string | null;
  status_extra: string | null;
  ts: string;
}

type TypeFilter =
  | 'all' | 'register' | 'user_login'
  | 'topup' | 'purchase' | 'lootbox' | 'redeem'
  | 'admin_action';
type RoleFilter = 'all' | 'admin' | 'member';

// ─── Config ───────────────────────────────────────────────────────────────────

interface TypeMeta {
  icon: string; bg: string; color: string; label: string;
  amountColor?: string; amountPrefix?: string;
  group: 'user' | 'admin';
}

const TYPE_META: Record<string, TypeMeta> = {
  // ── User actions ──
  register:    { icon: 'fa-user-plus',    bg: 'bg-green-100',   color: 'text-green-600',   label: 'สมัครสมาชิก',   group: 'user' },
  user_login:  { icon: 'fa-right-to-bracket', bg: 'bg-sky-100', color: 'text-sky-600',     label: 'เข้าสู่ระบบ',   group: 'user' },
  topup:       { icon: 'fa-circle-plus',  bg: 'bg-blue-100',    color: 'text-blue-600',    label: 'เติมเงิน',       group: 'user', amountColor: 'text-blue-600', amountPrefix: '+' },
  purchase:    { icon: 'fa-shopping-bag', bg: 'bg-orange-100',  color: 'text-orange-600',  label: 'ซื้อสินค้า',    group: 'user', amountColor: 'text-red-500',  amountPrefix: '-' },
  lootbox:     { icon: 'fa-gift',         bg: 'bg-purple-100',  color: 'text-purple-600',  label: 'เปิดกล่อง',     group: 'user', amountColor: 'text-red-500',  amountPrefix: '-' },
  redeem:      { icon: 'fa-ticket-alt',   bg: 'bg-teal-100',    color: 'text-teal-600',    label: 'ใช้โค้ด',       group: 'user', amountColor: 'text-teal-600', amountPrefix: '+' },
  // ── Admin: Products ──
  admin_product_create: { icon: 'fa-box-open',    bg: 'bg-indigo-100', color: 'text-indigo-600', label: 'เพิ่มสินค้า',   group: 'admin' },
  admin_product_update: { icon: 'fa-pen-to-square', bg: 'bg-indigo-100', color: 'text-indigo-600', label: 'แก้ไขสินค้า',  group: 'admin' },
  admin_product_delete: { icon: 'fa-box-open',    bg: 'bg-red-100',    color: 'text-red-500',    label: 'ลบสินค้า',     group: 'admin' },
  // ── Admin: Loot boxes ──
  admin_lootbox_create:      { icon: 'fa-gift',   bg: 'bg-purple-100', color: 'text-purple-600', label: 'เพิ่มกล่อง',    group: 'admin' },
  admin_lootbox_update:      { icon: 'fa-gift',   bg: 'bg-purple-100', color: 'text-purple-600', label: 'แก้ไขกล่อง',   group: 'admin' },
  admin_lootbox_delete:      { icon: 'fa-gift',   bg: 'bg-red-100',    color: 'text-red-500',    label: 'ลบกล่อง',       group: 'admin' },
  admin_lootbox_item_create: { icon: 'fa-gem',    bg: 'bg-violet-100', color: 'text-violet-600', label: 'เพิ่มไอเท็ม',   group: 'admin' },
  admin_lootbox_item_update: { icon: 'fa-gem',    bg: 'bg-violet-100', color: 'text-violet-600', label: 'แก้ไขไอเท็ม',  group: 'admin' },
  admin_lootbox_item_delete: { icon: 'fa-gem',    bg: 'bg-red-100',    color: 'text-red-500',    label: 'ลบไอเท็ม',      group: 'admin' },
  // ── Admin: Codes ──
  admin_code_create: { icon: 'fa-ticket-alt', bg: 'bg-teal-100',   color: 'text-teal-600',   label: 'สร้างโค้ด',     group: 'admin' },
  admin_code_update: { icon: 'fa-ticket-alt', bg: 'bg-teal-100',   color: 'text-teal-600',   label: 'แก้ไขโค้ด',    group: 'admin' },
  admin_code_delete: { icon: 'fa-ticket-alt', bg: 'bg-red-100',    color: 'text-red-500',    label: 'ลบโค้ด',        group: 'admin' },
  // ── Admin: Servers ──
  admin_server_create: { icon: 'fa-server',  bg: 'bg-cyan-100',   color: 'text-cyan-600',   label: 'เพิ่มเซิร์ฟ',   group: 'admin' },
  admin_server_update: { icon: 'fa-server',  bg: 'bg-cyan-100',   color: 'text-cyan-600',   label: 'แก้ไขเซิร์ฟ',  group: 'admin' },
  admin_server_delete: { icon: 'fa-server',  bg: 'bg-red-100',    color: 'text-red-500',    label: 'ลบเซิร์ฟ',      group: 'admin' },
  admin_server_toggle: { icon: 'fa-power-off', bg: 'bg-cyan-100', color: 'text-cyan-600',   label: 'เปิด/ปิดเซิร์ฟ', group: 'admin' },
  // ── Admin: Users ──
  admin_wallet_adjust: { icon: 'fa-coins',    bg: 'bg-yellow-100', color: 'text-yellow-600', label: 'ปรับยอดเงิน',   group: 'admin', amountColor: 'text-yellow-600' },
  admin_user_role:     { icon: 'fa-shield-alt', bg: 'bg-orange-100', color: 'text-orange-600', label: 'เปลี่ยน Role', group: 'admin' },
  admin_user_edit:     { icon: 'fa-user-pen',  bg: 'bg-gray-100',  color: 'text-gray-600',   label: 'แก้ไข User',    group: 'admin' },
  // ── Admin: System ──
  admin_settings:  { icon: 'fa-sliders',  bg: 'bg-gray-100',   color: 'text-gray-600',   label: 'Settings',       group: 'admin' },
  admin_rcon_cmd:  { icon: 'fa-terminal', bg: 'bg-slate-800',  color: 'text-green-400',  label: 'RCON Command',   group: 'admin' },
};

const fallbackMeta: TypeMeta = { icon: 'fa-circle-dot', bg: 'bg-gray-100', color: 'text-gray-500', label: 'กิจกรรม', group: 'user' };

const PURCHASE_STATUS: Record<string, { label: string; cls: string }> = {
  delivered: { label: 'สำเร็จ',     cls: 'bg-green-100  text-green-700  border-green-200' },
  pending:   { label: 'รอดำเนิน',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  failed:    { label: 'ล้มเหลว',   cls: 'bg-red-100    text-red-700    border-red-200' },
  refunded:  { label: 'คืนเงิน',   cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

// ─── Filter options (grouped) ─────────────────────────────────────────────────

const LIMIT = 20;
const REFRESH_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาที`;
  if (hrs  < 24) return `${hrs} ชม.`;
  if (days <  7) return `${days} วัน`;
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function fmtFull(ts: string) {
  return new Date(ts).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function dateSep(ts: string): string {
  const d    = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const day   = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return 'วันนี้';
  if (day.getTime() === yest.getTime())  return 'เมื่อวาน';
  return d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAuditLog() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();

  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [roleFilter, setRoleFilter]   = useState<RoleFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retentionStats, setRetentionStats] = useState<{
    login_count: number; admin_count: number; total_count: number; size_mb: number | null; oldest: string | null;
  } | null>(null);
  const [purging, setPurging] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(() => {
    api('/admin/logs/stats', { token: getToken()! })
      .then((d: any) => setRetentionStats(d.stats))
      .catch(() => {});
  }, []);

  const handlePurge = async () => {
    if (!await adminConfirm({
      title: 'ล้าง Log เก่า',
      message: 'ลบ Login log เก่ากว่า 30 วัน และ Admin log เก่ากว่า 365 วัน — ยืนยัน?',
      type: 'warning', confirmLabel: 'ล้างเลย',
    })) return;
    setPurging(true);
    try {
      const d: any = await api('/admin/logs/purge', { method: 'DELETE', token: getToken()! });
      adminAlert({ title: `ล้างแล้ว ${d.deleted.toLocaleString()} แถว`, type: 'success' });
      load();
      loadStats();
    } catch (err: any) {
      adminAlert({ title: 'เกิดข้อผิดพลาด', message: err?.message, type: 'error' });
    } finally { setPurging(false); }
  };

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [typeFilter, roleFilter]);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      type: typeFilter, role: roleFilter,
      ...(search ? { search } : {}),
    });
    api(`/admin/logs?${params}`, { token: getToken()! })
      .then((d: any) => {
        setLogs(d.logs || []);
        setTotal(d.pagination?.total || 0);
        setTotalPages(d.pagination?.totalPages || 1);
        setLastUpdated(new Date());
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [page, typeFilter, roleFilter, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Auto-refresh every 30s on page 1, only when visible
  useEffect(() => {
    if (page !== 1) return;
    const tick = () => { if (document.visibilityState === 'visible') load(true); };
    const t = setInterval(tick, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [page, load]);

  const handleRetry = async (refId: string) => {
    setActionLoading(refId);
    try {
      await api(`/admin/purchases/${refId}/retry`, { method: 'POST', token: getToken()! });
      adminAlert({ title: 'ส่ง RCON ซ้ำแล้ว', type: 'success' });
      load();
    } catch (err: any) {
      adminAlert({ title: 'เกิดข้อผิดพลาด', message: err?.message, type: 'error' });
    } finally { setActionLoading(null); }
  };

  const handleRefund = async (refId: string) => {
    if (!await adminConfirm({ title: 'คืนเงิน', message: 'ต้องการคืนเงินรายการนี้?', type: 'warning', confirmLabel: 'คืนเงิน' })) return;
    setActionLoading(refId);
    try {
      await api(`/admin/purchases/${refId}/refund`, { method: 'POST', token: getToken()! });
      adminAlert({ title: 'คืนเงินสำเร็จ', type: 'success' });
      load();
    } catch (err: any) {
      adminAlert({ title: 'คืนเงินไม่สำเร็จ', message: err?.message, type: 'error' });
    } finally { setActionLoading(null); }
  };

  // Date separator grouping
  const grouped: { sep: string | null; entry: LogEntry }[] = [];
  let lastSep = '';
  for (const log of logs) {
    const sep = dateSep(log.ts);
    grouped.push({ sep: sep !== lastSep ? sep : null, entry: log });
    lastSep = sep;
  }

  const hasFilters = typeFilter !== 'all' || roleFilter !== 'all' || search !== '';

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-scroll text-[#f97316]" /> Audit Log
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">บันทึกทุกกิจกรรมของเว็บไซต์</p>
            {page === 1 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-50 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-bold text-green-600">LIVE 30s</span>
              </span>
            )}
            {lastUpdated && (
              <span className="text-[10px] text-gray-300">· {fmtFull(lastUpdated.toISOString())}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-none active:translate-y-[1px] disabled:opacity-50"
        >
          <i className={`fas fa-sync-alt text-[10px] ${loading ? 'fa-spin' : ''}`} /> รีเฟรช
        </button>
      </div>

      {/* ── Retention stats bar ── */}
      {retentionStats && (
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_16px_rgba(0,0,0,0.08)] border border-gray-200/70 px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <i className="fas fa-database text-gray-400 text-[10px]" />
            <span className="font-bold text-gray-700">{Number(retentionStats.total_count).toLocaleString()}</span> แถวใน DB
            {retentionStats.size_mb != null && (
              <span className="text-gray-400">({retentionStats.size_mb} MB)</span>
            )}
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="text-gray-500">Login log:</span>
            <span className="font-bold text-gray-700">{Number(retentionStats.login_count).toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 bg-sky-50 border border-sky-200 px-1.5 rounded-md">เก็บ 30 วัน</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-gray-500">Admin action:</span>
            <span className="font-bold text-gray-700">{Number(retentionStats.admin_count).toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 bg-orange-50 border border-orange-200 px-1.5 rounded-md">เก็บ 365 วัน</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <i className="fas fa-clock text-[9px]" />
            ล้างอัตโนมัติทุกคืน 02:00
          </div>
          <button
            onClick={handlePurge}
            disabled={purging}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <i className={`fas fa-broom text-[10px] ${purging ? 'fa-spin' : ''}`} />
            {purging ? 'กำลังล้าง...' : 'ล้าง Log เก่า'}
          </button>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_16px_rgba(0,0,0,0.08)] border border-gray-200/70 px-4 py-3 flex items-center gap-3 flex-wrap">

        {/* Type filter — segmented group style */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1 flex-wrap">
          {/* User actions */}
          {([
            { key: 'all',          label: 'ทั้งหมด',     icon: 'fa-list' },
            { key: 'user_login',   label: 'Login',        icon: 'fa-right-to-bracket' },
            { key: 'register',     label: 'สมัคร',       icon: 'fa-user-plus' },
            { key: 'topup',        label: 'เติมเงิน',    icon: 'fa-circle-plus' },
            { key: 'purchase',     label: 'ซื้อ',         icon: 'fa-shopping-bag' },
            { key: 'lootbox',      label: 'กล่อง',       icon: 'fa-gift' },
            { key: 'redeem',       label: 'โค้ด',         icon: 'fa-ticket-alt' },
          ] as { key: TypeFilter; label: string; icon: string }[]).map(f => {
            const meta = f.key === 'all' ? null : TYPE_META[f.key];
            const isActive = typeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? f.key === 'all' ? 'bg-[#1e2735] text-white shadow-sm'
                    : `${meta?.bg.replace('bg-', 'bg-')} ${meta?.color} shadow-sm border border-current/20`
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
                }`}
              >
                <i className={`fas ${f.icon} text-[9px]`} />
                {f.label}
              </button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-gray-300 mx-0.5 flex-shrink-0" />

          {/* Admin actions */}
          <button
            onClick={() => setTypeFilter('admin_action')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
              typeFilter === 'admin_action'
                ? 'bg-[#f97316] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
            }`}
          >
            <i className="fas fa-shield-alt text-[9px]" /> กิจกรรม Admin
          </button>
        </div>

        {/* Role + Search */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Role */}
          <div className="relative">
            <i className="fas fa-users absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as RoleFilter)}
              className="pl-7 pr-6 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-orange-400 appearance-none cursor-pointer text-gray-700"
            >
              <option value="all">ทุกสิทธิ์</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <i className="fas fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[8px] pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative">
            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[11px]" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="ค้นหา username..."
              className="w-44 pl-8 pr-7 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/15 transition-colors"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                <i className="fas fa-times text-[7px] text-gray-500" />
              </button>
            )}
          </div>

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={() => { setTypeFilter('all'); setRoleFilter('all'); setSearchInput(''); }}
              className="text-[11px] text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-bold flex-shrink-0"
            >
              <i className="fas fa-rotate-left text-[9px] mr-1" />ล้าง
            </button>
          )}

          <span className="text-[11px] text-gray-400 tabular-nums font-medium flex-shrink-0 pl-1 border-l border-gray-200">
            {total.toLocaleString()} รายการ
          </span>
        </div>
      </div>

      {/* ── Log list ── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.08)] border border-gray-200/70 overflow-hidden">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <i className="fas fa-spinner fa-spin text-2xl text-orange-400" />
            <p className="text-xs text-gray-400">กำลังโหลด...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-300">
            <i className="fas fa-scroll text-5xl" />
            <p className="text-sm text-gray-400 font-medium">ไม่พบรายการ</p>
            {hasFilters && (
              <button onClick={() => { setTypeFilter('all'); setRoleFilter('all'); setSearchInput(''); }}
                className="text-xs text-orange-500 hover:underline">ล้างตัวกรอง</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50/80">
            {grouped.map(({ sep, entry: log }, i) => {
              const meta      = TYPE_META[log.action_type] ?? fallbackMeta;
              const isAdmin   = meta.group === 'admin';
              const pStatus   = log.action_type === 'purchase' && log.status_extra ? PURCHASE_STATUS[log.status_extra] : null;
              const canAction = log.action_type === 'purchase' && log.ref_id &&
                (log.status_extra === 'failed' || log.status_extra === 'pending');
              const hasAmount = log.amount !== null && log.amount !== undefined && Number(log.amount) > 0;

              return (
                <div key={i}>
                  {/* Date separator */}
                  {sep && (
                    <div className="flex items-center gap-3 px-5 py-2 bg-gray-50/80 sticky top-0 z-10">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{sep}</span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}

                  {/* Log row */}
                  <div className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 transition-colors ${isAdmin ? 'bg-orange-50/20' : ''}`}>

                    {/* Action icon */}
                    <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`fas ${meta.icon} ${meta.color} text-xs`} />
                    </div>

                    {/* Avatar */}
                    <img
                      src={`https://mc-heads.net/avatar/${log.username}/28`}
                      alt={log.username}
                      className={`w-7 h-7 rounded-lg flex-shrink-0 border ${isAdmin ? 'border-orange-200' : 'border-gray-200'}`}
                      onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/28'; }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/admin/users/${log.user_id}`}
                          className="text-[13px] font-black text-gray-900 hover:text-[#f97316] transition-colors"
                        >
                          {log.username}
                        </Link>
                        {/* Role badge */}
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                          log.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <i className={`fas ${log.role === 'admin' ? 'fa-shield-alt' : 'fa-user'} text-[7px]`} />
                          {log.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                        {/* Action badge */}
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-current/10 ${meta.bg} ${meta.color}`}>
                          <i className={`fas ${meta.icon} text-[7px]`} />
                          {meta.label}
                        </span>
                        {/* Purchase status */}
                        {pStatus && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${pStatus.cls}`}>
                            {pStatus.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">{log.description}</p>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Retry/Refund */}
                      {canAction && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleRetry(log.ref_id!)} disabled={actionLoading === log.ref_id}
                            className="h-6 px-2 flex items-center gap-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold transition-colors disabled:opacity-50">
                            {actionLoading === log.ref_id ? <i className="fas fa-spinner fa-spin text-[9px]" /> : <><i className="fas fa-redo text-[9px]" /> Retry</>}
                          </button>
                          <button onClick={() => handleRefund(log.ref_id!)} disabled={actionLoading === log.ref_id}
                            className="h-6 px-2 flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-[10px] font-bold transition-colors disabled:opacity-50">
                            {actionLoading === log.ref_id ? <i className="fas fa-spinner fa-spin text-[9px]" /> : <><i className="fas fa-rotate-left text-[9px]" /> คืน</>}
                          </button>
                        </div>
                      )}
                      {/* Amount */}
                      {hasAmount && (
                        <p className={`text-[13px] font-black tabular-nums w-20 text-right ${meta.amountColor || 'text-gray-700'}`}>
                          {meta.amountPrefix}{Number(log.amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ฿
                        </p>
                      )}
                      {/* Time */}
                      <p className="text-[11px] text-gray-400 font-medium w-16 text-right tabular-nums" title={fmtFull(log.ts)}>
                        {fmtTime(log.ts)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between gap-4">
            <p className="text-[11px] text-gray-400 tabular-nums">
              หน้า <span className="font-bold text-gray-700">{page}</span> / {totalPages}
              <span className="text-gray-300 ml-1">· {total.toLocaleString()} รายการ</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-[10px] text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <i className="fas fa-angles-left" />
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-[10px] text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <i className="fas fa-chevron-left" />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] font-bold transition-all ${
                      page === p ? 'bg-[#1e2735] text-white border-[#1e2735] shadow-[0_2px_0_#0d131d]' : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-[10px] text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <i className="fas fa-chevron-right" />
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-[10px] text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <i className="fas fa-angles-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
