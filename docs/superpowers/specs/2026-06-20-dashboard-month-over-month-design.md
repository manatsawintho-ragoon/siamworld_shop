# Dashboard Month-over-Month Comparison — Design

**Date:** 2026-06-20
**Scope:** Customer website admin dashboard only (`/admin`). No DB migration.

## Problem

The admin dashboard headline KPIs (`totalTopups`, `totalRevenue`, `totalUsers`, …)
are lifetime-cumulative and never reset. There is no last-month comparison and no
+/- % change anywhere. The operator wants the dashboard to be month-focused
(auto-reset each calendar month), still show last month's figures, and show on
every card whether the metric went up or down, by how much, and by what %.

## Decisions (confirmed)

1. Headline cards show **this month** as the primary number, with the lifetime
   total shown small underneath.
2. Comparison baseline = **all of the previous calendar month**.
3. Status indicator = **arrow + up/down color + %** on every card.

## Backend — `admin-stats.service.ts`

Add a `comparison` object to `getDashboardStats()`. Boundaries:

- `thisStart = DATE_FORMAT(CURDATE(), '%Y-%m-01')`
- `lastStart = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01')`

Per metric, one query using conditional aggregation, scan limited to
`created_at >= lastStart`:

```sql
SELECT
  COALESCE(SUM(CASE WHEN created_at >= :thisStart THEN <expr> END), 0) AS this_month,
  COALESCE(SUM(CASE WHEN created_at >= :lastStart AND created_at < :thisStart THEN <expr> END), 0) AS last_month
FROM <table>
WHERE <filters> AND created_at >= :lastStart
```

Metrics (each → `{ thisMonth, lastMonth, delta, pct }`):

| key | source |
|-----|--------|
| `topups` | `transactions` type=topup, status=success, SUM(amount) |
| `itemRevenue` | `purchases` status=delivered, SUM(price) |
| `gachaRevenue` | `transactions` type=purchase, status=success, desc LIKE 'เปิดกล่อง%', SUM(ABS(amount)) |
| `newUsers` | `users`, COUNT(*) |
| `itemsSold` | `purchases` status=delivered, SUM(quantity) |
| `lootboxOpened` | `web_inventory`, COUNT(*) (uses `won_at`) |
| `redeemUsed` | `redeem_logs`, COUNT(*) (uses `redeemed_at`) |
| `spent` | item + gacha by non-admin users, SUM |

Derived per metric:
- `delta = thisMonth - lastMonth`
- `pct = lastMonth > 0 ? round(delta / lastMonth * 100, 1) : (thisMonth > 0 ? 100 : 0)`

Lifetime totals already in the response stay (shown small). Existing
`month*`/`today*` fields remain for backward compatibility.

Note: `web_inventory` and `redeem_logs` order by `won_at` / `redeemed_at`, not
`created_at` — comparison queries must use those columns.

## Frontend — `admin/page.tsx`

- Add `comparison` to the `Stats` interface (typed `CompareMetric` map).
- New reusable `DeltaBadge` component:
  - up → `fa-arrow-up` green, `+<delta> (+<pct>%)`
  - down → `fa-arrow-down` red, `-<delta> (-<pct>%)`
  - flat / no baseline → gray dash, `0%` or "ไม่มีข้อมูลเดือนก่อน"
  - secondary line: "เดือนที่แล้ว <value>"
  - currency vs count formatting via a prop.
- Headline cards (ยอดเติม / รายได้ Item / รายได้ Gacha): primary number = this
  month; small "สะสม <lifetime>" line; footer = `DeltaBadge`.
- Other KPI cards get the matching `DeltaBadge` in their footer.
- Small month label "ข้อมูลเดือน <Thai current month>" next to the Live badge.
  Existing "อัพเดท HH:MM:SS" + 60s auto-refresh + manual refresh stay.

## Out of scope

Charts, rankings, recent lists, financial-summary endpoint — unchanged.
No schema/migration changes.

## Edge cases

- Divide-by-zero when `lastMonth = 0` → handled by `pct` rule above.
- Negative deltas render red/down.
- Brand-new shop (both months empty) → badge shows neutral "—".
