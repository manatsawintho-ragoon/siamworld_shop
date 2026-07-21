'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface PlayerEvent {
  type: 'join' | 'leave';
  name: string;
  serverId: number;
  serverName: string;
  ts: number;
  seq: number;
}

interface OnlineData {
  servers: OnlineServer[];
  totalOnline: number;
  peakToday: number;
  uniqueToday: number;
  matchedAccounts: number;
  guests: number;
  onlineWallet: number;
  onlineSpent: number;
  adminsOnline: number;
  bannedOnline: number;
}

interface TrendBucket {
  ts: number;
  total: number;
  joins: number;
  leaves: number;
}

interface AnalyticsStats {
  peak: number;
  peakTs: number | null;
  avg: number;
  low: number;
  joins: number;
  leaves: number;
  net: number;
  uniqueToday: number;
  turnover: number;
}

// Deeper stats fetched on-demand when a player card is opened (web account holders).
interface PlayerProfile {
  total_topup?: number;
  topup_count?: number;
  last_topup_at?: string | null;
  avg_topup?: number;
  monthly_topup?: number;
  monthly_spent?: number;
  purchase_count?: number;
  used_codes_count?: number;
  net_balance_rate?: number;
}

// The roster costs a MySQL lookup per online IGN, so it polls slowly. The join/leave
// feed is Redis-only and incremental, so it polls fast - that split is what makes the
// feed feel live without multiplying load on the heavy endpoint.
const ROSTER_REFRESH_MS = 15000;
const EVENTS_REFRESH_MS = 3000;
const ANALYTICS_REFRESH_MS = 30000;
const MAX_FEED = 60;

type SortKey = 'playtime' | 'balance' | 'name';
type AccFilter = 'all' | 'account' | 'guest' | 'banned' | 'admin';
type RangeKey = '1h' | '6h' | '24h' | '48h';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1h',  label: '1 ชม' },
  { key: '6h',  label: '6 ชม' },
  { key: '24h', label: '24 ชม' },
  { key: '48h', label: '48 ชม' },
];

