# Status surfaces + trial eligibility - design

Date: 2026-08-01
Scope: `panel/` (SaaS panel) and `frontend/` (per-tenant customer shop)

## Problem

Two separate defects, reported together as "the trial button lies to customers".

### 1. The trial CTA is not eligibility-aware

`panel/frontend/src/components/marketing/ThaiHome.tsx` declares the hero call to
action at module scope:

```ts
const PRIMARY_CTA = { href: '/order?kind=trial', label: 'ctaStartTrial' };
```

It is rendered to every visitor. `ThaiLanding.tsx` and `EnglishLanding.tsx` do the
same. A logged-in customer who already consumed their trial clicks the site's
largest button and is taken to `/order?kind=trial`, where `order/page.tsx` renders
a dead end: "คุณใช้สิทธิ์ทดลองฟรีไปแล้ว". The dashboard already gates the same
link correctly; only the marketing surfaces do not.

### 2. Trial eligibility is consumed even when the trial never existed

`subscription.service.ts` sets `used_trial = 1` inside the create transaction,
which commits *before* `deployService.deployAsync` runs. When a deploy fails,
`deploy.service.ts` moves the subscription back to `status = 'pending'` with
`deploy_log` prefixed `Deploy failed:`. Nothing anywhere resets `used_trial`:
there is no admin reset, no reset on cancellation, and no reset on deploy failure.

A customer whose trial shop never provisioned is therefore permanently locked out,
and the message they get accuses them of having used something they never received.

### 3. Neither app has any error or not-found page

Neither `panel/frontend/src/app` nor `frontend/src/app` contains `not-found.tsx`,
`error.tsx`, or `global-error.tsx`. A 404 or an unhandled client exception on
`panel.siamsite.shop` or on any tenant shop renders Next.js's raw built-in output.

## Non-goals

- No database migration. The recovery rule is derived from existing columns.
- No operator-facing eligibility reset UI. Recovery is automatic; a support path
  can be added later if automatic recovery proves insufficient.
- No change to the IP anti-abuse cap, which is a separate and working control.

## Design

### A. Eligibility becomes a verdict, not a boolean

`subscriptionService.getEligibility(userId)` returns:

```ts
{
  usedTrial:      boolean,  // raw column, for accounting
  usedIntro:      boolean,
  trialEligible:  boolean,  // what the UI must branch on
  introEligible:  boolean,
  trialReason:    'available' | 'consumed' | 'disabled',
  introReason:    'available' | 'consumed' | 'disabled',
}
```

`trialEligible` is true when the trial promo is enabled AND (`used_trial = 0` OR
the recovery rule applies).

**Recovery rule.** A consumed trial is restored when the user has no trial
subscription that ever became usable. A trial row counts as *usable* unless it is:

- `status = 'cancelled'`, or
- `status = 'pending'` AND `deploy_log LIKE 'Deploy failed:%'`

A trial that reached `active`, `expired`, or `suspended` was genuinely delivered
and stays consumed. `deploying` is excluded from recovery too, since it may still
succeed.

Recovery is computed read-only in `getEligibility`, and re-evaluated inside the
existing `SELECT ... FOR UPDATE` block in `create()` so two concurrent orders
cannot both pass the gate.

### B. Eligibility-aware CTAs

The marketing CTAs resolve their target from eligibility:

| Viewer | CTA |
|---|---|
| Logged out | trial CTA (unchanged - they can still sign up and claim it) |
| Logged in, trial eligible | trial CTA |
| Logged in, trial consumed, intro eligible | intro offer |
| Logged in, both consumed | regular packages |

Logged-out rendering must not change, so the marketing pages keep their current
server-rendered markup and a client component swaps the CTA once auth state
resolves. No layout shift: the swapped CTA occupies the same slot.

### C. `StatusScreen`

One component per app, same prop shape, each built on that app's own primitives:

