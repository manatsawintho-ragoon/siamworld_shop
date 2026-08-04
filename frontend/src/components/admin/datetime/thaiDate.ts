/**
 * Thai calendar formatting and the ONE canonical local/ISO conversion.
 *
 * The conversion pair used to exist in four independent copies
 * (news, rewards and campaigns page-locals, plus lib/saleWindow). They drifted:
 * one emitted `toISOString()` (UTC) into a control that reads back local wall
 * clock, so every edit-and-resave shifted the window by the local offset and a
 * "7 day" sale stored 9,659 minutes instead of 10,080 in Asia/Bangkok. Four
 * copies meant it could happen again in any of them. This is the only one now.
 */

export interface DateTimeParts {
  year: number;    // ค.ศ.
  month: number;   // 0-11
  day: number;
  hour: number;
  minute: number;
}

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/**
 * Weekday headers, MONDAY FIRST.
 *
 * Thai calendars conventionally start on Sunday, so this is the surprising
 * choice and it is deliberate: `campaigns/page.tsx` renders its weekday
 * selector as ['จ','อ','พ','พฤ','ศ','ส','อา'] and both that page and
 * `campaign.logic.ts` compute `weekdayMon0`. A Sunday-first calendar would sit
 * directly above a Monday-first weekday selector inside the same modal.
 */
export const THAI_WEEKDAYS_MON_FIRST = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];

/** ค.ศ. -> พ.ศ. */
export const toBuddhistYear = (gregorian: number): number => gregorian + 543;
/** พ.ศ. -> ค.ศ. */
export const toGregorianYear = (buddhist: number): number => buddhist - 543;

const pad = (n: number) => String(n).padStart(2, '0');

/** An instant -> its LOCAL wall-clock parts (what the UI shows). */
export function toParts(value: Date | string | null | undefined): DateTimeParts | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

/**
 * Local wall-clock parts -> the instant they name.
 *
 * `new Date(y, m, d, h, min)` resolves in the browser's own zone, which is what
 * makes the round trip lossless. Never build this from a UTC string.
 */
export function fromParts(p: DateTimeParts): Date {
  return new Date(p.year, p.month, p.day, p.hour, p.minute, 0, 0);
}

/** An instant -> ISO, for the API. */
export function partsToIso(p: DateTimeParts): string {
  return fromParts(p).toISOString();
}

/** Legacy shape: "YYYY-MM-DDTHH:mm" in local wall clock. Still used to seed state. */
export function toLocalInput(value: Date | string | null | undefined): string {
  const p = toParts(value);
  if (!p) return '';
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "YYYY-MM-DDTHH:mm" (local wall clock) -> ISO. */
export function fromLocalInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Trigger label, e.g. "13 ส.ค. 2569 14:30". */
export function formatThaiDateTime(value: Date | string | null | undefined): string {
  const p = toParts(value);
  if (!p) return '';
  return `${p.day} ${THAI_MONTHS_SHORT[p.month]} ${toBuddhistYear(p.year)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Calendar header, e.g. "สิงหาคม 2569". */
export function formatThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS_FULL[month]} ${toBuddhistYear(year)}`;
}

/** Midnight local on the same calendar day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function addMonths(d: Date, n: number): Date {
  // Snap to the 1st first, or 31 ม.ค. + 1 month lands in March.
  const out = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = daysInMonth(out.getFullYear(), out.getMonth());
  out.setDate(Math.min(d.getDate(), lastDay));
  out.setHours(d.getHours(), d.getMinutes(), 0, 0);
  return out;
}

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Last calendar day of a month, at 23:59 local. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()), 23, 59, 0, 0);
}

/**
 * Index of the first cell in a Monday-first grid: how many blanks precede day 1.
 * JS getDay() is Sunday=0, so shift by 6 and wrap.
 */
export function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

// ─── HH:MM strings (the Bangkok wall-clock daily window) ────────────────────

/**
 * Normalise a time coming from the API.
 *
 * `daily_start_time` is a MySQL `TIME` column (migration 032), so mysql2 returns
 * '14:30:00' and the campaigns page seeds the form with it untouched. Native
 * <input type="time"> tolerates the seconds, which is why this never surfaced;
 * a strict HH:MM parser renders every existing daily window as empty.
 */
export function normalizeTimeString(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return '';
  const h = Number(m[1]), min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return '';
  return `${pad(h)}:${pad(min)}`;
}

/** 'HH:MM' -> minutes since midnight, or null. */
export function timeToMinutes(value: string | null | undefined): number | null {
  const norm = normalizeTimeString(value);
  if (!norm) return null;
  const [h, m] = norm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
