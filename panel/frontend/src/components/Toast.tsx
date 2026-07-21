'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (opts: { type: ToastType; title: string; message?: string }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 4000;

const TYPE_CONFIG: Record<ToastType, { icon: IconName; bg: string; border: string; progress: string; text: string; title: string }> = {
  success: {
    icon: 'circle-check',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-emerald-500',
    progress: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-gray-900 dark:text-slate-50',
  },
  error: {
    icon: 'circle-xmark',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-red-500',
    progress: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    title: 'text-gray-900 dark:text-slate-50',
  },
  warning: {
    icon: 'triangle-exclamation',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-amber-500',
    progress: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    title: 'text-gray-900 dark:text-slate-50',
  },
  info: {
    icon: 'circle-info',
    bg: 'bg-white dark:bg-slate-800',
    border: 'border-blue-500',
    progress: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    title: 'text-gray-900 dark:text-slate-50',
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const cfg = TYPE_CONFIG[toast.type];
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [width, setWidth] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismiss = useCallback(() => {
    setLeaving(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => onRemove(toast.id), 300);
  }, [onRemove, toast.id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));

    const step = 100 / (TOAST_DURATION / 50);
    intervalRef.current = setInterval(() => {
      setWidth(w => {
        if (w <= 0) return 0;
        return w - step;
      });
    }, 50);

    timerRef.current = setTimeout(dismiss, TOAST_DURATION);

    return () => {
      cancelAnimationFrame(frame);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [dismiss]);

  return (
    <div
      className={`relative w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border-l-4 ${cfg.bg} ${cfg.border} shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-300 ${
        leaving
          ? 'opacity-0 translate-x-8'
          : visible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`flex-shrink-0 mt-0.5 text-base ${cfg.text}`}>
          <Icon name={cfg.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold tracking-wide leading-tight ${cfg.title}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className="text-[13px] font-medium text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">
              {toast.message}
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <Icon name="xmark" className="text-[10px]" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-100 dark:bg-slate-700">
        <div
          className={`h-full ${cfg.progress} transition-none`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((opts: { type: ToastType; title: string; message?: string }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, ...opts }]);
  }, []);

  const value: ToastContextValue = {
    toast: add,
    success: (title, message) => add({ type: 'success', title, message }),
    error: (title, message) => add({ type: 'error', title, message }),
    warning: (title, message) => add({ type: 'warning', title, message }),
    info: (title, message) => add({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

function Toaster({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export { Toaster };
