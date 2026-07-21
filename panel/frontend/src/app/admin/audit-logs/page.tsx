'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { activityLabel } from '@/lib/activityLabels';
import { Icon, type IconName } from '@/components/ui/icon';

interface AuditLog {
  id: number; user_id: number; action: string; category: string; target_type: string; target_id: number;
  details: string; ip_address: string; created_at: string;
  display_name: string; email: string;
}

/* Action label only. The old map also carried a colour per action, which put
   ten competing tints in one dense log and made scanning harder rather than
   easier; the action name already says what happened. */
const ACTION_LABEL: Record<string, string> = {
  wallet_credit:       'เพิ่มเงิน',
  wallet_debit:        'หักเงิน',
  remove_subscription: 'ลบร้านค้า',
  update_settings:     'แก้ไขตั้งค่า',
  verify_slip:         'ยืนยันสลิป',
  reject_slip:         'ปฏิเสธสลิป',
  edit_user:           'แก้ไขผู้ใช้',
  update_mc_ip:        'แก้ไข MC IP',
  page_view:           'เปิดหน้า',
  feature_click:       'กดใช้งาน',
};

const FILTERS = [
  { key: 'all',      label: 'ทั้งหมด',   icon: 'layer-group' },
  { key: 'action',   label: 'การกระทำ',  icon: 'bolt' },
  { key: 'activity', label: 'การใช้งาน', icon: 'fire' },
];

const PAGE_SIZE = 50;

function Content() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || 'all';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(urlCategory);

  // Adopt the category from the URL when arriving via a hotspot deep-link.
  useEffect(() => { setCategory(urlCategory); setPage(1); }, [urlCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (category && category !== 'all') params.category = category;
      if (q) params.q = q;
      const r = await api.get('/api/admin/audit-logs', { params });
      setLogs(r.data.logs);
      setTotal(r.data.total);
    } catch { } finally { setLoading(false); }
  }, [page, category, q]);

  useEffect(() => { load(); }, [load]);

  const selectFilter = (key: string) => { setCategory(key); setPage(1); };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">บันทึกเหตุการณ์</h2>
          <p className="admin-sub">ใคร ทำอะไร เมื่อไหร่ ทั้งหมด {total.toLocaleString('th-TH')} รายการ</p>
        </div>
        <button onClick={load} className="admin-btn" disabled={loading}>
          <Icon name="arrows-rotate" className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="admin-card admin-card-body">
        <div className="admin-toolbar">
          <div className="flex gap-1.5" role="group" aria-label="กรองประเภทเหตุการณ์">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => selectFilter(f.key)}
                aria-pressed={category === f.key}
                className={`admin-btn admin-btn-sm flex-1 ${category === f.key ? 'admin-btn-primary' : ''}`}
              >
                <Icon name={f.icon as IconName} className="text-[13px]" />{f.label}
              </button>
            ))}
          </div>
          {q && (
            <span className="admin-chip sm:ml-auto">
              <span className="font-mono">{q}</span>
              <Link href="/admin/audit-logs" aria-label="ล้างตัวกรอง" className="text-muted-foreground hover:text-foreground">
                <Icon name="xmark" className="text-[11px]" />
              </Link>
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="admin-card"><SkeletonTable rows={10} /></div>
      ) : logs.length === 0 ? (
        <div className="admin-card p-10">
          <EmptyState icon="clock-rotate-left" title="ไม่พบประวัติการใช้งาน" description="ยังไม่มีการบันทึกกิจกรรม" />
        </div>
      ) : (
        <div className="admin-card">
          <div className="p-3 md:p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>วัน-เวลา</th>
                  <th>ผู้ดำเนินการ</th>
                  <th>กิจกรรม</th>
                  <th>รายละเอียด</th>
                  <th className="text-right">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const label = ACTION_LABEL[log.action] || log.action;
                  const detail = log.category === 'activity' ? activityLabel(log.action, log.details) : log.details;
                  return (
                    <tr key={log.id}>
                      <td data-label="วัน-เวลา" className="admin-meta whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'medium' })}
                      </td>
                      <td data-label="ผู้ดำเนินการ">
                        <span className="block text-foreground">{log.display_name || 'ระบบ'}</span>
                        <span className="block admin-meta break-all">{log.email || 'auto-trigger'}</span>
                      </td>
                      <td data-label="กิจกรรม"><span className="admin-chip">{label}</span></td>
                      <td data-label="รายละเอียด" className="md:max-w-[360px]">
                        <span className="block text-[14px] text-foreground break-words">{detail}</span>
                        {log.category === 'activity' && (
                          <span className="block admin-meta font-mono break-all mt-0.5">{log.details}</span>
                        )}
                      </td>
                      <td data-label="IP" className="admin-meta font-mono md:text-right">{log.ip_address || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-border">
              <p className="admin-meta">
                แสดง {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} จาก {total} รายการ
              </p>
              <div className="flex items-center gap-2">
                <button className="admin-btn admin-btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <Icon name="chevron-left" className="text-[11px]" /> ก่อนหน้า
                </button>
                <span className="admin-meta admin-num">{page} / {pages}</span>
                <button className="admin-btn admin-btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                  ถัดไป <Icon name="chevron-right" className="text-[11px]" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
