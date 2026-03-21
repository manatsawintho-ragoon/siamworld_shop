'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            <i className="fas fa-history mr-2 text-[#f97316]"></i>ประวัติการใช้งาน
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ดูรายละเอียดประวัติการเติมเงิน การซื้อสินค้า และการใช้โค้ดทั้งหมดของบัญชีผู้ใช้นี้
          </p>
        </div>
        <Link 
          href={`/admin/users/${id}`}
          className="px-5 py-2.5 text-sm font-black rounded-xl bg-[#f97316] text-white shadow-[0_4px_0_#c2410c] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-2 uppercase tracking-wide"
        >
          <i className="fas fa-arrow-left"></i> กลับไปหน้ารายละเอียด
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
         <div className="bg-slate-50/70 p-4 border-b border-gray-100 flex overflow-x-auto gap-2">
            <button 
              onClick={() => setActiveTab('topup')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${activeTab === 'topup' ? 'bg-[#f97316] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              <i className="fas fa-wallet opacity-80"></i> ประวัติเติมเงิน
            </button>
            <button 
              onClick={() => setActiveTab('purchase')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${activeTab === 'purchase' ? 'bg-[#f97316] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              <i className="fas fa-shopping-cart opacity-80"></i> ประวัติทำรายการ
            </button>
            <button 
              onClick={() => setActiveTab('redeem')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${activeTab === 'redeem' ? 'bg-[#f97316] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              <i className="fas fa-gift opacity-80"></i> ประวัติใช้โค้ด
            </button>
         </div>
         
         {/* Table Content */}
         <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-[#1e2735] text-white">
                {activeTab === 'topup' ? (
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">ช่องทาง / รายการ</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">จำนวนเงิน</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                  </tr>
                ) : activeTab === 'purchase' ? (
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">รายการสั่งซื้อ</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">จำนวนเงิน</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">สถานะบิล</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">โค้ดที่ถูกใช้</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">รางวัลที่ได้รับ</th>
                    <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-300">วันที่และเวลา</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logsLoading ? (
                   <tr>
                     <td colSpan={5} className="py-20 text-center">
                        <i className="fas fa-spinner fa-spin text-3xl text-orange-400"></i>
                        <p className="text-sm text-gray-500 mt-4 font-medium">กำลังโหลดประวัติทำรายการ...</p>
                     </td>
                   </tr>
                ) : logs.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="py-20 text-center">
                        <i className="fas fa-folder-open text-5xl text-gray-200 mb-4 block"></i>
                        <p className="text-base text-gray-500 font-bold">ไม่พบประวัติการทำรายการ</p>
                        <p className="text-sm text-gray-400 mt-1">ผู้ใช้นี้ยังไม่มีการทำรายการในหมวดหมู่นี้</p>
                     </td>
                   </tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                     {activeTab === 'topup' ? (
                        <>
                          <td className="px-6 py-5">
                             <p className="font-bold text-gray-800">{log.description || 'ระบบเติมเงิน'}</p>
                             <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">Ref: {log.reference_id || '-'}</p>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <div className="inline-block px-4 py-1.5 bg-green-50 text-green-600 font-bold rounded-xl text-sm border border-green-100">
                               +{parseFloat(String(log.amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                             </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <p className="text-sm text-gray-700 font-bold">
                               {new Date(log.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                             </p>
                             <p className="text-xs text-gray-500 mt-0.5">
                               เวลา {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                             </p>
                          </td>
                        </>
                     ) : activeTab === 'purchase' ? (
                        <>
                          <td className="px-6 py-5">
                             <p className="font-bold text-gray-800">{log.description || 'ซื้อสินค้า/บริการ'}</p>
                             <p className="text-xs text-gray-400 mt-1 font-mono bg-gray-100 inline-block px-2 py-0.5 rounded">Ref: {log.reference_id || '-'}</p>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <div className="inline-block px-4 py-1.5 bg-orange-50 text-orange-600 font-bold rounded-xl text-sm border border-orange-100">
                               -{parseFloat(String(log.amount || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                             </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <span className="text-xs font-black px-3 py-1.5 rounded-full bg-green-50 text-green-600 border border-green-200/50 uppercase tracking-widest shadow-sm">
                               <i className="fas fa-check-circle mr-1"></i> Success
                             </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <p className="text-sm text-gray-700 font-bold">
                               {new Date(log.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                             </p>
                             <p className="text-xs text-gray-500 mt-0.5">
                               เวลา {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                             </p>
                          </td>
                        </>
                     ) : (
                        <>
                          <td className="px-6 py-5">
                             <div className="inline-block px-4 py-2 bg-gray-100 text-gray-800 font-mono font-black tracking-widest rounded-xl border border-gray-200 shadow-sm text-sm">
                                {log.reference_id}
                             </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <div className="flex flex-col items-center justify-center">
                               <span className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-1">
                                 {log.reward_type === 'point' ? 'ได้รับเครดิต/เงิน' : 'ไอเทม/คำสั่ง'}
                               </span>
                               <span className="text-sm font-bold text-gray-800 max-w-[250px] truncate">
                                 {log.reward_type === 'point' ? (
                                    <span className="text-orange-500">+{log.point_amount} ฿</span>
                                  ) : (
                                    <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">{log.command}</span>
                                  )}
                               </span>
                             </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <p className="text-sm text-gray-700 font-bold">
                               {new Date(log.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                             </p>
                             <p className="text-xs text-gray-500 mt-0.5">
                               เวลา {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                             </p>
                          </td>
                        </>
                     )}
                  </tr>
                ))}
              </tbody>
            </table>
         </div>
         
        {/* Pagination Control Full Size */}
        {totalPages > 1 && (
          <div className="px-6 py-5 border-t border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50">
            <p className="text-sm text-gray-500 font-medium">
              แสดงข้อมูลรายการที่ <span className="font-bold text-gray-800">{Math.min((page - 1) * limit + 1, totalLogs).toLocaleString()}</span> ถึง <span className="font-bold text-gray-800">{Math.min(page * limit, totalLogs).toLocaleString()}</span> จากทั้งหมด <span className="font-bold text-[#f97316]">{totalLogs.toLocaleString()}</span> รายการ
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page === 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 bg-white disabled:opacity-40 disabled:bg-gray-50 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <i className="fas fa-chevron-left text-sm"></i>
              </button>
              <div className="px-4 py-2 border border-gray-200 bg-white rounded-xl text-sm font-bold text-gray-700 shadow-sm">
                 {page} <span className="text-gray-400 font-medium mx-1">/</span> {totalPages}
              </div>
              <button
                onClick={() => goPage(page + 1)}
                disabled={page === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 bg-white disabled:opacity-40 disabled:bg-gray-50 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <i className="fas fa-chevron-right text-sm"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
