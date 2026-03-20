'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="modal-content max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary to-primary/70 rounded-t-2xl"></div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <i className="fas fa-sign-in-alt text-primary" aria-hidden="true"></i>
                </div>
                <h2 className="text-lg font-bold text-foreground">เข้าสู่ระบบ</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors"
                aria-label="ปิด"
              >
                <i className="fas fa-xmark" aria-hidden="true"></i>
              </button>
            </div>

            <div className="text-sm text-foreground-muted mb-5 bg-primary/5 border border-primary/10 rounded-xl p-3">
              <i className="fas fa-info-circle text-primary mr-1.5" aria-hidden="true"></i>
              ใช้ Username & Password เดียวกับที่ลงทะเบียนในเกม (AuthMe)
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-error-light border border-error/20 rounded-xl p-3 mb-4 text-sm text-error flex items-center gap-2"
              >
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-sm font-medium text-foreground mb-1.5">
                  Username
                </label>
                <input
                  ref={inputRef}
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="input"
                  placeholder="ชื่อในเกม"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-foreground mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input"
                  placeholder="รหัสผ่าน"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? (
                  <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> กำลังเข้าสู่ระบบ...</>
                ) : (
                  <><i className="fas fa-sign-in-alt" aria-hidden="true"></i> เข้าสู่ระบบ</>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
