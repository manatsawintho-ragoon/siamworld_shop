'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, getToken } from '@/lib/api';

interface Notification {
  id: number;
  type: 'topup_success' | 'topup_failed';
  title: string;
  body: string | null;
  is_read: number;
  created_at: string;
}

const TYPE_STYLE = {
  topup_success: {
    icon: 'fa-circle-check', color: 'text-[#16a34a]', bg: 'bg-green-100',
    accent: 'bg-[#16a34a]', glow: 'shadow-[0_0_32px_rgba(22,163,74,0.2)]',
    btnBg: 'bg-[#16a34a] shadow-[0_4px_0_#0d6b2e] hover:brightness-110',
    label: 'เติมเงินสำเร็จ',
  },
  topup_failed: {
    icon: 'fa-triangle-exclamation', color: 'text-red-500', bg: 'bg-red-100',
    accent: 'bg-red-500', glow: 'shadow-[0_0_32px_rgba(239,68,68,0.2)]',
    btnBg: 'bg-red-500 shadow-[0_4px_0_#b91c1c] hover:brightness-110',
    label: 'ตรวจพบความผิดปกติ',
  },
} as const;

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'เมื่อกี้';
  if (diff < 3600)  return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const FIELD_LABEL: Record<string, string> = {
  username:     'ผู้ใช้',
  userId:       'User ID',
  status:       'สถานะ',
  reason:       'เหตุผล',
  detail:       'รายละเอียด',
  amount_paid:  'ยอดโอนจริง',
  credit:       'เครดิตที่ได้',
  bank:         'ธนาคาร',
  sender_name:  'ชื่อผู้โอน',
  trans_ref:    'TransRef',
  balance_after:'ยอดคงเหลือ',
};

// Order fields for display
const FIELD_ORDER = [
  'username', 'userId', 'status', 'reason',
  'amount_paid', 'credit', 'bank', 'sender_name',
  'trans_ref', 'balance_after', 'detail',
];

function parseBody(body: string): { label: string; value: string; key: string }[] {
  try {
    const obj = JSON.parse(body);
    const rows: { label: string; value: string; key: string }[] = [];
    // Add in preferred order first
    for (const key of FIELD_ORDER) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        rows.push({ key, label: FIELD_LABEL[key] ?? key, value: String(obj[key]) });
      }
    }
    // Add any remaining keys not in order list
    for (const key of Object.keys(obj)) {
      if (!FIELD_ORDER.includes(key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        rows.push({ key, label: FIELD_LABEL[key] ?? key, value: String(obj[key]) });
      }
    }
    return rows;
  } catch {
    // Fallback: old pipe-separated format
    return body.split('|').map(s => s.trim()).filter(Boolean).map(s => {
      const colonIdx = s.indexOf(':');
      if (colonIdx > 0) return { key: 'raw', label: s.slice(0, colonIdx).trim(), value: s.slice(colonIdx + 1).trim() };
      return { key: 'raw', label: '', value: s };
    });
  }
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function NotificationModal({ n, onClose }: { n: Notification; onClose: () => void }) {
  const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.topup_failed;
  const bodyParts = n.body ? parseBody(n.body) : [];

  // Close on backdrop click
  const backdropRef = useRef(false);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
        onMouseUp={e => { if (backdropRef.current && e.target === e.currentTarget) onClose(); }}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.45, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.82, y: 16, transition: { duration: 0.16, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 420, damping: 24, mass: 0.75 }}
        className={`relative bg-white rounded-2xl w-full max-w-[420px] overflow-hidden border border-gray-200/80 ${style.glow} shadow-[0_4px_0_#c5cad3,0_8px_40px_rgba(0,0,0,0.18)]`}
      >
        {/* Colored top strip */}
        <div className={`h-1.5 w-full ${style.accent}`} />

        {/* Body */}
        <div className="px-6 pt-6 pb-5">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-5">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
              className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}
            >
              <i className={`fas ${style.icon} ${style.color} text-xl`} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${style.color}`}>
                {style.label}
              </p>
              <h3 className="text-[15px] font-black text-gray-900 leading-tight">{n.title}</h3>
              <p className="text-[11px] text-gray-400 mt-1">{formatDate(n.created_at)}</p>
            </div>
          </div>

          {/* Detail rows */}
          {bodyParts.length > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {bodyParts.map((p, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-[11px] font-bold text-gray-400 w-28 flex-shrink-0 pt-0.5 leading-relaxed">
                    {p.label || p.key}
                  </span>
                  <span className={`text-[12px] font-bold break-all leading-relaxed ${
                    p.key === 'status' && p.value === 'สำเร็จ' ? 'text-[#16a34a]' :
                    p.key === 'status' && p.value === 'ปฏิเสธ' ? 'text-red-500' :
                    p.key === 'reason' || p.key === 'detail' ? 'text-gray-600' :
                    p.key === 'trans_ref' ? 'font-mono text-gray-700 text-[11px]' :
                    'text-gray-800'
                  }`}>
                    {p.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100" />

        {/* Footer */}
        <div className="px-5 py-4">
          <button
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-bold rounded-xl ${style.btnBg} text-white transition-all active:shadow-none active:translate-y-[2px]`}
          >
            <i className="fas fa-check text-[11px]" /> ปิด
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const [selected, setSelected]           = useState<Notification | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const d = await api<any>('/admin/notifications', { token: getToken()! }) as any;
      setNotifications(d.notifications ?? []);
      setUnreadCount(d.unreadCount ?? 0);
    } catch { /* ignore — non-critical */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    api<any>(`/admin/notifications/${id}/read`, { method: 'POST', token: getToken()! }).catch(() => {});
  }, []);

  const markAllRead = async () => {
    setLoading(true);
    try {
      await api<any>('/admin/notifications/read-all', { method: 'POST', token: getToken()! });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (n: Notification) => {
    setSelected(n);
    setOpen(false);
    if (!n.is_read) markRead(n.id);
  };

  return (
    <>
      <div className="relative" ref={ref}>
        {/* Bell Button */}
        <button
          onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
          className="relative w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-colors shadow-[0_2px_0_#d1d5db] active:shadow-none active:translate-y-[2px]"
          title="การแจ้งเตือน"
        >
          <i className="fas fa-bell text-gray-600 text-[15px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <i className="fas fa-bell text-gray-700 text-sm" />
                  <span className="font-black text-gray-900 text-sm">การแจ้งเตือน</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={loading}
                    className="text-[11px] font-bold text-[#16a34a] hover:text-[#0d6b2e] transition-colors disabled:opacity-50"
                  >
                    {loading ? <i className="fas fa-circle-notch fa-spin" /> : 'อ่านทั้งหมด'}
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                    <i className="fas fa-bell-slash text-2xl" />
                    <p className="text-sm font-medium">ยังไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.topup_failed;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors group ${n.is_read ? 'opacity-60' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <i className={`fas ${style.icon} ${style.color} text-sm`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] font-bold leading-tight ${n.is_read ? 'text-gray-500' : 'text-gray-900'}`}>
                              {n.title}
                            </p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 mt-1" />}
                              <i className="fas fa-chevron-right text-[9px] text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" />
                            </div>
                          </div>
                          {n.body && (
                            <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[260px]">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <NotificationModal n={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
