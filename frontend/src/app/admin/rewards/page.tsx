'use client';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { DateTimeField, addYears } from '@/components/admin/datetime';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Reward {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  point_cost: number;
  stock: number | null;
  per_user_limit: number | null;
  command: string;
  requires_campaign_id: number | null;
  visible_from: string | null;
  visible_until: string | null;
  active: number | boolean;
  sort_order: number;
  created_at: string;
}

interface RewardStats {
  outstandingPoints: number;
  pointsSpent: number;
  redemptions: number;
  pendingClaims: number;
}

interface Redemption {
  id: number;
  user_id: number;
  username: string;
  reward_name: string;
  point_cost: number;
  status: string;
  inventory_status: string | null;
  created_at: string;
}

interface CampaignOption { id: number; name: string }

interface RewardForm {
  id?: number;
  name: string;
  description: string;
  image: string;
  pointCost: number;
  stock: string;          // '' = unlimited
  perUserLimit: string;   // '' = unlimited
  command: string;
  requiresCampaignId: string; // '' = always
  visibleFrom: string;
  visibleUntil: string;
  active: boolean;
}

const emptyForm: RewardForm = {
  name: '', description: '', image: '',
  pointCost: 0, stock: '', perUserLimit: '',
  command: '', requiresCampaignId: '',
  visibleFrom: '', visibleUntil: '', active: true,
};

const FIELD_LABELS: Record<string, string> = {
  name: 'ชื่อของรางวัล', description: 'คำอธิบาย', image: 'รูปภาพ',
  point_cost: 'ราคาแต้ม', stock: 'จำนวนคงเหลือ', per_user_limit: 'จำกัดต่อคน',
  command: 'คำสั่ง RCON', requires_campaign_id: 'ผูกกับแคมเปญ',
  visible_from: 'เริ่มแสดง', visible_until: 'หยุดแสดง',
};

// The local <-> ISO pair lives in @/components/admin/datetime (thaiDate.ts).
// It used to be copied into this file, campaigns and rewards/news, plus
// lib/saleWindow - four copies that drifted into the sale-duration bug.
import { toLocalInput, fromLocalInput } from '@/components/admin/datetime';

