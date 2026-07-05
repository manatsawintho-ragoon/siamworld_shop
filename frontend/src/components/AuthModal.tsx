'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, LogIn } from 'lucide-react';
import AuthForm from '@/components/AuthForm';

interface AuthModalValue { open: () => void; close: () => void; }
const AuthModalContext = createContext<AuthModalValue | null>(null);

/**
 * Bottom-sheet login/register modal.
 *
 * Mobile-first and right-thumb friendly: on phones it slides up from the
 * bottom edge into the thumb zone, with the primary action button sitting low
 * on the sheet. On desktop it becomes a centered dialog. Opened from anywhere
 * via useAuthModal().open() (e.g. the bottom-nav login button).
 */
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ open, close }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center sm:p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={close}
              data-theme-portal=""
            >
              {/* Scrim */}
              <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

              {/* Sheet / dialog */}
              <motion.div
                className="relative w-full sm:max-w-sm bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[92vh] flex flex-col frontend-page"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 340 }}
                onClick={e => e.stopPropagation()}
              >
                {/* Grab handle (mobile affordance) */}
                <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
                  <span className="w-10 h-1.5 rounded-full bg-border" />
                </div>

                {/* Header */}
                <div className="px-5 pt-3 sm:pt-5 pb-3 flex items-center gap-3 border-b border-border-muted">
                  <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0">
                    <LogIn className="w-5 h-5 text-primary" strokeWidth={2.25} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-foreground text-sm leading-tight">เข้าสู่ระบบ / สมัครสมาชิก</p>
                    <p className="text-foreground-subtle text-[11px] mt-0.5">ใช้ชื่อและรหัสผ่านในเกม Minecraft</p>
                  </div>
                  <button onClick={close} aria-label="ปิด"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors flex-shrink-0">
                    <X className="w-5 h-5" strokeWidth={2.25} />
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <AuthForm onSuccess={close} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}
