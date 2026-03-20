'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';

interface StepStatus {
  rcon: 'idle' | 'testing' | 'success' | 'error';
}

export default function SetupWizardPage() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<StepStatus>({ rcon: 'idle' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Server config form
  const [serverConfig, setServerConfig] = useState({
    name: '',
    host: '',
    port: 25565,
    rcon_port: 25575,
    rcon_password: '',
    minecraft_version: '1.20.4',
    max_players: 100,
  });

  const updateConfig = (field: string, value: string | number) => {
    setServerConfig(prev => ({ ...prev, [field]: value }));
  };

  const testRcon = async () => {
    setStatus(prev => ({ ...prev, rcon: 'testing' }));
    setMessage('');
    try {
      const res = await api('/setup/test-rcon', {
        method: 'POST',
        token: getToken() || undefined,
        body: {
          host: serverConfig.host,
          rcon_port: serverConfig.rcon_port,
          rcon_password: serverConfig.rcon_password,
        },
      });
      if (res.success) {
        setStatus(prev => ({ ...prev, rcon: 'success' }));
        setMessage(res.message || 'Connected');
      } else {
        setStatus(prev => ({ ...prev, rcon: 'error' }));
        setMessage(res.message || 'RCON connection failed');
      }
    } catch (err: any) {
      setStatus(prev => ({ ...prev, rcon: 'error' }));
      setMessage(err.message || 'Connection test failed');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/setup/save-server', {
        method: 'POST',
        token: getToken() || undefined,
        body: serverConfig,
      });
      if (res.success) {
        setStep(3);
        setMessage('Server configuration saved successfully!');
      } else {
        setMessage(String(res.error || 'Failed to save configuration'));
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
        <p className="text-gray-400 mt-2">Admin access required for setup wizard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-2">🧠 Setup Wizard</h1>
      <p className="text-gray-400 mb-8">Configure your Minecraft server connection step by step.</p>

      {/* Progress Steps */}
      <div className="flex items-center mb-8 gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              {step > s ? '✓' : s}
            </div>
            {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-emerald-500' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Server Info */}
      {step === 1 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Step 1: Server Information</h2>
          <p className="text-gray-400 text-sm">Enter your Minecraft server details.</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-300 mb-1">Server Name</label>
              <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.name} onChange={e => updateConfig('name', e.target.value)}
                placeholder="My Survival Server" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Host / IP</label>
              <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.host} onChange={e => updateConfig('host', e.target.value)}
                placeholder="127.0.0.1 or host.docker.internal" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Game Port</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.port} onChange={e => updateConfig('port', parseInt(e.target.value) || 25565)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Minecraft Version</label>
              <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.minecraft_version} onChange={e => updateConfig('minecraft_version', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Max Players</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.max_players} onChange={e => updateConfig('max_players', parseInt(e.target.value) || 100)} />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={() => setStep(2)} disabled={!serverConfig.name || !serverConfig.host}
              className="btn-primary disabled:opacity-50">
              Next: RCON Configuration →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: RCON Configuration */}
      {step === 2 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Step 2: RCON Configuration</h2>
          <p className="text-gray-400 text-sm">Configure RCON to enable item delivery. Make sure <code className="text-emerald-400">enable-rcon=true</code> in your server.properties.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">RCON Port</label>
              <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.rcon_port} onChange={e => updateConfig('rcon_port', parseInt(e.target.value) || 25575)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">RCON Password</label>
              <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                value={serverConfig.rcon_password} onChange={e => updateConfig('rcon_password', e.target.value)}
                placeholder="Your RCON password" />
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-4 pt-2">
            <button onClick={testRcon} disabled={status.rcon === 'testing' || !serverConfig.rcon_password}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                status.rcon === 'success' ? 'bg-emerald-600 text-white' :
                status.rcon === 'error' ? 'bg-red-600 text-white' :
                'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}>
              {status.rcon === 'testing' ? '⏳ Testing...' :
               status.rcon === 'success' ? '✅ Connected' :
               status.rcon === 'error' ? '❌ Retry Test' :
               '🔌 Test RCON Connection'}
            </button>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              status.rcon === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              status.rcon === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-gray-800 text-gray-300'
            }`}>
              {message}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              ← Back
            </button>
            <button onClick={saveConfig} disabled={saving || !serverConfig.rcon_password}
              className="btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : '💾 Save & Complete'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && (
        <div className="card p-8 text-center space-y-4">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
          <p className="text-gray-400">
            Your Minecraft server <span className="text-emerald-400 font-bold">{serverConfig.name}</span> has been configured.
          </p>
          <div className="bg-gray-800/50 rounded-lg p-4 text-left text-sm space-y-1">
            <p className="text-gray-300"><span className="text-gray-500">Host:</span> {serverConfig.host}:{serverConfig.port}</p>
            <p className="text-gray-300"><span className="text-gray-500">RCON:</span> Port {serverConfig.rcon_port}</p>
            <p className="text-gray-300"><span className="text-gray-500">Version:</span> {serverConfig.minecraft_version}</p>
            <p className="text-gray-300"><span className="text-gray-500">Password:</span> 🔒 Encrypted & Stored</p>
          </div>
          <div className="flex justify-center gap-4 pt-4">
            <a href="/admin" className="btn-primary">Go to Dashboard</a>
            <button onClick={() => { setStep(1); setServerConfig({ name: '', host: '', port: 25565, rcon_port: 25575, rcon_password: '', minecraft_version: '1.20.4', max_players: 100 }); setStatus({ rcon: 'idle' }); setMessage(''); }}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
              ➕ Add Another Server
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
