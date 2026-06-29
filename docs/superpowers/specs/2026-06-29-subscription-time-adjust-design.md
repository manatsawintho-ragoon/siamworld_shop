# Subscription Time Adjustment (+/-) Design

Date: 2026-06-29
Branch: feat/subscription-time-adjust
Scope: Panel (siamworld_shop/panel)

## Goal

Let the operator add or subtract time on a customer subscription directly from the
admin customers page, for compensation, special promotions, or corrections. The
adjustment is relative (+/- days), records an optional reason/tag, and can
optionally surface a popup to the customer in their panel dashboard (UX modeled on
the existing announcements system: a tag/level badge + body text).

## Decisions (from brainstorming)

- Adjust `expires_at` directly in days. Does NOT touch the wallet (no conversion to
  credit).
- Reason and category/tag are OPTIONAL (not enforced).
- Customer popup is OPTIONAL per adjustment (`notify_customer` checkbox). When set,
  the customer sees a one-time popup in `/dashboard` with the tag badge + reason,
  and dismisses it (marks seen).
- Adding time to a `suspended`/`expired` shop whose new expiry is in the future also
  brings the shop back online (mirrors the renew flow's unsuspend).
- Subtracting time is allowed even past now (for corrections); not blocked.
- No scheduled/future-dated adjustments. No email (popup only).

## Data Model

New migration `panel/database/migrations/016_subscription_adjustments.sql`
(idempotent, follows the existing migration style):

```
subscription_adjustments
  id               INT AUTO_INCREMENT PK
  subscription_id  INT NOT NULL              -- FK to subscriptions(id)
  admin_user_id    INT NULL                  -- panel_users(id) who made the change
  delta_days       INT NOT NULL              -- signed (+ extend, - reduce)
  old_expires_at   TIMESTAMP NULL
  new_expires_at   TIMESTAMP NULL
  category         VARCHAR(20) NULL          -- compensation|promotion|correction|goodwill
  reason           TEXT NULL
  notify_customer  TINYINT(1) NOT NULL DEFAULT 0
  customer_seen_at TIMESTAMP NULL            -- when the customer dismissed the popup
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  INDEX idx_sub (subscription_id)
  INDEX idx_notify (subscription_id, notify_customer, customer_seen_at)
```

One table serves both the audit/history view (admin) and the customer popup queue.

## Backend (`panel/backend/src`)

### subscription.service.ts

- `adjustTime(subscriptionId, adminUserId, deltaDays, opts, ip)` where
  `opts = { category?, reason?, notifyCustomer }`:
  1. Validate `deltaDays` is a non-zero integer within a sane bound (abs <= 3650).
  2. In a transaction: `SELECT ... FOR UPDATE` the subscription, read `expires_at`
     (fallback to now if null), compute `newExpiry = expires_at + deltaDays`,
     `UPDATE subscriptions SET expires_at = ?`, insert the adjustment row. Commit.
  3. After commit: if the shop was `suspended`/`expired` and `newExpiry > now`,
     bring it back online (startShop + customDomain onResume, same fallback as renew).
  4. `logAudit(adminUserId, 'sub_adjust_time', 'subscription', subId, details, ip)`.
  5. Return `{ oldExpiry, newExpiry, deltaDays }`.
- `getAdjustments(subscriptionId)` -> recent adjustment rows for the admin history list.
- `getCustomerNotifications(userId)` -> unseen rows (`notify_customer=1 AND
  customer_seen_at IS NULL`) joined to subscriptions owned by `userId`, returning
  shop_name, delta_days, category, reason, created_at.
- `markNotificationSeen(userId, adjustmentId)` -> set `customer_seen_at=NOW()` only
  if the adjustment belongs to a subscription owned by `userId` (ownership check).

### Routes

admin.routes.ts (requireAdmin):
- `POST /admin/subscriptions/:id/adjust-time` body `{ deltaDays, category?, reason?, notifyCustomer? }`
- `GET  /admin/subscriptions/:id/adjustments`

subscription.routes.ts (requireAuth):
- `GET  /subscriptions/notifications`
- `POST /subscriptions/notifications/:id/seen`

## Frontend (`panel/frontend/src`)

### Admin: app/admin/customers/page.tsx (ManageModal)

Add an "ปรับเวลา" section to the manage modal:
- Quick buttons: +1 / +7 / +30 and -1 / -7 days.
- Custom numeric input with a +/- toggle.
- Optional category dropdown (4 tags) and optional reason textarea.
- Checkbox "แจ้งลูกค้าเป็น popup".
- Live preview of the resulting expiry date.
- A compact history list (last few adjustments) loaded from the adjustments endpoint.
- Submits via `POST /api/admin/subscriptions/:id/adjust-time`, then reloads.

### Customer: app/dashboard/page.tsx

On load, `GET /api/subscriptions/notifications`. If any unseen, show a popup modal
(reusing the announcement popup look: tag/level badge color + reason text + shop
name + delta). Dismiss calls `POST /api/subscriptions/notifications/:id/seen`.

## Reuse / Conventions

- Tag colors mirror the announcement `level` badge palette.
- Admin modal styling follows the existing ManageModal/THEME.
- No em dash in any user-facing string (use `-`, `:`, parentheses).
- Audit logging uses the existing `logAudit` signature.

## Out of Scope (YAGNI)

- Wallet credit conversion, scheduled adjustments, email notifications, bulk
  time-adjust across multiple shops.
