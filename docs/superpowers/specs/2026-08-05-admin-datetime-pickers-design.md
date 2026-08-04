# Admin date/time pickers

Date: 2026-08-05
Branch: `feat/admin-datetime-pickers`

## Problem

The shop admin has 12 date/time inputs across 6 pages, all raw
`<input type="datetime-local">` / `<input type="time">`:

| Page | Fields |
|---|---|
| `admin/campaigns` | `startsAt`, `endsAt`, `dailyStartTime`, `dailyEndTime` |
| `admin/lootboxes` | sale end |
| `admin/news` | `publishedAt`, `expiresAt` |
| `admin/products` | sale end (x2 render sites) |
| `admin/rewards` | `visibleFrom`, `visibleUntil` |

Three problems.

**1. The UI is whatever the browser decides.** Native `datetime-local` renders
completely differently in Chrome, Firefox and Safari, shows the Gregorian year
to owners who think in พ.ศ., has tiny hit targets, and cannot be themed to match
the admin palette.

**2. Almost nothing is constrained.** Exactly one of the twelve inputs has any
bound at all (`lootboxes/page.tsx:1419`, `min=`). An owner can set a campaign to
end before it starts, schedule a sale into 1970, or set a reward window to the
year 3000. The backend *does* reject reversed windows (Zod refines at
`validators/schemas.ts:278` and `:387`), but the owner only discovers this after
filling the whole form and pressing save.

**3. The local/UTC helper is duplicated four times.** `toLocalInput` /
`fromLocalInput` exist independently at `news/page.tsx:78-84`,
`rewards/page.tsx:79-85`, `campaigns/page.tsx:122-130`, plus `lib/saleWindow.ts`.
This is the exact duplication that produced the sale-duration bug: the copies
drifted, one used `toISOString()` (UTC) where the input reads local wall clock,
and a "7 day" sale silently stored 9,659 minutes instead of 10,080 in
Asia/Bangkok. Four copies means it can happen again in any of them.

## Decisions

| Question | Decision |
|---|---|
| Library or custom | Custom, no new dependency |
| Rules to enforce | Block past, end-after-start, max span, quick presets |
| Editing a record that already started | Keep the stored value selectable, block choosing a *new* past date |
| Mobile | Same custom picker everywhere (bottom sheet under 640px), never native |

### Why custom

The picker has to render พ.ศ., Thai month and weekday names, obey the admin's own
neutral palette (`THEME.md` forbids the admin following the customer theme), and
carry per-field bounds. A library would need heavy theming and a Thai-year
adapter anyway, and would still not supply the time half. The cost is that
keyboard navigation, focus management and the disabled-date edge cases are ours
to get right, which the testing section addresses explicitly.

## A. Module layout

```
frontend/src/components/admin/datetime/
  thaiDate.ts        pure: พ.ศ. <-> ค.ศ., Thai month/weekday names,
                     local-wall-clock <-> ISO (the ONE canonical pair)
  constraints.ts     pure: resolveBounds(), isDayDisabled(), clampToBounds()
  CalendarMonth.tsx  month grid; takes bounds + selected, emits a pick
  TimeSpinner.tsx    HH:MM stepper with wrap and bound awareness
  PickerSurface.tsx  portal, positioning, focus trap, Esc / outside-click
  DateTimeField.tsx  the control: trigger button + surface + presets
  TimeField.tsx      bare HH:MM control (campaigns daily window)
  index.ts
```

`thaiDate.ts` and `constraints.ts` are pure and carry the logic worth testing.
The components stay thin so a rendering change cannot break a rule.

## B. The picker must render in a portal

This is the load-bearing technical constraint, not a style preference.

The datetime inputs sit inside the modal body at `campaigns/page.tsx:459`
(`flex-1 min-h-0 overflow-y-auto`), which is nested in the modal shell at `:443`
(`overflow-hidden`), at `z-[200]`. An absolutely-positioned popover rendered
inline is clipped by both. The calendar would be cut off mid-month for any field
low in a scrolled form, which is precisely where the sale-end fields sit.

Therefore `PickerSurface` renders through `createPortal` into `document.body` at
`z-[300]`, positions itself from the trigger's `getBoundingClientRect()`, and
recomputes on `scroll` (capture phase, so it catches the modal body scrolling)
and `resize`. It flips above the trigger when the space below is short.

