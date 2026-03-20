'use client';
import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

interface Setting {
  key: string;
  value: string;
}

const SETTING_GROUPS = [
  {
    title: 'Shop Configuration',
    icon: 'fa-store',
    keys: [
      { key: 'shop_name', label: 'Shop Name', type: 'text' },
      { key: 'shop_description', label: 'Description', type: 'text' },
      { key: 'welcome_message', label: 'Welcome Message', type: 'text' },
      { key: 'currency', label: 'Currency Symbol', type: 'text' },
      { key: 'logo_url', label: 'Logo URL', type: 'text' },
      { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle' },
    ],
  },
  {
    title: 'Discord Integration',
    icon: 'fa-discord fab',
    keys: [
      { key: 'discord_webhook_url', label: 'Webhook URL', type: 'text' },
      { key: 'discord_invite', label: 'Invite Link', type: 'text' },
    ],
  },
  {
    title: 'Payment Settings',
    icon: 'fa-credit-card',
    keys: [
      { key: 'promptpay_id', label: 'PromptPay ID', type: 'text' },
      { key: 'truemoney_phone', label: 'TrueMoney Phone', type: 'text' },
    ],
  },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/admin/settings', { token: getToken()! })
      .then(d => {
        const arr = (d.settings as Setting[]) || [];
        const map: Record<string, string> = {};
        arr.forEach(s => { map[s.key] = s.value; });
        setSettings(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value: value ?? '' }));
      const data = await api('/admin/settings', { method: 'PUT', token: getToken()!, body: { settings: settingsArray } });
      // Update local state from response
      if (data.settings) {
        const updated = data.settings as Record<string, string>;
        setSettings(updated);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8 text-center"><i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <i className="fas fa-gear mr-2 text-gray-400"></i>ตั้งค่าระบบ
        </h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? <><i className="fas fa-spinner fa-spin"></i> กำลังบันทึก...</> :
           saved ? <><i className="fas fa-check"></i> บันทึกแล้ว!</> :
           <><i className="fas fa-save"></i> บันทึกการตั้งค่า</>}
        </button>
      </div>

      {SETTING_GROUPS.map(group => (
        <div key={group.title} className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">
              <i className={`${group.icon.includes('fab') ? group.icon : `fas ${group.icon}`} mr-2 text-gray-400`}></i>
              {group.title}
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {group.keys.map(({ key, label, type }) => (
              <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm text-gray-600 sm:w-48 flex-shrink-0">{label}</label>
                {type === 'toggle' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings[key] === 'true'}
                      onChange={e => setSettings({ ...settings, [key]: e.target.checked ? 'true' : 'false' })}
                      className="accent-black w-4 h-4"
                    />
                    <span className="text-sm text-gray-500">{settings[key] === 'true' ? 'เปิด' : 'ปิด'}</span>
                  </label>
                ) : (
                  <input
                    value={settings[key] || ''}
                    onChange={e => setSettings({ ...settings, [key]: e.target.value })}
                    className="input flex-1"
                    placeholder={`${label}...`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
