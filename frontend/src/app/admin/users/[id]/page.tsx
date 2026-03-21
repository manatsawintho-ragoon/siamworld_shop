'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';

interface UserDetail {
  id: number;
  username: string;
  email?: string;
  role: string;
  wallet_balance: number;
  created_at: string;
  total_topup: number;
  monthly_topup: number;
  used_codes_count: number;
  total_spent: number;
}

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

export default function AdminUserDetail() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'topup' | 'purchase' | 'redeem'>('topup');
  const [logs, setLogs] = useState<HistoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalLogs, setTotalLogs] = useState(0);

  // Edit states
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  const totalPages = Math.ceil(totalLogs / limit);

  const loadUser = () => {
    setLoading(true);
    api(`/admin/users/${id}`, { token: getToken()! })
      .then((d: any) => {
        setUser(d.user);
        setEditRole(d.user.role);
        setEditEmail(d.user.email || '');
        setEditBalance(String(d.user.wallet_balance || 0));
      })
      .catch((err: any) => {
        setError(err.message || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      })
      .finally(() => setLoading(false));
  };

  const loadLogs = (p = page, tab = activeTab, l = limit) => {
    setLogsLoading(true);
    api(`/admin/users/${id}/history?type=${tab}&page=${p}&limit=${l}`, { token: getToken()! })
      .then((d: any) => {
        setLogs(d.logs || []);
        setTotalLogs(d.pagination?.total || 0);
      })
      .catch((err: any) => console.error('Failed to load logs', err))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    loadUser();
  }, [id]);

  useEffect(() => {
    setPage(1);
    loadLogs(1, activeTab, limit);
  }, [activeTab]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    setSaveSuccess('');
    setError('');
    
    try {
      const payload: any = { role: editRole };
      if (editEmail !== (user.email || '')) payload.email = editEmail;
      if (Number(editBalance) !== user.wallet_balance) payload.balance = Number(editBalance);

      await api(`/admin/users/${id}`, { 
        method: 'PUT', token: getToken()!, body: payload 
      });
      
      setSaveSuccess('บันทึกข้อมูลสำเร็จ');
      loadUser();
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSavingSettings(false);
    }
  };

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    loadLogs(p, activeTab, limit);
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <i className="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
        <p className="text-sm text-gray-400 mt-2">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-gray-700">ไม่พบข้อมูลผู้ใช้</h2>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">กลับ</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            <i className="fas fa-user-cog mr-2 text-[#f97316]"></i>จัดการข้อมูลผู้ใช้
          </h1>
        </div>
        <Link 
          href="/admin/users"
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#1e2735] text-white shadow-[0_3px_0_#38404d] hover:brightness-110 flex items-center gap-2"
        >
          <i className="fas fa-arrow-left"></i> ย้อนกลับ
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-exclamation-circle shrink-0"></i>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <i className="fas fa-check-circle shrink-0"></i>
          <span>{saveSuccess}</span>
          <button onClick={() => setSaveSuccess('')} className="ml-auto text-green-400 hover:text-green-600"><i className="fas fa-times"></i></button>
        </div>
      )}

      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Card */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden relative">
          <div className="h-32 w-full absolute top-0 left-0">
             <img src="https://i.imgur.com/u5T9q3u.jpeg" alt="Background" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
          </div>
          
          <div className="relative pt-16 px-6 pb-6 text-center z-10">
            <div className="w-24 h-24 mx-auto bg-white p-1 rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center">
              <img
                src={`https://mc-heads.net/avatar/${user.username}/80`}
                alt={user.username}
                width={80}
                height={80}
                className="w-full h-full rounded-xl"
                style={{ imageRendering: 'pixelated' }}
                onError={e => { (e.currentTarget as HTMLImageElement).src = 'https://mc-heads.net/avatar/Steve/80'; }}
              />
            </div>
            <h2 className="mt-3 text-xl font-black text-gray-800 uppercase tracking-wide">{user.username}</h2>
            <div className="inline-block mt-1 px-3 py-1 bg-[#1e2735] text-white text-[11px] font-bold rounded-full uppercase tracking-widest shadow-sm">
              {user.role}
            </div>
          </div>
          
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Registration Date</p>
              <p className="text-sm font-semibold text-gray-800">
                {new Date(user.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(user.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <div className="text-center">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ยอดเงินคงเหลือ</p>
                 <p className="text-xl font-black text-[#f97316]">{parseFloat(String(user.wallet_balance || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-xs">฿</span></p>
              </div>
              <div className="text-center border-l border-gray-200">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">เติมเงินสุทธิ</p>
                 <p className="text-xl font-black text-gray-800">{parseFloat(String(user.total_topup || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-xs">฿</span></p>
              </div>
              <div className="text-center pt-2 border-t border-gray-200">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ยอดใช้จ่ายทั้งหมด</p>
                 <p className="text-xl font-black text-orange-600">{parseFloat(String(user.total_spent || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span className="text-xs">฿</span></p>
              </div>
              <div className="text-center pt-2 border-t border-l border-gray-200">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ใช้โค้ดทั้งหมด</p>
                 <p className="text-xl font-black text-green-600">{user.used_codes_count || 0} <span className="text-xs">ครั้ง</span></p>
              </div>
            </div>
            
            <div className="pt-2">
               <div className="h-px bg-gray-200 my-2"></div>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">System Summary</p>
               <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-xl border border-gray-100 p-2 text-center shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Monthly Topup</p>
                    <p className="text-sm font-bold text-gray-700">{parseFloat(String(user.monthly_topup || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-2 text-center shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">User ID</p>
                    <p className="text-sm font-bold text-gray-700">#{user.id}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Edit Settings */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-100 bg-slate-50/70 flex items-center gap-3">
              <i className="fas fa-edit text-orange-500"></i>
              <h3 className="font-bold text-gray-800 text-sm">แก้ไขข้อมูลบัญชี</h3>
            </div>
            <div className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 
                 <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-gray-500 mb-2 whitespace-nowrap"><i className="fas fa-envelope text-blue-400 w-4"></i> อีเมล (Email)</label>
                   <input 
                     type="email" 
                     className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 bg-white text-gray-700" 
                     value={editEmail} 
                     onChange={(e) => setEditEmail(e.target.value)}
                     placeholder="example@mail.com"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-gray-500 mb-2 whitespace-nowrap"><i className="fas fa-coins text-[#f97316] w-4"></i> จำนวนเงินที่มีอยู่ (Balance)</label>
                   <input 
                     type="number" 
                     className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 bg-white text-gray-700" 
                     value={editBalance} 
                     onChange={(e) => setEditBalance(e.target.value)}
                     step="0.01"
                   />
                 </div>

                 <div>
                   <label className="block text-xs font-bold text-gray-500 mb-2">ลำดับสิทธิ์ (Roles)</label>
                   <select 
                     className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 bg-white text-gray-700"
                     value={editRole}
                     onChange={e => setEditRole(e.target.value)}
                   >
                     <option value="user">Member (ผู้ใช้ทั่วไป)</option>
                     <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                   </select>
                 </div>
               </div>

                <div className="mt-6 pt-5 border-t border-gray-100 space-y-4">
                  <button 
                   onClick={handleSaveSettings}
                   disabled={savingSettings}
                   className="w-full py-3.5 bg-[#f97316] text-white font-black rounded-xl shadow-[0_4px_0_#c2410c] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                  >
                    {savingSettings ? <><i className="fas fa-spinner fa-spin"></i> กำลังบันทึก...</> : <><i className="fas fa-save shadow-sm"></i> บันทึกข้อมูลข้อมูลทั้งหมด</>}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <Link href={`/admin/users/${id}/history?tab=topup`} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-all flex items-center justify-center gap-2 shadow-sm">
                      <i className="fas fa-wallet"></i> ประวัติเติมเงิน
                    </Link>
                    <Link href={`/admin/users/${id}/history?tab=purchase`} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-all flex items-center justify-center gap-2 shadow-sm">
                      <i className="fas fa-shopping-cart"></i> ประวัติทำรายการ
                    </Link>
                    <Link href={`/admin/users/${id}/history?tab=redeem`} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-bold text-xs hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-all flex items-center justify-center gap-2 shadow-sm">
                      <i className="fas fa-gift"></i> ประวัติใช้โค้ด
                    </Link>
                  </div>
                </div>
            </div>
          </div>
        </div>

      </div>

      {/* History section removed and buttons moved above */}
    </div>
  );
}
