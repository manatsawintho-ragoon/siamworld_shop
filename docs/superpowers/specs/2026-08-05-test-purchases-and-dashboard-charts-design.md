# Test purchases + dashboard chart redesign

Date: 2026-08-05
Branch: `feat/test-purchases-dashboard-charts`

## Problem

Two problems, both on the shop's own admin dashboard (not the SaaS panel).

**1. Admin test buys pollute the numbers.** A shop owner buys their own item to
confirm the RCON command actually delivers it in-game. That purchase is
indistinguishable from a real sale, so it inflates the product's public
`sold_count`, the dashboard revenue, top-products, the charts and the
month-over-month comparison. The owner cannot verify delivery without corrupting
their own analytics.

The codebase is already inconsistent about this: `getFinancialSummary()` and
`comparison.spent` filter `u.role != 'admin'`, but the other ~20 aggregates on
the same page do not. So the dashboard already disagrees with itself.

**2. The timeline chart is not usable.** `admin/page.tsx:50-174` hand-rolls an
SVG line chart that plots member counts and Baht amounts on one shared Y axis.
With realistic data (5 new members, 5,000 Baht revenue) the member line is
pinned flat against zero and carries no information. It also renders 30 X labels
into a 700px viewBox and sets `preserveAspectRatio="none"`, which stretches
every stroke, dot and text node by the card's aspect ratio.

## Decisions

| Question | Decision |
|---|---|
| How to identify a test purchase | Persisted `is_test` flag stamped at purchase time |
| What counts as test | Shop purchases + loot box opens by an `admin` |
| Admin top-ups | NOT marked - they still count as income |
| Redeem code uses | NOT marked |
| Stock consumption | Test buys do NOT consume `stock_limit` |
| Where test rows stay visible | `/admin/purchases` only, badged + filterable |
| Existing history | Backfilled from current role at migration time |
| Chart tech | Hand-rolled SVG extracted into a chart module, no new dependency |
| Chart layout | Stacked panels sharing one X axis and one crosshair |
| Timeline | Explicit date range caption + 7/30/90d/week/month presets + tick thinning |
| Redesign scope | The chart card and the data-viz cards around it |

### Why a persisted flag and not a role join

Role-at-query-time rewrites history. Promote a long-time player to moderator or
admin and every real purchase they ever made retroactively vanishes from the
shop's revenue. Demote an admin and their test buys become revenue. A flag
stamped at insert time snapshots what was true when the money moved, which is
the only thing an accounting number can honestly mean.

It is also cheaper: `sold_count` is a correlated subquery evaluated per product
row on the shop listing. Adding a `users` join to it multiplies the work on the
hottest read path in the app.

## A. Data model

`migrations/037_test_purchases.sql`:

```sql
ALTER TABLE purchases     ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE web_inventory ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE transactions  ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE purchases     ADD KEY idx_prod_status_test (product_id, status, is_test);
ALTER TABLE web_inventory ADD KEY idx_wi_box_test (loot_box_id, is_test);
ALTER TABLE transactions  ADD KEY idx_tx_type_status_test (type, status, is_test);

-- backfill: rows bought by anyone who is an admin as of now
UPDATE purchases p     JOIN users u ON u.id = p.user_id SET p.is_test = 1 WHERE u.role = 'admin';
UPDATE web_inventory w JOIN users u ON u.id = w.user_id SET w.is_test = 1 WHERE u.role = 'admin';
UPDATE transactions t  JOIN users u ON u.id = t.user_id
   SET t.is_test = 1 WHERE u.role = 'admin' AND t.type = 'purchase';
```

The migration must be idempotent to survive `apply-migrations.sh` re-runs and to
tolerate a shop that already has the column. MySQL 8.0 has no
`ADD COLUMN IF NOT EXISTS`, so each `ALTER` is guarded by an
`information_schema.COLUMNS` / `.STATISTICS` check executed through a prepared
statement, following the pattern already used in earlier migrations.

