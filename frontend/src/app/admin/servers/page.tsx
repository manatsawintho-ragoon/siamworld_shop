'use client';
import { useEffect, useState } from 'react';
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

      {editing && (
        <div className="modal-overlay" onClick={() => !saving && setEditing(null)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{editing.id ? 'แก้ไขเซิร์ฟเวอร์' : 'เพิ่มเซิร์ฟเวอร์ใหม่'}</h3>
                <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-black"><i className="fas fa-xmark"></i></button>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700"><i className="fas fa-exclamation-circle mr-1.5"></i>{error}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ชื่อเซิร์ฟเวอร์ *</label>
                  <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="input" placeholder="เช่น Survival" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Host *</label>
                    <input value={editing.host || ''} onChange={e => setEditing({ ...editing, host: e.target.value })} className="input" placeholder="เช่น mc.server.com" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Port</label>
                    <input type="number" value={editing.port || 25565} onChange={e => setEditing({ ...editing, port: Number(e.target.value) })} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">RCON Port *</label>
                    <input type="number" value={editing.rcon_port || 25575} onChange={e => setEditing({ ...editing, rcon_port: Number(e.target.value) })} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">RCON Password *</label>
                    <input type="password" value={editing.rcon_password || ''} onChange={e => setEditing({ ...editing, rcon_password: e.target.value })} className="input" placeholder="••••••••" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Minecraft Version</label>
                    <input value={editing.minecraft_version || ''} onChange={e => setEditing({ ...editing, minecraft_version: e.target.value })} className="input" placeholder="1.20.4" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Max Players</label>
                    <input type="number" value={editing.max_players || 100} onChange={e => setEditing({ ...editing, max_players: Number(e.target.value) })} className="input" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editing.is_enabled !== false} onChange={e => setEditing({ ...editing, is_enabled: e.target.checked })} className="accent-black w-4 h-4" />
                  <span className="text-sm">เปิดใช้งาน</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                <button onClick={() => setEditing(null)} className="btn-ghost flex-1 justify-center">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <><i className="fas fa-spinner fa-spin"></i> กำลังบันทึก...</> : <><i className="fas fa-save"></i> บันทึก</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
