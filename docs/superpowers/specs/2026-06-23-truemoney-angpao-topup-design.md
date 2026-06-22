# TrueMoney Wallet Angpao Top-up Gateway — Design

Date: 2026-06-23
Status: Approved (brainstorming) — pending implementation plan

## 1. Goal

Add a second top-up payment gateway to the **customer shop** (siamworld_shop)
alongside the existing PromptPay/EasySlip flow: **TrueMoney Wallet Angpao**
(ซองของขวัญ / gift voucher).

A player creates a TrueMoney angpao gift link and pastes it into the shop. The
backend redeems that voucher **into the shop's own TrueMoney wallet** and credits
the player's wallet with the exact amount TrueMoney reports as redeemed.

Reference for the redeem mechanism: `https://github.com/pichxyaponn/tw-angpao`
(ported natively into the backend — no external microservice).

### Scope boundaries

- **Customer shop only** (`backend/` + `frontend/`). **No changes to the SaaS
  panel.** Nothing in this spec touches the panel codebase.
- Reuses the existing disabled scaffold: `redeemTrueMoney` stub, the
  `/payment/truemoney/redeem` route, `trueMoneyRedeemSchema`, the frontend
  `truemoney` step, and the `truemoney_wallet.png` asset.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|----------|----------|
| Where | siamworld_shop, complete the existing stub |
| Redeem method | Native in-backend service (mirror `easyslip.service.ts`) |
| Top-up bonus multiplier | **Applies** (same as slips) |
| Discount/promo codes | **Do not apply** to TrueMoney top-ups |
| Min/max amount bounds | **None** — credit whatever real amount TrueMoney reports (amount must be > 0) |
| UX | Single-step: paste gift link, no amount entry |
| Tests | Add a focused **ts-jest** harness for the security-critical logic |

## 3. Why this is secure (parity with PromptPay)

TrueMoney redemption is actually a **stronger** trust model than slip OCR:

- The voucher is redeemed **server-side into the shop's own wallet**. TrueMoney
  is the source of truth for the amount — there is no "fake slip"/OCR surface.
- **Single-spend is enforced at the source.** A voucher can be redeemed
  successfully exactly once; a second (even concurrent) redeem returns an error
  (`TARGET_USER_REDEEMED` / `VOUCHER_OUT_OF_STOCK`). On top of that we add a DB
  `UNIQUE(voucher_hash)` guard for retry/race safety, so no double-credit is
  possible.
- **Atomic wallet credit** with `SELECT ... FOR UPDATE` row lock, identical to
  the slip flow.
- **Ledger records real money** (`transactions.amount` = redeemed amount); the
  bonus only inflates the spendable wallet balance / `wallet_logs`.
- **Auth (JWT) + 30s per-user cooldown** on the redeem route to rate-limit
  abuse of the external API (same as `/slip/verify`).
- The shop's wallet **phone number is never returned raw** to clients (it is not
  even needed client-side — the backend supplies it).
- Strict input validation (phone format, voucher-hash regex) with Thai error
  messages.

### Reconciliation safety (the one non-idempotent edge)

Redemption moves real money and is **not idempotent** — once TrueMoney returns
`SUCCESS`, the money is already in the shop wallet. If our DB credit then fails
(e.g. DB hiccup) the money is in the shop wallet but the player is not yet
credited. We handle this by firing a loud `topup_failed` notification carrying
the `voucher_hash` + `amount` so an admin can credit manually. This is the same
"never silently lose money" posture the slip flow uses.

## 4. Components

### 4.1 `backend/src/services/truemoney.service.ts` (new)

Mirrors the structure and hardening of `easyslip.service.ts`.

- **HTTP transport:** reuse the proven **HTTP/2 + IPv4-first DNS resolve + 30s
  timeout** pattern from `easyslip.service.ts`. `gift.truemoney.com` is behind
  Cloudflare too, so the same TLS-fingerprint/IPv6 hardening applies.
  - `POST https://gift.truemoney.com/campaign/vouchers/{voucher_hash}/redeem`
  - Body: `{ "mobile": <shop phone>, "voucher_hash": <hash> }`
  - `content-type: application/json`