Note the backfill only touches `transactions` rows of `type='purchase'`. Admin
`topup` rows stay `is_test = 0` by decision, so admin self-credits keep counting
as income.

### Why `transactions` needs the flag

Gacha revenue is not read from `web_inventory`. It is read from `transactions`
matching `description LIKE 'เปิดกล่อง%'` (`admin-stats.service.ts:9` and `:205`).
Excluding an admin's test box-open from revenue therefore has to happen on the
`transactions` row, or the query needs a `users` join and we are back to
role-at-query-time. Flagging the transaction keeps every analytics query on one
uniform predicate: `is_test = 0`.

## B. Stamping

New module `backend/src/services/test-purchase.ts`:

```ts
/** Single definition of "this purchase is a test, keep it out of the numbers". */
export const isTestBuyer = (role?: string | null): boolean => role === 'admin';
```

`middleware/auth.ts:73` already attaches a DB-fresh `role` to `req.user` (it is
re-read on every request for ban/delete checks, so it costs nothing extra).
Routes pass it down:

- `shop.routes.ts` → `shopService.buyProduct(..., buyerRole)` → stamps the
  `purchases` row and the matching `transactions` row inside the existing
  transaction.
- `lootbox.routes.ts` → `lootBoxService.openBox(..., buyerRole)` → stamps the
  `web_inventory` row and the matching `transactions` row.
- `reward.service.ts` also inserts into `web_inventory` (reward-shop
  redemptions). It takes the same parameter for consistency so the column is
  never left ambiguous.

A gift purchase is judged by the **buyer's** role, not the recipient's: the
admin is the one testing, and the money left the admin's wallet.

Refunds flip `status`, never `is_test`. A refunded test buy stays a test buy.

## C. Read paths that filter on the flag

**Stock (test buys do not consume stock):**
- `shop.service.ts:29` `remainingStock()` → `AND is_test = 0`
- `loot-box.service.ts:31` `soldCount()` → `AND is_test = 0`

**Public sold counters (the "shows 0" the customer sees):**
- `shop.service.ts:352, 401, 435`
- `public.routes.ts:180, 200`

**Dashboard (`admin-stats.service.ts`), everything:** the 21 scalar aggregates,
`topProducts`, `topLootBoxes`, `recentPurchases`, `recentTransactions`,
`monthlyChart` / `dailyChart` / `weeklyChart`, all 7 `compareDefs`, `spentSql`,
and the `activityFeed` union.

`getFinancialSummary()` and `spentSql` drop their `u.role != 'admin'` joins and
use `is_test = 0` instead, so the whole page finally agrees with itself.

**Deliberately NOT filtered:** `/admin/purchases` keeps every row. That page
owns `rcon_response`, so it is where the owner confirms the test delivery
actually worked. It gains a `ทดสอบ` badge and a ทั้งหมด / ขายจริง / ทดสอบ filter.

### Drive-by fix

`public.routes.ts:180` computes `sold_count` as `COUNT(pu.id)` while
`shop.service.ts:352` computes it as `SUM(pu.quantity)`. A single 5-unit order
therefore reads as "1 sold" on the featured list and "5 sold" on the shop page.
Both lines are being edited for the `is_test` filter anyway, so they get aligned
on `SUM(quantity)`.

## D. Series endpoint

`GET /api/admin/stats/series?range=7d|30d|90d|week|month`

The three baked-in series (`dailyChart`, `weeklyChart`, `monthlyChart`) leave
`getDashboardStats()`, so the dashboard's first paint gets lighter even though
the feature adds two more presets. The client fetches a series on toggle and
caches what it has already seen.

Response:

```ts
{
  range: '30d',
  from: '2026-07-07',          // ISO, for the date-range caption
  to:   '2026-08-05',
  points: [{ key, label, newUsers, topupAmount, revenueAmount }, ...]
}
```

