'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export type AdminAction = 'regen' | 'setpw';

/**
 * Confirmation / input modal for the shop web-admin credential actions, replacing
 * the old window.confirm / window.prompt. Two modes:
 *   - regen : confirm-only, "สุ่มรหัสใหม่" (back to rotating)
 *   - setpw : password input (min 6), "ตั้งรหัสเอง" (permanent custom password)
 * onConfirm receives the typed password for setpw, undefined for regen.
 */
export default function AdminActionModal({
  action, busy, onClose, onConfirm,
}: {
  action: AdminAction | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => void;
}) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  // Reset the form whenever a fresh action opens.
  useEffect(() => {
    if (action) { setPw(''); setShow(false); setErr(''); }
  }, [action]);

  // Esc to close.
  useEffect(() => {
    if (!action) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [action, busy, onClose]);

  const isSetPw = action === 'setpw';

  const submit = () => {
    if (isSetPw) {
      if (pw.length < 6) { setErr('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'); return; }
      if (pw.length > 100) { setErr('รหัสผ่านยาวเกินไป'); return; }
      onConfirm(pw);
    } else {
      onConfirm();
    }
  };

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 overflow-y-auto bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => { if (!busy) onClose(); }}
        >
          <motion.div
            className="relative w-full max-w-md my-8 bg-background border border-border rounded-2xl shadow-2xl"
            initial={{ scale: 0.96, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSetPw ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>
                  <i className={`fas ${isSetPw ? 'fa-pen' : 'fa-dice'} text-lg`} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    {isSetPw ? 'ตั้งรหัสผ่านเอง' : 'สุ่มรหัสแอดมินใหม่'}
                  </h2>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {isSetPw ? 'ตั้งรหัสถาวร (หยุดการหมุนรหัสทุก 1 นาที)' : 'สร้างรหัสหมุนเวียนชุดใหม่'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => { if (!busy) onClose(); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary cursor-pointer flex-shrink-0">
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {isSetPw ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">
                    หลังตั้งรหัสเอง รหัสจะไม่หมุนทุก 1 นาทีอีกต่อไป และใช้รหัสนี้ถาวรจนกว่าจะเปลี่ยน
                  </p>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={pw}
                      autoFocus
                      onChange={e => { setPw(e.target.value); setErr(''); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !busy) submit(); }}
                      placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button type="button" onClick={() => setShow(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                      <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                    </button>
                  </div>
                  {err && (
                    <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <i className="fas fa-circle-exclamation" /> {err}
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm font-bold text-foreground mb-1">
                    <i className="fas fa-triangle-exclamation mr-1.5 text-amber-600" /> รหัสเดิมจะใช้เข้าสู่ระบบไม่ได้ทันที
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    ระบบจะสร้างรหัสหมุนเวียนชุดใหม่ที่เปลี่ยนทุก 1 นาที คัดลอกรหัสใหม่จากการ์ดหลังยืนยัน
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button onClick={submit} disabled={busy}
                  className={`flex-1 cursor-pointer font-bold rounded-full ${isSetPw ? '' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                  {busy
                    ? <i className="fas fa-spinner fa-spin mr-2" />
                    : <i className={`fas ${isSetPw ? 'fa-check' : 'fa-dice'} mr-2`} />}
                  {isSetPw ? 'บันทึกรหัสผ่าน' : 'ยืนยันสุ่มรหัสใหม่'}
                </Button>
                <Button variant="outline" onClick={() => { if (!busy) onClose(); }} disabled={busy}
                  className="cursor-pointer font-bold rounded-full">
                  ยกเลิก
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