- **`extractVoucherHash(linkOrHash): string`** — split on `?v=`, take the
  param (fallback to the whole string), then match `[0-9A-Za-z]+` and return the
  first run. Throws a typed error if nothing valid is found.
- **`normalizePhone(phone): string`** — strip non-digits; convert `66XXXXXXXXX`
  → `0XXXXXXXXX`; validate against `^0[689]\d{8}$`. Throws if invalid.
- **Status-code mapping → `TrueMoneyApiError`** with Thai messages:
  - `VOUCHER_NOT_FOUND` → "ไม่พบซองของขวัญนี้ ลิงก์อาจไม่ถูกต้อง"
  - `VOUCHER_EXPIRED` → "ซองของขวัญนี้หมดอายุแล้ว"
  - `VOUCHER_OUT_OF_STOCK` → "ซองของขวัญนี้ถูกรับไปหมดแล้ว"
  - `TARGET_USER_REDEEMED` → "ซองนี้ถูกใช้ไปแล้ว"
  - `CANNOT_GET_OWN_VOUCHER` → "ไม่สามารถรับซองของตัวเองได้"
  - network/JSON/unknown → connection error (HTTP 503-style) with retry hint.
- **Return shape:** `{ amount: number, voucherHash: string, ownerName?: string }`
  (amount parsed from the TrueMoney response `data` block).

### 4.2 `payment.service.ts` → `redeemTrueMoney(userId, giftLink)` (replaces stub)

Security layers paralleling `verifySlip`:

- **L0 Config:** read `truemoney_enabled` + `truemoney_phone` from settings;
  reject with a clear Thai message if disabled or phone unset.
- **L1 Parse:** `extractVoucherHash(giftLink)`; reject malformed input.
- **L1b Pre-dedup:** if `voucher_hash` already exists in `truemoney_logs`,
  reject *before* making the external call (saves an API round-trip and gives a
  precise "already used" message).
- **L2 Redeem:** `truemoneyService.redeem(shopPhone, hash)` → real `amount`.
  Map all TrueMoney errors to Thai messages.
- **L3 Sanity:** `amount > 0` (no min/max bounds per decision).
- **L4 Atomic credit** (single DB transaction, mirrors slip Layer 7):
  1. `INSERT INTO truemoney_logs (...)` — the `UNIQUE(voucher_hash)` constraint
     is the authoritative retry/race guard; a duplicate-key error here →
     `ConflictError` "ซองของขวัญนี้ถูกใช้ไปแล้ว" with **no** wallet change.
  2. `SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE`.
  3. Bonus: `creditAmount = amount * multiplier` when
     `topup_bonus_enabled` and `multiplier > 1`.
  4. `UPDATE wallets SET balance = balanceAfter`.
  5. `INSERT INTO wallet_logs` (action `credit`, source `truemoney`,
     reference = voucher hash, description includes bonus note).
  6. `INSERT INTO transactions` (type `topup`, method `truemoney`,
     status `success`, **amount = real redeemed amount**, not bonus-inflated).
  7. `commit`.
- **Notifications:** `topup_success` on success (username, amount paid, credited
  + bonus, balance after, owner name, voucher hash). `topup_failed` on the
  rare post-redeem credit failure (for manual reconciliation).
- Returns `{ amount: creditAmount, paid_amount: amount, multiplier, voucherHash,
  balanceAfter, ownerName }`.

### 4.3 Migration `migrations/027_truemoney_logs.sql`

Idempotent, follows the `apply-migrations.sh` / `schema_migrations` convention
(auto-run in `new-customer.sh` / rebuild).

```sql
CREATE TABLE IF NOT EXISTS truemoney_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  voucher_hash VARCHAR(64) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  owner_name VARCHAR(255) NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tmn_user (user_id)
);
```

### 4.4 Settings & Admin Payment Settings

