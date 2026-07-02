'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';

interface OnlinePlayer {
  name: string;
  hasAccount: boolean;
  userId?: number;
  role?: string;
  banned?: boolean;
  walletBalance?: number;
  totalTopup?: number;
  totalSpent?: number;
  createdAt?: string;
  onlineSince?: number | null;
  // injected client-side
  serverId?: string;
  serverName?: string;
}

interface OnlineServer {
  id: string;
  serverName: string;
  count: number;
  truncated: boolean;
  players: OnlinePlayer[];
}

interface OnlineData {
  servers: OnlineServer[];
  totalOnline: number;
  peakToday: number;
  matchedAccounts: number;
  guests: number;
}

const REFRESH_MS = 10000;
type SortKey = 'playtime' | 'balance' | 'name';
type AccFilter = 'all' | 'account' | 'guest' | 'banned' | 'admin';

const fmtMoney = (n?: number) => (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

function fmtDuration(sinceMs?: number | null, nowMs?: number): string {
  if (!sinceMs) return '-';
  const s = Math.max(0, Math.floor(((nowMs ?? Date.now()) - sinceMs) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ชม ${m} น`;
  if (m > 0) return `${m} น ${sec} วิ`;
  return `${sec} วิ`;
}

const worldLabel = (w: string | null): string => {
  if (!w) return 'ไม่ทราบ';
  const map: Record<string, string> = {
    'minecraft:overworld': 'โลกปกติ (Overworld)',
    'minecraft:the_nether': 'เนเธอร์ (Nether)',
    'minecraft:the_end': 'ดิเอนด์ (The End)',
  };
  return map[w.toLowerCase()] || w;
};

export default function AdminOnlinePlayers() {
  const [data, setData]           = useState<OnlineData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow]             = useState(Date.now());

  // Filters
  const [search, setSearch]   = useState('');
  const [serverId, setServerId] = useState<string>('all');
  const [accFilter, setAccFilter] = useState<AccFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('playtime');

  // Detail drawer
  const [selected, setSelected]   = useState<OnlinePlayer | null>(null);
  const [world, setWorld]         = useState<string | null>(null);
  const [worldLoading, setWorldLoading] = useState(false);

  const dataTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api('/admin/online-players', { token: getToken()! })
      .then((d: any) => {
        setData({
          servers: d.servers || [],
          totalOnline: d.totalOnline || 0,
          peakToday: d.peakToday || 0,
          matchedAccounts: d.matchedAccounts || 0,
          guests: d.guests || 0,
        });
        setUpdatedAt(new Date());
        setError('');
      })
      .catch((err: any) => setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    dataTimer.current = setInterval(() => load(true), REFRESH_MS);
    tickTimer.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (dataTimer.current) clearInterval(dataTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flatten all servers into one list (each player tagged with its server) so many
  // players are visible in a single dense grid without hunting through sections.
  const allPlayers = useMemo<OnlinePlayer[]>(() => {
    if (!data) return [];
    const out: OnlinePlayer[] = [];
    for (const s of data.servers) {
      for (const p of s.players) out.push({ ...p, serverId: s.id, serverName: s.serverName });
    }
    return out;
  }, [data]);

  const filtered = useMemo(() => {
    let list = allPlayers;
    if (serverId !== 'all') list = list.filter(p => p.serverId === serverId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (accFilter === 'account') list = list.filter(p => p.hasAccount);
    else if (accFilter === 'guest') list = list.filter(p => !p.hasAccount);
    else if (accFilter === 'banned') list = list.filter(p => p.banned);
    else if (accFilter === 'admin') list = list.filter(p => p.role === 'admin');

    const sorted = [...list];
    if (sortKey === 'playtime') sorted.sort((a, b) => (a.onlineSince ?? Infinity) - (b.onlineSince ?? Infinity)); // longest online first
    else if (sortKey === 'balance') sorted.sort((a, b) => (b.walletBalance ?? -1) - (a.walletBalance ?? -1));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [allPlayers, serverId, search, accFilter, sortKey]);

  const openDetail = (p: OnlinePlayer) => {
    setSelected(p);
    setWorld(null);
    setWorldLoading(true);
    api(`/admin/online-players/${p.serverId}/${encodeURIComponent(p.name)}/world`, { token: getToken()! })
      .then((d: any) => setWorld(d.world ?? null))
      .catch(() => setWorld(null))
      .finally(() => setWorldLoading(false));
  };

  const CHIPS: { key: AccFilter; icon: string; label: string }[] = [
    { key: 'all',     icon: 'fa-layer-group',  label: 'ทั้งหมด' },
    { key: 'account', icon: 'fa-user-check',   label: 'มีบัญชีเว็บ' },
    { key: 'guest',   icon: 'fa-user-secret',  label: 'ไม่มีบัญชี' },
    { key: 'banned',  icon: 'fa-ban',          label: 'ถูกระงับ' },
    { key: 'admin',   icon: 'fa-shield-alt',   label: 'Admin' },
  ];

  const summary = [
    { label: 'ออนไลน์ตอนนี้', value: String(data?.totalOnline ?? 0), icon: 'fa-users',      grad: 'from-green-500 to-emerald-600', pulse: true },
    { label: 'Peak วันนี้',    value: String(data?.peakToday ?? 0),   icon: 'fa-arrow-trend-up', grad: 'from-orange-500 to-amber-600' },
    { label: 'มีบัญชีเว็บ',    value: String(data?.matchedAccounts ?? 0), icon: 'fa-user-check', grad: 'from-blue-500 to-indigo-600' },
    { label: 'เซิร์ฟเวอร์',    value: String(data?.servers.length ?? 0), icon: 'fa-server',    grad: 'from-slate-600 to-gray-800' },
  ];

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-signal text-[#22c55e]"></i> ผู้เล่นออนไลน์
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            เรียลไทม์ + ข้อมูลบัญชีเว็บของแต่ละคน
            {updatedAt && <span className="ml-1">· อัปเดต {updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.</span>}
          </p>
        </div>
        <button onClick={() => load()} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#1e2735] text-white shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d131d] active:translate-y-[2px] disabled:opacity-60">
          <i className={`fas fa-rotate ${loading ? 'fa-spin' : ''} text-xs`}></i> รีเฟรช
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle flex-shrink-0"></i><span className="flex-1 text-xs">{error}</span>
        </div>
      )}

      {/* Summary hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map(s => (
          <div key={s.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.grad} p-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.15)]`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-black tabular-nums leading-none flex items-center gap-2">
                  {s.value}
                  {s.pulse && (data?.totalOnline ?? 0) > 0 && <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse"></span>}
                </p>
                <p className="text-[11px] font-semibold text-white/80 mt-1.5">{s.label}</p>
              </div>
              <i className={`fas ${s.icon} text-3xl text-white/25`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Filter / search bar */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อผู้เล่น..."
            className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"><i className="fas fa-times"></i></button>
          )}
        </div>
        {/* Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CHIPS.map(c => (
            <button key={c.key} onClick={() => setAccFilter(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                accFilter === c.key ? 'bg-[#1e2735] border-[#1e2735] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}>
              <i className={`fas ${c.icon} text-[10px]`}></i> {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {(data?.servers.length ?? 0) > 1 && (
            <select value={serverId} onChange={e => setServerId(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469]">
              <option value="all">ทุกเซิร์ฟเวอร์</option>
              {data!.servers.map(s => <option key={s.id} value={s.id}>{s.serverName || `#${s.id}`}</option>)}
            </select>
          )}
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-[#637469]">
            <option value="playtime">ออนไลน์นานสุด</option>
            <option value="balance">ยอดเงินมากสุด</option>
            <option value="name">ชื่อ A-Z</option>
          </select>
        </div>
        <span className="text-[11px] text-gray-400 w-full sm:w-auto">แสดง {filtered.length.toLocaleString()} คน</span>
      </div>

      {/* Player grid */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-2xl text-green-400"></i>
          <p className="text-xs text-gray-400 mt-2">กำลังโหลด...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 flex flex-col items-center justify-center py-16 text-gray-400">
          <i className="fas fa-user-slash text-3xl mb-3 text-gray-200"></i>
          <p className="text-sm font-medium">{allPlayers.length === 0 ? 'ยังไม่มีผู้เล่นออนไลน์ หรือ RCON ยังต่อไม่ได้' : 'ไม่พบผู้เล่นตามตัวกรอง'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filtered.map(p => (
            <button key={`${p.serverId}:${p.name}`} onClick={() => openDetail(p)}
              className="group text-left bg-white rounded-xl border border-gray-200/70 shadow-[0_2px_10px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)] hover:border-green-300 transition-all p-3 flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
                  <img src={`https://mc-heads.net/avatar/${p.name}/44`} alt={p.name} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                </div>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white"></span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-800 text-[13px] truncate">{p.name}</span>
                  {p.role === 'admin' && <i className="fas fa-shield-alt text-orange-500 text-[9px]" title="Admin"></i>}
                  {p.banned && <i className="fas fa-ban text-red-500 text-[9px]" title="ถูกระงับ"></i>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate">
                    <i className="fas fa-clock text-[8px]"></i> {fmtDuration(p.onlineSince, now)}
                  </span>
                  {p.hasAccount ? (
                    <span className="text-[10px] font-bold text-green-600 tabular-nums flex items-center gap-1">
                      <i className="fas fa-wallet text-[8px]"></i> {fmtMoney(p.walletBalance)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300">ไม่มีบัญชี</span>
                  )}
                </div>
                {(data?.servers.length ?? 0) > 1 && (
                  <span className="text-[9px] text-gray-300 flex items-center gap-1 mt-0.5 truncate"><i className="fas fa-server text-[7px]"></i> {p.serverName}</span>
                )}
              </div>
              <i className="fas fa-chevron-right text-gray-200 group-hover:text-green-400 text-xs transition-colors"></i>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto animate-[slideIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            {/* Drawer header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-[#1e2735] to-[#0d131d] text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/10 overflow-hidden border border-white/20">
                    <img src={`https://mc-heads.net/avatar/${selected.name}/56`} alt={selected.name} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                  </div>
                  <div>
                    <p className="font-black text-lg flex items-center gap-2">{selected.name}
                      {selected.banned && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500">ระงับ</span>}
                    </p>
                    <p className="text-[11px] text-white/60 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> ออนไลน์ · {selected.serverName}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white transition-colors"><i className="fas fa-times text-lg"></i></button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="p-5 space-y-4">
              {/* Live session */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">ออนไลน์มาแล้ว</p>
                  <p className="text-lg font-black text-gray-800 tabular-nums">{fmtDuration(selected.onlineSince, now)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">ล็อกอินเมื่อ</p>
                  <p className="text-sm font-bold text-gray-700">{selected.onlineSince ? new Date(selected.onlineSince).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}</p>
                </div>
              </div>
              {/* World */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><i className="fas fa-earth-asia text-emerald-600 text-sm"></i></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">โลกที่อยู่</p>
                  <p className="text-sm font-bold text-gray-800 truncate">{worldLoading ? <i className="fas fa-spinner fa-spin text-gray-300"></i> : worldLabel(world)}</p>
                </div>
              </div>

              {/* Web account */}
              {selected.hasAccount ? (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">บัญชีเว็บ</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold text-white ${selected.role === 'admin' ? 'bg-orange-500' : 'bg-green-500'}`}>{selected.role === 'admin' ? 'Admin' : 'Member'}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {[
                      { label: 'ยอดเงินคงเหลือ', value: `${fmtMoney(selected.walletBalance)} บาท`, strong: true },
                      { label: 'เติมรวม',        value: `${fmtMoney(selected.totalTopup)} บาท` },
                      { label: 'ใช้จ่ายรวม',     value: `${fmtMoney(selected.totalSpent)} บาท` },
                      { label: 'สมัครเมื่อ',     value: selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{r.label}</span>
                        <span className={`text-xs tabular-nums ${r.strong ? 'font-black text-gray-800' : 'font-semibold text-gray-600'}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 pt-0">
                    <Link href={`/admin/users/${selected.userId}`}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-white text-[13px] font-bold shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]">
                      <i className="fas fa-pen text-[11px]"></i> จัดการบัญชีนี้
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                  <i className="fas fa-user-secret text-2xl text-gray-300 mb-2"></i>
                  <p className="text-xs text-gray-400">ผู้เล่นนี้ยังไม่มีบัญชีในเว็บ</p>
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </div>
      )}

    </div>
  );
}
