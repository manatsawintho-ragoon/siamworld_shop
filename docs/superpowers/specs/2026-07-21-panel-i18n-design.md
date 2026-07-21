# Panel i18n (Thai + English) - Design

Date: 2026-07-21
Status: approved, Phase 1 ready for planning
Branch: `feat/panel-i18n`

## Why

Two drivers, both confirmed by the owner:

1. **Non-Thai customers.** People who cannot operate a Thai-only dashboard are
   expected as customers. The order flow, top-up and dashboard need to be
   usable in English.
2. **Consistency.** A language switcher that only works on marketing pages
   reads as unfinished.

Note what is **not** a driver: SEO. `/dashboard/` is disallowed in `robots.txt`
and authenticated pages are not indexed, so translating them earns no search
value. This work is justified by usability, and should be prioritised by what a
new customer touches first, not by keyword value.

Payment scope (THB / PromptPay / TrueMoney only) is explicitly out of scope for
this work. Translation does not make the product purchasable abroad; that is a
separate decision.

## Scope

**In scope: 18 customer-facing pages.**
Home, solutions, order, contact, delete-account, dashboard (7 pages: index,
credentials, domain, profile, renew, support, topup), and the 6 legal pages
(terms, privacy, shop-owner-agreement, payment-policy, prohibited-content).

**Out of scope: the 11 `/admin` pages.** That is the operator back office. No
customer ever sees it, so neither driver applies. The switcher will not render
inside `/admin`.

**Measured volume:** ~1,571 distinct Thai strings across 51 files, 14,893 lines
of TSX. This is why the work is phased rather than attempted in one pass.

## Hard constraint

**Every currently-indexed Thai URL must survive byte-identical.**

`/`, `/solutions`, `/lp/<thai-slug>`, `/order`, `/contact` and the legal pages
are indexed today, and the English SEO tree that references them shipped on
2026-07-21. A route migration that changes even one Thai path forfeits that
work. This constraint outranks any architectural preference below.

## Architecture

### Routing: `next-intl` with `[locale]`, Thai unprefixed

Routes move under `app/[locale]/`. Configuration uses
`localePrefix: 'as-needed'` with `th` as `defaultLocale`, which renders Thai at
the bare path and English under `/en`:

| Page | Thai (unchanged) | English |
|---|---|---|
| Home | `/` | `/en` |
| Solutions | `/solutions` | `/en/solutions` |
| Order | `/order` | `/en/order` |
| Dashboard | `/dashboard` | `/en/dashboard` |
| Terms | `/terms` | `/en/terms` |

Two properties make this the right choice over the alternatives:

- Thai URLs are preserved by construction, satisfying the hard constraint.
- English lands on `/en/...`, exactly where the marketing pages already live,
  so the existing tree is absorbed rather than orphaned.

It also removes an existing workaround. Today the root layout is fixed at
`<html lang="th">` and the English subtree declares itself with a `<div
lang="en">` wrapper, because the App Router forbids a nested `<html>`. With
`[locale]` as a route param the root layout emits a real `<html lang={locale}>`,
and the wrapper goes away.

**Rejected alternatives:**

- *Hybrid (URL locale for public pages, cookie for authenticated).* Less file
  movement, and defensible since authenticated pages are not indexed. Rejected
  because it leaves two mental models in one codebase; every future page needs
  a "which kind is this?" decision, which rots.
- *Parallel hand-written trees* (the current state, extended). Workable for 16
  content-driven landing pages with separate datasets. At 1,571 shared UI
  strings it means maintaining every page twice, and will drift within a month.

### Messages

JSON namespaces per area: `common`, `nav`, `dashboard`, `order`, `topup`,
`profile`, `legal`. Thai is the source of truth; English is the translation.

Namespaced rather than one file so server components load only what they need
and dashboard strings never reach the marketing bundle. Keys are semantic
(`order.plan.monthly.label`), not English-text-derived, so a copy change in one
language does not orphan the other.

