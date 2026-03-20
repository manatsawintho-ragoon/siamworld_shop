'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header accent bar */}
        <div className="h-1 bg-gradient-to-r from-brand-500 to-brand-400 rounded-t-2xl"></div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center">
                <i className="fas fa-sign-in-alt text-brand-500"></i>
              </div>
              <h2 className="text-lg font-bold dark:text-white">เข้าสู่ระบบ</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors">
              <i className="fas fa-xmark"></i>
            </button>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-5 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-lg p-3">
            <i className="fas fa-info-circle text-brand-500 mr-1.5"></i>
            ใช้ Username & Password เดียวกับที่ลงทะเบียนในเกม (AuthMe)
          </div>

          {error && (
            <div className="bg-error-50 dark:bg-error-500/10 border border-error-200 dark:border-error-500/20 rounded-lg p-3 mb-4 text-sm text-error-600 dark:text-error-400 flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="input" placeholder="ชื่อในเกม" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input" placeholder="รหัสผ่าน" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? (
                <><i className="fas fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...</>
              ) : (
                <><i className="fas fa-sign-in-alt"></i> เข้าสู่ระบบ</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
