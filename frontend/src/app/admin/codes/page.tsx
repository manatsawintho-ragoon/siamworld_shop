'use client';
import { useState } from 'react';
import { api, getToken } from '@/lib/api';

// Mock Interface since backend doesn't exist yet
interface RedeemCode {
  id: number;
  code: string;
  reward_type: 'balance' | 'item';
  reward_amount: number;
  reward_name?: string;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminCodeManager() {
  // Mock Data
  const [codes, setCodes] = useState<RedeemCode[]>([
    {
      id: 1,
      code: 'VERITY2025',
      reward_type: 'balance',
      reward_amount: 100,
      max_uses: 1000,
      current_uses: 452,
      expires_at: '2025-12-31T23:59:59Z',
      is_active: true,
      created_at: '2025-01-01T12:00:00Z',
    },
    {
      id: 2,
      code: 'FREEVIP',
      reward_type: 'item',
      reward_amount: 1,
      reward_name: 'VIP Rank (30 Days)',
      max_uses: 50,
      current_uses: 50,
      expires_at: null,
      is_active: false,
      created_at: '2024-11-20T08:30:00Z',
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock handlers
  const handleToggleStatus = (id: number) => {
    setCodes(codes.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
  };

  const handleDelete = (id: number) => {
    if (confirm('คุณต้องการลบโค้ดนี้ใช่หรือไม่?')) {
      setCodes(codes.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          จัดการโค้ดของรางวัล
        </h1>
        <div className="flex items-center gap-3">
          <button className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-semibold transition-colors flex items-center gap-2 shadow-sm border border-gray-200">
            <i className="fas fa-sync-alt"></i> รีเฟรช
          </button>
          <button onClick={() => setIsModalOpen(true)} className="text-xs px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] rounded-lg text-white font-bold transition-colors flex items-center gap-2 shadow-sm">
            <i className="fas fa-plus"></i> เพิ่มโค้ดใหม่
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <i className="fas fa-ticket-alt text-[#f97316]"></i>
          <h3 className="font-bold text-gray-800 text-sm">รายการโค้ดทั้งหมด</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#f97316]">
            <i className="fas fa-spinner fa-spin text-3xl"></i>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-4 font-semibold w-[20%]">รหัสโค้ด</th>
                  <th className="px-5 py-4 font-semibold w-[20%]">รางวัล</th>
                  <th className="px-5 py-4 font-semibold w-[15%] text-center">สิทธิ์คงเหลือ</th>
                  <th className="px-5 py-4 font-semibold w-[15%]">หมดอายุ</th>
                  <th className="px-5 py-4 font-semibold w-[15%] text-center">สถานะ</th>
                  <th className="px-5 py-4 font-semibold w-[15%] text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#f97316]">
                          <i className="fas fa-barcode"></i>
                        </div>
                        <span className="text-sm font-black text-gray-800 tracking-wide">{c.code}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {c.reward_type === 'balance' ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-green-600">+฿{c.reward_amount.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-400">เงินในระบบ</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-blue-600">{c.reward_name}</span>
                          <span className="text-[10px] text-gray-400">ไอเทม / ยศ</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-800">{c.current_uses} / {c.max_uses}</span>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full ${c.current_uses >= c.max_uses ? 'bg-red-500' : 'bg-[#f97316]'}`} 
                            style={{ width: `${Math.min(100, (c.current_uses / c.max_uses) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {c.expires_at ? (
                        <span className="text-xs text-gray-600 font-medium">
                          {new Date(c.expires_at).toLocaleDateString('th-TH')}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md font-bold">ไม่มีวันหมดอายุ</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => handleToggleStatus(c.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
                          c.is_active 
                            ? 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100' 
                            : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        }`}
                      >
                        <i className={`fas ${c.is_active ? 'fa-check' : 'fa-times'}`}></i>
                        {c.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex items-center justify-center">
                          <i className="fas fa-edit text-xs"></i>
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors flex items-center justify-center">
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <i className="fas fa-ticket-alt text-3xl text-gray-300 mb-3"></i>
                      <p className="text-gray-500 font-medium">ยังไม่มีโค้ดในระบบ</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Purely visual mock */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-800"><i className="fas fa-plus-circle text-[#f97316] mr-2"></i>สร้างโค้ดใหม่</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">รหัสโค้ด</label>
                <div className="relative">
                  <i className="fas fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input type="text" className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all" placeholder="เช่น DISCORD2025" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">ประเภทรางวัล</label>
                  <select className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#f97316]">
                    <option value="balance">เครดิต / เงิน</option>
                    <option value="item">ไอเทมในเกม</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">จำนวนที่แจก (สิทธิ์)</label>
                  <input type="number" defaultValue="100" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#f97316]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">จำนวนเงิน</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                  <input type="number" defaultValue="50" className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#f97316]" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors text-sm">
                  ยกเลิก
                </button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold transition-colors text-sm shadow-sm flex items-center justify-center gap-2">
                  <i className="fas fa-save"></i> บันทึกโค้ด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
