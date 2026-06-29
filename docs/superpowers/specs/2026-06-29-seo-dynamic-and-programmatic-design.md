# SEO: Per-Shop Dynamic Metadata + Panel Programmatic Keyword Coverage

Date: 2026-06-29
Branch: feat/subscription-time-adjust (continued)
Scope: siamworld_shop/frontend (customer shop) + siamworld_shop/backend + panel/frontend

## Goal

1. Customer shops: each shop is independently indexable on Google with its OWN shop
   name in title/description/OG, correct per-domain sitemap/robots/canonical, JSON-LD,
   and a Google Search Console verification field. Works for both `*.siamsite.shop`
   subdomains and custom domains, with no rebuild needed for domain changes (runtime
   `headers()`).
2. Panel: rank for a very broad set of "เช่าเว็บร้านค้า Minecraft / webshop" long-tail
   keywords via white-hat programmatic SEO (a keyword-cluster landing system with
   genuinely useful unique pages, internal linking, FAQ + Service JSON-LD, auto
   sitemap). Target thousands of long-tail keyword impressions through ~100-200
   high-quality pages (not thin doorway pages).

## Part 1: Customer Shop dynamic SEO (frontend + backend)

### Backend (`backend/src/routes/public.routes.ts`)
Add to the `/public/settings` whitelist: `google_site_verification`, `seo_title`,
`seo_description`, `seo_keywords`. (Settings are already a generic key-value store.)

### Frontend server SEO helper (`frontend/src/lib/serverSeo.ts`)
- `getRequestHost()` -> read `host` from `next/headers`, build `https://<host>`.
- `fetchShopSeo()` -> fetch settings from `process.env.BACKEND_INTERNAL_URL`
  (fallback `https://<host>/api`) `/public/settings`, return shop_name,
  shop_subtitle, shop_description, logo_url, server_ip, seo_* overrides, and
  google_site_verification. Cached with `next: { revalidate: 300 }`.

### Frontend `app/layout.tsx`
- Replace static `metadata` with `async generateMetadata()`:
  - `metadataBase = new URL(host)`
  - `title = { default: seo_title || `${shop_name} | ร้านค้า Minecraft เติมเงินอัตโนมัติ`,
     template: `%s | ${shop_name}` }`
  - `description = seo_description || shop_description || sensible default with shop_name`
  - `keywords` includes shop_name + Minecraft store terms (+ seo_keywords)
  - `alternates.canonical = '/'`
  - `openGraph` / `twitter` with shop_name + logo_url image
  - `verification.google = google_site_verification` (when set)
  - `robots` index/follow.
- Inject JSON-LD (`Store` + `WebSite`) via a `<script type="application/ld+json">` in
  the body using fetched settings (name, url, logo, potential SearchAction to /shop).

### Frontend `app/robots.ts` and `app/sitemap.ts`
- Both read host via `headers()` and emit absolute URLs.
- `robots`: allow `/`, disallow `/api/ /admin/ /profile/ /inventory/`, add
  `sitemap: https://<host>/sitemap.xml` and `host`.
- `sitemap`: absolute URLs for `/ /shop /lootbox /topup /download`.

### Per-page titles (server layouts)
Add tiny server `layout.tsx` for `app/shop`, `app/topup`, `app/lootbox`,
`app/download` exporting static `metadata.title` (e.g. "ร้านค้า", "เติมเงิน") so the
root template yields "ร้านค้า | <shop_name>". Pages stay client components.

### Admin shop settings UI (`frontend/src/app/admin/settings/page.tsx`)
Add an "SEO / Google" section: Google verification code input + optional custom
title/description/keywords overrides. Persists via the existing settings save.

## Part 2: Panel programmatic SEO (panel/frontend)

### Keyword dataset (`panel/frontend/src/lib/seo/keywords.ts`)
Curated clusters (data-driven, extensible) covering the rental webshop niche:
- core service terms (เช่าเว็บร้านค้ามายคราฟ, ระบบร้านค้า Minecraft, webshop minecraft, ...)
- features (เติมเงินอัตโนมัติ, PromptPay, TrueMoney, EasySlip ตรวจสลิป, RCON, กล่องสุ่ม/gacha, ...)
- use-cases / server types (survival, skyblock, roleplay, network/velocity, ...)
- comparisons / alternatives (แทน Tebex, ทางเลือก Tebex ไทย, ...)
- how-to / guides (วิธีเปิดร้านค้า Minecraft, รับเงินจากเซิร์ฟ, ...)
Each entry: slug, h1, title, description, intro, bullet points, FAQ items, cluster.

### Dynamic landing route (`panel/frontend/src/app/(seo)/lp/[slug]/page.tsx`)
- `generateStaticParams()` from the dataset (SSG, fast + indexable).
- `generateMetadata()` per slug (unique title/description/canonical/OG).
- Page renders: H1, intro, value bullets, internal links to related clusters +
  pricing/trial CTA, FAQ (rendered + `FAQPage` JSON-LD) and `Service` +
  `BreadcrumbList` JSON-LD. Each page is substantial and unique (no thin content).

### Hub page (`panel/frontend/src/app/(seo)/solutions/page.tsx`)
Lists all clusters/pages with descriptive anchor text (internal-link hub, avoids
orphan pages) and is linked from the footer.

### Sitemap + metadata
- Extend `panel/frontend/src/app/sitemap.ts` to include all programmatic slugs + hub.
- Enrich panel homepage metadata keywords + add `FAQPage` JSON-LD for the landing.
- Add footer link to the solutions hub so crawlers (and the homepage) reach the pages.

## Deploy / Rollout Notes

- Shop SEO changes only take effect per shop after that shop's image is rebuilt
  (use `deploy/manage-customer.sh` rebuild, never a raw docker build). Listed as a
  follow-up ops step; not auto-run for all shops in this change.
- Panel changes go live on the next panel rebuild.

## Out of Scope (YAGNI)

- Per-product dynamic sitemap entries on shops (homepage is the ranking target).
- SSR rewrite of client product pages.
- Auto-submitting sitemaps to Google on behalf of customers (self-serve via the
  verification field + guide instead).
- Literal 10000 thin pages (white-hat: quality pages that each rank for many terms).
