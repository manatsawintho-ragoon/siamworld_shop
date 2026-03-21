'use client';
import { useEffect, useState, useRef } from 'react';
import { api, getToken } from '@/lib/api';

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

const emptyServer = {
  name: '', host: '', port: 25565, rcon_port: 25575, rcon_password: '',
  minecraft_version: '1.20.4', max_players: 100, is_enabled: true,
};

export default function AdminServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Server> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, boolean | null>>({});
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api('/admin/servers', { token: getToken()! })
      .then(d => setServers((d.servers as Server[]) || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        name: editing.name,
        host: editing.host,
        port: editing.port,
        rcon_port: editing.rcon_port,
        rcon_password: editing.rcon_password || undefined,
        minecraft_version: editing.minecraft_version,
        max_players: editing.max_players,
        is_enabled: Boolean(editing.is_enabled),
      };
      if (editing.id) {
        await api(`/admin/servers/${editing.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/servers', { method: 'POST', token: getToken()!, body });
      }
      setEditing(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(prev => ({ ...prev, [id]: null }));
    try {
      const data = await api(`/admin/servers/${id}/test`, { method: 'POST', token: getToken()! });
      setTestResult(prev => ({ ...prev, [id]: (data.healthy as boolean) || false }));
    } catch {
      setTestResult(prev => ({ ...prev, [id]: false }));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบเซิร์ฟเวอร์นี้?')) return;
    try {
      await api(`/admin/servers/${id}`, { method: 'DELETE', token: getToken()! });
      load();
    } catch { }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fas fa-server mr-2 text-gray-400"></i>จัดการเซิร์ฟเวอร์
        </h1>
        <button onClick={() => setEditing({ ...emptyServer })} className="btn-primary text-sm">
          <i className="fas fa-plus"></i> เพิ่มเซิร์ฟเวอร์
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>
      ) : servers.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <i className="fas fa-server text-3xl mb-3"></i>
          <p>ยังไม่มีเซิร์ฟเวอร์</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map(s => (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <i className={`fas fa-server ${s.is_enabled ? 'text-green-600' : 'text-gray-400'}`}></i>
                  </div>
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-gray-400">{s.host}:{s.port}</p>
                  </div>
                </div>
                <span className={`badge ${s.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_enabled ? 'เปิด' : 'ปิด'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="bg-gray-50 rounded-md px-3 py-2">
                  <span className="text-xs text-gray-400">RCON Port</span>
                  <p className="font-mono">{s.rcon_port}</p>
                </div>
                <div className="bg-gray-50 rounded-md px-3 py-2">
                  <span className="text-xs text-gray-400">Version</span>
                  <p>{s.minecraft_version}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTest(s.id)}
                  disabled={testing === s.id}
                  className={`btn text-xs px-3 py-1.5 ${
                    testResult[s.id] === true ? 'bg-green-100 text-green-700' :
                    testResult[s.id] === false ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}
                >
                  {testing === s.id ? <i className="fas fa-spinner fa-spin"></i> :
                   testResult[s.id] === true ? <><i className="fas fa-check"></i> เชื่อมต่อได้</> :
                   testResult[s.id] === false ? <><i className="fas fa-xmark"></i> เชื่อมต่อไม่ได้</> :
                   <><i className="fas fa-plug"></i> ทดสอบ</>}
                </button>
                <button onClick={() => setEditing({ ...s })} className="btn bg-gray-100 text-gray-600 text-xs px-3 py-1.5">
                  <i className="fas fa-pen"></i> แก้ไข
                </button>
                <button onClick={() => handleDelete(s.id)} className="btn bg-red-50 text-red-600 text-xs px-3 py-1.5">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setEditing(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-server text-green-600 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">{editing.id ? 'แก้ไขเซิร์ฟเวอร์' : 'เพิ่มเซิร์ฟเวอร์ใหม่'}</h3>
                <p className="text-[11px] text-gray-400">{editing.id ? 'แก้ไขข้อมูลเซิร์ฟเวอร์ที่เลือก' : 'กำหนดค่า RCON และข้อมูลเซิร์ฟเวอร์'}</p>
              </div>
              <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg border border-red-100 flex items-center gap-1.5"><i className="fas fa-exclamation-circle"></i> {error}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">ชื่อเซิร์ฟเวอร์ <span className="text-red-400">*</span></label>
                <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="เช่น Survival" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Host <span className="text-red-400">*</span></label>
                  <input value={editing.host || ''} onChange={e => setEditing({ ...editing, host: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="mc.server.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Port</label>
                  <input type="number" value={editing.port || 25565} onChange={e => setEditing({ ...editing, port: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">RCON Port <span className="text-red-400">*</span></label>
                  <input type="number" value={editing.rcon_port || 25575} onChange={e => setEditing({ ...editing, rcon_port: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">RCON Password <span className="text-red-400">*</span></label>
                  <input type="password" value={editing.rcon_password || ''} onChange={e => setEditing({ ...editing, rcon_password: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="••••••••" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Minecraft Version</label>
                  <input value={editing.minecraft_version || ''} onChange={e => setEditing({ ...editing, minecraft_version: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 placeholder:text-gray-300" placeholder="1.20.4" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">Max Players</label>
                  <input type="number" value={editing.max_players || 100} onChange={e => setEditing({ ...editing, max_players: Number(e.target.value) })} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_enabled !== false} onChange={e => setEditing({ ...editing, is_enabled: e.target.checked })} className="accent-[#16a34a] w-4 h-4" />
                <span className="text-sm text-gray-700">เปิดใช้งาน</span>
              </label>
            </div>
            <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_4px_0_#d1d5db]">
                <i className="fas fa-times text-[12px]"></i> ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#1e2735] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#38404d]">
                {saving ? <><i className="fas fa-spinner fa-spin text-[12px]"></i> บันทึก...</> : <><i className="fas fa-save text-[12px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })()}
    </div>
  );
}