- New settings keys: `truemoney_enabled` (`'true'`/`'false'`), `truemoney_phone`
  (normalized `0XXXXXXXXX`).
- `admin.routes.ts`: include the two keys in the payment-settings save batch;
  validate `truemoney_phone` against `^0[689]\d{8}$` when enabled.
- `frontend/src/app/admin/payment-settings/page.tsx`: add a **TrueMoney**
  section — enable toggle + phone input (with the `08x-xxx-1234` mask shown
  read-back). This is the customer shop's own admin UI, **not** the panel.

### 4.5 Public settings exposure

- Add **`truemoney_enabled`** to `publicKeys` in `public.routes.ts` so the
  top-up page can show/hide the TrueMoney method. (For symmetry we also surface
  `promptpay_enabled`.) **`truemoney_phone` is never exposed.**

### 4.6 Route & schema

- `payment.routes.ts`: the `/payment/truemoney/redeem` route already exists; add
  `purchaseCooldown(30, 'truemoney')` (rate-limit, same as `/slip/verify`).
- `schemas.ts`: loosen `trueMoneyRedeemSchema` to accept **either** a TrueMoney
  gift URL **or** a raw voucher hash:
  `giftLink: z.string().min(1).max(2048)` plus a `.refine()` that it contains a
  redeemable hash (delegated to `extractVoucherHash`, which is the single source
  of truth for parsing).

### 4.7 Frontend top-up page (`frontend/src/app/topup/page.tsx`)

- Remove the `if (m === 'truemoney') return;` disable so the method is
  selectable; gate the TrueMoney method tile on `truemoney_enabled` from public
  settings (and gate PromptPay on `promptpay_enabled`).
- The `truemoney` step shows:
  1. A gift-link input (already present) + submit → `POST /payment/truemoney/redeem`.
  2. **"ขั้นตอนการสร้างซอง"** — a 5-step illustrated guide using the existing
     images in `frontend/public/images/`:
     `truemoney-sendgift-icon-20240521-how-to-create-1.png` … `-5.png`.

     | # | ข้อความ | รูป |
     |---|---------|-----|
     | 1 | เข้าแอป TrueMoney Wallet เลือก "ส่งซองของขวัญ" | `...-1.png` |
     | 2 | ระบุจำนวนเงินที่ต้องการเติม | `...-2.png` |
     | 3 | เลือก "แบ่งจำนวนเงินเท่ากัน" | `...-3.png` |
     | 4 | ระบุจำนวนคนรับซอง "1 คน" | `...-4.png` |
     | 5 | กดยืนยัน คัดลอกลิงก์มาวางในช่องด้านบน | `...-5.png` |

  3. On success → `success` step showing credited amount (+bonus note when
     applicable), styled like the slip success.
- UI follows the project theme conventions (Font Awesome icons, no emoji, no
  em dashes in user-facing text).

## 5. Testing (new ts-jest harness)

Add `ts-jest` + `jest` as devDependencies and a `test` script. Cover the
security-critical logic:

- **Pure functions:** `extractVoucherHash` (full URL, `?v=` param, raw hash,
  garbage → throws); `normalizePhone` (`0XXXXXXXXX`, `66XXXXXXXXX`, `+66...`,
  invalid → throws); status-code → `TrueMoneyApiError` mapping.
- **Service (mocked HTTP):** success returns correct amount; expired / not-found
  / out-of-stock / already-redeemed → correct typed errors; network error →
  connection error.
- **`redeemTrueMoney` (mocked service + DB):** success credits amount × bonus,
  ledger records real amount; duplicate `voucher_hash` → `ConflictError`, no
  double credit; disabled/unconfigured → validation error.

Fallback if the harness is rejected later: manual verification with a real ฿1
angpao against a staging shop.

## 6. Out of scope

- Panel (SaaS management app) changes of any kind.
- Discount-code support on TrueMoney top-ups.
- Min/max amount enforcement.
- Refund/withdrawal of redeemed angpao (redemption is one-way into the shop
  wallet).