const fmtMoney = (n?: number) => (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtClock = (ts: number) => new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const fmtClockSec = (ts: number) => new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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

// Compact relative age for the feed. Paired with an exact clock time in the row, so
// "อันไหนล่าสุด" never depends on reading a fuzzy label.
function fmtAgo(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (s < 10) return 'ตอนนี้';
  if (s < 60) return `${s} วิ`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} น`;
  const h = Math.floor(m / 60);
  return `${h} ชม`;
}

// ── Interactive concurrency chart ─────────────────────────────────────────────
// Single series (peak concurrent online per bucket), so it carries no legend: the
// card title names it. Pointer, touch and keyboard all drive the same crosshair.

const CH_H = 196;
const PAD = { top: 14, right: 10, bottom: 24, left: 34 };

function OnlineChart({
  buckets, bucketMin, stale,
}: { buckets: TrendBucket[]; bucketMin: number; stale: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 720);
    return () => ro.disconnect();
  }, []);

  const geom = useMemo(() => {
    const innerW = Math.max(1, width - PAD.left - PAD.right);
    const innerH = CH_H - PAD.top - PAD.bottom;
    const maxY = Math.max(1, ...buckets.map(b => b.total));
    // Round the axis top up to a friendly step so gridline labels stay whole numbers.
    const step = maxY <= 4 ? 1 : maxY <= 10 ? 2 : maxY <= 40 ? 10 : maxY <= 100 ? 25 : 50;
    const topY = Math.ceil(maxY / step) * step || step;
    const x = (i: number) => PAD.left + (buckets.length <= 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / topY) * innerH;
    const ticks = [0, topY / 2, topY].filter((v, i, a) => a.indexOf(v) === i);
    return { innerW, innerH, topY, x, y, ticks };
  }, [width, buckets]);

  const paths = useMemo(() => {
    if (buckets.length < 2) return null;
    const { x, y } = geom;
    const line = buckets.map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(b.total).toFixed(1)}`).join(' ');
    const base = CH_H - PAD.bottom;
    const area = `${line} L${x(buckets.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
    return { line, area };
  }, [buckets, geom]);

  // Nearest-bucket lookup: the reader aims at a time, never at a 2px line.
  const pick = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el || buckets.length === 0) return;
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left - PAD.left;
    const ratio = geom.innerW <= 0 ? 0 : rel / geom.innerW;
    const i = Math.round(ratio * (buckets.length - 1));
    setActive(Math.min(buckets.length - 1, Math.max(0, i)));
  }, [buckets.length, geom.innerW]);

  const onKey = (e: React.KeyboardEvent) => {
    if (buckets.length === 0) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setActive(prev => {
        const next = (prev ?? buckets.length - 1) + (e.key === 'ArrowRight' ? 1 : -1);
        return Math.min(buckets.length - 1, Math.max(0, next));
      });
    } else if (e.key === 'Escape') setActive(null);
  };

  if (buckets.length === 0) {
    return <div className="flex items-center justify-center h-[196px] text-xs text-gray-400">ยังไม่มีข้อมูลในช่วงเวลานี้</div>;
  }

  const cur = active != null ? buckets[active] : null;
  // Clamp the tooltip inside the card so edge buckets stay fully readable.
  const tipW = 176;
  const tipLeft = cur ? Math.min(Math.max(geom.x(active!) - tipW / 2, 4), Math.max(4, width - tipW - 4)) : 0;

  const xLabelIdx: number[] = [];
  const labelCount = Math.min(5, buckets.length);
  for (let i = 0; i < labelCount; i++) {
    xLabelIdx.push(Math.round((i / Math.max(1, labelCount - 1)) * (buckets.length - 1)));
  }

  return (
    <div
      ref={wrapRef}
      className={`relative select-none transition-opacity duration-200 ${stale ? 'opacity-60' : 'opacity-100'}`}
      tabIndex={0}
      role="application"
      aria-label="กราฟผู้เล่นออนไลน์ ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูรายละเอียดแต่ละช่วงเวลา"
      onKeyDown={onKey}
      onPointerMove={e => pick(e.clientX)}
      onPointerDown={e => pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      style={{ touchAction: 'pan-y' }}
    >
      <svg width={width} height={CH_H} className="block overflow-visible">
        <defs>
          <linearGradient id="onlineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive grid + y labels */}
        {geom.ticks.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={geom.y(v)} y2={geom.y(v)} stroke="#eef0f3" strokeWidth="1" />
            <text x={PAD.left - 7} y={geom.y(v) + 3.5} textAnchor="end" className="fill-gray-400" style={{ fontSize: 10 }}>{v}</text>
          </g>
        ))}

        {paths && <path d={paths.area} fill="url(#onlineFill)" />}
        {paths && <path d={paths.line} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {!paths && buckets.length === 1 && <circle cx={geom.x(0)} cy={geom.y(buckets[0].total)} r="3.5" fill="#16a34a" />}

        {/* x labels */}
        {xLabelIdx.map((i, n) => (
          <text
            key={`${i}-${n}`}
            x={geom.x(i)}
            y={CH_H - 7}
            textAnchor={n === 0 ? 'start' : n === xLabelIdx.length - 1 ? 'end' : 'middle'}
            className="fill-gray-400"
            style={{ fontSize: 10 }}
          >
            {fmtClock(buckets[i].ts)}
          </text>
        ))}

        {/* Crosshair */}
        {cur && (
          <g>
            <line x1={geom.x(active!)} x2={geom.x(active!)} y1={PAD.top} y2={CH_H - PAD.bottom} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={geom.x(active!)} cy={geom.y(cur.total)} r="8" fill="#16a34a" fillOpacity="0.15" />
            <circle cx={geom.x(active!)} cy={geom.y(cur.total)} r="4" fill="#16a34a" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Tooltip: value leads, label follows */}
      {cur && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
          style={{ width: tipW, left: tipLeft, top: 2 }}
        >
          <p className="text-[10px] font-semibold text-gray-400">
            {fmtClock(cur.ts)} - {fmtClock(cur.ts + bucketMin * 60000)}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-lg font-black tabular-nums text-gray-900">{cur.total}</span>
            <span className="text-[11px] text-gray-500">คนออนไลน์ (สูงสุด)</span>
          </p>
          <div className="mt-1.5 flex items-center gap-3 border-t border-gray-100 pt-1.5">
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <i className="fas fa-arrow-right-to-bracket text-[9px] text-green-600"></i>
              เข้า <b className="tabular-nums text-gray-900">{cur.joins}</b>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-600">
              <i className="fas fa-arrow-right-from-bracket text-[9px] text-gray-400"></i>
              ออก <b className="tabular-nums text-gray-900">{cur.leaves}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────────

function Metric({ label, value, sub, accent, live }: {
  label: string; value: string; sub?: string; accent?: boolean; live?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
        {label}
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>}
      </p>
      <p className={`mt-1 text-2xl font-black leading-none tabular-nums ${accent ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]';

