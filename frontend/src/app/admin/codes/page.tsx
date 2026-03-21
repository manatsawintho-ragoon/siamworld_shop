'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';

interface RedeemCode {
  id: number;
  code: string;
  description: string | null;
  reward_type: 'rcon' | 'point';
  point_amount: number | null;
  command: string | null;
  max_uses: number;
  used_count: number;
  actual_used: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface RedeemLog {
  id: number;
  code_id: number;
  user_id: number;
  username: string;
  redeemed_at: string;
}

const EMPTY_CODE = {
  code: '',
  description: '',
  reward_type: 'rcon' as const,
  point_amount: null as number | null,
  command: '',
  max_uses: 1,
  active: true,
  expires_at: '',
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg(4)}-${seg(4)}-${seg(4)}`;
}

function toLocalISOString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeUntil(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const past = diff < 0;
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  let text: string;
  if (days > 0) text = `${days} วัน`;
  else if (hours > 0) text = `${hours} ชม.`;
  else if (minutes > 0) text = `${minutes} นาที`;
  else text = 'ไม่กี่วินาที';

  return past ? `หมดแล้ว ${text}` : `อีก ${text}`;
}

export default function AdminCodeManager() {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<RedeemCode> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewingLogs, setViewingLogs] = useState<{ codeId: number; codeName: string; logs: RedeemLog[] } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [viewingCmd, setViewingCmd] = useState<{ code: string; command: string } | null>(null);
  const backdropDown = useRef(false);
  const logsBackdropDown = useRef(false);
  const cmdBackdropDown = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    api('/admin/codes', { token: getToken()! })
      .then(d => setCodes((d.codes as RedeemCode[]) || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const body: any = {
        code: editing.code,
        description: editing.description || null,
        reward_type: editing.reward_type || 'rcon',
        point_amount: editing.reward_type === 'point' ? Number(editing.point_amount) || null : null,
        command: editing.reward_type === 'rcon' ? (editing.command || null) : null,
        max_uses: Number(editing.max_uses) || 0,
        active: editing.active !== false,
        expires_at: editing.expires_at || null,
      };
      if (editing.id) {
        await api(`/admin/codes/${editing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/codes', { method: 'POST', token: getToken()!, body });
      }
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบโค้ดนี้?')) return;
    try {
      await api(`/admin/codes/${id}`, { method: 'DELETE', token: getToken()! });
      load();
    } catch { }
  };

  const handleToggle = async (code: RedeemCode) => {
    const newActive = !code.active;
    setCodes(prev => prev.map(c => c.id === code.id ? { ...c, active: newActive } : c));
    try {
      await api(`/admin/codes/${code.id}`, { method: 'PUT', token: getToken()!, body: { active: newActive } });
    } catch { load(); }
  };

  const viewLogs = async (code: RedeemCode) => {
    setLogsLoading(true);
    setViewingLogs({ codeId: code.id, codeName: code.code, logs: [] });
    try {
      const d = await api(`/admin/codes/${code.id}/logs`, { token: getToken()! });
      setViewingLogs({ codeId: code.id, codeName: code.code, logs: (d.logs as RedeemLog[]) || [] });
    } catch { }
    setLogsLoading(false);
  };

  const isExpired = (code: RedeemCode) => code.expires_at && new Date(code.expires_at) < new Date();
  const isUsedUp = (code: RedeemCode) => code.max_uses > 0 && code.used_count >= code.max_uses;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-ticket-alt text-[#f97316]"></i> จัดการโค้ดไอเทม
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">สร้างและจัดการโค้ดสำหรับแจกไอเทมให้ผู้เล่น</p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_CODE, code: generateCode() })}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]"
        >
          <i className="fas fa-plus text-[12px]"></i> สร้างโค้ดใหม่
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'โค้ดทั้งหมด', value: codes.length, icon: 'fa-ticket-alt', color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'ใช้งานอยู่', value: codes.filter(c => c.active && !isExpired(c) && !isUsedUp(c)).length, icon: 'fa-check-circle', color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'หมดอายุ/ครบ', value: codes.filter(c => isExpired(c) || isUsedUp(c)).length, icon: 'fa-clock', color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'ใช้ไปทั้งหมด', value: codes.reduce((sum, c) => sum + (c.actual_used || c.used_count), 0), icon: 'fa-gift', color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${s.icon} ${s.color} text-sm`}></i>
            </div>
            <div>
              <p className="text-lg font-black text-gray-800 tabular-nums">{s.value}</p>
              <p className="text-[10px] text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-ticket-alt text-orange-500 text-xs"></i>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">รายการโค้ด</h3>
            <p className="text-[11px] text-gray-500">{codes.length} โค้ด</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <i className="fas fa-spinner fa-spin text-2xl text-orange-400"></i>
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <i className="fas fa-ticket-alt text-3xl mb-3 text-gray-300"></i>
            <p className="text-sm font-medium">ยังไม่มีโค้ด</p>
            <p className="text-xs mt-1">กดปุ่ม &quot;สร้างโค้ดใหม่&quot; เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">รหัสโค้ด</th>
                  <th className="px-5 py-3 font-medium text-center">ประเภท</th>
                  <th className="px-5 py-3 font-medium text-center">รางวัล</th>
                  <th className="px-5 py-3 font-medium text-center">เงื่อนไขการใช้</th>
                  <th className="px-5 py-3 font-medium">วันที่สร้าง</th>
                  <th className="px-5 py-3 font-medium">วันหมดอายุ</th>
                  <th className="px-5 py-3 font-medium text-center">สถานะ</th>
                  <th className="px-5 py-3 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(code => (
                  <tr key={code.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-200/80 px-3 py-1.5 rounded text-[15px] font-mono font-black text-gray-800 tracking-wider">{code.code}</code>
                        <button onClick={() => { navigator.clipboard.writeText(code.code); setCopiedId(code.id); setTimeout(() => setCopiedId(null), 2000); }}
                          className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" title="คัดลอกโค้ด">
                          <i className={`fas ${copiedId === code.id ? 'fa-check text-green-500' : 'fa-copy'} text-[11px]`}></i>
                        </button>
                      </div>
                      {code.description && <p className="text-[11px] text-gray-500 mt-1 max-w-[220px] truncate">{code.description}</p>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {code.reward_type === 'point' ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500 text-white"><i className="fas fa-coins mr-1"></i>Promo Code</span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-blue-500 text-white"><i className="fas fa-terminal mr-1"></i>RCON</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {code.reward_type === 'point' ? (
                        <span className="text-sm font-bold text-amber-600">{code.point_amount} บาท</span>
                      ) : (
                        <button onClick={() => setViewingCmd({ code: code.code, command: code.command || '' })}
                          className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer">
                          <i className="fas fa-terminal text-[10px] mr-1"></i>ดูคำสั่ง
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div>
                        <span className="text-sm font-bold text-gray-800 tabular-nums">
                          {code.actual_used || code.used_count} / {code.max_uses === 0 ? '∞' : code.max_uses}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      <div>
                        <span className="text-[13px] font-semibold text-gray-700">{new Date(code.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        <p className="text-[11px] text-gray-500 mt-0.5">{new Date(code.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {code.expires_at ? (
                        <div>
                          <span className={`text-[13px] font-semibold ${isExpired(code) ? 'text-red-500' : 'text-green-600'}`}>
                            {timeUntil(code.expires_at)}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {new Date(code.expires_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(code.expires_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </p>
                        </div>
                      ) : <span className="text-gray-300 text-[13px]">ถาวร</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {isExpired(code) ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-red-500 text-white">หมดอายุ</span>
                      ) : isUsedUp(code) ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-gray-500 text-white">ใช้ครบ</span>
                      ) : code.active ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-green-500 text-white">ใช้งานได้</span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-gray-400 text-white">ปิด</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => viewLogs(code)} className="w-8 h-8 rounded-lg bg-blue-500 border border-blue-600 flex items-center justify-center text-white shadow-[0_3px_0_#1d4ed8] hover:brightness-110 transition-all active:shadow-[0_1px_0_#1d4ed8] active:translate-y-[2px]" title="ดูประวัติ">
                          <i className="fas fa-history text-[11px]"></i>
                        </button>
                        <button onClick={() => handleToggle(code)} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-white shadow-[0_3px_0] hover:brightness-110 transition-all active:shadow-[0_1px_0] active:translate-y-[2px] ${code.active ? 'bg-green-500 border-green-600 shadow-[0_3px_0_#15803d]' : 'bg-gray-400 border-gray-500 shadow-[0_3px_0_#6b7280]'}`} title={code.active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}>
                          <i className={`fas ${code.active ? 'fa-eye' : 'fa-eye-slash'} text-[11px]`}></i>
                        </button>
                        <button onClick={() => setEditing({ ...code, expires_at: code.expires_at ? code.expires_at.slice(0, 16) : '', reward_type: code.reward_type || 'rcon', point_amount: code.point_amount })} className="w-8 h-8 rounded-lg bg-amber-500 border border-amber-600 flex items-center justify-center text-white shadow-[0_3px_0_#b45309] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b45309] active:translate-y-[2px]" title="แก้ไข">
                          <i className="fas fa-pen text-[11px]"></i>
                        </button>
                        <button onClick={() => handleDelete(code.id)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#b91c1c] active:translate-y-[2px]" title="ลบ">
                          <i className="fas fa-trash text-[11px]"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { backdropDown.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (backdropDown.current && e.target === e.currentTarget && !saving) setEditing(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-2xl overflow-hidden">

            {/* ── Header ── */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 border border-orange-100">
                <i className="fas fa-ticket-alt text-orange-500 text-sm"></i>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 text-base leading-tight">{editing.id ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{editing.id ? 'แก้ไขข้อมูลโค้ดที่เลือก' : 'กรอกข้อมูลเพื่อสร้างโค้ดไอเทม'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] transition-all flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            {/* ── Body ── */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="text-red-600 text-xs bg-red-50 px-3 py-2.5 rounded-lg border border-red-100 flex items-center gap-2">
                  <i className="fas fa-exclamation-circle"></i> {error}
                </div>
              )}

              {/* ── Code display row ── */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">รหัสโค้ด</label>
                <div className="flex gap-2.5">
                  <div className="flex-1 px-4 py-2.5 rounded-lg border-2 border-gray-200 bg-gray-50 font-mono font-black text-gray-800 tracking-[0.2em] text-[15px] select-all flex items-center min-w-0">
                    {editing.code || <span className="text-gray-300 font-normal tracking-normal text-sm">กดสุ่มโค้ด →</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, code: generateCode() })}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#c2410c] hover:brightness-110 transition-all active:shadow-[0_1px_0_#c2410c] active:translate-y-[2px] whitespace-nowrap flex-shrink-0"
                  >
                    <i className="fas fa-random text-[11px]"></i> สุ่มโค้ด
                  </button>
                </div>
              </div>

              {/* ── 2-Column Grid ── */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                {/* ─ Left column ─ */}
                <div className="space-y-4">

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">คำอธิบาย</label>
                    <input
                      value={editing.description || ''}
                      onChange={e => setEditing({ ...editing, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 transition-colors"
                      placeholder="เช่น ต้อนรับสมาชิกใหม่"
                    />
                  </div>

                  {/* Reward type */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ประเภทรางวัล</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, reward_type: 'rcon' })}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                          (editing.reward_type || 'rcon') === 'rcon'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <i className="fas fa-terminal text-xs"></i> คำสั่ง RCON
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, reward_type: 'point' })}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                          editing.reward_type === 'point'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <i className="fas fa-coins text-xs"></i> Promo Code
                      </button>
                    </div>
                  </div>

                  {/* RCON command / Amount */}
                  {(editing.reward_type || 'rcon') === 'rcon' ? (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        คำสั่ง RCON <span className="text-red-400">*</span>
                        <span className="ml-1.5 font-normal text-gray-400">ใช้ {'{player}'} แทนชื่อผู้เล่น</span>
                      </label>
                      <textarea
                        value={editing.command || ''}
                        onChange={e => setEditing({ ...editing, command: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 resize-none bg-gray-50 transition-colors"
                        rows={4}
                        placeholder="give {player} diamond 64"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">
                        จำนวนเงิน (บาท) <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editing.point_amount ?? ''}
                          onChange={e => setEditing({ ...editing, point_amount: parseFloat(e.target.value) || null })}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300 pr-12 transition-colors"
                          placeholder="100" min={0} step="0.01"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">บาท</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─ Right column ─ */}
                <div className="space-y-4">

                  {/* Max uses */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">
                      จำนวนครั้งที่ใช้ได้
                      <span className="ml-1.5 font-normal text-gray-400">0 = ไม่จำกัด</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                        <i className="fas fa-hashtag text-xs"></i>
                      </div>
                      <input
                        type="number"
                        value={editing.max_uses ?? 1}
                        onChange={e => setEditing({ ...editing, max_uses: parseInt(e.target.value) || 0 })}
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 transition-colors"
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">วันหมดอายุ</label>

                    {/* Input row */}
                    <div className="flex gap-2 mb-2.5">
                      <input
                        type="number" min={1}
                        placeholder="เช่น 7"
                        id="custom-exp-val"
                        className="w-20 px-2.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 text-center flex-shrink-0 transition-colors"
                      />
                      <select
                        id="custom-exp-unit"
                        className="flex-1 px-2.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 transition-colors"
                      >
                        <option value="1">นาที</option>
                        <option value="60">ชั่วโมง</option>
                        <option value="1440">วัน</option>
                        <option value="10080">สัปดาห์</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const valEl = document.getElementById('custom-exp-val') as HTMLInputElement;
                          const unitEl = document.getElementById('custom-exp-unit') as HTMLSelectElement;
                          const n = parseFloat(valEl?.value || '0');
                          const u = parseFloat(unitEl?.value || '1');
                          if (n > 0) {
                            const t = new Date(Date.now() + n * u * 60000);
                            setEditing({ ...editing, expires_at: toLocalISOString(t) });
                          }
                        }}
                        className="px-3 py-2.5 bg-[#1e2735] text-white text-[13px] font-bold rounded-lg shadow-[0_3px_0_#38404d] hover:brightness-110 transition-all active:shadow-none active:translate-y-[1px] flex-shrink-0"
                      >
                        ตั้งค่า
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, expires_at: '' })}
                        className={`px-3 py-2.5 rounded-lg text-xs font-bold border-2 transition-all flex-shrink-0 ${
                          !editing.expires_at
                            ? 'border-gray-700 bg-gray-100 text-gray-700'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <i className="fas fa-infinity text-xs"></i>
                      </button>
                    </div>

                    {/* Preview */}
                    {editing.expires_at ? (
                      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <i className="fas fa-clock text-amber-500 text-sm flex-shrink-0"></i>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-amber-700">
                            {new Date(editing.expires_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {' '}{new Date(editing.expires_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </p>
                          <p className="text-[10px] text-amber-500 mt-0.5">{timeUntil(editing.expires_at)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                        <i className="fas fa-infinity text-gray-400 text-sm flex-shrink-0"></i>
                        <p className="text-xs text-gray-400 font-medium">ไม่มีวันหมดอายุ</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 shadow-[0_4px_0_#d1d5db] hover:brightness-95 transition-all active:shadow-[0_1px_0_#d1d5db] active:translate-y-[2px]"
              >
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]"
              >
                {saving
                  ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</>
                  : <><i className="fas fa-save text-[12px]"></i> บันทึกโค้ด</>
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logs Modal */}
      {viewingLogs && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { logsBackdropDown.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (logsBackdropDown.current && e.target === e.currentTarget) setViewingLogs(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden">
            <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-history text-blue-500 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">ประวัติการใช้โค้ด</h3>
                <p className="text-[11px] text-gray-500">โค้ด: <code className="font-mono font-bold text-orange-500">{viewingLogs.codeName}</code></p>
              </div>
              <button onClick={() => setViewingLogs(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5 max-h-[50vh] overflow-y-auto">
              {logsLoading ? (
                <div className="flex items-center justify-center py-8"><i className="fas fa-spinner fa-spin text-lg text-blue-400"></i></div>
              ) : viewingLogs.logs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <i className="fas fa-inbox text-2xl mb-2 text-gray-300"></i>
                  <p className="text-xs">ยังไม่มีใครใช้โค้ดนี้</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {viewingLogs.logs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-2. rounded-lg border border-gray-100">
                      <img src={`https://mc-heads.net/avatar/${log.username}/32`} alt="" className="w-8 h-8 rounded-lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{log.username}</p>
                        <p className="text-[10px] text-gray-500">{new Date(log.redeemed_at).toLocaleString('th-TH')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Command Viewer Modal */}
      {viewingCmd && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { cmdBackdropDown.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (cmdBackdropDown.current && e.target === e.currentTarget) setViewingCmd(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden">
            <div className="relative px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-terminal text-blue-500 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">คำสั่ง RCON</h3>
                <p className="text-[11px] text-gray-500">โค้ด: <code className="font-mono font-bold text-orange-500">{viewingCmd.code}</code></p>
              </div>
              <button onClick={() => setViewingCmd(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5">
              <pre className="bg-gray-900 text-green-400 text-sm font-mono p-4 rounded-lg whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">{viewingCmd.command}</pre>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