const fmtWindow = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/** Mirrors reward.logic visibility + stock, for the list status pill. */
function getStatusInfo(r: Reward): { label: string; className: string; dot: string } {
  const now = Date.now();
  if (!r.active) return { label: 'ปิดอยู่', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  if (r.visible_from && now < new Date(r.visible_from).getTime()) return { label: 'รอเริ่ม', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
  if (r.visible_until && now > new Date(r.visible_until).getTime()) return { label: 'หมดเวลาแล้ว', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  if (r.stock !== null && r.stock <= 0) return { label: 'ของหมด', className: 'bg-rose-50 text-rose-600 border-rose-200', dot: 'bg-rose-500' };
  return { label: 'เปิดแลก', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500 animate-pulse' };
}

const REDEMPTION_STATUS: Record<string, { label: string; className: string }> = {
  claimed: { label: 'รับของแล้ว', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'รอรับของ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed:  { label: 'ล้มเหลว', className: 'bg-rose-50 text-rose-600 border-rose-200' },
};

export default function AdminRewards() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stats, setStats] = useState<RewardStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // re-render so status pills flip without a refresh

  const [tab, setTab] = useState<'catalog' | 'log'>('catalog');
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);

  const [form, setForm] = useState<RewardForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = () => {
    setLoading(true);
    api('/admin/rewards', { token: getToken()! })
      .then(d => { setRewards((d.rewards as Reward[]) || []); setStats((d.stats as RewardStats) || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    // Campaign options for the "requires campaign" lock. Failure is non-fatal;
    // the dropdown just shows "ไม่ผูก" only.
    api('/admin/campaigns', { token: getToken()! })
      .then(d => setCampaigns(((d.campaigns as any[]) || []).map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  const loadLog = () => {
    api('/admin/rewards/redemptions', { token: getToken()! })
      .then(d => setRedemptions((d.redemptions as Redemption[]) || []))
      .catch(() => {})
      .finally(() => setLogLoaded(true));
  };

  const openLog = () => { setTab('log'); if (!logLoaded) loadLog(); };

  // Stored window captured at open; null when creating. Create and edit share
  // one modal and one form object, so a stale ref would let a new reward
  // inherit the edited one's floor.
  const originalRef = useRef<{ visibleFrom: Date | null; visibleUntil: Date | null }>(
    { visibleFrom: null, visibleUntil: null }
  );

  const openCreate = () => {
    originalRef.current = { visibleFrom: null, visibleUntil: null };
    setForm({ ...emptyForm }); setError(''); setFieldErrors([]);
  };

  const openEdit = (r: Reward) => {
    originalRef.current = {
      visibleFrom: r.visible_from ? new Date(r.visible_from) : null,
      visibleUntil: r.visible_until ? new Date(r.visible_until) : null,
    };
    setForm({
      id: r.id,
      name: r.name,
      description: r.description || '',
      image: r.image || '',
      pointCost: Number(r.point_cost),
      stock: r.stock === null ? '' : String(r.stock),
      perUserLimit: r.per_user_limit === null ? '' : String(r.per_user_limit),
      command: r.command || '',
      requiresCampaignId: r.requires_campaign_id === null ? '' : String(r.requires_campaign_id),
      visibleFrom: toLocalInput(r.visible_from),
      visibleUntil: toLocalInput(r.visible_until),
      active: Boolean(r.active),
    });
    setError('');
    setFieldErrors([]);
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim()) { setError('กรอกชื่อของรางวัลก่อนบันทึก'); return; }
    if (!form.command.trim()) { setError('กรอกคำสั่ง RCON ที่จะส่งให้ผู้เล่นตอนกดรับ'); return; }
    if (!form.pointCost || form.pointCost <= 0) { setError('ราคาแต้มต้องมากกว่า 0'); return; }

    // Raising the price devalues points players already hold; make the admin
    // confirm, mirroring the explicit price-raise audit line on the backend.
    if (form.id) {
      const before = rewards.find(r => r.id === form.id);
      if (before && form.pointCost > Number(before.point_cost)) {
        const ok = await adminConfirm({
          title: 'ขึ้นราคาของรางวัล',
          message: `ราคาเดิม ${Number(before.point_cost).toLocaleString()} point จะขึ้นเป็น ${form.pointCost.toLocaleString()} point ผู้เล่นที่สะสมแต้มไว้จะแลกได้ยากขึ้น ยืนยันหรือไม่`,
          type: 'warning', confirmLabel: 'ยืนยันขึ้นราคา',
        });
        if (!ok) return;
      }
    }

    setSaving(true);
    setError('');
    setFieldErrors([]);
    try {
      const body: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        image: form.image.trim() || null,
        point_cost: form.pointCost,
        stock: form.stock.trim() === '' ? null : Number(form.stock),
        per_user_limit: form.perUserLimit.trim() === '' ? null : Number(form.perUserLimit),
        command: form.command.trim(),
        requires_campaign_id: form.requiresCampaignId === '' ? null : Number(form.requiresCampaignId),
        visible_from: fromLocalInput(form.visibleFrom),
        visible_until: fromLocalInput(form.visibleUntil),
        active: form.active,
      };
      if (form.id) {
        await api(`/admin/rewards/${form.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/rewards', { method: 'POST', token: getToken()!, body: { ...body, sort_order: rewards.length } });
      }
      setForm(null);
      adminAlert({ title: form.id ? 'แก้ไขของรางวัลแล้ว' : 'เพิ่มของรางวัลแล้ว', type: 'success' });
      load();
    } catch (err: unknown) {
      const fe = (err as { fieldErrors?: { field: string; message: string }[] })?.fieldErrors;
      if (Array.isArray(fe) && fe.length > 0) {
        setFieldErrors(fe);
        setError('กรอกข้อมูลไม่ครบหรือไม่ถูกต้อง โปรดตรวจรายการด้านล่าง');
      } else {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: Reward) => {
    try {
      await api(`/admin/rewards/${r.id}`, { method: 'PUT', token: getToken()!, body: { active: !r.active } });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'เปลี่ยนสถานะไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  /** Swap with the neighbour, then persist the whole list's positions. */
  const move = async (index: number, delta: number) => {
    const next = [...rewards];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRewards(next); // optimistic - reload below reconciles
    try {
      await api('/admin/rewards/reorder', {
        method: 'PUT', token: getToken()!,
        body: { order: next.map((r, i) => ({ id: r.id, sort_order: i })) },
      });
    } catch (err: any) {
      await adminAlert({ title: 'จัดลำดับไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    } finally {
      load();
    }
  };

  const handleDelete = async (r: Reward) => {
    if (!await adminConfirm({
      title: 'ลบของรางวัล',
      message: `ต้องการลบ "${r.name}" หรือไม่ (ของที่ผู้เล่นแลกไปแล้วและรอรับจะยังอยู่)`,
      type: 'danger', confirmLabel: 'ลบ',
    })) return;
    try {
      await api(`/admin/rewards/${r.id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบของรางวัลแล้ว', type: 'success' });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const campaignName = (id: number | null) => id === null ? null : (campaigns.find(c => c.id === id)?.name ?? `แคมเปญ #${id}`);

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-gift text-[#f97316]"></i> แลกของรางวัล (Reward Shop)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ของรางวัลที่ผู้เล่นแลกด้วย point จากแคมเปญเติมเงิน (แลกด้วยแต้มเท่านั้น ไม่ใช้เงิน)
          </p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all flex items-center gap-2">
          <i className="fas fa-plus text-xs"></i> เพิ่มของรางวัล
        </button>
      </div>

      {/* ── Liability + stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <i className="fas fa-coins text-[13px]"></i>
            <span className="text-[11px] font-bold uppercase tracking-wide">แต้มคงค้าง (ภาระ)</span>
          </div>
          <p className="text-2xl font-black text-gray-800 tabular-nums">{(stats?.outstandingPoints ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">point ที่ผู้เล่นยังถือ พร้อมมาแลก</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <i className="fas fa-fire text-[13px]"></i>
            <span className="text-[11px] font-bold uppercase tracking-wide">แต้มที่ถูกใช้</span>
          </div>
          <p className="text-2xl font-black text-gray-800 tabular-nums">{(stats?.pointsSpent ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">รวมทุกการแลก</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <i className="fas fa-right-left text-[13px]"></i>
            <span className="text-[11px] font-bold uppercase tracking-wide">จำนวนการแลก</span>
          </div>
          <p className="text-2xl font-black text-gray-800 tabular-nums">{(stats?.redemptions ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">ครั้งทั้งหมด</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <i className="fas fa-hourglass-half text-[13px]"></i>
            <span className="text-[11px] font-bold uppercase tracking-wide">รอรับของ</span>
          </div>
          <p className="text-2xl font-black text-gray-800 tabular-nums">{(stats?.pendingClaims ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">ยังไม่กดรับเข้าเกม</p>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('catalog')}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'catalog' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
          <i className="fas fa-list mr-1.5 text-xs"></i> รายการของรางวัล
        </button>
        <button onClick={openLog}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tab === 'log' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
          <i className="fas fa-receipt mr-1.5 text-xs"></i> ประวัติการแลก
        </button>
      </div>

      {/* ── Catalog tab ──────────────────────────────────────────────── */}
      {tab === 'catalog' && (loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : rewards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-gift text-gray-300 text-xl"></i>
          </div>
          <p className="text-sm font-bold text-gray-700">ยังไม่มีของรางวัล</p>
          <p className="text-xs text-gray-500 mt-1">กด &quot;เพิ่มของรางวัล&quot; เพื่อสร้างรายการแรก</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map((r, i) => {
            const status = getStatusInfo(r);
            const from = fmtWindow(r.visible_from);
            const to = fmtWindow(r.visible_until);
            const campName = campaignName(r.requires_campaign_id);
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">

                {/* Reorder */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 disabled:opacity-30 flex items-center justify-center" aria-label="เลื่อนขึ้น">
                    <i className="fas fa-chevron-up text-[10px]"></i>
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === rewards.length - 1}
                    className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 disabled:opacity-30 flex items-center justify-center" aria-label="เลื่อนลง">
                    <i className="fas fa-chevron-down text-[10px]"></i>
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {r.image ? <img src={r.image} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-gift text-gray-300"></i>}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-800 truncate">{r.name}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span> {status.label}
                    </span>
                    {campName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200">
                        <i className="fas fa-lock text-[8px]"></i> {campName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span className="font-bold text-[#f97316]"><i className="fas fa-coins text-[10px] mr-1"></i>{Number(r.point_cost).toLocaleString()} point</span>
                    <span>คงเหลือ: {r.stock === null ? 'ไม่จำกัด' : r.stock.toLocaleString()}</span>
                    {r.per_user_limit !== null && <span>จำกัด {r.per_user_limit}/คน</span>}
                  </div>
                  {(from || to) && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {from ? `เริ่ม ${from}` : 'แสดงทันที'} : {to ? `ถึง ${to}` : 'ไม่มีกำหนดจบ'}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(r)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${r.active ? 'bg-green-600' : 'bg-gray-300'}`}
                    aria-label={r.active ? 'ปิดของรางวัลนี้' : 'เปิดของรางวัลนี้'}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${r.active ? 'left-[22px]' : 'left-0.5'}`}></span>
                  </button>
                  <button onClick={() => openEdit(r)}
                    className="w-8 h-8 rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_3px_0_#1d4ed8] active:translate-y-[3px] active:shadow-none transition-all" aria-label="แก้ไข">
                    <i className="fas fa-pen text-[11px]"></i>
                  </button>
                  <button onClick={() => handleDelete(r)}
                    className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_3px_0_#b91c1c] active:translate-y-[3px] active:shadow-none transition-all" aria-label="ลบ">
                    <i className="fas fa-trash text-[11px]"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Redemption log tab ───────────────────────────────────────── */}
      {tab === 'log' && (!logLoaded ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : redemptions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-receipt text-gray-300 text-xl"></i>
          </div>
          <p className="text-sm font-bold text-gray-700">ยังไม่มีการแลกของรางวัล</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left font-bold px-4 py-2.5">ผู้เล่น</th>
                  <th className="text-left font-bold px-4 py-2.5">ของรางวัล</th>
                  <th className="text-right font-bold px-4 py-2.5">แต้ม</th>
                  <th className="text-center font-bold px-4 py-2.5">สถานะ</th>
                  <th className="text-right font-bold px-4 py-2.5">เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {redemptions.map(rd => {
                  const st = REDEMPTION_STATUS[rd.inventory_status?.toLowerCase() ?? rd.status] ?? REDEMPTION_STATUS[rd.status] ?? { label: rd.status, className: 'bg-gray-100 text-gray-500 border-gray-200' };
                  return (
                    <tr key={rd.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 font-bold text-gray-800">{rd.username}</td>
                      <td className="px-4 py-2.5 text-gray-600">{rd.reward_name}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#f97316] tabular-nums">{Number(rd.point_cost).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[11px] text-gray-400 tabular-nums">
                        {new Date(rd.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      {form && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setForm(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-gift text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-sm">{form.id ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}</h3>
              </div>
              <button onClick={() => setForm(null)} disabled={saving}
                className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i> {error}
                  </p>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1.5 ml-5 list-disc text-[11px] text-red-600 space-y-0.5">
                      {fieldErrors.map((fe, i) => (
                        <li key={i}><span className="font-bold">{FIELD_LABELS[fe.field] || fe.field}</span>: {fe.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">ชื่อของรางวัล <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={255}
                  placeholder="เช่น ยศ VIP 30 วัน"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">คำอธิบาย</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={2}
                  placeholder="รายละเอียดของรางวัล (ไม่ใส่ก็ได้)"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">รูปภาพ (URL)</label>
                  <input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} maxLength={500}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ราคาแต้ม <span className="text-red-500">*</span></label>
                  <input type="number" min={1} value={form.pointCost || ''} onChange={e => setForm({ ...form, pointCost: Number(e.target.value) })}
                    placeholder="เช่น 500"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">จำนวนคงเหลือ (Stock)</label>
                  <input type="number" min={0} value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                    placeholder="เว้นว่าง = ไม่จำกัด"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = ไม่จำกัด, 0 = ปิดการแลก</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">จำกัดต่อคน</label>
                  <input type="number" min={1} value={form.perUserLimit} onChange={e => setForm({ ...form, perUserLimit: e.target.value })}
                    placeholder="เว้นว่าง = ไม่จำกัด"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
                  <p className="text-[11px] text-gray-400 mt-1">จำนวนครั้งที่ผู้เล่นหนึ่งคนแลกได้</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">คำสั่ง RCON <span className="text-red-500">*</span></label>
                <textarea value={form.command} onChange={e => setForm({ ...form, command: e.target.value })} maxLength={5000} rows={2}
                  placeholder="เช่น lp user {player} parent add vip"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-gray-400 resize-none" />
                <p className="text-[11px] text-gray-400 mt-1">ใช้ <code className="px-1 bg-gray-100 rounded">{'{player}'}</code> แทนชื่อผู้เล่น จะส่งตอนผู้เล่นกดรับของในกระเป๋า</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">ผูกกับแคมเปญ (ล็อกให้แลกได้เฉพาะช่วงแคมเปญ)</label>
                <select value={form.requiresCampaignId} onChange={e => setForm({ ...form, requiresCampaignId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white">
                  <option value="">ไม่ผูก (แลกได้ตลอด)</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">ถ้าเลือก จะแลกได้เฉพาะเมื่อแคมเปญนั้นกำลังทำงานอยู่</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">เริ่มแสดง</label>
                  <DateTimeField
                    value={form.visibleFrom}
                    onChange={v => setForm({ ...form, visibleFrom: v })}
                    clearable
                    placeholder="เว้นว่าง = แสดงทันที"
                    bounds={{
                      disablePast: true,
                      originalValue: originalRef.current.visibleFrom,
                      pairMax: form.visibleUntil ? new Date(form.visibleUntil) : null,
                    }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = แสดงทันที</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">หยุดแสดง</label>
                  <DateTimeField
                    value={form.visibleUntil}
                    onChange={v => setForm({ ...form, visibleUntil: v })}
                    clearable
                    placeholder="เว้นว่าง = ไม่มีกำหนดจบ"
                    bounds={{
                      disablePast: true,
                      originalValue: originalRef.current.visibleUntil,
                      pairMin: form.visibleFrom ? new Date(form.visibleFrom) : null,
                      policyMax: addYears(form.visibleFrom ? new Date(form.visibleFrom) : new Date(), 1),
                    }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">เว้นว่าง = ไม่มีกำหนดจบ</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${form.active ? 'bg-green-600' : 'bg-gray-300'}`}
                  onClick={() => setForm({ ...form, active: !form.active })}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.active ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
                <span className="text-sm font-bold text-gray-800">เปิดให้แลกของรางวัลนี้</span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2 flex-shrink-0">
              <button onClick={() => setForm(null)} disabled={saving}
                className="px-4 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-bold">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-600 border border-green-700 text-white text-sm font-bold shadow-[0_3px_0_#15803d] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-60 flex items-center gap-2">
                {saving ? <><i className="fas fa-spinner fa-spin text-xs"></i> กำลังบันทึก</> : <><i className="fas fa-check text-xs"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}
    </div>
  );
}