export default function AdminOnlinePlayers() {
  const [data, setData]           = useState<OnlineData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [now, setNow]             = useState(Date.now());

  // Analytics / chart
  const [range, setRange]         = useState<RangeKey>('6h');
  const [buckets, setBuckets]     = useState<TrendBucket[]>([]);
  const [bucketMin, setBucketMin] = useState(10);
  const [stats, setStats]         = useState<AnalyticsStats | null>(null);
  const [chartStale, setChartStale] = useState(false);

  // Live feed
  const [events, setEvents]       = useState<PlayerEvent[]>([]);
  const [feedReady, setFeedReady] = useState(false);
  const lastSeq = useRef(0);
  const freshSeqs = useRef<Set<number>>(new Set());

  // Filters
  const [search, setSearch]       = useState('');
  const [serverId, setServerId]   = useState<string>('all');
  const [accFilter, setAccFilter] = useState<AccFilter>('all');
  const [sortKey, setSortKey]     = useState<SortKey>('playtime');

  // Detail modal
  const [selected, setSelected]   = useState<OnlinePlayer | null>(null);
  const [world, setWorld]         = useState<string | null>(null);
  const [worldLoading, setWorldLoading] = useState(false);
  const [profile, setProfile]     = useState<PlayerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadRoster = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api('/admin/online-players', { token: getToken()! })
      .then((d: any) => {
        setData({
          servers: d.servers || [],
          totalOnline: d.totalOnline || 0,
          peakToday: d.peakToday || 0,
          uniqueToday: d.uniqueToday || 0,
          matchedAccounts: d.matchedAccounts || 0,
          guests: d.guests || 0,
          onlineWallet: d.onlineWallet || 0,
          onlineSpent: d.onlineSpent || 0,
          adminsOnline: d.adminsOnline || 0,
          bannedOnline: d.bannedOnline || 0,
        });
        setUpdatedAt(new Date());
        setError('');
      })
      .catch((err: any) => setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const loadAnalytics = useCallback((key: RangeKey) => {
    setChartStale(true);
    api(`/admin/online-players/analytics?range=${key}`, { token: getToken()! })
      .then((d: any) => {
        setBuckets(d.buckets || []);
        setBucketMin(d.bucketMin || 10);
        setStats(d.stats || null);
      })
      .catch(() => { /* chart keeps its previous frame */ })
      .finally(() => setChartStale(false));
  }, []);

  // Incremental feed poll: only events newer than what is already on screen.
  const loadEvents = useCallback(() => {
    const after = lastSeq.current;
    const qs = after > 0 ? `?after=${after}&limit=50` : '?limit=50';
    api(`/admin/online-players/events${qs}`, { token: getToken()! })
      .then((d: any) => {
        const incoming: PlayerEvent[] = d.events || [];
        setFeedReady(true);
        if (incoming.length === 0) return;
        lastSeq.current = Math.max(lastSeq.current, Number(d.lastSeq) || 0);
        if (after > 0) {
          // Only the seqs still renderable matter; drop the rest so this can't grow forever.
          if (freshSeqs.current.size > MAX_FEED * 2) freshSeqs.current.clear();
          incoming.forEach(e => freshSeqs.current.add(e.seq));
        }
        setEvents(prev => {
          const merged = after > 0 ? [...incoming, ...prev] : incoming;
          return merged.slice(0, MAX_FEED);
        });
      })
      .catch(() => { /* transient - next tick retries */ });
  }, []);

  useEffect(() => {
    loadRoster();
    loadEvents();
    const rosterTimer = setInterval(() => loadRoster(true), ROSTER_REFRESH_MS);
    const eventsTimer = setInterval(loadEvents, EVENTS_REFRESH_MS);
    const tickTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(rosterTimer);
      clearInterval(eventsTimer);
      clearInterval(tickTimer);
    };
  }, [loadRoster, loadEvents]);

  useEffect(() => {
    loadAnalytics(range);
    const t = setInterval(() => loadAnalytics(range), ANALYTICS_REFRESH_MS);
    return () => clearInterval(t);
  }, [range, loadAnalytics]);

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

  // Average session length of everyone currently online - a read on whether the
  // server is holding players or churning.
  const avgSession = useMemo(() => {
    const withSince = allPlayers.filter(p => p.onlineSince);
    if (withSince.length === 0) return null;
    const total = withSince.reduce((sum, p) => sum + (now - (p.onlineSince as number)), 0);
    return total / withSince.length;
  }, [allPlayers, now]);

  const openDetail = (p: OnlinePlayer) => {
    setSelected(p);
    setWorld(null);
    setWorldLoading(true);
    setProfile(null);
    api(`/admin/online-players/${p.serverId}/${encodeURIComponent(p.name)}/world`, { token: getToken()! })
      .then((d: any) => setWorld(d.world ?? null))
      .catch(() => setWorld(null))
      .finally(() => setWorldLoading(false));
    // Deeper account stats (topup history, monthly spend, etc.) for web-account holders.
    if (p.hasAccount && p.userId) {
      setProfileLoading(true);
      api(`/admin/users/${p.userId}`, { token: getToken()! })
        .then((d: any) => setProfile(d.user ?? null))
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
    }
  };

  const CHIPS: { key: AccFilter; label: string }[] = [
    { key: 'all',     label: 'ทั้งหมด' },
    { key: 'account', label: 'มีบัญชีเว็บ' },
    { key: 'guest',   label: 'ไม่มีบัญชี' },
    { key: 'banned',  label: 'ถูกระงับ' },
    { key: 'admin',   label: 'Admin' },
  ];

  const truncatedServers = data?.servers.filter(s => s.truncated) ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ผู้เล่นออนไลน์</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            สถานะเรียลไทม์และข้อมูลบัญชีเว็บของผู้เล่นแต่ละคน
            {updatedAt && <span className="ml-1 text-gray-400">: อัปเดต {fmtClockSec(updatedAt.getTime())} น.</span>}
          </p>
        </div>
        <button onClick={() => { loadRoster(); loadAnalytics(range); }} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[#1e2735] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_0_#0d131d] transition-all hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_#0d131d] disabled:opacity-60">
          <i className={`fas fa-rotate text-xs ${loading ? 'fa-spin' : ''}`}></i> รีเฟรช
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <i className="fas fa-exclamation-circle flex-shrink-0"></i><span className="flex-1 text-xs">{error}</span>
        </div>
      )}

      {/* Key numbers: one strip, no card confetti. Secondary figures ride along as
          sub-lines under the metric they qualify instead of claiming their own card. */}
      <div className={`${CARD} grid grid-cols-2 divide-gray-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x`}>
        <Metric
          label="ออนไลน์ตอนนี้" accent live
          value={String(data?.totalOnline ?? 0)}
          sub={avgSession != null ? `เฉลี่ยเล่นมาแล้ว ${fmtDuration(now - avgSession, now)}` : 'ยังไม่มีผู้เล่น'}
        />
        <Metric
          label="Peak วันนี้"
          value={String(data?.peakToday ?? 0)}
          sub={stats?.peak ? `ช่วง ${RANGES.find(r => r.key === range)?.label} สูงสุด ${stats.peak}` : undefined}
        />
        <Metric
          label="ผู้เล่นไม่ซ้ำวันนี้"
          value={String(data?.uniqueToday ?? 0)}
          sub={stats ? `เข้าใหม่ ${stats.turnover}/ชม` : undefined}
        />
        <Metric
          label="มีบัญชีเว็บ"
          value={String(data?.matchedAccounts ?? 0)}
          sub={`ไม่มีบัญชี ${data?.guests ?? 0} คน`}
        />
        <Metric
          label="ยอดเงินคงเหลือรวม"
          value={fmtMoney(data?.onlineWallet)}
          sub={`ใช้จ่ายสะสม ${fmtMoney(data?.onlineSpent)}`}
        />
      </div>

      {/* Warnings that used to hide inside per-server chips */}
      {(truncatedServers.length > 0 || (data?.bannedOnline ?? 0) > 0 || (data?.adminsOnline ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {(data?.adminsOnline ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600">
              <i className="fas fa-shield-halved text-[10px] text-gray-400"></i> Admin ออนไลน์ {data!.adminsOnline}
            </span>
          )}
          {(data?.bannedOnline ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 font-medium text-red-700">
              <i className="fas fa-ban text-[10px]"></i> ผู้เล่นถูกระงับกำลังออนไลน์ {data!.bannedOnline} คน
            </span>
          )}
          {truncatedServers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              <i className="fas fa-triangle-exclamation text-[10px]"></i>
              รายชื่อไม่ครบ ({truncatedServers.map(s => s.serverName || `#${s.id}`).join(', ')}) เซิร์ฟเวอร์จำกัดรายชื่อ RCON
            </span>
          )}
        </div>
      )}

      {/* Chart + live feed */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${CARD} p-4 lg:col-span-2`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-gray-900">ผู้เล่นออนไลน์ตามช่วงเวลา</h2>
              <p className="text-[11px] text-gray-400">แตะหรือชี้ที่กราฟเพื่อดูรายละเอียดแต่ละช่วง</p>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              {RANGES.map(r => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    range === r.key ? 'bg-[#1e2735] text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <OnlineChart buckets={buckets} bucketMin={bucketMin} stale={chartStale} />

          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 sm:grid-cols-4">
              {[
                { label: 'สูงสุดในช่วง', value: String(stats.peak), hint: stats.peakTs ? `เวลา ${fmtClock(stats.peakTs)} น.` : undefined },
                { label: 'เฉลี่ย',        value: String(stats.avg),  hint: `ต่ำสุด ${stats.low}` },
                { label: 'เข้าเซิร์ฟ',    value: String(stats.joins), hint: `ออก ${stats.leaves}` },
                { label: 'เปลี่ยนแปลงสุทธิ', value: `${stats.net > 0 ? '+' : ''}${stats.net}`, hint: `${stats.turnover}/ชม` },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-[10px] font-medium text-gray-400">{s.label}</p>
                  <p className="text-sm font-black tabular-nums text-gray-900">{s.value}</p>
                  {s.hint && <p className="text-[10px] text-gray-400">{s.hint}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live join/leave feed */}
        <div className={`${CARD} flex flex-col p-4`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-gray-900">เข้า-ออกล่าสุด</h2>
            <span className="text-[10px] text-gray-400">ใหม่สุดอยู่บนสุด</span>
          </div>
          <div className="-mr-1 max-h-[360px] flex-1 overflow-y-auto pr-1">
            {!feedReady ? (
              <div className="space-y-2 py-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-6 w-6 flex-shrink-0 animate-pulse rounded bg-gray-100"></div>
                    <div className="h-3 flex-1 animate-pulse rounded bg-gray-100"></div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="py-10 text-center text-xs text-gray-400">ยังไม่มีความเคลื่อนไหว</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {events.map((e, i) => (
                  <li
                    key={e.seq || `${e.ts}:${e.name}:${i}`}
                    className={`flex items-center gap-2 py-1.5 ${freshSeqs.current.has(e.seq) ? 'animate-[fadeIn_0.35s_ease-out]' : ''}`}
                  >
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded ${
                      e.type === 'join' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <i className={`fas ${e.type === 'join' ? 'fa-arrow-right-to-bracket' : 'fa-arrow-right-from-bracket'} text-[9px]`}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-gray-800">{e.name}</span>
                        <span className={`text-[10px] font-bold ${e.type === 'join' ? 'text-green-600' : 'text-gray-400'}`}>
                          {e.type === 'join' ? 'เข้า' : 'ออก'}
                        </span>
                        {i === 0 && <span className="rounded bg-gray-900 px-1 py-px text-[8px] font-bold text-white">ล่าสุด</span>}
                      </p>
                      {/* Exact clock time removes the "which one came first" guesswork */}
                      <p className="text-[10px] tabular-nums text-gray-400">{fmtClockSec(e.ts)} น.</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] tabular-nums text-gray-300">{fmtAgo(e.ts, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Filters - one row above the roster */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 p-3`}>
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-300"></i>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อผู้เล่น..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-8 text-sm transition-colors placeholder:text-gray-400 focus:border-[#637469] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#637469]/20" />
          {search && (
            <button onClick={() => setSearch('')} aria-label="ล้างคำค้นหา"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-300 hover:text-gray-500"><i className="fas fa-times"></i></button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIPS.map(c => (
            <button key={c.key} onClick={() => setAccFilter(c.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                accFilter === c.key ? 'border-[#1e2735] bg-[#1e2735] text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(data?.servers.length ?? 0) > 1 && (
            <select value={serverId} onChange={e => setServerId(e.target.value)} aria-label="กรองตามเซิร์ฟเวอร์"
              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:border-[#637469] focus:bg-white focus:outline-none">
              <option value="all">ทุกเซิร์ฟเวอร์</option>
              {data!.servers.map(s => <option key={s.id} value={s.id}>{s.serverName || `#${s.id}`} ({s.count})</option>)}
            </select>
          )}
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} aria-label="เรียงลำดับ"
            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs focus:border-[#637469] focus:bg-white focus:outline-none">
            <option value="playtime">ออนไลน์นานสุด</option>
            <option value="balance">ยอดเงินมากสุด</option>
            <option value="name">ชื่อ A-Z</option>
          </select>
          <span className="text-[11px] tabular-nums text-gray-400">{filtered.length.toLocaleString()} คน</span>
        </div>
      </div>

      {/* Roster */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
          <p className="mt-2 text-xs text-gray-400">กำลังโหลด...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center py-16 text-gray-400`}>
          <i className="fas fa-user-slash mb-3 text-3xl text-gray-200"></i>
          <p className="text-sm font-medium">{allPlayers.length === 0 ? 'ยังไม่มีผู้เล่นออนไลน์ หรือ RCON ยังต่อไม่ได้' : 'ไม่พบผู้เล่นตามตัวกรอง'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <button key={`${p.serverId}:${p.name}`} onClick={() => openDetail(p)}
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50">
              <div className="relative flex-shrink-0">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                  <img src={`https://mc-heads.net/avatar/${p.name}/40`} alt="" className="h-full w-full" style={{ imageRendering: 'pixelated' }} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500"></span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-gray-900">{p.name}</span>
                  {p.role === 'admin' && <i className="fas fa-shield-halved text-[9px] text-gray-400" title="Admin"></i>}
                  {p.banned && <i className="fas fa-ban text-[9px] text-red-500" title="ถูกระงับ"></i>}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400">
                  <span className="tabular-nums">{fmtDuration(p.onlineSince, now)}</span>
                  {p.hasAccount ? (
                    <span className="tabular-nums font-semibold text-gray-600">{fmtMoney(p.walletBalance)} บาท</span>
                  ) : (
                    <span>ไม่มีบัญชี</span>
                  )}
                  {(data?.servers.length ?? 0) > 1 && <span className="truncate">{p.serverName}</span>}
                </div>
              </div>
              <i className="fas fa-chevron-right text-xs text-gray-200 transition-colors group-hover:text-gray-400"></i>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="relative max-h-[90vh] w-full max-w-lg animate-[popIn_0.15s_ease-out] overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1e2735] p-5 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/20 bg-white/10">
                    <img src={`https://mc-heads.net/avatar/${selected.name}/56`} alt="" className="h-full w-full" style={{ imageRendering: 'pixelated' }} />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-lg font-black">{selected.name}
                      {selected.role === 'admin' && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold">Admin</span>}
                      {selected.banned && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold">ระงับ</span>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/60">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
                      ออนไลน์ {fmtDuration(selected.onlineSince, now)} : {selected.serverName}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} aria-label="ปิด" className="text-white/50 transition-colors hover:text-white"><i className="fas fa-times text-lg"></i></button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* Session: login time + world in one row instead of two stacked cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[10px] font-medium text-gray-400">ล็อกอินเมื่อ</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">
                    {selected.onlineSince ? `${fmtClock(selected.onlineSince)} น.` : '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[10px] font-medium text-gray-400">โลกที่อยู่</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-gray-900">
                    {worldLoading ? <i className="fas fa-spinner fa-spin text-gray-300"></i> : worldLabel(world)}
                  </p>
                </div>
              </div>

              {selected.hasAccount ? (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                    {[
                      { label: 'คงเหลือ',    value: fmtMoney(selected.walletBalance) },
                      { label: 'เติมรวม',    value: fmtMoney(profile?.total_topup ?? selected.totalTopup) },
                      { label: 'ใช้จ่ายรวม', value: fmtMoney(selected.totalSpent) },
                    ].map(c => (
                      <div key={c.label} className="p-3 text-center">
                        <p className="text-[10px] font-medium text-gray-400">{c.label}</p>
                        <p className="mt-0.5 text-sm font-black tabular-nums text-gray-900">{c.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 p-3">
                    {[
                      { label: 'เติมเดือนนี้',    value: `${fmtMoney(profile?.monthly_topup)} บาท` },
                      { label: 'ใช้จ่ายเดือนนี้',  value: `${fmtMoney(profile?.monthly_spent)} บาท` },
                      { label: 'จำนวนครั้งที่เติม', value: profile?.topup_count != null ? `${profile.topup_count} ครั้ง` : '-' },
                      { label: 'เติมเฉลี่ย/ครั้ง',  value: profile?.avg_topup != null ? `${fmtMoney(profile.avg_topup)} บาท` : '-' },
                      { label: 'จำนวนออเดอร์',     value: profile?.purchase_count != null ? `${profile.purchase_count} ออเดอร์` : '-' },
                      { label: 'เติมล่าสุด',        value: profile?.last_topup_at ? new Date(profile.last_topup_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' },
                      { label: 'สมัครเมื่อ',        value: selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{r.label}</span>
                        <span className="text-xs font-semibold tabular-nums text-gray-700">
                          {profileLoading && r.value === '-' ? <i className="fas fa-spinner fa-spin text-gray-300"></i> : r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 pt-0">
                    <Link href={`/admin/users/${selected.userId}`}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-[13px] font-bold text-white shadow-[0_3px_0_#b45309] transition-all hover:brightness-110 active:translate-y-[2px] active:shadow-[0_1px_0_#b45309]">
                      <i className="fas fa-pen text-[11px]"></i> จัดการบัญชีนี้
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-xs text-gray-500">ผู้เล่นนี้ยังไม่มีบัญชีในเว็บ</p>
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes popIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