The existing queries build their calendar spine as an inline
`SELECT 0 n UNION SELECT 1 UNION ...` — already 30 lines, and 90 for a quarter
view. That is replaced by one grouped query per metric plus a zero-filled spine
built in TypeScript:

```sql
SELECT DATE(created_at) d, COALESCE(SUM(price),0) v FROM purchases
 WHERE status='delivered' AND is_test=0 AND created_at >= ? GROUP BY d
```

**Timezone:** the spine is anchored to a `SELECT CURDATE()` read from MySQL, not
to the Node process clock. The containers and the DB can disagree about the
date, and an off-by-one spine silently drops today's row. Bucketing stays on
MySQL's `DATE()` in the DB's own timezone, matching the existing behaviour.

## E. Chart module

```
frontend/src/components/admin/charts/
  scale.ts           niceTicks(), linearScale(), thinTicks()
  ChartFrame.tsx     ResizeObserver → true-pixel viewBox, grid, Y/X axes
  AreaSeries.tsx     gradient area + line
  BarSeries.tsx      members panel
  Crosshair.tsx      pointer + keyboard tracking, guide line, HTML tooltip
  TimelineChart.tsx  two stacked panels, one shared crosshair
  RangeTabs.tsx      presets + date-range caption
```

Each piece is independently testable: `scale.ts` is pure functions,
`ChartFrame` takes dimensions and ticks, series components take scaled points.
`admin/page.tsx` stops carrying 125 lines of chart internals.

Layout: a tall Baht panel (item revenue + top-ups) over a short new-members bar
panel, sharing one X axis and one crosshair. Each panel gets its own correctly
scaled Y axis. Stacked panels rather than a dual Y axis because dual axes let
the scale choice imply a correlation that is not in the data.

Fixes, each against something concretely wrong today:

- **Drop `preserveAspectRatio="none"`.** Measure the container and render at
  real pixel size, so a 2px stroke is 2px regardless of card width.
- **HTML tooltip, not SVG `<text>`.** The current one hand-positions `<rect>`
  and `<text>` at fixed offsets and is stretched along with everything else.
- **Thin the X axis to ~7 labels**, emphasise month boundaries, mark today.
- **`niceTicks` on the Y axis**, so labels are `0 / 2k / 4k / 6k` and not
  `0 / 2418 / 4837`.
- **Real empty state** - "ยังไม่มีข้อมูลในช่วงนี้" rather than three flat lines at
  zero, which reads as a broken page.
- **Legend chips toggle a series** on click.
- **Accessible**: `role="img"` + summary label, a visually-hidden data table,
  arrow-key crosshair movement.

Light mode only. `THEME.md`: the admin panel keeps its own neutral palette and
must not follow the customer theme (no `data-theme-portal`, no `.frontend-page`).

## F. Surrounding cards

Top products, top loot boxes and the rank widgets get the same bar treatment and
type scale as the chart so the section reads as one system.

`admin/page.tsx:176` `const medals = ['🥇','🥈','🥉']` becomes numbered rank
badges: `.agents/context/ICONS.md` says never use emoji in UI.

No em dash in any Thai user-facing string (`THEME.md`).

## Testing

- `scale.ts` unit tests: `niceTicks` on 0, 1, 4837, 1e6; `thinTicks` when the
  label count is below, equal to and far above the budget.
- Backend jest: `isTestBuyer`; series spine zero-fills gaps and includes today.
- Manual: buy as admin → product `sold_count` stays 0, stock unchanged,
  dashboard unchanged, row visible under ทดสอบ in `/admin/purchases` with its
  `rcon_response`. Buy as a normal player → all counters move.

## Rollout

Migration **before** rebuild, per `project_campaign_points`: `rebuild` builds the
image first and migrates after, so a rebuild-first order runs new code against
an old schema. Suspended shops are skipped entirely
(`feedback_suspended_shops`), and deploys go through
`deploy/manage-customer.sh`, never a hand-rolled `docker build`
(`feedback_customer_deploy`).