Under 640px it is a bottom sheet with a backdrop instead of a popover, which
also sidesteps positioning entirely on the smallest screens.

## C. One canonical time conversion

`thaiDate.ts` exports the single pair:

```ts
/** ISO string -> "YYYY-MM-DDTHH:mm" in LOCAL wall clock (what the UI shows). */
export function isoToLocalParts(iso: string | Date | null): DateTimeParts | null;
/** Local wall-clock parts -> ISO instant (what the API stores). */
export function localPartsToIso(parts: DateTimeParts): string;
```

The three page-level copies (`news:78`, `rewards:79`, `campaigns:122`) are
deleted outright and their call sites re-pointed here.

`lib/saleWindow.ts` keeps its sale-duration helpers and keeps exporting
`toLocalInput`, but as a thin wrapper over `thaiDate` rather than its own
implementation. It is not dead code: `products/page.tsx:168` and
`lootboxes/page.tsx:1052` call it to seed state
(`hasLiveSale(...) ? toLocalInput(...) : defaultSaleEndInput()`), independently
of any input element. Only the `min={toLocalInput(new Date())}` attribute uses
(`products:926`, `:1362`, `lootboxes:1419`) disappear with the native inputs.

## D. Constraint model

```ts
export interface FieldBounds {
  /** From the companion field. Encodes an invariant: never loosened. */
  pairMin?: Date | null;
  pairMax?: Date | null;
  /** Caps this design introduces (the 1-year ceiling). May be extended to
   *  keep an existing record's stored value reachable. */
  policyMin?: Date | null;
  policyMax?: Date | null;
  disablePast?: boolean;
  /** The value stored on the record, captured at modal-open. Null when creating. */
  originalValue?: Date | null;
}

export function resolveBounds(b: FieldBounds, now: Date): { min: Date | null; max: Date | null };
```

Resolution, in full. `min` and `disablePast` are independent and BOTH apply -
several fields carry both at once, so neither may be dropped:

A bound has two possible sources and they behave differently, so `FieldBounds`
names them separately: **pair** bounds come from the companion field and encode
an invariant; **policy** bounds are caps this design introduces.

```
// floor: the explicit min and the past-block are combined - not alternatives
pastFloor    = disablePast ? earliest(now, originalValue ?? now) : null
effectiveMin = latest(pairMin, policyMin, pastFloor)

// ceiling: reachability extends the POLICY cap only
policyCeil   = originalValue ? latest(policyMax, originalValue) : policyMax
effectiveMax = earliest(pairMax, policyCeil)     // pairMax is never loosened
```

`latest`/`earliest` skip null operands and return null only when every operand
is null.

Worked cases:

- Campaign started 1 ส.ค., editing today (5 ส.ค.). `pastFloor` =
  `earliest(5 ส.ค., 1 ส.ค.)` = 1 ส.ค. So 1 ส.ค. stays selectable and saveable
  while 25 ก.ค. is greyed out. Editing a live record never traps the owner, and
  no new backdating gets through.
- `campaigns.endsAt` carries `disablePast: yes` AND `pairMin = startsAt`. For a
  campaign starting next month, `effectiveMin` = `latest(startsAt, now)` =
  `startsAt`. Taking only the past-block here would floor it at `now` and let
  the owner end the campaign before it starts - which is precisely what the
  cross-field bound exists to prevent. This is why the two are combined rather
  than branched.
- **Reachability must not touch a pair bound.** Editing a campaign scheduled
  1 ก.ย. - 30 ก.ย. and pulling `endsAt` back to 5 ส.ค.: if reachability applied
  to `pairMax`, `startsAt`'s ceiling would become `latest(5 ส.ค., 1 ก.ย.)` =
  1 ก.ย., and the owner could save start 1 ก.ย. with end 5 ส.ค. The backend
  would still reject it (`schemas.ts:358`), but preventing that round trip is
  the entire point of the picker. Reachability exists so a newly-introduced cap
  cannot strand an existing record; a pair bound encodes an invariant and stays
  hard.

**`originalValue` MUST be the value stored on the record, captured once when the
modal opens - never the live form state.** Every one of these pages holds a
single mutable form object seeded from the record (`campaigns/page.tsx:61`,
`rewards/page.tsx:65`, `news/page.tsx:51`), so passing `form.startsAt` would
re-anchor the floor to whatever is currently in the field. The owner could then
walk the date backwards indefinitely, one edit at a time, which is exactly the
hole `disablePast` exists to close. Each modal therefore stashes the record's
original window in a ref at open time and passes that ref's value.