### Landing pages stay outside the message system

`/lp/*` (Thai, 16 pages) and `/en/lp/*` (English, 13 pages) are **not
translations of each other**. They are separate content targeting different
queries, with different slugs and different datasets
(`lib/seo/keywords.ts`, `lib/seo/keywords.en.ts`).

They keep their datasets and select by locale. They must **not** be routed
through message extraction, and their pairs must **not** become hreflang
annotations: declaring non-equivalent pages as translations makes Google
discard the whole annotation. Only the two homepages carry reciprocal hreflang.

`lib/seo/locale-path.ts` already encodes the nearest-topic mapping used by the
switcher, and documents that it is a UX convenience rather than a translation
claim. That distinction must survive this migration.

### Fonts

`lib/fonts.ts` currently applies both Kanit subsets (latin + thai) at the root
layout, so all 10 woff2 files preload on every page regardless of language.
Once `[locale]` exists, preload becomes locale-aware: English pages preload
latin only, Thai pages preload thai (plus latin, which Thai pages also render
for numerals and brand text).

The vendored-font arrangement itself does not change. Builds must stay hermetic:
`next/font/google` fetches at build time and treats a failed fetch as a fatal
webpack error, which broke the panel build on 2026-07-21.

### Switcher

`components/LanguageSwitcher.tsx` moves from `router.push()` over a hand-rolled
path map to next-intl's locale-aware navigation. The nearest-topic mapping for
landing pages stays, because next-intl cannot infer it. The switcher is hidden
inside `/admin`.

## Phase 1 (this spec)

1. Install and configure `next-intl` (middleware, request config, `[locale]`).
2. Migrate routes under `app/[locale]/`, preserving Thai paths exactly.
3. Root layout: real `<html lang>`, locale-aware font preload, remove the
   `<div lang="en">` wrapper.
4. Rewire the switcher to next-intl navigation; hide it in `/admin`.
5. Extract and translate **three pilot pages**: order, dashboard/topup, and one
   legal page. These prove the pattern across a form-heavy page, a money-path
   page and a prose page before the remaining 15 are touched.

## Later phases

- **Phase 2:** dashboard (remaining 6 pages) and profile. Highest usability
  value for driver A.
- **Phase 3:** remaining 5 legal pages. Low churn, meaningful trust signal.
- **Phase 4:** home and solutions reconciliation - the Thai home is 1,589 lines
  and the English home is a separate purpose-built page; deciding whether they
  converge is its own question, not a mechanical translation.

Each later phase gets its own plan. This spec covers Phase 1 only.

## Verification

The migration is verified, not assumed:

- **Route parity:** capture `next build`'s route list before and after. Every
  Thai path must appear unchanged. Any Thai path that moves fails the phase.
- **Sitemap parity:** diff generated `sitemap.xml`. The 40 URLs currently
  emitted must still be emitted, with hreflang pairs intact on the homepages.
- **Rendered checks:** `<html lang>` correct per locale, canonical unchanged on
  Thai pages, no `fonts.googleapis.com` reference, font preload count per
  locale lower than the current 10.
- **Build hermeticity:** the build must still succeed with no network access.

Measure occurrences with `grep -o ... | wc -l`, not `grep -c`, which counts
matching lines and undercounts minified single-line output.

## Risks

| Risk | Mitigation |
|---|---|
| A Thai URL changes and rankings are lost | Route-list diff gate before merge; abort phase if any Thai path moves |
| Landing-page pairs get declared as hreflang | Documented in `locale-path.ts` and here; reviewer checks |
| Message extraction drifts from rendered copy | Pilot pages first; pattern proven before bulk work |
| Shared working directory collision | Work stays in the `feat/panel-i18n` worktree; verify branch before any build |

## Non-goals

- Translating `/admin`.
- Card or non-THB payment support.
- Converging the Thai and English home pages.
- Machine-translating the 1,571 strings in bulk without review.