```ts
type StatusVariant = 'success' | 'error' | 'warning' | 'pending';
interface StatusScreenProps {
  variant: StatusVariant;
  title: string;
  description?: ReactNode;
  detail?: ReactNode;      // receipt rows, error code, deploy log excerpt
  actions?: ReactNode;     // primary + secondary buttons
  compact?: boolean;       // inline inside a wizard vs full-page
}
```

- Panel: `ui/card` + `ui/icon` + `ui/button`, all copy through next-intl (`th`, `en`).
- Shop: Lucide icons and the per-theme `--color-success` / `--color-error` /
  `--color-warning` tokens, so it inherits all 10 shop themes. Thai copy inline,
  matching the rest of the shop frontend.

Consumers:

- Panel: order done, order ineligibility screens, topup `done` step, topup slip
  rejection, renew result, shop-still-deploying.
- Shop: promptpay success and slip failure, truemoney success and failure, redeem
  result, purchase result.

### D. Global route pages

Per app: `not-found.tsx`, `error.tsx` (client, receives `reset()`),
`global-error.tsx` (renders its own `<html>`/`<body>`).

`global-error.tsx` cannot use the theme context or next-intl - it replaces the
root layout. It ships self-contained inline styles and neutral bilingual copy.

**Panel 404 routing, as built.** Three findings changed this from the sketch:

1. Next serves a `not-found.tsx` for an *unmatched* URL only when it is the ROOT
   `app/not-found.tsx`; a segment-level one is reached only via an explicit
   `notFound()`. The panel cannot have a root one - it has two root layouts
   ([locale] and (operator)), legal only while nothing sits above them, and a
   root `not-found.tsx` requires a root layout. `next build` fails outright:
   "not-found.tsx doesn't have a root layout".
2. So `[locale]` gets `[...rest]/page.tsx`, a catch-all that does nothing but
   call `notFound()`. That puts the miss inside the segment, where our 404, the
   locale layout, fonts and translations all apply. Catch-alls are the
   lowest-priority match, so no real page is shadowed. Verified: `/nope` and
   `/en/nope` return 404 with the branded page (111 KB / 67 KB) rather than
   Next's 6 KB built-in.
3. `(operator)` needs no catch-all. Because it is a root layout group,
   `(operator)/not-found.tsx` is already used for unmatched `/admin/*` - it
   returns 404 with the styled page on its own. An `admin/[...rest]` catch-all
   was tried and REMOVED: `admin/layout.tsx` is a client component, so the shell
   streams and flushes headers before the page can throw, turning every miss
   into **HTTP 200** with a page reading "not found". A correct status matters
   more than a prettier page on an operator-only surface.

## Testing

- `getEligibility` recovery matrix: no trial row; cancelled trial; failed-deploy
  pending trial; deploying trial; active trial; expired trial. Each asserts
  `trialEligible`.
- `create()` rejects a second trial when the first is `active`, and accepts one
  when the first is a failed-deploy `pending`.
- Panel `tsc`, `vitest`, `jest` and `next build` are all real gates.
- Neither app's `node_modules` can be borrowed from the main checkout: the
  panel's host copy predates next-intl, so a symlinked `tsc` reports 40 phantom
  "cannot find module" errors, and the shop has none at all. `npm ci` inside the
  worktree is what makes local typechecking meaningful; without it `tsc` either
  lies or no-ops.
- Route status codes are checked over HTTP against `next start`, not inferred
  from the build manifest. The manifest lists `/[locale]/[...rest]` either way;
  only a request proves which page answers and with what status. Both panel
  trees render essentially nothing server-side (auth-gated client shells), so
  status code and payload size are the signal, not scraped text.

## Rollout

No migration, so plain rebuilds. Panel first, then the active shops via
`manage-customer.sh --action rebuild`. Suspended shops are skipped: their
containers are intentionally stopped and rebuilding them would resurrect a shop
the panel deliberately took down.

## Copy rules

No em dash in any user-facing string, panel or shop. Validation and failure
messages name the field or the cause and state the next action.
