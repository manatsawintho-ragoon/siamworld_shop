'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, getToken } from '@/lib/api';
import { useAdminAlert } from '@/components/AdminAlert';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  banner_image: string | null;
  points_per_baht: string | number;
  min_topup_amount: string | number;
  starts_at: string;
  ends_at: string;
  daily_start_time: string | null;
  daily_end_time: string | null;
  weekday_mask: number | null;
  max_points_per_user: number | null;
  max_points_budget: number | null;
  points_expire_days: number;
  paused: number | boolean;
  active: number | boolean;
  points_issued: string | number;
  participants: string | number;
}

interface CampaignStats {
  issued: number;
  outstanding: number;
  expiredUnspent: number;
  clawedBack: number;
  redeemed: number;
  participants: number;
}

interface CampaignForm {
  id?: number;
  name: string;
  description: string;
  bannerImage: string;
  pointsPerBaht: number;
  minTopupAmount: number;
  startsAt: string; // datetime-local value
  endsAt: string;
  dailyStartTime: string | null;
  dailyEndTime: string | null;
  weekdayMask: number | null;
  maxPointsPerUser: number | null;
  maxPointsBudget: number | null;
  pointsExpireDays: number;
  paused: boolean;
  active: boolean;
}

const emptyForm: CampaignForm = {
  name: '', description: '', bannerImage: '',
  pointsPerBaht: 0, minTopupAmount: 0,
  startsAt: '', endsAt: '',
  dailyStartTime: null, dailyEndTime: null,
  weekdayMask: null,
  maxPointsPerUser: null, maxPointsBudget: null,
  pointsExpireDays: 30,
  paused: false, active: true,
};

// bit0=Mon .. bit6=Sun
const DAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

const FIELD_LABELS: Record<string, string> = {
  name: 'ชื่อแคมเปญ', description: 'คำอธิบาย', bannerImage: 'รูปแบนเนอร์',
  pointsPerBaht: 'อัตราแต้มต่อบาท', minTopupAmount: 'ยอดเติมขั้นต่ำ',
  startsAt: 'เวลาเริ่ม', endsAt: 'เวลาสิ้นสุด',
  dailyStartTime: 'เวลาเริ่มรายวัน', dailyEndTime: 'เวลาสิ้นสุดรายวัน',
  weekdayMask: 'วันในสัปดาห์', maxPointsPerUser: 'แต้มสูงสุดต่อคน',
  maxPointsBudget: 'งบแต้มสูงสุดของแคมเปญ', pointsExpireDays: 'อายุแต้ม (วัน)',
};

// ─── Live status (mirrors backend Asia/Bangkok logic - given verbatim) ──────

function isLiveNow(c: Campaign): boolean {
  const now = new Date();
  if (!c.active || c.paused) return false;
  if (now < new Date(c.starts_at) || now > new Date(c.ends_at)) return false;

  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const weekdayMon0 = (shifted.getUTCDay() + 6) % 7;
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();

  if (c.weekday_mask != null && (c.weekday_mask & (1 << weekdayMon0)) === 0) return false;

  if (c.daily_start_time && c.daily_end_time) {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s = toMin(c.daily_start_time);
    const e = toMin(c.daily_end_time);
    if (s === e) return false;
    return s < e ? (minutes >= s && minutes < e) : (minutes >= s || minutes < e);
  }
  return true;
}

