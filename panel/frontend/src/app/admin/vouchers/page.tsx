'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import api from '@/lib/api';
import { SkeletonTable } from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

interface Voucher {
  id: number;
  code: string;
  amount: string;
  max_uses: number;
  current_uses: number;
  creator_name: string | null;
  created_at: string;
}

interface Redemption {
  id: number;
  voucher_id: number;
  user_id: number;
  email: string;
  display_name: string;
  redeemed_at: string;
}

const fmtBaht = (n: number | string) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });

const PAGE_SIZE = 20;

function Content() {
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [createForm, setCreateForm] = useState({ code: '', amount: '', maxUses: '1' });
  const [creating, setCreating] = useState(false);

  const [viewRedemptions, setViewRedemptions] = useState<Voucher | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/vouchers', { params: { page, limit: PAGE_SIZE } });
      setVouchers(data.data);
      setTotal(data.total);
    } catch {
      toast.error('โหลดข้อมูลล้มเหลว', 'ไม่สามารถดึงข้อมูล Voucher ได้');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { if (user?.role === 'admin') load(); }, [load, user]);

  const handleCreate = async () => {
    const amt = parseFloat(createForm.amount);
    const uses = parseInt(createForm.maxUses);
    if (!amt || amt <= 0) return toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนเงินมากกว่า 0');
    if (!uses || uses <= 0) return toast.error('ข้อมูลไม่ถูกต้อง', 'กรุณาระบุจำนวนครั้งอย่างน้อย 1');

    setCreating(true);
    try {
      await api.post('/api/vouchers', {
        code: createForm.code.trim().toUpperCase(),
        amount: amt,
        maxUses: uses,
      });
      toast.success('สร้าง Voucher สำเร็จ', 'โค้ดใหม่พร้อมใช้งานแล้ว');
      setCreateForm({ code: '', amount: '', maxUses: '1' });
      load();
    } catch (e: any) {
      toast.error('สร้างไม่สำเร็จ', e.response?.data?.error || 'ไม่สามารถสร้างโค้ดได้');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบ Voucher นี้?')) return;
    try {
      await api.delete(`/api/vouchers/${id}`);
      toast.success('ลบสำเร็จ', 'Voucher ถูกลบแล้ว');
      load();
    } catch {
      toast.error('ลบไม่สำเร็จ', 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const openRedemptions = async (v: Voucher) => {
    setViewRedemptions(v);
    setLoadingRedemptions(true);
    setRedemptions([]);
    try {
      const { data } = await api.get(`/api/vouchers/${v.id}/redemptions`);
      setRedemptions(data.data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลผู้ใช้ที่แลกโค้ดได้');
    } finally {
      setLoadingRedemptions(false);
    }
  };

  if (authLoading || (user && user.role !== 'admin')) return null;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">โค้ดโปรโมชั่น</h2>
          <p className="admin-sub">สร้างและจัดการโค้ดเติมเงินสำหรับลูกค้า</p>
        </div>
        <button onClick={load} className="admin-btn" disabled={loading}>
          <Icon name="arrows-rotate" className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <section className="admin-card xl:col-span-1">
          <div className="admin-card-head">
            <h3 className="admin-section-title">สร้างโค้ดใหม่</h3>
          </div>
          <div className="admin-card-body space-y-4">
            <div>
              <label className="admin-label" htmlFor="v-code">รหัสโค้ด</label>
              <input
                id="v-code"
                className="admin-input font-mono uppercase"
                placeholder="เว้นว่างเพื่อสุ่มให้อัตโนมัติ"
                value={createForm.code}
                onChange={e => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="v-amount">มูลค่า (บาท)</label>
              <input
                id="v-amount"
                type="number"
                inputMode="decimal"
                className="admin-input admin-num"
                placeholder="0.00"
                value={createForm.amount}
                onChange={e => setCreateForm({ ...createForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="v-uses">ใช้ได้กี่ครั้ง</label>
              <input
                id="v-uses"
                type="number"
                inputMode="numeric"
                className="admin-input admin-num"
                value={createForm.maxUses}
                onChange={e => setCreateForm({ ...createForm, maxUses: e.target.value })}
              />
              <p className="admin-meta mt-1.5">ผู้ใช้หนึ่งคนแลกโค้ดเดิมได้ครั้งเดียว</p>
            </div>
            <button onClick={handleCreate} disabled={creating} className="admin-btn admin-btn-primary w-full">
              {creating && <Icon name="spinner" className="animate-spin" />}
              สร้างโค้ด
            </button>
          </div>
        </section>

        <section className="admin-card xl:col-span-2">
          <div className="admin-card-head">
            <h3 className="admin-section-title">โค้ดทั้งหมด</h3>
            <span className="admin-chip">{total.toLocaleString('th-TH')} โค้ด</span>
          </div>

          {loading ? (
            <SkeletonTable rows={6} />
          ) : vouchers.length === 0 ? (
            <div className="p-10">
              <EmptyState icon="ticket" title="ยังไม่มีโค้ดโปรโมชั่น" description="สร้างโค้ดแรกจากแบบฟอร์มด้านซ้าย" />
            </div>
          ) : (
            <>
              <div className="p-3 md:p-0">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>โค้ด</th>
                      <th className="text-right">มูลค่า</th>
                      <th>ใช้ไปแล้ว</th>
                      <th>สร้างเมื่อ</th>
                      <th className="text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => {
                      const used = Number(v.current_uses);
                      const max = Number(v.max_uses);
                      const exhausted = used >= max;
                      return (
                        <tr key={v.id}>
                          <td data-label="โค้ด">
                            <span className="font-mono font-medium text-foreground break-all">{v.code}</span>
                          </td>
                          <td data-label="มูลค่า" className="admin-num md:text-right font-medium">{fmtBaht(v.amount)}</td>
                          <td data-label="ใช้ไปแล้ว">
                            <span className={`admin-num ${exhausted ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {used} / {max}
                            </span>
                            {exhausted && <span className="admin-meta ml-1.5">(ใช้ครบแล้ว)</span>}
                          </td>
                          <td data-label="สร้างเมื่อ" className="admin-meta">{fmtDateTime(v.created_at)}</td>
                          <td data-label="" className="md:text-right">
                            <span className="flex gap-2 md:justify-end">
                              <button onClick={() => openRedemptions(v)} className="admin-btn admin-btn-sm flex-1 md:flex-none">
                                <Icon name="users" className="text-[13px]" /> ผู้ใช้
                              </button>
                              <button onClick={() => handleDelete(v.id)} className="admin-btn admin-btn-sm admin-btn-danger flex-1 md:flex-none">
                                <Icon name="trash" className="text-[13px]" /> ลบ
                              </button>
                            </span>
                          </td>
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
            </>
          )}
        </section>
      </div>

      {viewRedemptions && (
        <RedemptionsModal
          voucher={viewRedemptions}
          redemptions={redemptions}
          loading={loadingRedemptions}
          onClose={() => setViewRedemptions(null)}
        />
      )}
    </div>
  );
}

function RedemptionsModal({
  voucher, redemptions, loading, onClose,
}: {
  voucher: Voucher;
  redemptions: Redemption[];
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/55" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-xl sm:rounded-xl shadow-xl z-10 max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">ผู้ใช้ที่แลกโค้ดนี้</p>
            <p className="admin-meta font-mono break-all">{voucher.code}</p>
          </div>
          <button onClick={onClose} className="admin-btn admin-btn-sm shrink-0" aria-label="ปิด">
            <Icon name="times" className="text-[13px]" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {loading ? (
            <p className="admin-meta text-center py-6">กำลังโหลด</p>
          ) : redemptions.length === 0 ? (
            <p className="admin-meta text-center py-6">ยังไม่มีใครแลกโค้ดนี้</p>
          ) : (
            <ul className="divide-y divide-border">
              {redemptions.map(r => (
                <li key={r.id} className="py-2.5">
                  <p className="text-[14px] font-medium text-foreground truncate">{r.display_name}</p>
                  <p className="admin-meta break-all">{r.email}</p>
                  <p className="admin-meta">{fmtDateTime(r.redeemed_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VouchersPage() {
  return <Suspense fallback={<div className="p-4"><SkeletonTable rows={8} /></div>}><Content /></Suspense>;
}
