'use client';

export const RANGES = [
  { id: '7d',    label: '7 วัน' },
  { id: '30d',   label: '30 วัน' },
  { id: '90d',   label: '90 วัน' },
  { id: 'week',  label: 'รายสัปดาห์' },
  { id: 'month', label: 'รายเดือน' },
] as const;

export type RangeId = (typeof RANGES)[number]['id'];

interface Props {
  value: RangeId;
  onChange: (r: RangeId) => void;
  disabled?: boolean;
}

export function RangeTabs({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-xl bg-gray-100 p-1" role="tablist">
      {RANGES.map(r => {
        const on = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={disabled}
            onClick={() => onChange(r.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${
              on ? 'bg-white text-[#f97316] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "30 วัน" alone never says WHICH 30 days. This renders the actual span in Thai
 * so the chart is self-describing.
 */
export function formatRangeCaption(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d} ${months[m - 1]} ${y + 543}`;
  };
  return `${fmt(from)} - ${fmt(to)}`;
}
