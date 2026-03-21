'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import RconModal from '@/components/RconModal';
import { fmtDate } from '@/lib/dateFormat';

interface HistoryLog {
  id: number;
  amount?: number;
  point_amount?: number;
  balance_after?: number;
  created_at: string;
  description?: string;
  reference_id?: string;
  reward_type?: string;
  command?: string;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UserHistoryPage() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'topup' | 'purchase' | 'redeem') || 'topup';

  const [activeTab, setActiveTab] = useState<'topup' | 'purchase' | 'redeem'>(initialTab);
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalLogs, setTotalLogs] = useState(0);
  const [viewingRcon, setViewingRcon] = useState<string | null>(null);

  const totalPages = Math.ceil(totalLogs / limit);

  const loadLogs = (p = page, tab = activeTab) => {
    setLogsLoading(true);
    api(`/admin/users/${id}/history?type=${tab}&page=${p}&limit=${limit}`, { token: getToken()! })
      .then((d: any) => {
        setLogs(d.logs || []);
        setTotalLogs(d.pagination?.total || 0);
      })
      .catch((err: any) => console.error('Failed to load history', err))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    setPage(1);
    loadLogs(1, activeTab);
  }, [activeTab]);

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    loadLogs(p, activeTab);
  };

  const tabs: { key: 'topup' | 'purchase' | 'redeem'; label: string; icon: string }[] = [
    { key: 'topup',    label: 'ประวัติเติมเงิน',   icon: 'fa-wallet'        },
    { key: 'purchase', label: 'ประวัติทำรายการ', icon: 'fa-shopping-cart' },
    { key: 'redeem',   label: 'ประวัติใช้โค้ด',    icon: 'fa-gift'          },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-[#f97316]" /> ประวัติการใช้งาน
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            ดูรายละเอียดประวัติการเติมเงิน การซื้อสินค้า และการใช้โค้ดทั้งหมดของบัญชีผู้ใช้นี้
          </p>
        </div>
        <Link
          href={`/admin/users/${id}`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-[#1e2735] text-white shadow-[0_4px_0_#0d131d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#0d131d] active:translate-y-[2px]"
        >
          <i className="fas fa-arrow-left text-xs" /> กลับไปหน้ารายละเอียด
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">

        {/* Tab Bar */}
        <div className="bg-gray-50/70 px-4 py-3 border-b border-gray-100 flex gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === t.key
                  ? 'bg-[#1e2735] text-white shadow-[0_2px_0_#0d131d]'
                  : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
            >
              <i className={`fas ${t.icon} text-[10px]`} /> {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm">
            <thead className="bg-[#1e2735] text-white">
              {activeTab === 'topup' ? (
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">ช่องทาง / รายการ</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">จำนวนเงิน</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                </tr>
              ) : activeTab === 'purchase' ? (
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">รายการสั่งซื้อ</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">จำนวนเงิน</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">สถานะ</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                </tr>
              ) : (
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">โค้ดที่ถูกใช้</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">รางวัล</th>
                  <th className="text-center px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logsLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <i className="fas fa-spinner fa-spin text-2xl text-orange-400" />
                    <p className="text-xs text-gray-500 mt-3">กำลังโหลด...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <i className="fas fa-folder-open text-4xl text-gray-200 mb-3 block" />
                    <p className="text-sm text-gray-500 font-bold">ไม่พบประวัติการทำรายการ</p>
                  </td>
                </tr>
              ) : logs.map(log => {
                const { date, time } = fmtDate(log.created_at);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {activeTab === 'topup' ? (
                      <>
                        <td className="px-5 py-2.5">
                          <p className="text-[12px] font-semibold text-gray-800">{log.description || 'ระบบเติมเงิน'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono bg-gray-100 inline-block px-1.5 py-0.5 rounded">Ref: {log.reference_id || '-'}</p>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-600 font-bold rounded-lg text-[11px] border border-green-100">
                            +{parseFloat(String(log.amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <p className="text-[11px] text-gray-700 font-semibold">{date}</p>
                          <p className="text-[10px] text-gray-400">{time} น.</p>
                        </td>
                      </>
                    ) : activeTab === 'purchase' ? (
                      <>
                        <td className="px-5 py-2.5">
                          <p className="text-[12px] font-semibold text-gray-800">{log.description || 'ซื้อสินค้า/บริการ'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono bg-gray-100 inline-block px-1.5 py-0.5 rounded">Ref: {log.reference_id || '-'}</p>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <span className="inline-flex items-center px-3 py-1 bg-orange-50 text-orange-600 font-bold rounded-lg text-[11px] border border-orange-100">
                            -{parseFloat(String(log.amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-600 border border-green-200/50 uppercase tracking-wide">
                            <i className="fas fa-check-circle mr-1" /> Success
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <p className="text-[11px] text-gray-700 font-semibold">{date}</p>
                          <p className="text-[10px] text-gray-400">{time} น.</p>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-2.5">
                          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 font-mono font-bold tracking-widest rounded-lg border border-gray-200 text-[11px]">
                            {log.reference_id}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          {log.reward_type === 'point' ? (
                            <span className="text-[12px] font-black text-orange-500">+{log.point_amount} ฿</span>
                          ) : (
                            <button
                              onClick={() => setViewingRcon(log.command || '')}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-600 font-bold rounded-lg text-[10px] border border-purple-200 hover:bg-purple-100 active:scale-95 transition-all cursor-pointer"
                            >
                              <i className="fas fa-terminal text-[8px]" /> RCON
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <p className="text-[11px] text-gray-700 font-semibold">{date}</p>
                          <p className="text-[10px] text-gray-400">{time} น.</p>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between bg-gray-50/50">
            <p className="text-xs text-gray-500">
              รายการที่ <span className="font-bold text-gray-800">{Math.min((page - 1) * limit + 1, totalLogs).toLocaleString()}</span>–<span className="font-bold text-gray-800">{Math.min(page * limit, totalLogs).toLocaleString()}</span> จาก <span className="font-bold text-[#f97316]">{totalLogs.toLocaleString()}</span> รายการ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <i className="fas fa-chevron-left text-xs" />
              </button>
              <div className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                {page} <span className="text-gray-400 font-medium mx-1">/</span> {totalPages}
              </div>
              <button
                onClick={() => goPage(page + 1)}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <i className="fas fa-chevron-right text-xs" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RCON Modal */}
      {viewingRcon !== null && (
        <RconModal command={viewingRcon} onClose={() => setViewingRcon(null)} />
      )}
    </div>
  );
}