**The ceiling extends for a stored value too.** `effectiveMax = latest(max,
originalValue)`, mirroring the floor rule. Sale length has no server-side
ceiling today (`schemas.ts:199`, `duration_minutes: z.number().int().min(0)`),
so multi-year sales already exist; reopening one under the new `now + 1 year`
cap would otherwise put its stored value outside the bounds and leave the owner
unable to navigate to, or re-save, their own live sale. A stored value is always
reachable, in both directions.

**Bounds are instants, so the boundary day must clamp the TIME too.** Day-level
disabling alone leaks the headline rule: with `disablePast` resolving `min` to
14:00 today, today is correctly selectable, and the owner then spins the time
back to 09:00 and saves a timestamp five hours in the past. On the day equal to
`min`, hours and minutes before `min` are disabled; on the day equal to `max`,
those after it are. Selecting a boundary day clamps the time into range rather
than leaving an out-of-bounds value on screen.

**`originalValue` must be cleared when creating.** These pages use one modal and
one form object for both actions (`campaigns/page.tsx:178-180` `openCreate` /
`openEdit`; same shape at `news:141` and `rewards:157`). `openEdit` sets the ref
from the record; `openCreate` MUST reset it to `null`. Otherwise editing a
campaign that began 1 ส.ค. and then pressing "create" leaves the floor at
1 ส.ค., and the escape hatch built for editing becomes a backdating hole in
creating.

For sale end specifically, `originalValue` is the stored value only while the
sale is live: `products/page.tsx:168` and `lootboxes/page.tsx:1052` already gate
on `hasLiveSale`, seeding a fresh default for an expired sale rather than
resurrecting the old window.

**Contradictory bounds fail closed.** If the resolved `max` is earlier than the
resolved `min`, every day renders disabled and the field shows why. The bounds
are NOT swapped: silently inverting them would let a cross-field pair accept the
reversed window the pair exists to prevent.

Cross-field pairs are wired by passing each other's current value: the end field
receives `min = startValue`, the start field receives `max = endValue`. Both
directions are set so the pair cannot be crossed from either side. When the
companion field is still empty its bound is simply absent rather than
`new Date('')` - see the `endsAt` row below.

## E. Per-field policy

Columns use the exact `FieldBounds` vocabulary from §D. `pairMin` / `pairMax`
come from the companion field and are never loosened; `policyMax` is this
design's cap and may be extended to keep a stored value reachable.

| Page | Field | disablePast | pairMin | pairMax | policyMax |
|---|---|---|---|---|---|
| campaigns | `startsAt` | yes | - | `endsAt` | - |
| campaigns | `endsAt` | yes | `startsAt` | - | (`startsAt` or now) + 1 year |
| campaigns | `dailyStartTime` | n/a | n/a | n/a | n/a - see below |
| campaigns | `dailyEndTime` | n/a | n/a | n/a | n/a - see below |
| products | sale end | yes | - | - | now + 1 year |
| lootboxes | sale end | yes | - | - | now + 1 year |
| rewards | `visibleFrom` | yes | - | `visibleUntil` | - |
| rewards | `visibleUntil` | yes | `visibleFrom` | - | `visibleFrom` + 1 year |
| news | `publishedAt` | **no** | - | `expiresAt` | - |
| news | `expiresAt` | yes | `publishedAt` | - | (`publishedAt` or now) + 1 year |

Every window pair is guarded from both ends: the start field takes the end as
its `pairMax`, the end field takes the start as its `pairMin`. A `-` means the
bound is absent, not zero. `originalValue` is supplied on all rows where
`disablePast` is yes, and is null whenever the modal was opened via create.

**Pair bounds are EXCLUSIVE; policy bounds and `disablePast` are inclusive.**
All three backend refines use strict `>` - `endsAt > startsAt`
(`schemas.ts:358`), `expires_at > published_at` (`:279`),
`visible_until > visible_from` (`:388`). An inclusive pair bound would let start
equal end through the picker and fail on save, and a zero-length window is
exactly what an owner produces by giving both fields the same preset.

The three pairs above are the complete set, and they match the backend
one-for-one: the picker prevents the round trip, the refine remains the
authority.

**The daily window may cross midnight, and the picker must not forbid it.**
`campaign.logic.ts:66-70` handles `start > end` on purpose:

```ts
const inWindow = start < end
  ? (minutesOfDay >= start && minutesOfDay < end)   // same-day
  : (minutesOfDay >= start || minutesOfDay < end);  // crosses midnight
```

`schemas.ts:361` validates only that both are set or neither, deliberately not
their order. A 22:00-02:00 night-bonus campaign is a supported configuration
today. The only invalid case is `start === end`, which `campaign.logic.ts:66`
rejects as a zero-width window. So `TimeField` enforces exactly one rule -
start must not equal end - and when end < start the control shows a
"ข้ามคืน" hint so the wrap reads as intentional rather than as a typo.

**The daily times are Bangkok wall clock; the datetime fields are instants.**
`campaign.logic.ts:18` documents `daily_start_time` as `'HH:MM:SS' Bangkok wall
clock`, and `bangkokParts` (`:27-33`) shifts by a fixed `BANGKOK_OFFSET_MIN`,
ignoring both the server's and the browser's timezone. `starts_at` / `ends_at`
are real instants rendered in browser-local time. Two different time semantics
sit inches apart on the same form. `TimeField` therefore performs NO timezone
conversion - it is a plain `HH:MM` string - and its label reads "(เวลาไทย)"
so an admin on a non-Bangkok device is not silently misled.

**`news.publishedAt` is unbounded in both directions on purpose.** Past values
back-date an article, which is ordinary editorial work. Future values are the
scheduling mechanism: `news.service.ts:273` computes
`isPublished = published_at !== null && published_at.getTime() <= Date.now()`,
so a future date means "not published yet". Adding `disablePast` here would
remove back-dating; adding a `max` would remove scheduling. Neither is a
tidy-up, both are regressions.

The 1-year ceiling is a guard against a typo turning a สิ้นเดือน sale into a
2569-vs-2026 mistake, not a product limit. It is a constant in one place so it
can be raised. Where it is anchored to a companion field that is still empty
(a new campaign where the owner fills the end first, `campaigns/page.tsx:61`
initialises `startsAt: ''`), it falls back to `now` - never `new Date('')`.

**products / lootboxes sale end is one branch of a two-mode control.**
`products/page.tsx:6-9` drives it through `deriveSaleDuration` /
`defaultSaleEndInput` against a duration input, and the owner toggles between
"release for N units of time" and "release until this date". `DateTimeField`
replaces only the end-date branch. `deriveSaleDuration`'s round trip must keep
working unchanged, or the sale-duration bug regresses - that helper is what
makes a 60-day sale reopen as "60 days" instead of "60 นาที".

## E2. Data seams and grid conventions

Four details that break against real data if left implicit.

**Clearing an optional field.** `news.publishedAt`, `news.expiresAt`,
`rewards.visibleFrom` and `rewards.visibleUntil` are all `optionalDate`
(`schemas.ts:272`, `:381`). Native `datetime-local` has a built-in clear; a
trigger button that only opens a calendar would strip that capability, leaving
an owner unable to return an article to "no expiry". `DateTimeField` therefore
takes `clearable` and renders a "ล้าง" control in the surface footer plus an ×
on the trigger once a value is set. `campaigns.startsAt` / `endsAt` are
non-optional (`schemas.ts:345-346`, bare `z.coerce.date()`) and pass
`clearable={false}`.

**The daily times arrive as `HH:MM:SS`, not `HH:MM`.**
`migrations/032_campaign_points.sql:24` declares `daily_start_time TIME`, mysql2
returns `'14:30:00'`, and `campaigns/page.tsx:190` seeds the form with that value
untouched. Native `<input type="time">` tolerates the seconds, which is why this
has never surfaced. `TimeField` must normalise on read (`slice(0, 5)`) and emit
`HH:MM` on write. Both ends accept it: `schemas.ts:347` matches
`HH:MM(:SS)?`, and `timeToMinutes` (`campaign.logic.ts:36`) splits and reads only
the first two parts. Skipping the normalisation renders every existing campaign
with a daily window as empty.

**The calendar week starts MONDAY.** Thai calendars conventionally start Sunday,
so this is the counter-intuitive choice and has to be stated. The precedent is
on the same form: `campaigns/page.tsx:70` renders
`DAY_LABELS = ['จ','อ','พ','พฤ','ศ','ส','อา']`, and both
`campaigns/page.tsx:89` and `campaign.logic.ts:30` compute `weekdayMon0`. A
Sunday-first calendar would sit directly above a Monday-first weekday selector
inside one modal.