function getStatusInfo(c: Campaign): { label: string; className: string; dot: string } {
  const now = new Date();
  if (isLiveNow(c)) return { label: 'กำลังแจกแต้ม', className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500 animate-pulse' };
  if (c.paused) return { label: 'หยุดชั่วคราว', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  if (now < new Date(c.starts_at)) return { label: 'รอเริ่ม', className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
  if (now > new Date(c.ends_at)) return { label: 'จบแล้ว', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  return { label: 'นอกช่วงเวลา', className: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
}

// ─── Datetime <-> datetime-local helpers ────────────────────────────────────
// <input type="datetime-local"> has no timezone: the browser reads and writes
// its value as LOCAL wall clock. Both helpers must therefore agree on local,
// or the round trip silently shifts the window by the UTC offset (7h here) on
// every edit-and-resave. fromLocalInput already parses as local, so
// toLocalInput must emit local wall clock too - NOT toISOString(), which is UTC.
const toLocalInput = (iso: string) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16);
  } catch { return ''; }
};
const fromLocalInput = (value: string) => new Date(value).toISOString();

const fmtWindow = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AdminCampaigns() {
  const { confirm: adminConfirm, alert: adminAlert } = useAdminAlert();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // forces re-render so the live pill flips without a refresh

  const [form, setForm] = useState<CampaignForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);

  const [statsModal, setStatsModal] = useState<Campaign | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = () => {
    setLoading(true);
    api('/admin/campaigns', { token: getToken()! })
      .then(async d => {
        const list = (d.campaigns as Campaign[]) || [];
        setCampaigns(list);
        const entries = await Promise.all(list.map(async c => {
          try {
            const sd = await api(`/admin/campaigns/${c.id}/stats`, { token: getToken()! });
            return [c.id, sd.stats as CampaignStats] as const;
          } catch {
            return [c.id, null] as const;
          }
        }));
        const map: Record<number, CampaignStats> = {};
        entries.forEach(([id, s]) => { if (s) map[id] = s; });
        setStatsMap(map);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => { setForm({ ...emptyForm }); setError(''); setFieldErrors([]); };

  const openEdit = (c: Campaign) => {
    setForm({
      id: c.id,
      name: c.name,
      description: c.description || '',
      bannerImage: c.banner_image || '',
      pointsPerBaht: Number(c.points_per_baht),
      minTopupAmount: Number(c.min_topup_amount),
      startsAt: toLocalInput(c.starts_at),
      endsAt: toLocalInput(c.ends_at),
      dailyStartTime: c.daily_start_time,
      dailyEndTime: c.daily_end_time,
      weekdayMask: c.weekday_mask,
      maxPointsPerUser: c.max_points_per_user,
      maxPointsBudget: c.max_points_budget,
      pointsExpireDays: c.points_expire_days,
      paused: Boolean(c.paused),
      active: Boolean(c.active),
    });
    setError('');
    setFieldErrors([]);
  };

  const hasOverlap = (f: CampaignForm) => {
    if (!f.startsAt || !f.endsAt) return false;
    const s = new Date(f.startsAt).getTime();
    const e = new Date(f.endsAt).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return false;
    return campaigns.some(c => {
      if (c.id === f.id) return false;
      const cs = new Date(c.starts_at).getTime();
      const ce = new Date(c.ends_at).getTime();
      return cs <= e && ce >= s;
    });
  };

  const doSave = async (f: CampaignForm) => {
    setSaving(true);
    setError('');
    setFieldErrors([]);
    try {
      const body = {
        name: f.name,
        description: f.description || undefined,
        bannerImage: f.bannerImage || null,
        pointsPerBaht: Number(f.pointsPerBaht),
        minTopupAmount: Number(f.minTopupAmount) || 0,
        startsAt: fromLocalInput(f.startsAt),
        endsAt: fromLocalInput(f.endsAt),
        dailyStartTime: f.dailyStartTime || null,
        dailyEndTime: f.dailyEndTime || null,
        weekdayMask: f.weekdayMask,
        maxPointsPerUser: f.maxPointsPerUser || null,
        maxPointsBudget: f.maxPointsBudget || null,
        pointsExpireDays: Number(f.pointsExpireDays) || 0,
        paused: Boolean(f.paused),
        active: Boolean(f.active),
      };
      if (f.id) {
        await api(`/admin/campaigns/${f.id}`, { method: 'PUT', token: getToken()!, body });
      } else {
        await api('/admin/campaigns', { method: 'POST', token: getToken()!, body });
      }
      setForm(null);
      adminAlert({ title: f.id ? 'แก้ไขแคมเปญแล้ว' : 'สร้างแคมเปญแล้ว', type: 'success' });
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

  const handleSave = async () => {
    if (!form) return;
    if (!form.name || !form.startsAt || !form.endsAt) {
      setError('กรอกชื่อแคมเปญ เวลาเริ่ม และเวลาสิ้นสุดให้ครบ');
      return;
    }
    if (hasOverlap(form)) {
      const ok = await adminConfirm({
        title: 'ช่วงเวลาทับซ้อน',
        message: 'มีแคมเปญอื่นทับช่วงเวลานี้อยู่ ระบบจะใช้แคมเปญที่ให้แต้มต่อบาทสูงสุดเพียงอันเดียว (ไม่รวมแต้ม)',
        type: 'warning',
        confirmLabel: 'ยืนยันบันทึก',
      });
      if (!ok) return;
    }
    await doSave(form);
  };

  const handleDelete = async (c: Campaign) => {
    if (!await adminConfirm({
      title: 'ลบแคมเปญ',
      message: `ต้องการลบ "${c.name}" หรือไม่ (แต้มที่แจกไปแล้วจะยังใช้ได้ตามปกติ ระบบจะหยุดแจกแต้มใหม่เท่านั้น)`,
      type: 'danger', confirmLabel: 'ลบ',
    })) return;
    try {
      await api(`/admin/campaigns/${c.id}`, { method: 'DELETE', token: getToken()! });
      adminAlert({ title: 'ลบแคมเปญแล้ว', type: 'success' });
      load();
    } catch (err: any) {
      await adminAlert({ title: 'ลบไม่สำเร็จ', message: err?.message || 'เกิดข้อผิดพลาด', type: 'error' });
    }
  };

  const filtered = campaigns.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-bullhorn text-[#f97316]"></i> แคมเปญเติมเงิน
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">ตั้งค่าช่วงเวลาให้แต้มพิเศษเมื่อผู้เล่นเติมเงิน</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-[#16a34a] text-white text-[13px] font-bold rounded-lg shadow-[0_4px_0_#0d6b2e] hover:brightness-110 transition-all active:shadow-[0_2px_0_#0d6b2e] active:translate-y-[2px]">
            <i className="fas fa-plus text-[12px]"></i> เพิ่มแคมเปญ
          </button>
        </div>
      </div>

      {/* ── Main table card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_0_#c5cad3,0_2px_24px_rgba(0,0,0,0.10)] border border-gray-200/70 overflow-hidden flex flex-col">

        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-bullhorn text-[#f97316] text-[10px]"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">แคมเปญทั้งหมด</p>
            <p className="text-[10px] text-gray-400">{filtered.length} รายการ</p>
          </div>
          <div className="relative">
            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]"></i>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาแคมเปญ..."
              className="pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 text-[11px] focus:outline-none focus:border-[#637469] focus:ring-1 focus:ring-[#637469]/20 w-44" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <i className="fas fa-spinner fa-spin text-2xl text-[#f97316]"></i>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1 pb-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50/40">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">แคมเปญ</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">อัตรา</th>
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">ช่วงเวลา</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">สถานะ</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">ผู้เข้าร่วม</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">แต้มที่แจก</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">คงเหลือ</th>
                  <th className="text-center px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => {
                  const status = getStatusInfo(c);
                  const stats = statsMap[c.id];
                  const restrictsDays = c.weekday_mask != null;
                  const restrictsHours = !!(c.daily_start_time && c.daily_end_time);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-gray-800 truncate max-w-[220px]">{c.name}</div>
                          {c.description && <div className="text-[10px] text-gray-400 truncate max-w-[220px]">{c.description}</div>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="text-[12px] font-black text-gray-800">{Number(c.points_per_baht)} point/฿</span>
                        {Number(c.min_topup_amount) > 0 && (
                          <div className="text-[9px] text-gray-400">ขั้นต่ำ {Number(c.min_topup_amount).toLocaleString()} ฿</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-[11px] text-gray-700 whitespace-nowrap">{fmtWindow(c.starts_at)} - {fmtWindow(c.ends_at)}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {restrictsHours && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                              <i className="fas fa-clock text-[8px]" /> {c.daily_start_time?.slice(0, 5)}-{c.daily_end_time?.slice(0, 5)}
                            </span>
                          )}
                          {restrictsDays && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                              <i className="fas fa-calendar-week text-[8px]" /> เฉพาะวัน
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${status.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right hidden md:table-cell">
                        <span className="text-[12px] font-bold text-gray-700">{Number(c.participants).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2 text-right hidden lg:table-cell">
                        <span className="text-[12px] font-bold text-gray-700">{Number(c.points_issued).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2 text-right hidden lg:table-cell">
                        {stats ? (
                          <span className="text-[12px] font-bold text-amber-600">{stats.outstanding.toLocaleString()}</span>
                        ) : (
                          <span className="text-[10px] text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setStatsModal(c)} title="ดูสถิติ"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-500 border border-blue-600 text-white shadow-[0_2px_0_#1d4ed8] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                            <i className="fas fa-chart-line text-[10px]"></i>
                          </button>
                          <button onClick={() => openEdit(c)} title="แก้ไข"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-500 border border-amber-600 text-white shadow-[0_2px_0_#b45309] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                            <i className="fas fa-pen text-[10px]"></i>
                          </button>
                          <button onClick={() => handleDelete(c)} title="ลบ"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 border border-red-600 text-white shadow-[0_2px_0_#b91c1c] hover:brightness-110 active:translate-y-[1px] active:shadow-none transition-all">
                            <i className="fas fa-trash text-[10px]"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <i className="fas fa-bullhorn text-3xl text-gray-200 mb-3 block"></i>
                      <p className="text-sm text-gray-400">ยังไม่มีแคมเปญ</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Create / Edit Modal ─────────────────────────────── */}
      {form && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget && !saving) setForm(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            onMouseDown={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-bullhorn text-[#f97316] text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-sm">{form.id ? 'แก้ไขแคมเปญ' : 'สร้างแคมเปญใหม่'}</h3>
              </div>
              <button onClick={() => setForm(null)} className="w-7 h-7 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_3px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-[10px]"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2.5">
              {error && (
                <div className="text-red-600 text-[11px] bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                  <div className="flex items-center gap-1.5 font-bold"><i className="fas fa-exclamation-circle"></i> {error}</div>
                  {fieldErrors.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {fieldErrors.map((fe, i) => (
                        <li key={i} className="flex items-start gap-1.5 pl-0.5">
                          <i className="fas fa-circle text-[4px] mt-1.5 text-red-400"></i>
                          <span><span className="font-bold">{FIELD_LABELS[fe.field] || fe.field}</span>: {fe.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">ชื่อแคมเปญ *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                  placeholder="เช่น โปรเติมเงินปีใหม่" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">คำอธิบาย</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20 h-12 resize-none"
                  placeholder="รายละเอียดแคมเปญ..." />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">รูปแบนเนอร์ (URL)</label>
                <div className="flex gap-1.5">
                  <input value={form.bannerImage} onChange={e => setForm({ ...form, bannerImage: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder="https://..." />
                  {form.bannerImage && (
                    <div className="w-8 h-8 rounded-md border border-gray-200 flex-shrink-0 bg-gray-50 overflow-hidden">
                      <img src={form.bannerImage} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">อัตราแต้มต่อบาท *</label>
                  <input type="number" step="0.01" min={0} max={1000} value={form.pointsPerBaht || ''}
                    onChange={e => setForm({ ...form, pointsPerBaht: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">ยอดเติมขั้นต่ำ (฿)</label>
                  <input type="number" min={0} value={form.minTopupAmount || ''}
                    onChange={e => setForm({ ...form, minTopupAmount: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder="0" />
                </div>
              </div>

              {/* Dry-run preview - catches a misplaced decimal before saving */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <i className="fas fa-calculator" aria-hidden="true" />
                  <span>ตัวอย่างการคำนวณ</span>
                </div>
                <ul className="mt-2 space-y-1 text-slate-700">
                  {[100, 500, 1000].map(amt => (
                    <li key={amt} className="flex justify-between">
                      <span>เติม ฿{amt.toLocaleString()}</span>
                      <span className="font-medium">
                        {amt < (form.minTopupAmount || 0)
                          ? 'ไม่ได้รับแต้ม (ต่ำกว่าขั้นต่ำ)'
                          : `${Math.floor(amt * (form.pointsPerBaht || 0)).toLocaleString()} point`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">เวลาเริ่ม *</label>
                  <input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">เวลาสิ้นสุด *</label>
                  <input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
              </div>

              {/* Daily hours restriction */}
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                    <i className="fas fa-clock text-gray-400 text-[9px]"></i> จำกัดช่วงเวลาต่อวัน (เวลาไทย)
                  </span>
                  <button type="button"
                    onClick={() => setForm(f => f && (f.dailyStartTime !== null
                      ? { ...f, dailyStartTime: null, dailyEndTime: null }
                      : { ...f, dailyStartTime: '00:00', dailyEndTime: '23:59' }))}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${form.dailyStartTime !== null ? 'bg-[#16a34a]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.dailyStartTime !== null ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {form.dailyStartTime !== null && (
                  <div className="flex gap-2 items-center">
                    <input type="time" value={form.dailyStartTime || ''} onChange={e => setForm({ ...form, dailyStartTime: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                    <span className="text-gray-400 text-xs">-</span>
                    <input type="time" value={form.dailyEndTime || ''} onChange={e => setForm({ ...form, dailyEndTime: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                  </div>
                )}
              </div>

              {/* Weekday restriction */}
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                    <i className="fas fa-calendar-week text-gray-400 text-[9px]"></i> จำกัดวันในสัปดาห์
                  </span>
                  <button type="button"
                    onClick={() => setForm(f => f && ({ ...f, weekdayMask: f.weekdayMask === null ? 127 : null }))}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${form.weekdayMask !== null ? 'bg-[#16a34a]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.weekdayMask !== null ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                {form.weekdayMask !== null && (
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, bit) => {
                      const checked = ((form.weekdayMask ?? 127) & (1 << bit)) !== 0;
                      return (
                        <button key={bit} type="button"
                          onClick={() => setForm(f => f && ({ ...f, weekdayMask: (f.weekdayMask ?? 127) ^ (1 << bit) }))}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${checked ? 'bg-[#1e2735] text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">แต้มสูงสุดต่อคน</label>
                  <input type="number" min={1} value={form.maxPointsPerUser ?? ''}
                    onChange={e => setForm({ ...form, maxPointsPerUser: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder="ไม่จำกัด" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">งบแต้มรวม</label>
                  <input type="number" min={1} value={form.maxPointsBudget ?? ''}
                    onChange={e => setForm({ ...form, maxPointsBudget: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20"
                    placeholder="ไม่จำกัด" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">อายุแต้ม (วัน)</label>
                  <input type="number" min={0} max={3650} value={form.pointsExpireDays}
                    onChange={e => setForm({ ...form, pointsExpireDays: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#637469] focus:ring-2 focus:ring-[#637469]/20" />
                </div>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-[12px] font-bold text-gray-700 cursor-pointer">
                  <button type="button" onClick={() => setForm({ ...form, active: !form.active })}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${form.active ? 'bg-[#16a34a]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  เปิดใช้งาน
                </label>
                <label className="flex items-center gap-2 text-[12px] font-bold text-gray-700 cursor-pointer">
                  <button type="button" onClick={() => setForm({ ...form, paused: !form.paused })}
                    className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 ${form.paused ? 'bg-amber-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.paused ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  หยุดชั่วคราว
                </label>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2 flex-shrink-0">
              <button onClick={() => setForm(null)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-800 shadow-[0_3px_0_#d1d5db] hover:brightness-95 transition-all">
                <i className="fas fa-times text-[11px]"></i> ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-[#1e2735] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-[0_3px_0_#38404d] hover:brightness-110 transition-all active:shadow-[0_1px_0_#38404d] active:translate-y-[2px]">
                {saving ? <><i className="fas fa-spinner fa-spin text-[11px]"></i> บันทึก...</> : <><i className="fas fa-save text-[11px]"></i> บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      ); })(), document.body)}

      {/* ─── Stats Modal ─────────────────────────────────────── */}
      {statsModal && createPortal((() => { const bd = { current: false }; return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
          onMouseDown={e => { bd.current = e.target === e.currentTarget; }}
          onMouseUp={e => { if (bd.current && e.target === e.currentTarget) setStatsModal(null); }}>
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-chart-line text-blue-500 text-xs"></i>
              </div>
              <div className="flex-1 text-center">
                <h3 className="font-bold text-gray-900 text-base">สถิติแคมเปญ</h3>
                <p className="text-[11px] text-gray-500">{statsModal.name}</p>
              </div>
              <button onClick={() => setStatsModal(null)} className="w-8 h-8 rounded-lg bg-red-500 border border-red-600 flex items-center justify-center text-white shadow-[0_4px_0_#b91c1c] flex-shrink-0">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <div className="p-5">
              {(() => {
                const s = statsMap[statsModal.id];
                if (!s) return <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูลสถิติ</p>;
                const rows: { label: string; value: number; color: string }[] = [
                  { label: 'แต้มที่แจกทั้งหมด', value: s.issued, color: 'text-gray-800' },
                  { label: 'คงเหลือ (ยังไม่หมดอายุ)', value: s.outstanding, color: 'text-amber-600' },
                  { label: 'ใช้ไปแล้ว', value: s.redeemed, color: 'text-green-600' },
                  { label: 'หมดอายุโดยไม่ได้ใช้', value: s.expiredUnspent, color: 'text-gray-500' },
                  { label: 'ถูกเรียกคืน (ยกเลิกเติมเงิน)', value: s.clawedBack, color: 'text-red-500' },
                  { label: 'ผู้เข้าร่วม', value: s.participants, color: 'text-gray-800' },
                ];
                return (
                  <div className="space-y-2">
                    {rows.map(r => (
                      <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-[12px] text-gray-600">{r.label}</span>
                        <span className={`text-sm font-black ${r.color}`}>{r.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ); })(), document.body)}
    </div>
  );
}
