'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { Icon, type IconName } from '@/components/ui/icon';

interface Slip {
  id: number; amount: number; status: string; purpose: string;
  display_name: string; email: string; created_at: string;
  verified_at: string | null; reject_reason: string | null;
  easyslip_ref: string | null;
}

const FILTER_TABS = [
  { value: '',         label: 'ทั้งหมด',       icon: 'list' },
  { value: 'pending',  label: 'รอดำเนินการ',  icon: 'clock' },
  { value: 'verified', label: 'ตรวจสอบแล้ว',  icon: 'circle-check' },
  { value: 'rejected', label: 'ปฏิเสธแล้ว',   icon: 'circle-xmark' },
];

const PAGE_SIZE = 50;
const fmtBaht = (n: number) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

function Content() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<Slip | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/admin/slips', { params: { page, status: status || undefined, limit: PAGE_SIZE } })
      .then(r => { setSlips(r.data.slips); setTotal(r.data.total); })
      .catch(() => toast.error('โหลดล้มเหลว', 'ไม่สามารถดึงข้อมูลสลิปได้'))
      .finally(() => setLoading(false));
  }, [page, status, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const verify = async (id: number) => {
    if (!confirm('ต้องการอนุมัติสลิปนี้ใช่หรือไม่?')) return;
    setActionLoading(id);
    try {
      await api.post(`/api/admin/slips/${id}/verify`);
      toast.success('อนุมัติสำเร็จ', `สลิป #${id} ตรวจสอบเรียบร้อย`);
      load();
    } catch (e: any) {
      toast.error('ล้มเหลว', e.response?.data?.error || 'ไม่สามารถอนุมัติได้');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: number, reason: string) => {
    setActionLoading(id);
    try {
      await api.post(`/api/admin/slips/${id}/reject`, { reason });
      toast.success('ปฏิเสธสำเร็จ', `สลิป #${id} ถูกปฏิเสธ`);
      setRejectModal(null);
      load();
    } catch (e: any) {
      toast.error('ล้มเหลว', e.response?.data?.error || 'ไม่สามารถปฏิเสธได้');
    } finally {
      setActionLoading(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">รายการชำระเงิน</h2>
          <p className="admin-sub">ตรวจสอบสลิปและจัดการรายการชำระเงิน {total.toLocaleString('th-TH')} รายการ</p>
        </div>
        <button onClick={load} className="admin-btn" disabled={loading}>
          <Icon name="arrows-rotate" className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="admin-card admin-card-body">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5" role="group" aria-label="กรองตามสถานะ">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              aria-pressed={status === tab.value}
              className={`admin-btn admin-btn-sm ${status === tab.value ? 'admin-btn-primary' : ''}`}
            >
              <Icon name={tab.icon as IconName} className="text-[13px]" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-card"><SkeletonTable rows={10} /></div>
      ) : slips.length === 0 ? (
        <div className="admin-card p-10">
          <EmptyState icon="receipt" title="ไม่พบรายการชำระเงิน" description="ไม่มีสลิปที่ตรงกับสถานะที่เลือก" />
        </div>
      ) : (
        <div className="admin-card">
          <div className="p-3 md:p-0">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ผู้ใช้งาน</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th>ประเภท</th>
                  <th>สถานะ</th>
                  <th>วันที่</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {slips.map(slip => (
                  <tr key={slip.id}>
                    <td data-label="ผู้ใช้งาน">
                      <span className="block font-medium text-foreground">{slip.display_name}</span>
                      <span className="block admin-meta break-all">{slip.email}</span>
                    </td>
                    <td data-label="จำนวนเงิน" className="admin-num md:text-right font-medium">{fmtBaht(slip.amount)}</td>
                    <td data-label="ประเภท">
                      <span className="admin-chip">{slip.purpose === 'topup' ? 'เติมเงิน' : 'ต่ออายุแพ็กเกจ'}</span>
                    </td>
                    <td data-label="สถานะ"><StatusBadge status={slip.status} /></td>
                    <td data-label="วันที่">
                      <span className="block admin-meta">{fmtDateTime(slip.created_at)}</span>
                      {slip.reject_reason && (
                        <span className="block text-[13px] text-destructive mt-0.5">เหตุผล: {slip.reject_reason}</span>
                      )}
                      {slip.status !== 'pending' && slip.easyslip_ref && (
                        <span className="block admin-meta font-mono break-all mt-0.5">{slip.easyslip_ref}</span>
                      )}
                    </td>
                    <td data-label="" className="md:text-right">
                      {slip.status === 'pending' ? (
                        <span className="flex gap-2 md:justify-end">
                          <button
                            onClick={() => verify(slip.id)}
                            disabled={actionLoading === slip.id}
                            className="admin-btn admin-btn-sm admin-btn-primary flex-1 md:flex-none"
                          >
                            {actionLoading === slip.id && <Icon name="spinner" className="animate-spin" />}
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => setRejectModal(slip)}
                            disabled={actionLoading === slip.id}
                            className="admin-btn admin-btn-sm admin-btn-danger flex-1 md:flex-none"
                          >
                            ปฏิเสธ
                          </button>
                        </span>
                      ) : (
                        <span className="admin-meta">ดำเนินการแล้ว</span>
                      )}
                    </td>
                  </tr>
                ))}
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

      {rejectModal && (
        <RejectModal
          slip={rejectModal}
          loading={actionLoading === rejectModal.id}
          onSubmit={(reason) => reject(rejectModal.id, reason)}
          onClose={() => setRejectModal(null)}
        />
      )}
    </div>
  );
}

function RejectModal({
  slip, loading, onSubmit, onClose,
}: {
  slip: Slip;
  loading: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setMounted(true);
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!mounted) return null;

  const submit = () => {
    const r = reason.trim();
    if (!r) return;
    onSubmit(r);
  };

  return createPortal(
    <div className="admin-shell fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/55" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-xl sm:rounded-xl shadow-xl z-10">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">ปฏิเสธรายการชำระเงิน</p>
            <p className="admin-meta truncate">{slip.display_name} ({fmtBaht(slip.amount)})</p>
          </div>
          <button onClick={onClose} className="admin-btn admin-btn-sm shrink-0" aria-label="ปิด">
            <Icon name="times" className="text-[13px]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="admin-label" htmlFor="reject-reason">เหตุผลที่ปฏิเสธ</label>
            <textarea
              id="reject-reason"
              autoFocus
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="เช่น สลิปไม่ถูกต้อง ยอดเงินไม่ตรง หรือส่งซ้ำ"
              className="admin-textarea"
            />
            <p className="admin-meta mt-1.5">เหตุผลนี้จะแสดงให้ลูกค้าเห็น</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={onClose} className="admin-btn sm:flex-1">ยกเลิก</button>
            <button onClick={submit} disabled={loading || !reason.trim()} className="admin-btn admin-btn-danger sm:flex-[2]">
              {loading && <Icon name="spinner" className="animate-spin" />}
              ยืนยันการปฏิเสธ
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PaymentsPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={10} /></div>}><Content /></Suspense>;
}