**products renders the sale-end field twice from one state.**
`products/page.tsx:925` and `:1361` both bind `saleEndDatetime` declared at
`:276`. Both sites are replaced, or the page keeps a native input in one of its
two modals.

**Minute granularity.** The spinner arrows step 5 minutes; typing accepts any
value. Five is right for a daily bonus window and does not block an exact sale
end.

## F. Presets

Row of chips above the calendar: วันนี้ / พรุ่งนี้ / +7 วัน / +30 วัน /
สิ้นเดือนนี้. A preset that resolves outside the field's bounds is not rendered,
so a preset can never produce an invalid value. Presets set date and time
together and close the surface, which is the one-tap path for the common case.

## G. Surfacing the rules

- Disabled days are visually distinct (muted + `cursor-not-allowed` +
  `aria-disabled`), not merely inert. A day you cannot click and cannot tell
  apart from one you can reads as a broken calendar.
- The trigger shows the formatted Thai value, e.g. `13 ส.ค. 2569 14:30`, or a
  placeholder.
- Cross-field violations show an inline message under the field in Thai.
- No em dash anywhere in user-facing copy (`THEME.md`); use `-`, `:` or
  parentheses.
- Font Awesome for the calendar/clock glyphs, matching the surrounding admin
  pages (`ICONS.md`: FA primary in the shop frontend, never emoji).

## H. Accessibility and keyboard

- Trigger is a `<button aria-haspopup="dialog" aria-expanded>`.
- **Focus behaviour differs by breakpoint, and the two must not be conflated.**
  The desktop popover is non-modal: `role="dialog" aria-modal="false"`, focus
  moves to the selected day on open, and Tab is NOT trapped - it closes the
  surface and moves to the next field, which is how a keyboard user leaves a
  date input. Trapping focus there would turn the form into a dead end.
  Under 640px the bottom sheet has a backdrop and IS modal: focus is trapped,
  `aria-modal="true"`, and Tab cycles within the sheet.
- Focus returns to the trigger on close in both cases.
- Arrow keys move by day, PageUp/PageDown by month, Home/End to week bounds,
  Enter selects, Esc closes without committing.
- Disabled days are skipped by arrow navigation rather than landing on a dead
  cell.
- The grid is a `<table role="grid">` with `aria-selected` on the chosen day.

## Testing

The frontend has no test runner (`package.json` has no `test` script), so the
pure modules are verified by a checked-in script run under
`node --experimental-strip-types`, the same approach used for the dashboard
chart's `scale.ts`:

- `thaiDate.ts`: พ.ศ. conversion either way; a local->ISO->local round trip is
  lossless in a non-UTC zone (the sale-duration bug in miniature); month lengths
  including a leap February; midnight and 23:59 boundaries.
- `constraints.ts`: `disablePast` with and without `originalValue`; `min` later
  than `now`; `max` earlier than `min` (contradictory bounds must fail closed,
  not silently invert); cross-field pairs from both directions; clamping; an
  empty companion field falling back to `now` rather than `new Date('')`;
  a stored value beyond `max` (the multi-year sale case) staying reachable.
- Pair-bound strictness: start equal to end is rejected; one minute apart is
  accepted.
- Reachability extends `policyMax` but never `pairMax`: the scheduled-campaign
  case above must NOT allow start after end.
- `min` and `disablePast` together: a field with both floors at the LATER of
  the two, never at `now` alone (the `campaigns.endsAt` case).
- Boundary-day clamping: with `min` at 14:00 today, 09:00 today is rejected and
  14:00 today is accepted; the mirror case at `max`.
- `originalValue` cleared on create: an edit followed by a create does not
  inherit the edited record's floor.
- `TimeField` normalisation: `'14:30:00'` in renders as `14:30` and writes back
  `'14:30'`; `start === end` rejected; `end < start` accepted and flagged as
  ข้ามคืน.

Manual: open each of the 6 pages, confirm the surface is not clipped inside the
scrolled modal, confirm a running campaign reopens with its past start intact and
still saves, confirm the backend Zod refines are never reached because the UI
prevents the reversed window first.

Rollout follows the usual path: worktree, Docker build as the real gate,
`manage-customer.sh rebuild` per shop, suspended shops skipped. No migration:
this change is frontend-only.
