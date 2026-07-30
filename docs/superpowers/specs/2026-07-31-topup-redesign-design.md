# Top-up page redesign (PromptPay + TrueMoney Angpao)

Date: 2026-07-31
Branch: `feat/topup-redesign`

## Problem

The customer top-up flow reads as three unrelated screens rather than one checkout.

- `/topup/promptpay` is a four-step wizard (amount -> QR -> upload slip -> success).
  The 15-minute countdown lives on the QR step only, so it disappears exactly when
  the player needs it: while they are finding and uploading the slip. Expiry
  bounces the player back to the amount step and throws away their input.
- `/topup/truemoney` leads with a large "send the gift to this phone number" block
  that the player does not need (the backend redeems with `truemoney_phone`
  server-side), followed by five how-to screenshots that push the actual input
  below the fold.
- Both pages open with a full-width orange gradient bonus banner that outshouts the
  payment UI itself.

## Goals

1. Remove the phone-number block from the Angpao page.
2. Put the PromptPay QR, its countdown, and the slip upload on one screen.
3. Make both pages read as a professional checkout.

Non-goals: no backend changes, no route changes, no change to bonus, discount, or
campaign-point logic.

## Design

### Shared shape

Both payment pages use one card with two columns on desktop (`lg:`) and a stacked
layout on mobile:

- **Left column**: the action. QR for PromptPay, gift-link input for Angpao.
- **Right column**: a persistent summary rail - amount, bonus multiplier, campaign
  points earned, wallet balance, discount code.

The bonus stops being a full-width gradient banner and becomes a compact chip
inside the summary rail. Method identity is carried by the accent colour only:
PromptPay `#003b80`, TrueMoney `#ed1c24`.

### PromptPay - step 1 (amount)

Presets, custom amount, campaign points nudge, live "you receive" total. Same
inputs as today, tightened visually.

### PromptPay - step 2 (pay)

One screen. Left: QR, countdown, locked amount, recipient name. Right: slip upload
and discount code.

- The countdown is mounted on the same screen as the upload and never unmounts.
- On expiry the QR greys out and the primary button becomes "สร้าง QR ใหม่", which
  re-calls `POST /payment/promptpay/create` **in place** with the same amount. It
  does not return to step 1.
- Upload accepts click, drag-and-drop, and clipboard paste (Ctrl+V of a
  screenshot).
- The image is downscaled client-side (longest edge 1600px, JPEG q0.85) before
  base64 encoding so `POST /payment/slip/verify` stays small.

### TrueMoney Angpao

Single screen, no steps before success.

- The phone-number block is deleted. `truemoney_phone` remains a required setting
  and is still used server-side to redeem; it is simply not rendered.
- Left: gift-link input with inline validation of the voucher-link shape.
- Right: the same summary rail (bonus chip, wallet balance).
- The five how-to screenshots move into a `<details>`-style collapsible
  "วิธีสร้างซอง" section, collapsed by default.

### Errors

Redemption and slip-verification failures render inline under the relevant field
instead of in an `AdminAlert` modal: the modal had to be dismissed before the
player could correct the input it was describing. QR-creation failure keeps the
modal, since there is no field to attach it to.

### Unchanged

`POST /payment/promptpay/create`, `POST /payment/slip/verify`,
`POST /payment/truemoney/redeem`, `POST /payment/discount/preview`, every settings
key, `resolveTopupBonus`, and campaign point granting.

## Constraints

- No em dash in user-facing Thai copy (`.agents/context/THEME.md`).
- Lucide icons only, no emoji (`.agents/context/ICONS.md`).
- Semantic theme tokens where the element is not part of a payment brand mark.
- Currency is Baht only; campaign points are displayed, never treated as money
  (`.agents/context/SYSTEM.md`).

## Rollout

Typecheck and `next build` in the worktree, merge to `master`, then
`deploy/manage-customer.sh rebuild <name>` for the five running shops: mchanom,
yokaicraft, honeyland, jackcraft, gfloorsmp. helloworld, testwebshop and notte are
suspended and must be skipped.
