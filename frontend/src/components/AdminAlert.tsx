'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType = 'success' | 'error' | 'warning' | 'info' | 'danger';

interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface AlertState extends AlertOptions {
  mode: 'alert' | 'confirm';
  resolve: (value: boolean) => void;
}

interface ToastOptions {
  title: string;
  message?: string;
  type?: AlertType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface AlertContextValue {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: AlertOptions) => Promise<boolean>;
  toast: (opts: ToastOptions) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextValue | null>(null);

// ─── Per-type visual config ───────────────────────────────────────────────────

const TYPE_CONFIG = {
  success: {
    accent:      'bg-[#16a34a]',
    iconWrap:    'bg-green-100 ring-4 ring-green-200',
    iconColor:   'text-[#16a34a]',
    icon:        'fa-circle-check',
    glow:        'shadow-[0_0_32px_rgba(22,163,74,0.25)]',
    confirmBg:   'bg-[#16a34a] shadow-[0_4px_0_#0d6b2e] hover:brightness-110',
    confirmText: 'text-white',
  },
  error: {
    accent:      'bg-red-500',
    iconWrap:    'bg-red-100 ring-4 ring-red-200',
    iconColor:   'text-red-500',
    icon:        'fa-circle-xmark',
    glow:        'shadow-[0_0_32px_rgba(239,68,68,0.22)]',
    confirmBg:   'bg-red-500 shadow-[0_4px_0_#b91c1c] hover:brightness-110',
    confirmText: 'text-white',
  },
  danger: {
    accent:      'bg-red-600',
    iconWrap:    'bg-red-100 ring-4 ring-red-200',
    iconColor:   'text-red-600',
    icon:        'fa-triangle-exclamation',
    glow:        'shadow-[0_0_32px_rgba(220,38,38,0.22)]',
    confirmBg:   'bg-red-600 shadow-[0_4px_0_#991b1b] hover:brightness-110',
    confirmText: 'text-white',
  },
  warning: {
    accent:      'bg-amber-400',
    iconWrap:    'bg-amber-100 ring-4 ring-amber-200',
    iconColor:   'text-amber-500',
    icon:        'fa-triangle-exclamation',
    glow:        'shadow-[0_0_32px_rgba(251,191,36,0.25)]',
    confirmBg:   'bg-amber-500 shadow-[0_4px_0_#b45309] hover:brightness-110',
    confirmText: 'text-white',
  },
  info: {
    accent:      'bg-[#1e2735]',
    iconWrap:    'bg-slate-100 ring-4 ring-slate-200',
    iconColor:   'text-[#1e2735]',
    icon:        'fa-circle-info',
    glow:        'shadow-[0_0_32px_rgba(30,39,53,0.18)]',
    confirmBg:   'bg-[#1e2735] shadow-[0_4px_0_#38404d] hover:brightness-110',
    confirmText: 'text-white',
  },
} as const;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState | null>(null);
  const backdropDown = useRef(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  const close = useCallback((value: boolean) => {
    setState(prev => { prev?.resolve(value); return null; });
  }, []);

  const show = useCallback((mode: 'alert' | 'confirm', opts: AlertOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ ...opts, mode, type: opts.type ?? 'info', resolve });
    });
  }, []);

  const alert = useCallback(async (opts: AlertOptions) => {
    await show('alert', opts);
  }, [show]);

  const confirm = useCallback((opts: AlertOptions): Promise<boolean> => {
    return show('confirm', opts);
  }, [show]);

  const toast = useCallback((opts: ToastOptions) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { ...opts, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), opts.duration ?? 3500);
  }, []);

  const cfg = state ? TYPE_CONFIG[state.type ?? 'info'] : null;

  return (
    <AlertContext.Provider value={{ alert, confirm, toast }}>
      {children}

      {/* ── Toast Container ── */}
      <div className="fixed bottom-5 right-5 z-[9997] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const tc = TYPE_CONFIG[t.type ?? 'success'];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className={`pointer-events-auto flex items-start gap-3 bg-white rounded-xl border border-gray-200 shadow-[0_4px_0_#c5cad3,0_8px_24px_rgba(0,0,0,0.14)] px-4 py-3 max-w-[300px] overflow-hidden ${tc.glow}`}
              >
                <div className={`h-full absolute left-0 top-0 bottom-0 w-1 ${tc.accent} rounded-l-xl`} />
                <div className={`w-7 h-7 rounded-lg ${tc.iconWrap.replace('ring-4 ring-green-200','').replace('ring-4 ring-red-200','').replace('ring-4 ring-amber-200','').replace('ring-4 ring-slate-200','')} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <i className={`fas ${tc.icon} ${tc.iconColor} text-sm`} />
                </div>
                <div className="flex-1 min-w-0 pl-1">
                  <p className="font-black text-gray-900 text-[13px] leading-tight">{t.title}</p>
                  {t.message && <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{t.message}</p>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {state && cfg && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-[2px]"
              onMouseDown={e => { backdropDown.current = e.target === e.currentTarget; }}
              onMouseUp={e => { if (backdropDown.current && e.target === e.currentTarget) close(false); }}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.45, y: 32 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.82, y: 16, transition: { duration: 0.16, ease: 'easeIn' } }}
                transition={{ type: 'spring', stiffness: 420, damping: 24, mass: 0.75 }}
                className={`pointer-events-auto relative bg-white rounded-2xl w-full max-w-[360px] overflow-hidden border border-gray-200/80 ${cfg.glow} shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.18)]`}
              >
                {/* Colored top strip */}
                <div className={`h-1.5 w-full ${cfg.accent}`} />

                {/* Body */}
                <div className="px-6 pt-7 pb-6 flex flex-col items-center text-center">

                  {/* Icon circle */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
                    className={`w-16 h-16 rounded-full ${cfg.iconWrap} flex items-center justify-center mb-4 flex-shrink-0`}
                  >
                    <i className={`fas ${cfg.icon} ${cfg.iconColor} text-2xl`} />
                  </motion.div>

                  {/* Title */}
                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.2 }}
                    className="text-[17px] font-black text-gray-900 leading-tight mb-1.5"
                  >
                    {state.title}
                  </motion.h3>

                  {/* Message */}
                  {state.message && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14, duration: 0.2 }}
                      className="text-[13px] text-gray-500 leading-relaxed max-w-[280px]"
                    >
                      {state.message}
                    </motion.p>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 mx-0" />

                {/* Buttons */}
                <div className={`px-5 py-4 flex gap-2.5 ${state.mode === 'confirm' ? 'flex-row' : 'flex-col'}`}>
                  {state.mode === 'confirm' && (
                    <button
                      onClick={() => close(false)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-bold rounded-xl bg-surface border border-border text-foreground-muted shadow-sm hover:bg-surface-hover transition-all active:shadow-none active:translate-y-[2px]"
                    >
                      <i className="fas fa-times text-[11px]" />
                      {state.cancelLabel ?? 'ยกเลิก'}
                    </button>
                  )}

                  <button
                    onClick={() => close(true)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl ${cfg.confirmBg} ${cfg.confirmText} transition-all active:shadow-none active:translate-y-[3px]`}
                  >
                    {state.mode === 'confirm' ? (
                      <><i className="fas fa-check text-[11px]" /> {state.confirmLabel ?? 'ยืนยัน'}</>
                    ) : (
                      <><i className="fas fa-check text-[11px]" /> {state.confirmLabel ?? 'ตกลง'}</>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAdminAlert must be used inside AdminAlertProvider');
  return ctx;
}
