'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { Icon, type IconName } from '@/components/ui/icon';

interface Notification {
  id: number;
  delta_days: number;
  category: string | null;
  reason: string | null;
  created_at: string;
  shop_name: string;
}

const CATEGORY_LABELS: Record<string, { label: string; badge: string }> = {
  compensation: { label: 'ชดเชย',      badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  promotion:    { label: 'โปรโมชั่น',   badge: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  correction:   { label: 'แก้ไขข้อมูล', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  goodwill:     { label: 'น้ำใจ',       badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

/**
 * One-time popup shown to a shop owner when the operator adjusts their subscription
 * time with notify_customer set (compensation / promotions). Mirrors the announcement
 * popup UX: a tag badge + body text. Dismissing marks the adjustment seen server-side.
 */
export default function CompensationPopup() {
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<Notification[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    api.get('/api/subscriptions/notifications')
      .then(r => setQueue(r.data.notifications || []))
      .catch(() => { /* non-critical */ });
  }, []);

  const current = queue[0] || null;

  const dismiss = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setQueue(q => q.filter(n => n.id !== id));
    try { await api.post(`/api/subscriptions/notifications/${id}/seen`); } catch { /* best effort */ }
  }, [current]);

  if (!mounted || !current) return null;

  const cat = current.category ? CATEGORY_LABELS[current.category] : null;
  const added = current.delta_days > 0;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={dismiss}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 24, stiffness: 240 }}
          className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-10"
        >
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border shadow-sm ${added ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
              <Icon name={added ? 'gift' : 'clock'} />
            </div>

            {cat && (
              <span className={`px-2.5 py-1 rounded-full border text-[12px] font-medium tracking-wider ${cat.badge}`}>
                {cat.label}
              </span>
            )}

            <h3 className="text-lg font-bold text-foreground tracking-tight">
              {added ? `เพิ่มเวลาให้ ${current.delta_days} วัน` : `ปรับเวลา ${current.delta_days} วัน`}
            </h3>

            <p className="text-xs font-semibold text-muted-foreground">
              ร้าน {current.shop_name}
            </p>

            {current.reason && (
              <p className="text-sm text-foreground/80 bg-secondary/50 border border-border rounded-2xl px-4 py-3 w-full">
                {current.reason}
              </p>
            )}

            <button
              onClick={dismiss}
              className="mt-2 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-medium text-xs shadow-md shadow-primary/20 hover:opacity-90 transition-all active:scale-95 cursor-pointer"
            >
              รับทราบ
            </button>

            {queue.length > 1 && (
              <p className="text-[12px] font-medium text-muted-foreground/60 tracking-wider">
                เหลืออีก {queue.length - 1} รายการ
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
