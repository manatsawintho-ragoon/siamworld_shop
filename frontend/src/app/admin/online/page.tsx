'use client';
import { useEffect, useRef, useState } from 'react';
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
  matchedAccounts: number;
  guests: number;
}

const REFRESH_MS = 10000;

export default function AdminOnlinePlayers() {
  const [data, setData]         = useState<OnlineData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    api('/admin/online-players', { token: getToken()! })
      .then((d: any) => {
        setData({
          servers: d.servers || [],
          totalOnline: d.totalOnline || 0,
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
    timer.current = setInterval(() => load(true), REFRESH_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtMoney = (n?: number) => (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-signal text-[#22c55e]"></i> ผู้เล่นออนไลน์
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            เช็คผู้เล่นที่กำลังออนไลน์แบบเรียลไทม์ + ข้อมูลบัญชีเว็บของแต่ละคน
            {updatedAt && <span className="ml-1">· อัปเดตล่าสุด {updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.</span>}
          </p>
        </div>
        <button onClick={() => load()} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#1e2735] text-white shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d131d] active:translate-y-[2px] disabled:opacity-60">
          <i className={`fas fa-rotate ${loading ? 'fa-spin' : ''} text-xs`}></i> รีเฟรช
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle flex-shrink-0"></i>
          <span className="flex-1 text-xs">{error}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ออนไลน์ทั้งหมด', value: String(data?.totalOnline ?? 0), icon: 'fa-users',        color: 'text-green-500',  bg: 'bg-green-50'  },
          { label: 'มีบัญชีเว็บ',     value: String(data?.matchedAccounts ?? 0), icon: 'fa-user-check', color: 'text-blue-500',   bg: 'bg-blue-50'   },
          { label: 'ไม่มีบัญชีเว็บ',   value: String(data?.guests ?? 0),    icon: 'fa-user-secret',  color: 'text-gray-500',   bg: 'bg-gray-100'  },
          { label: 'เซิร์ฟเวอร์',      value: String(data?.servers.length ?? 0), icon: 'fa-server',   color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${s.icon} ${s.color} text-sm`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-gray-800 tabular-nums truncate">{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-20">
          <i className="fas fa-spinner fa-spin text-2xl text-green-400"></i>
          <p className="text-xs text-gray-400 mt-2">กำลังโหลด...</p>
        </div>
      ) : (data?.servers.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 flex flex-col items-center justify-center py-16 text-gray-400">
          <i className="fas fa-plug-circle-xmark text-3xl mb-3 text-gray-200"></i>
          <p className="text-sm font-medium">ยังไม่มีเซิร์ฟเวอร์ หรือ RCON ยังเชื่อมต่อไม่ได้</p>
          <p className="text-xs text-gray-300 mt-1">ตรวจสอบการตั้งค่าที่ "จัดการเซิร์ฟเวอร์"</p>
        </div>
      ) : (
        <div className="space-y-5">
          {data!.servers.map(server => (
            <div key={server.id} className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
              {/* Server header */}
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-server text-green-600 text-xs"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{server.serverName || `เซิร์ฟเวอร์ #${server.id}`}</h3>
                    <p className="text-[11px] text-gray-400">
                      {server.count.toLocaleString()} คนออนไลน์
                      {server.truncated && <span className="text-amber-500"> · รายชื่อบางส่วน (list ถูกตัด)</span>}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> {server.count} ONLINE
                </span>
              </div>

              {server.players.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <i className="fas fa-user-slash text-2xl mb-2 text-gray-200"></i>
                  <p className="text-xs">ไม่มีผู้เล่นออนไลน์</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">ผู้เล่น</th>
                        <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">บัญชีเว็บ</th>
                        <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden sm:table-cell">ยอดเงิน</th>
                        <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden lg:table-cell">เติมรวม</th>
                        <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hidden lg:table-cell">ใช้จ่ายรวม</th>
                        <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {server.players.map(p => (
                        <tr key={p.name} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                                <img src={`https://mc-heads.net/avatar/${p.name}/32`} alt={p.name} className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-[13px]">{p.name}</span>
                                {p.banned && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600">
                                    <i className="fas fa-ban text-[8px]"></i> ระงับ
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {!p.hasAccount ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">
                                <i className="fas fa-user-secret text-[8px]"></i> ไม่มีบัญชี
                              </span>
                            ) : p.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-orange-500 text-white">
                                <i className="fas fa-shield-alt text-[8px]"></i> Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-green-500 text-white">
                                <i className="fas fa-user-check text-[8px]"></i> Member
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right hidden sm:table-cell">
                            {p.hasAccount ? (
                              <span className="font-black text-gray-800 tabular-nums text-[13px]">{fmtMoney(p.walletBalance)}<span className="text-[10px] font-medium text-gray-400 ml-1">บาท</span></span>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-5 py-3 text-right hidden lg:table-cell">
                            {p.hasAccount ? <span className="text-[13px] tabular-nums text-gray-500">{fmtMoney(p.totalTopup)}</span> : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-5 py-3 text-right hidden lg:table-cell">
                            {p.hasAccount ? <span className="text-[13px] tabular-nums text-gray-500">{fmtMoney(p.totalSpent)}</span> : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end">
                              {p.hasAccount ? (
                                <Link href={`/admin/users/${p.userId}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 border border-amber-600 text-white text-[11px] font-bold shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]">
                                  <i className="fas fa-pen text-[10px]"></i> จัดการ
                                </Link>
                              ) : <span className="text-gray-300 text-xs">-</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
