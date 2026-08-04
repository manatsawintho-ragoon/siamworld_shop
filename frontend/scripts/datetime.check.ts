import * as T from "../src/components/admin/datetime/thaiDate.ts";
import * as C from "../src/components/admin/datetime/constraints.ts";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); fail++; }
  else console.log(`ok   ${name} = ${g}`);
};
const D = (s: string) => new Date(s);

console.log('── thaiDate ──');
eq('พ.ศ. 2026->2569', T.toBuddhistYear(2026), 2569);
eq('ค.ศ. 2569->2026', T.toGregorianYear(2569), 2026);
// round trip must be lossless in a non-UTC zone (the sale-duration bug)
const src = new Date(2026, 7, 13, 14, 30);
eq('local round trip', T.toParts(T.fromParts(T.toParts(src)!)), T.toParts(src));
eq('toLocalInput no UTC shift', T.toLocalInput(src), '2026-08-13T14:30');
eq('fromLocalInput -> same instant', T.fromLocalInput('2026-08-13T14:30'), src.toISOString());
eq('leap feb 2028', T.daysInMonth(2028, 1), 29);
eq('feb 2026', T.daysInMonth(2026, 1), 28);
eq('31 Jan +1mo = 29 Feb 2028', T.toLocalInput(T.addMonths(new Date(2028,0,31,9,0),1)), '2028-02-29T09:00');
eq('midnight', T.toLocalInput(new Date(2026,7,13,0,0)), '2026-08-13T00:00');
eq('23:59', T.toLocalInput(new Date(2026,7,13,23,59)), '2026-08-13T23:59');
eq('fmt thai', T.formatThaiDateTime(src), '13 ส.ค. 2569 14:30');
eq('month header', T.formatThaiMonthYear(2026, 7), 'สิงหาคม 2569');
// Monday-first: 1 Aug 2026 is a Saturday -> 5 blanks (Mon..Fri)
eq('leadingBlanks Aug2026', T.leadingBlanks(2026, 7), 5);
eq('weekday hdr mon-first', T.THAI_WEEKDAYS_MON_FIRST[0], 'จ');
// HH:MM:SS from MySQL TIME
eq('normalize 14:30:00', T.normalizeTimeString('14:30:00'), '14:30');
eq('normalize 14:30', T.normalizeTimeString('14:30'), '14:30');
eq('normalize junk', T.normalizeTimeString('99:99'), '');
eq('normalize null', T.normalizeTimeString(null), '');
eq('timeToMinutes 14:30:00', T.timeToMinutes('14:30:00'), 870);

console.log('\n── constraints ──');
const now = D('2026-08-05T14:00:00');

// disablePast, creating (originalValue null)
let b = C.resolveBounds({ disablePast: true, originalValue: null }, now);
eq('create: floor = now', b.min?.toISOString(), now.toISOString());

// disablePast, editing a record that already started
b = C.resolveBounds({ disablePast: true, originalValue: D('2026-08-01T09:00:00') }, now);
eq('edit: floor = stored past value', b.min?.toISOString(), D('2026-08-01T09:00:00').toISOString());
eq('  stored value reachable', C.isWithinBounds(D('2026-08-01T09:00:00'), b), true);
eq('  earlier date blocked', C.isWithinBounds(D('2026-07-25T09:00:00'), b), false);

// THE round-5 case: min and disablePast COMBINE, not alternatives
b = C.resolveBounds({ disablePast: true, pairMin: D('2026-09-01T00:00:00'), originalValue: null }, now);
eq('pairMin+disablePast -> later wins', b.min?.toISOString(), D('2026-09-01T00:00:00.001').toISOString());
eq('  cannot end before start', C.isWithinBounds(D('2026-08-10T00:00:00'), b), false);

// THE round-6 case: reachability must not loosen pairMax
b = C.resolveBounds({ pairMax: D('2026-08-05T00:00:00'), originalValue: D('2026-09-01T00:00:00') }, now);
eq('pairMax NOT loosened by original', b.max?.toISOString(), D('2026-08-04T23:59:59.999').toISOString());
// ...but policyMax IS extended (the multi-year sale)
b = C.resolveBounds({ policyMax: D('2027-08-05T00:00:00'), originalValue: D('2029-01-01T00:00:00') }, now);
eq('policyMax extended by original', b.max?.toISOString(), D('2029-01-01T00:00:00').toISOString());

// exclusive pair bounds (backend uses >)
b = C.resolveBounds({ pairMin: D('2026-08-10T12:00:00') }, now);
eq('start==end rejected', C.isWithinBounds(D('2026-08-10T12:00:00'), b), false);
eq('one minute later ok', C.isWithinBounds(D('2026-08-10T12:01:00'), b), true);

// contradictory bounds fail closed, not swapped
b = C.resolveBounds({ policyMin: D('2026-09-01T00:00:00'), policyMax: D('2026-08-01T00:00:00') }, now);
eq('impossible flagged', b.impossible, true);
eq('  every day disabled', C.isDayDisabled(D('2026-08-15T00:00:00'), b), true);

// boundary-day time clamp - the rule that leaks without it
b = C.resolveBounds({ disablePast: true, originalValue: null }, now);   // min = 14:00 today
eq('today selectable', C.isDayDisabled(D('2026-08-05T00:00:00'), b), false);
eq('  09:00 today blocked', C.isTimeDisabled(D('2026-08-05T00:00:00'), 9*60, b), true);
eq('  14:00 today allowed', C.isTimeDisabled(D('2026-08-05T00:00:00'), 14*60, b), false);
eq('  allowedMinutes from', C.allowedMinutes(D('2026-08-05T00:00:00'), b).from, 840);
eq('  next day unrestricted', C.allowedMinutes(D('2026-08-06T00:00:00'), b).from, 0);
eq('  clamp pulls into range', C.clampToBounds(D('2026-08-05T09:00:00'), b).toISOString(), now.toISOString());
eq('  yesterday disabled', C.isDayDisabled(D('2026-08-04T00:00:00'), b), true);

// empty companion -> absent bound, never new Date('')
b = C.resolveBounds({ pairMin: null, disablePast: true, originalValue: null }, now);
eq('empty companion -> no NaN', b.min?.toISOString(), now.toISOString());

// daily window: midnight wrap MUST be allowed
eq('22:00-02:00 allowed', C.checkDailyWindow('22:00','02:00'), { ok: true, crossesMidnight: true, error: null });
eq('09:00-17:00 allowed', C.checkDailyWindow('09:00','17:00'), { ok: true, crossesMidnight: false, error: null });
eq('equal rejected', C.checkDailyWindow('09:00','09:00').ok, false);
eq('one side empty ok', C.checkDailyWindow('09:00', null).ok, true);

console.log(fail ? `\n${fail} FAILURES` : '\nall checks passed');
process.exit(fail ? 1 : 0);
