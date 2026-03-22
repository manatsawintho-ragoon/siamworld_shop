'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  rcon_port: number;
  rcon_password: string;
  minecraft_version: string;
  max_players: number;
  is_enabled: boolean;
}

interface HealthEntry {
  id: number;
  healthy: boolean;
  latency_ms: number;
}

interface PlayerData {
  servers: Record<string, { serverName: string; players: string[]; count: number }>;
  totalOnline: number;
}

const emptyServer = {
  name: '', host: '', port: 25565, rcon_port: 25575, rcon_password: '',
  minecraft_version: '1.20.4', max_players: 100, is_enabled: true,
};

const INPUT = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15 placeholder:text-gray-300 transition-colors bg-white';
const LABEL = 'block text-[11px] font-black text-gray-500 uppercase tracking-wide mb-1.5';

export default function AdminServers() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();

  const [servers, setServers]       = useState<Server[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState<Partial<Server> | null>(null);
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<number | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [error, setError]           = useState('');

  // Health: null = not checked, true/false = result, undefined = checking
  const [health, setHealth]         = useState<Record<number, HealthEntry | null>>({});
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  const bdRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    api('/admin/servers', { token: getToken()! })
      .then(d => setServers((d.servers as Server[]) || []))
      .finally(() => setLoading(false));
  }, []);

  const loadPlayers = useCallback(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/online-players`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlayerData({ servers: d.servers || {}, totalOnline: d.totalOnline || 0 }); })
      .catch(() => {});
  }, []);

  /** Real RCON health check for ALL servers (enabled + disabled) */
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const d = await api('/admin/servers/health', { token: getToken()! });
      const map: Record<number, HealthEntry> = {};
      for (const h of (d.health as HealthEntry[])) map[h.id] = h;
      setHealth(map);
      setLastHealthCheck(new Date());
    } catch {
      // silently fail — keep existing health data
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadPlayers();
    checkHealth();

    // Players refresh every 15s
    const playerTimer = setInterval(() => {
      if (document.visibilityState === 'visible') loadPlayers();
    }, 15_000);

    // Health check every 60s — only when tab visible
    const healthTimer = setInterval(() => {
      if (document.visibilityState === 'visible') checkHealth();
    }, 60_000);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadPlayers();
        checkHealth();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      clearInterval(playerTimer);
      clearInterval(healthTimer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, loadPlayers, checkHealth]);

  const handleToggle = async (s: Server) => {
    setToggling(s.id);
    try {
      const d = await api(`/admin/servers/${s.id}/toggle`, { method: 'PATCH', token: getToken()! });
      setServers(prev => prev.map(x => x.id === s.id ? { ...x, is_enabled: Boolean(d.is_enabled) } : x));
      // Re-check health after toggle so status reflects new state quickly
      setTimeout(() => checkHealth(), 2000);
    } catch (err: any) {
      adminAlert({ title: 'เกิดข้อผิดพลาด', message: err?.message, type: 'error' });
    } finally { setToggling(null); }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        name: editing.name, host: editing.host, port: editing.port,
        rcon_port: editing.rcon_port, rcon_password: editing.rcon_password || undefined,
        minecraft_version: editing.minecraft_version, max_players: editing.max_players,
        is_enabled: Boolean(editing.is_enabled),
      };
      if (editing.id) {
        await api(`/admin/servers/${editing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/servers', { method: 'POST', token: getToken()!, body });
      }
      setEditing(null);
      adminAlert({ title: editing.id ? 'แก้ไขเซิร์ฟเวอร์แล้ว' : 'เพิ่มเซิร์ฟเวอร์แล้ว', type: 'success' });
      load();
      setTimeout(() => checkHealth(), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!await adminConfirm({ title: 'ลบเซิร์ฟเวอร์', message: 'ต้องการลบเซิร์ฟเวอร์นี้?', type: 'danger', confirmLabel: 'ลบ' })) return;
    try {
      await api(`/admin/servers/${id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบเซิร์ฟเวอร์แล้ว', type: 'success' });
      load();
    } catch { }
  };

  const getOnlineCount   = (id: number) => playerData?.servers[String(id)]?.count ?? null;
  const getHealth        = (id: number): HealthEntry | null => health[id] ?? null;
  const rconOnlineCount  = servers.filter(s => getHealth(s.id)?.healthy === true).length;
  const totalPlayers     = playerData?.totalOnline ?? 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-server text-[#f97316]" /> จัดการเซิร์ฟเวอร์
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">เชื่อมต่อ RCON จริง · ดูสถานะจริง · จัดการเซิร์ฟเวอร์ Minecraft</p>
            {lastHealthCheck && (
              <span className="text-[10px] text-gray-300">
                ตรวจสอบล่าสุด {lastHealthCheck.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={checkHealth}
            disabled={healthLoading}
            title="ตรวจสอบ RCON ทุกเซิร์ฟเวอร์"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-none active:translate-y-[1px] disabled:opacity-50"
          >
            <i className={`fas fa-heartbeat text-[10px] ${healthLoading ? 'fa-spin' : 'text-red-400'}`} />
            {healthLoading ? 'กำลังตรวจ...' : 'ตรวจ RCON'}
          </button>
          <button
            onClick={() => { setError(''); setEditing({ ...emptyServer }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-xl shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d6b2e] active:translate-y-[2px]"
          >
            <i className="fas fa-plus text-[11px]" /> เพิ่มเซิร์ฟเวอร์
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'เซิร์ฟเวอร์ทั้งหมด', value: servers.length,   icon: 'fa-server',       color: 'text-[#f97316]', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'RCON Online จริง',    value: rconOnlineCount,  icon: 'fa-circle-check', color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
          { label: 'ผู้เล่นออนไลน์รวม',  value: totalPlayers,     icon: 'fa-users',        color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-200' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_16px_rgba(0,0,0,0.08)] border border-gray-200/70 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${s.icon} ${s.color} text-sm`} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-800 tabular-nums leading-none">{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Server list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-2xl text-orange-400" />
        </div>
      ) : servers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3] border border-gray-200/70 py-20 flex flex-col items-center justify-center gap-3 text-gray-300">
          <i className="fas fa-server text-5xl" />
          <p className="text-sm font-semibold text-gray-400">ยังไม่มีเซิร์ฟเวอร์</p>
          <button
            onClick={() => { setError(''); setEditing({ ...emptyServer }); }}
            className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#16a34a] text-white text-xs font-bold rounded-xl shadow-[0_3px_0_#0d6b2e] hover:brightness-110 transition-all"
          >
            <i className="fas fa-plus text-[10px]" /> เพิ่มเซิร์ฟเวอร์แรก
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map(s => {
            const h           = getHealth(s.id);
            const rconOk      = h?.healthy === true;
            const rconFail    = h?.healthy === false;
            const rconChecking = healthLoading && h === null;
            const onlineCount = getOnlineCount(s.id);
            const isToggling  = toggling === s.id;

            // Color strip: green = RCON ok, red = RCON fail, gray = disabled/unchecked
            const stripColor = rconOk ? 'bg-green-500' : rconFail ? 'bg-red-400' : 'bg-gray-300';

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.08)] border overflow-hidden transition-all ${
                  s.is_enabled ? 'border-gray-200/70' : 'border-gray-200/70 opacity-70'
                }`}
              >
                {/* Color strip */}
                <div className={`h-1.5 w-full transition-colors ${stripColor}`} />

                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Icon + status dot */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative ${
                        rconOk   ? 'bg-green-50 border border-green-200'
                        : rconFail ? 'bg-red-50 border border-red-200'
                        : 'bg-gray-100 border border-gray-200'
                      }`}>
                        <i className={`fas fa-server text-base ${
                          rconOk   ? 'text-green-600'
                          : rconFail ? 'text-red-400'
                          : 'text-gray-400'
                        }`} />
                        {/* RCON status dot */}
                        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          rconChecking ? 'bg-gray-300'
                          : rconOk   ? 'bg-green-500 animate-pulse'
                          : rconFail   ? 'bg-red-500'
                          : 'bg-gray-300'
                        }`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-black text-gray-900 text-sm truncate">{s.name}</h3>
                          {/* Real RCON status badge */}
                          {rconChecking ? (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-gray-100 text-gray-400">
                              <i className="fas fa-spinner fa-spin text-[7px]" /> กำลังตรวจ...
                            </span>
                          ) : rconOk ? (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              RCON Online
                              {h?.latency_ms != null && (
                                <span className="text-green-400 font-medium">{h.latency_ms}ms</span>
                              )}
                            </span>
                          ) : rconFail ? (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-100 text-red-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              RCON Offline
                            </span>
                          ) : (
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-gray-100 text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              ยังไม่ตรวจ
                            </span>
                          )}
                          {/* System enabled/disabled badge */}
                          {!s.is_enabled && (
                            <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-gray-100 text-gray-500">
                              <i className="fas fa-ban text-[7px]" /> ปิดในระบบ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{s.host}:{s.port}</p>
                      </div>
                    </div>

                    {/* Power toggle button — controls whether shop uses this server for RCON */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={isToggling}
                        title={s.is_enabled
                          ? 'เซิร์ฟเวอร์นี้เปิดในระบบร้าน — คลิกเพื่อปิด (ผู้เล่นจะซื้อ/รับของไม่ได้)'
                          : 'เซิร์ฟเวอร์นี้ปิดในระบบร้าน — คลิกเพื่อเปิด'}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all disabled:opacity-50 active:translate-y-[1px] ${
                          s.is_enabled
                            ? 'bg-green-500 text-white shadow-[0_3px_0_#15803d] hover:bg-green-600'
                            : 'bg-gray-200 text-gray-500 shadow-[0_3px_0_#9ca3af] hover:bg-gray-300'
                        }`}
                      >
                        {isToggling
                          ? <i className="fas fa-spinner fa-spin text-xs" />
                          : <i className="fas fa-power-off text-sm" />
                        }
                      </button>
                      <span className={`text-[8px] font-black uppercase tracking-wide ${s.is_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                        {s.is_enabled ? 'เปิด' : 'ปิด'}
                      </span>
                    </div>
                  </div>

                  {/* Info chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {/* Online players */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                      onlineCount !== null && onlineCount > 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <i className={`fas fa-users text-[9px] ${onlineCount !== null && onlineCount > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className={`text-[11px] font-black tabular-nums ${onlineCount !== null && onlineCount > 0 ? 'text-green-700' : 'text-gray-700'}`}>
                        {onlineCount !== null ? `${onlineCount}/${s.max_players}` : `–/${s.max_players}`}
                      </span>
                      <span className="text-[10px] text-gray-400">online</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                      <i className="fas fa-terminal text-gray-400 text-[9px]" />
                      <span className="text-[11px] text-gray-500 font-medium">RCON</span>
                      <span className="text-[11px] font-black text-gray-800 font-mono">{s.rcon_port}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                      <i className="fas fa-cube text-gray-400 text-[9px]" />
                      <span className="text-[11px] font-black text-gray-800">{s.minecraft_version}</span>
                    </div>
                  </div>

                  {/* Disabled warning banner */}
                  {!s.is_enabled && (
                    <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                      <i className="fas fa-exclamation-triangle text-amber-500 text-[11px] flex-shrink-0" />
                      <p className="text-[11px] text-amber-700 font-semibold leading-snug">
                        เซิร์ฟเวอร์นี้<span className="font-black">ปิดอยู่ในระบบร้าน</span> — ผู้เล่นจะ<span className="font-black">ซื้อของ / รับของ</span>ผ่านเซิร์ฟเวอร์นี้ไม่ได้
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setError(''); setEditing({ ...s }); }}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl bg-white border border-gray-200 text-gray-700 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-none active:translate-y-[2px]"
                    >
                      <i className="fas fa-pen text-[10px]" /> แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-500 text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-none active:translate-y-[2px] ml-auto"
                    >
                      <i className="fas fa-trash text-[11px]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {editing && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px]"
          onMouseDown={e => { bdRef.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bdRef.current && e.target === e.currentTarget && !saving) setEditing(null); }}
        >
          <div className="bg-white rounded-2xl shadow-[0_8px_0_#c5cad3,0_12px_48px_rgba(0,0,0,0.2)] w-full max-w-lg overflow-hidden border border-gray-200/80">

            <div className="h-1 w-full bg-[#f97316]" />
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-server text-[#f97316] text-sm" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 text-sm">{editing.id ? 'แก้ไขเซิร์ฟเวอร์' : 'เพิ่มเซิร์ฟเวอร์ใหม่'}</h3>
                <p className="text-[11px] text-gray-400">{editing.id ? 'อัปเดตการตั้งค่า RCON และข้อมูล' : 'กำหนดค่า RCON เพื่อส่งคำสั่งไปยังเซิร์ฟเวอร์'}</p>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-none active:translate-y-[1px]"
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2.5 rounded-xl">
                  <i className="fas fa-exclamation-circle flex-shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className={LABEL}>ชื่อเซิร์ฟเวอร์ <span className="text-red-400 normal-case">*</span></label>
                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className={INPUT} placeholder="เช่น Survival, Creative, Skyblock" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={LABEL}>Host / IP <span className="text-red-400 normal-case">*</span></label>
                  <input value={editing.host || ''} onChange={e => setEditing({ ...editing, host: e.target.value })} className={INPUT} placeholder="mc.example.com" />
                </div>
                <div>
                  <label className={LABEL}>Port</label>
                  <input type="number" value={editing.port ?? 25565} onChange={e => setEditing({ ...editing, port: Number(e.target.value) })} className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>RCON Port <span className="text-red-400 normal-case">*</span></label>
                  <input type="number" value={editing.rcon_port ?? 25575} onChange={e => setEditing({ ...editing, rcon_port: Number(e.target.value) })} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>RCON Password <span className="text-red-400 normal-case">*</span></label>
                  <input type="password" value={editing.rcon_password || ''} onChange={e => setEditing({ ...editing, rcon_password: e.target.value })} className={INPUT} placeholder="••••••••" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Minecraft Version</label>
                  <input value={editing.minecraft_version || ''} onChange={e => setEditing({ ...editing, minecraft_version: e.target.value })} className={INPUT} placeholder="1.20.4" />
                </div>
                <div>
                  <label className={LABEL}>Max Players</label>
                  <input type="number" value={editing.max_players ?? 100} onChange={e => setEditing({ ...editing, max_players: Number(e.target.value) })} className={INPUT} />
                </div>
              </div>

            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex gap-2.5">
              <button onClick={() => setEditing(null)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-bold rounded-xl bg-white border border-gray-200 text-gray-700 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-none active:translate-y-[2px]">
                <i className="fas fa-times text-[11px]" /> ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1e2735] text-white text-[13px] font-bold rounded-xl shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-none active:translate-y-[2px] disabled:opacity-60">
                {saving ? <><i className="fas fa-spinner fa-spin text-[11px]" /> กำลังบันทึก...</> : <><i className="fas fa-save text-[11px]" /> บันทึก</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
