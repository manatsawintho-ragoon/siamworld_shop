# Panel i18n Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the panel on `next-intl` with an `[locale]` route segment so every customer-facing page can render in Thai or English, without changing a single existing Thai URL.

**Architecture:** `next-intl` v3.26.5 with `defineRouting({localePrefix: 'as-needed'})` and `th` as default locale, so Thai renders at the bare path and English at `/en/...`. Routes move under `app/[locale]/`. Marketing pages that differ per language (home, solutions, landing pages) dispatch to locale-specific components rather than sharing one translated body. UI strings move into per-namespace JSON message files.

**Tech Stack:** Next.js 14.2.35 (App Router, SSG), React 18.3, TypeScript 5.5, Tailwind v4, next-intl 3.26.5, Vitest 4 (new).

## Global Constraints

- **Every existing Thai URL must stay byte-identical.** `/`, `/solutions`, `/lp/<thai-slug>`, `/order`, `/contact`, `/dashboard/*`, and the 6 legal pages are indexed. If any Thai path changes, the task has failed - stop and fix, do not proceed.
- **next-intl version is exactly `3.26.5`.** Not v4. v4 targets the Next 15 async-params model; this project is Next 14.2 with sync params.
- **No em dash (`—`) in user-facing copy**, Thai or English. Use `-`, `:`, or parentheses.
- **Builds must stay hermetic.** No build-time network fetches. Never reintroduce `next/font/google`; Kanit is vendored in `panel/frontend/src/fonts/`.
- **`/admin` is out of scope.** Do not move admin routes under `[locale]`, do not translate them, and do not render the language switcher inside them.
- **Landing pages are not translations.** `/lp/*` and `/en/lp/*` target different queries with different slugs. Never emit hreflang linking them. Only the two homepages carry reciprocal hreflang.
- **Icons:** no emoji in UI. Use the lucide registry in `components/ui/icon.tsx`.
- All work happens in the worktree `.claude/worktrees/panel-i18n` on branch `feat/panel-i18n`. Verify with `git branch --show-current` before any build.

**Working directory for all commands:** `/home/limitrack/siamworld_shop/.claude/worktrees/panel-i18n/panel/frontend`

---

### Task 1: Route-parity baseline (the safety net)

Build this **first**. It is the gate that proves the migration did not move a Thai URL. Without a baseline captured before any change, the constraint is unverifiable.

**Files:**
- Create: `scripts/route-snapshot.sh`
- Create: `scripts/routes.baseline.txt` (generated)

**Interfaces:**
- Produces: `scripts/route-snapshot.sh` writes a sorted route list to stdout. Later tasks diff against `scripts/routes.baseline.txt`.

- [ ] **Step 1: Write the snapshot script**

Create `scripts/route-snapshot.sh`:

```bash
#!/usr/bin/env bash
# Extracts the route list from a Next.js build and normalises it for diffing.
#
# Next prints a tree with box-drawing characters, sizes, and a "[+N more paths]"
# elision. The elision is why we read the build manifest instead of the pretty
# output: the tree hides paths, the manifest does not.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .next/routes-manifest.json ]; then
  echo "error: .next/routes-manifest.json missing. Run 'npm run build' first." >&2
  exit 1
fi

# Static routes from the prerender manifest (every SSG page, no elision),
# plus dynamic route patterns from the routes manifest.
python3 - <<'PY'
import json, sys

routes = set()

with open('.next/prerender-manifest.json') as f:
    routes.update(json.load(f).get('routes', {}).keys())

with open('.next/routes-manifest.json') as f:
    rm = json.load(f)
    for r in rm.get('staticRoutes', []):
        routes.add(r['page'])
    for r in rm.get('dynamicRoutes', []):
        routes.add(r['page'])

for r in sorted(routes):
    print(r)
PY
```

- [ ] **Step 2: Make it executable and produce the baseline**

Run:

```bash
chmod +x scripts/route-snapshot.sh
npm run build
./scripts/route-snapshot.sh > scripts/routes.baseline.txt
wc -l scripts/routes.baseline.txt
```

Expected: a non-zero line count (roughly 70 lines, covering 66 prerendered pages plus dynamic patterns).

- [ ] **Step 3: Verify the baseline contains the URLs we must protect**

Run:

```bash
for p in / /solutions /order /contact /terms /privacy /dashboard /dashboard/topup; do
  grep -qxF "$p" scripts/routes.baseline.txt && echo "OK   $p" || echo "MISS $p"
done
grep -c '^/lp/' scripts/routes.baseline.txt
```

Expected: every line prints `OK`, and the `/lp/` count is `16`.

If any prints `MISS`, the snapshot script is reading the wrong manifest key. Fix it before continuing - a baseline that omits a URL cannot protect it.

- [ ] **Step 4: Commit**

```bash
git add scripts/route-snapshot.sh scripts/routes.baseline.txt
git commit -m "test(panel): capture route baseline before i18n migration

Snapshot of every route the panel serves today, read from the build
manifests rather than the pretty tree output (which elides paths behind
'[+N more paths]'). The i18n migration must not change a single Thai URL,
and this file is what proves it."
```

---

### Task 2: Test infrastructure and locale-path unit tests

The project has no test runner. `lib/seo/locale-path.ts` holds the trickiest pure logic in this feature (locale detection, path mapping, encoded Thai slugs) and has zero tests. Add the runner and cover it before the migration changes anything around it.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/seo/locale-path.test.ts`

**Interfaces:**
- Consumes: `localeOf`, `localePath`, `hasDirectCounterpart` from `src/lib/seo/locale-path.ts` (already exists).
- Produces: `npm test` runs the suite. Later tasks add tests to it.

- [ ] **Step 1: Install Vitest**

Run:

```bash
npm install -D vitest@^4.1.10
```

Expected: `added N packages` with no peer-dependency errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Mirrors the "@/*" -> "src/*" alias in tsconfig.json so imports in tests
    // resolve the same way they do in the Next build.
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 4: Write the failing tests**

Create `src/lib/seo/locale-path.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { localeOf, localePath, hasDirectCounterpart } from '@/lib/seo/locale-path';

describe('localeOf', () => {
  it('treats bare paths as Thai', () => {
    expect(localeOf('/')).toBe('th');
    expect(localeOf('/dashboard')).toBe('th');
  });

  it('detects the English tree', () => {
    expect(localeOf('/en')).toBe('en');
    expect(localeOf('/en/solutions')).toBe('en');
  });

  it('does not mistake a path merely starting with "en" for English', () => {
    expect(localeOf('/enterprise')).toBe('th');
  });
});

describe('localePath', () => {
  it('maps the homepages to each other', () => {
    expect(localePath('/', 'en')).toBe('/en');
    expect(localePath('/en', 'th')).toBe('/');
  });

  it('maps the solutions hubs to each other', () => {
    expect(localePath('/solutions', 'en')).toBe('/en/solutions');
    expect(localePath('/en/solutions', 'th')).toBe('/solutions');
  });

  it('maps a Thai landing page to its English topic counterpart', () => {
    expect(localePath('/lp/ทางเลือกแทน-tebex', 'en')).toBe('/en/lp/tebex-alternative');
  });

  it('maps an English landing page back to a Thai one', () => {
    expect(localePath('/en/lp/tebex-alternative', 'th')).toBe('/lp/' + encodeURIComponent('ทางเลือกแทน-tebex'));
  });

  it('falls back to the hub when a landing page has no counterpart', () => {
    expect(localePath('/lp/ไม่มีอยู่จริง', 'en')).toBe('/en/solutions');
    expect(localePath('/en/lp/does-not-exist', 'th')).toBe('/solutions');
  });

  it('falls back to home for untranslated areas', () => {
    expect(localePath('/dashboard/topup', 'en')).toBe('/en');
    expect(localePath('/terms', 'en')).toBe('/en');
  });

  it('returns the same path when the target locale already matches', () => {
    expect(localePath('/dashboard', 'th')).toBe('/dashboard');
    expect(localePath('/en/solutions', 'en')).toBe('/en/solutions');
  });

  it('strips query and hash before mapping', () => {
    expect(localePath('/solutions?utm=x', 'en')).toBe('/en/solutions');
    expect(localePath('/#pricing', 'en')).toBe('/en');
  });

  it('tolerates a trailing slash', () => {
    expect(localePath('/solutions/', 'en')).toBe('/en/solutions');
  });
});

describe('hasDirectCounterpart', () => {
  it('is true for pages that genuinely exist in both languages', () => {
    expect(hasDirectCounterpart('/', 'en')).toBe(true);
    expect(hasDirectCounterpart('/solutions', 'en')).toBe(true);
    expect(hasDirectCounterpart('/lp/ทางเลือกแทน-tebex', 'en')).toBe(true);
  });

  it('is false for untranslated areas', () => {
    expect(hasDirectCounterpart('/dashboard', 'en')).toBe(false);
    expect(hasDirectCounterpart('/terms', 'en')).toBe(false);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`

Expected: all tests PASS. `locale-path.ts` already implements this behaviour, so this task is characterisation - it pins current behaviour so the Task 6 rewrite cannot silently change it.

If any test FAILS, that is a real bug in the existing implementation. Fix `locale-path.ts` to satisfy the test, not the other way round. The most likely genuine failure is `localeOf('/enterprise')`, which requires the `pathname === '/en' || pathname.startsWith('/en/')` form rather than `startsWith('/en')`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/seo/locale-path.test.ts
git commit -m "test(panel): add vitest and cover locale-path mapping

The project had no test runner. locale-path.ts holds the trickiest pure
logic in the i18n feature (locale detection, encoded Thai slugs, hub
fallbacks) and had no coverage, so pin its behaviour before the migration
rewrites the switcher around it."
```

---

### Task 3: Install and configure next-intl (no route moves yet)

Configuration only. Routes stay where they are, so the build must still pass and the route baseline must still match at the end of this task.

**Files:**
- Modify: `package.json`
- Modify: `next.config.js`
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/navigation.ts`
- Create: `src/i18n/request.ts`
- Create: `src/middleware.ts`
- Create: `messages/th.json`
- Create: `messages/en.json`
- Test: `src/i18n/routing.test.ts`

**Interfaces:**
- Produces:
  - `routing` from `@/i18n/routing` - `{ locales: ['th','en'], defaultLocale: 'th', localePrefix: 'as-needed' }`
  - `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` from `@/i18n/navigation`
  - Message namespaces `common` and `nav` in `messages/{th,en}.json`

- [ ] **Step 1: Install next-intl**

Run:

```bash
npm install next-intl@3.26.5
```

Expected: `added N packages`, no peer warnings about `next`.

- [ ] **Step 2: Write the routing definition**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing';

/**
 * Thai is the default locale and renders WITHOUT a prefix, which is the whole
 * point of 'as-needed': every existing Thai URL (/, /solutions, /order,
 * /lp/<thai-slug>) stays exactly as it is today. English gets the /en prefix,
 * which is where the English marketing pages already live.
 *
 * Changing defaultLocale or localePrefix changes indexed URLs. Do not.
 */
export const routing = defineRouting({
  locales: ['th', 'en'],
  defaultLocale: 'th',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Write the navigation wrappers**

Create `src/i18n/navigation.ts`:

```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and next/navigation. Using these
 * instead of the raw Next equivalents is what keeps a link on an English page
 * pointing at the English route without every call site hardcoding '/en'.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 4: Write the request config**

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as never)
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Write the middleware**

Create `src/middleware.ts`:

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  /**
   * Skip API routes, Next internals, and anything with a file extension.
   *
   * /admin is deliberately excluded: it is the operator back office, is not
   * translated, and running it through locale negotiation would only add a
   * redirect hop to pages no customer sees.
   */
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 6: Wire the plugin into next.config.js**

In `next.config.js`, wrap the export. Change the final line from:

```js
module.exports = nextConfig;
```

to:

```js
const createNextIntlPlugin = require('next-intl/plugin');

// Points at the request config above. next-intl's default lookup path is
// ./i18n/request.ts relative to the project root; ours lives under src/.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

module.exports = withNextIntl(nextConfig);
```

- [ ] **Step 7: Create the message files**

Create `messages/th.json`:

```json
{
  "common": {
    "startTrial": "เริ่มทดลองใช้ฟรี",
    "seePricing": "ดูราคาแพ็กเกจ",
    "contactUs": "ติดต่อเรา",
    "loading": "กำลังโหลด",
    "save": "บันทึก",
    "cancel": "ยกเลิก",
    "back": "ย้อนกลับ"
  },
  "nav": {
    "home": "หน้าแรก",
    "features": "ฟีเจอร์เด่น",
    "pricing": "ราคาแพ็กเกจ",
    "solutions": "บริการเช่าเว็บร้านค้า",
    "dashboard": "แดชบอร์ด",
    "profile": "โปรไฟล์ส่วนตัว",
    "adminPanel": "แผงควบคุมแอดมิน",
    "logout": "ออกจากระบบ",
    "changeLanguage": "เปลี่ยนภาษา"
  }
}
```

Create `messages/en.json`:

```json
{
  "common": {
    "startTrial": "Start the free trial",
    "seePricing": "See pricing",
    "contactUs": "Contact us",
    "loading": "Loading",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back"
  },
  "nav": {
    "home": "Home",
    "features": "Features",
    "pricing": "Pricing",
    "solutions": "Solutions",
    "dashboard": "Dashboard",
    "profile": "Profile",
    "adminPanel": "Admin panel",
    "logout": "Sign out",
    "changeLanguage": "Change language"
  }
}
```

- [ ] **Step 8: Write a test that both locales define the same keys**

Create `src/i18n/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routing } from './routing';
import th from '../../messages/th.json';
import en from '../../messages/en.json';

/** Flattens {a: {b: 'x'}} to ['a.b'] so a missing nested key is visible. */
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? keyPaths(v as Record<string, unknown>, path)
      : [path];
  });
}

describe('routing config', () => {
  it('keeps Thai as the unprefixed default', () => {
    expect(routing.defaultLocale).toBe('th');
    expect(routing.localePrefix).toBe('as-needed');
    expect(routing.locales).toEqual(['th', 'en']);
  });
});

describe('messages', () => {
  it('defines exactly the same keys in both locales', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(th).sort());
  });

  it('has no empty strings', () => {
    const empties = [
      ...keyPaths(th).filter((p) => !p),
      ...Object.values(th.common).filter((v) => !v.trim()),
      ...Object.values(en.common).filter((v) => !v.trim()),
    ];
    expect(empties).toEqual([]);
  });

  it('uses no em dashes in user-facing copy', () => {
    const all = JSON.stringify(th) + JSON.stringify(en);
    expect(all).not.toContain('—');
  });
});
```

- [ ] **Step 9: Run tests and build**

Run:

```bash
npm test
npm run build
./scripts/route-snapshot.sh > /tmp/routes.after-task3.txt
diff scripts/routes.baseline.txt /tmp/routes.after-task3.txt && echo "ROUTES UNCHANGED"
```

Expected: tests PASS, build succeeds, and the diff prints `ROUTES UNCHANGED`.

This task adds configuration only. If routes changed here, the middleware matcher is catching something it should not - most likely it is missing the `admin` exclusion or the file-extension guard.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json next.config.js src/i18n src/middleware.ts messages src/i18n/routing.test.ts
git commit -m "feat(panel): configure next-intl, Thai unprefixed

Config only, no routes moved: Thai stays the unprefixed default locale so
every indexed URL is untouched, verified against the route baseline.

Middleware skips /admin - the operator back office is not translated and
locale negotiation there would only add a redirect hop."
```

---

### Task 4: Move app routes under `[locale]`

The risky task. Move the non-marketing customer pages under `app/[locale]/`. Marketing pages (home, solutions, lp) are handled separately in Task 5 because they are not translations of each other.

**Files:**
- Create: `src/app/[locale]/layout.tsx`
- Move: `src/app/{order,contact,delete-account,dashboard,terms,privacy,shop-owner-agreement,payment-policy,prohibited-content}` → `src/app/[locale]/...`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `routing` from `@/i18n/routing`.
- Produces: `app/[locale]/layout.tsx` exporting `generateStaticParams()` returning `[{locale:'th'},{locale:'en'}]`.

- [ ] **Step 1: Move the route directories with git mv**

Run:

```bash
mkdir -p "src/app/[locale]"
for d in order contact delete-account dashboard terms privacy shop-owner-agreement payment-policy prohibited-content; do
  git mv "src/app/$d" "src/app/[locale]/$d"
done
git status --short | head -20
```

Expected: renames listed, no errors. Use `git mv` (not `mv`) so history follows the files.

- [ ] **Step 2: Create the locale layout**

Create `src/app/[locale]/layout.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Pre-renders both locales at build time. Without this the whole [locale]
 * subtree becomes dynamic and the panel loses its 66 static pages.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as never)) notFound();

  // Required for static rendering: tells next-intl which locale this render
  // is for, since there is no request to infer it from at build time.
  setRequestLocale(locale);

  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
```

- [ ] **Step 3: Make the root layout locale-aware**

In `src/app/layout.tsx`, change the opening `<html>` tag. Replace:

```tsx
    <html lang="th" className={fontVariables}>
```

with:

```tsx
    <html lang={locale} className={fontVariables}>
```

and change the component signature from:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
```

to:

```tsx
export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: { locale?: string };
}) {
  // Falls back to Thai for the routes that still sit outside [locale]
  // (robots.ts, sitemap.ts and the marketing pages until Task 5 moves them).
  const locale = params?.locale ?? 'th';
```

- [ ] **Step 4: Make font preloading locale-aware**

Both Kanit subsets currently preload on every page, because the root layout
applies both variables regardless of language. An English page renders no Thai
glyphs, so its five Thai font files are pure waste at high priority.

In `src/app/layout.tsx`, replace the import:

```tsx
import { fontVariables } from '@/lib/fonts';
```

with:

```tsx
import { kanitLatin, kanitThai } from '@/lib/fonts';
```

and compute the class from the locale, just above the `return`:

```tsx
  // Thai pages need both subsets: Thai copy plus Latin numerals, prices and
  // brand names. English pages render no Thai glyphs, so applying only the
  // Latin instance drops five preloaded font files from every English page.
  const fontClass = locale === 'en' ? kanitLatin.variable : `${kanitLatin.variable} ${kanitThai.variable}`;
```

then use it:

```tsx
    <html lang={locale} className={fontClass}>
```

- [ ] **Step 5: Build and check route parity**

Run:

```bash
npm run build
./scripts/route-snapshot.sh > /tmp/routes.after-task4.txt
diff scripts/routes.baseline.txt /tmp/routes.after-task4.txt
```

Expected: the diff shows **only additions** of `/en/...` paths. Every line in the baseline must still be present.

Verify explicitly that nothing was lost:

```bash
comm -23 scripts/routes.baseline.txt /tmp/routes.after-task4.txt
```

Expected: **empty output**. Any line printed here is a Thai URL that disappeared - a constraint violation. Stop and fix before continuing.

- [ ] **Step 6: Verify lang and font preloads per locale**

Run:

```bash
TH=$(find .next/server/app -path '*terms.html' -not -path '*/en/*' | head -1)
EN=$(find .next/server/app -path '*en/terms.html' | head -1)
echo "th: $(grep -o '<html lang="[a-z]*"' "$TH" | head -1), preloads $(grep -o 'as="font"' "$TH" | wc -l)"
echo "en: $(grep -o '<html lang="[a-z]*"' "$EN" | head -1), preloads $(grep -o 'as="font"' "$EN" | wc -l)"
```

Expected: Thai reports `lang="th"` with `10` preloads; English reports `lang="en"` with `5`.

If English still shows 10, the locale-aware `fontClass` from Step 4 is not being applied - check that the root layout receives `params.locale` rather than falling back to `'th'`.

Note `grep -o ... | wc -l` rather than `grep -c`: the rendered HTML is a single minified line, and `grep -c` counts matching lines, which would report `1` for any number of preloads.

- [ ] **Step 7: Commit**

```bash
git add -A src/app
git commit -m "feat(panel): move customer routes under [locale]

Thai stays unprefixed so every indexed URL is byte-identical, verified with
comm against the pre-migration route baseline: additions only, no removals.

Root layout now emits a real <html lang> per locale, replacing the <div
lang=\"en\"> wrapper that the App Router's single-<html> rule had forced."
```

---

### Task 5: Fold the English marketing tree into `[locale]`

`app/en/page.tsx` and `app/[locale]/page.tsx` would both match `/en`. Resolve it by making the marketing routes dispatch on locale, since the Thai and English versions are genuinely different documents, not translations.

**Files:**
- Create: `src/app/[locale]/page.tsx`
- Create: `src/components/marketing/ThaiHome.tsx` (extracted from `src/app/page.tsx`)
- Move: `src/app/en/page.tsx` → `src/components/marketing/EnglishHome.tsx`
- Create: `src/app/[locale]/solutions/page.tsx`
- Create: `src/app/[locale]/lp/[slug]/page.tsx`
- Delete: `src/app/en/`, `src/app/page.tsx`, `src/app/solutions/`, `src/app/lp/`

**Interfaces:**
- Consumes: `LANDING_PAGES`, `getLandingBySlug` from `@/lib/seo/keywords`; `EN_LANDING_PAGES`, `getEnLandingBySlug` from `@/lib/seo/keywords.en`.
- Produces: `src/app/[locale]/lp/[slug]/page.tsx` exporting `generateStaticParams()` that emits Thai slugs for `th` and English slugs for `en`.

- [ ] **Step 1: Extract the Thai home into a component**

Move the entire default-export component body of `src/app/page.tsx` into `src/components/marketing/ThaiHome.tsx`, exporting it as `export default function ThaiHome()`. Keep every import it uses. Do not change any markup or copy - this is a pure move.

- [ ] **Step 2: Move the English home into a component**

```bash
mkdir -p src/components/marketing
git mv src/app/en/page.tsx src/components/marketing/EnglishHome.tsx
```

Then in `src/components/marketing/EnglishHome.tsx`:
- rename the component `export default function EnglishHome()`
- delete the `export const metadata` block (metadata moves to the route in Step 3)

- [ ] **Step 3: Create the dispatching home route**

Create `src/app/[locale]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import ThaiHome from '@/components/marketing/ThaiHome';
import EnglishHome from '@/components/marketing/EnglishHome';
import { SITE_URL } from '@/lib/seo/site';

/**
 * The Thai and English homepages are different documents, not translations:
 * the Thai page is the long-form sales page, the English one is purpose-built
 * for the English keyword set. So this route dispatches on locale rather than
 * rendering one body with swapped strings.
 *
 * These two ARE a real translation pair for hreflang purposes (unlike the
 * landing pages), which is why both declare the reciprocal alternates.
 */
export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  const alternates = {
    canonical: locale === 'en' ? '/en' : '/',
    languages: {
      'th-TH': `${SITE_URL}/`,
      en: `${SITE_URL}/en`,
      'x-default': `${SITE_URL}/`,
    },
  };

  if (locale === 'en') {
    return {
      title: 'Minecraft Webshop For Your Server - Free 7-Day Trial',
      description:
        'Hosted Minecraft webshop for Thai and SEA servers. AuthMe login, PromptPay and TrueMoney top-ups with automatic slip verification, and instant RCON item delivery. Free 7-day trial, no card required.',
      alternates,
      openGraph: { url: '/en', type: 'website', locale: 'en_US' },
    };
  }

  return {
    title: 'เช่าเว็บร้านค้ามายคราฟ ทดลองฟรี 7 วัน เดือนแรก ฿99 | SIAMSITE',
    description:
      'บริการเช่าเว็บร้านค้า Minecraft สำเร็จรูปสำหรับเซิร์ฟเวอร์ไทย เริ่มทดลองฟรี 7 วัน หรือเดือนแรกเพียง ฿99 รองรับ PromptPay ตรวจสลิปอัตโนมัติ และ TrueMoney อั่งเปา เชื่อม RCON ตรงด้วย Bridge Plugin ติดตั้งจบใน 10 นาที',
    alternates,
    openGraph: { url: '/', type: 'website', locale: 'th_TH' },
  };
}

export default function Home({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return locale === 'en' ? <EnglishHome /> : <ThaiHome />;
}
```

- [ ] **Step 4: Create the dispatching landing-page route**

Create `src/app/[locale]/lp/[slug]/page.tsx`. Move the body of the existing `src/app/lp/[slug]/page.tsx` (Thai) and `src/app/en/lp/[slug]/page.tsx` (English) into two components under `src/components/marketing/`, then dispatch:

```tsx
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LANDING_PAGES, getLandingBySlug } from '@/lib/seo/keywords';
import { EN_LANDING_PAGES, getEnLandingBySlug } from '@/lib/seo/keywords.en';
import ThaiLanding from '@/components/marketing/ThaiLanding';
import EnglishLanding from '@/components/marketing/EnglishLanding';

export const dynamicParams = false;

/**
 * Each locale contributes its OWN slugs. Thai slugs exist only under the bare
 * path and English slugs only under /en, because these pages are not
 * translations of one another and no slug is valid in both locales.
 */
export function generateStaticParams({ params: { locale } }: { params: { locale: string } }) {
  const pages = locale === 'en' ? EN_LANDING_PAGES : LANDING_PAGES;
  return pages.map((p) => ({ slug: p.slug }));
}

export default function LandingPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);
  const decoded = decodeURIComponent(slug);

  if (locale === 'en') {
    const page = getEnLandingBySlug(decoded);
    if (!page) notFound();
    return <EnglishLanding page={page} />;
  }

  const page = getLandingBySlug(decoded);
  if (!page) notFound();
  return <ThaiLanding page={page} />;
}
```

Do the same dispatch for `src/app/[locale]/solutions/page.tsx` using the existing Thai and English hub bodies.

- [ ] **Step 5: Remove the superseded routes**

```bash
git rm -r src/app/en src/app/lp src/app/solutions
git rm src/app/page.tsx
```

- [ ] **Step 6: Build and check route parity - the critical gate**

Run:

```bash
npm run build
./scripts/route-snapshot.sh > /tmp/routes.after-task5.txt
comm -23 scripts/routes.baseline.txt /tmp/routes.after-task5.txt
```

Expected: **empty output.** Every Thai URL from before the migration still exists.

Then confirm the English tree survived:

```bash
grep -c '^/en/lp/' /tmp/routes.after-task5.txt
grep -c '^/lp/' /tmp/routes.after-task5.txt
```

Expected: `13` English landing pages and `16` Thai ones.

- [ ] **Step 7: Verify the sitemap still emits everything**

Run:

```bash
grep -o "<loc>" .next/server/app/sitemap.xml.body | wc -l
grep -o 'hreflang="[^"]*"' .next/server/app/sitemap.xml.body | sort | uniq -c
```

Expected: `40` locations, and one each of `th-TH`, `en`, `x-default`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(panel): fold the English marketing tree into [locale]

app/en/page.tsx and app/[locale]/page.tsx both matched /en. Resolved by
dispatching on locale: the Thai and English homepages are different
documents (long-form sales page vs purpose-built English keyword page),
so they render different components rather than one translated body.

Landing pages contribute their own slugs per locale and stay on their own
datasets. They are still NOT an hreflang pair - only the homepages are."
```

---

### Task 6: Rewire the language switcher to next-intl

**Files:**
- Modify: `src/components/LanguageSwitcher.tsx`
- Modify: `src/components/Navbar.tsx`
- Test: `src/lib/seo/locale-path.test.ts` (already covers the mapping)

**Interfaces:**
- Consumes: `usePathname`, `useRouter` from `@/i18n/navigation`; `localePath`, `hasDirectCounterpart` from `@/lib/seo/locale-path`.
- Note: `Locale` is declared in **two** places - `@/i18n/routing` (derived from `routing.locales`) and `@/lib/seo/locale-path` (hand-written). Both resolve to `'th' | 'en'`, so they are structurally compatible today, but they will silently diverge if a locale is ever added. In this task, change `locale-path.ts` to re-export the routing one instead of declaring its own:

```ts
// src/lib/seo/locale-path.ts - replace the local declaration
import type { Locale } from '@/i18n/routing';
export type { Locale };
```

Then `localePath(pathname, target)` accepts exactly the locales `routing` knows about, and adding a third locale is a single-file change.

- [ ] **Step 1: Switch the imports**

In `src/components/LanguageSwitcher.tsx`, replace:

```tsx
import { useRouter, usePathname } from 'next/navigation';
```

with:

```tsx
import { useRouter, usePathname } from '@/i18n/navigation';
```

next-intl's `usePathname` returns the path **without** the locale prefix, which is what `localePath` already expects for Thai paths.

- [ ] **Step 2: Use locale-aware navigation**

Replace the `choose` function body:

```tsx
  const choose = (code: Locale) => {
    setOpen(false);
    if (code === active) return;
    // next-intl applies the prefix for the target locale, so pass the
    // unprefixed path and let routing decide whether /en is added.
    router.replace(localePath(pathname, code), { locale: code });
  };
```

- [ ] **Step 3: Hide the switcher inside /admin**

In `src/components/Navbar.tsx`, guard both render sites. Replace `<LanguageSwitcher />` with:

```tsx
{!pathname.startsWith('/admin') && <LanguageSwitcher />}
```

and `<LanguageSwitcher compact />` with:

```tsx
{!pathname.startsWith('/admin') && <LanguageSwitcher compact />}
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS, build succeeds.

- [ ] **Step 5: Verify switching works end to end**

Run:

```bash
npm run build && npm start &
sleep 8
curl -s localhost:2000/en/terms -o /dev/null -w "en/terms: %{http_code}\n"
curl -s localhost:2000/terms -o /dev/null -w "terms: %{http_code}\n"
kill %1
```

Expected: both return `200`.

- [ ] **Step 6: Commit**

```bash
git add src/components/LanguageSwitcher.tsx src/components/Navbar.tsx
git commit -m "feat(panel): switcher uses next-intl navigation, hidden in /admin

next-intl's usePathname returns the unprefixed path and its router applies
the target locale's prefix, so the switcher no longer hand-builds /en URLs.

Hidden inside /admin: the operator back office is not translated, and a
control that silently sends you to the home page is worse than no control."
```

---

### Task 7: Pilot page - order flow

The first real extraction. A form-heavy, high-stakes page: this is what a new customer touches first.

**Files:**
- Modify: `src/app/[locale]/order/page.tsx`
- Modify: `messages/th.json`, `messages/en.json`

- [ ] **Step 1: Inventory the strings**

Run:

```bash
grep -oP "[\x{0E00}-\x{0E7F}][^\"'\`<>{}]*" "src/app/[locale]/order/page.tsx" | sort -u | wc -l
```

Record the count. Every one of these must end up as a message key or be deliberately left (brand names, currency symbols).

- [ ] **Step 2: Add the `order` namespace**

Add to `messages/th.json` (keep existing keys):

```json
  "order": {
    "title": "สั่งซื้อแพ็กเกจ",
    "shopName": "ชื่อร้านค้า",
    "shopNamePlaceholder": "ตั้งชื่อร้านของคุณ",
    "domain": "โดเมน",
    "package": "แพ็กเกจ",
    "months": "{count} เดือน",
    "total": "ยอดรวม",
    "submit": "ยืนยันการสั่งซื้อ",
    "processing": "กำลังดำเนินการ",
    "errorRequired": "กรุณากรอก{field}"
  }
```

Add to `messages/en.json`:

```json
  "order": {
    "title": "Order a plan",
    "shopName": "Shop name",
    "shopNamePlaceholder": "Name your shop",
    "domain": "Domain",
    "package": "Plan",
    "months": "{count} months",
    "total": "Total",
    "submit": "Confirm order",
    "processing": "Processing",
    "errorRequired": "Please enter {field}"
  }
```

Extend both with a key for every string found in Step 1. Keys are semantic, not English-derived.

- [ ] **Step 3: Consume the messages in the page**

At the top of the component in `src/app/[locale]/order/page.tsx`:

```tsx
import { useTranslations } from 'next-intl';
```

and inside the component:

```tsx
  const t = useTranslations('order');
```

Then replace each hardcoded Thai string with its key, e.g. `<h1>สั่งซื้อแพ็กเกจ</h1>` becomes `<h1>{t('title')}</h1>`, and `{months} เดือน` becomes `{t('months', { count: months })}`.

- [ ] **Step 4: Verify no Thai literals remain**

Run:

```bash
grep -oP "[\x{0E00}-\x{0E7F}][^\"'\`<>{}]*" "src/app/[locale]/order/page.tsx" | sort -u
```

Expected: **empty output.** Any remaining line is an unextracted string.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm test
npm run build
```

Expected: the message-parity test from Task 3 PASSES (proving `order` was added to both locales), and the build succeeds.

- [ ] **Step 6: Verify both renderings**

Run:

```bash
npm start &
sleep 8
curl -s localhost:2000/order    | grep -o "สั่งซื้อแพ็กเกจ" | head -1
curl -s localhost:2000/en/order | grep -o "Order a plan"   | head -1
kill %1
```

Expected: the Thai string on `/order`, the English string on `/en/order`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/[locale]/order/page.tsx" messages/
git commit -m "i18n(panel): extract order flow strings

First real extraction and the highest-stakes page: it is what a new
customer touches first. Keys are semantic rather than English-derived, so
a copy change in one language does not orphan the other."
```

---

### Task 8: Pilot page - dashboard/topup

The money path. Proves the pattern on a page with currency, numbers and API-driven state.

**Files:**
- Modify: `src/app/[locale]/dashboard/topup/page.tsx`
- Modify: `messages/th.json`, `messages/en.json`

- [ ] **Step 1: Inventory the strings**

Run:

```bash
grep -oP "[\x{0E00}-\x{0E7F}][^\"'\`<>{}]*" "src/app/[locale]/dashboard/topup/page.tsx" | sort -u | wc -l
```

- [ ] **Step 2: Add the `topup` namespace**

Add to `messages/th.json`:

```json
  "topup": {
    "title": "เติมเงิน",
    "amount": "จำนวนเงิน",
    "method": "ช่องทางการชำระเงิน",
    "promptpay": "พร้อมเพย์ (PromptPay)",
    "truemoney": "ทรูมันนี่ อั่งเปา",
    "uploadSlip": "อัปโหลดสลิป",
    "verifying": "กำลังตรวจสอบสลิป",
    "success": "เติมเงินสำเร็จ",
    "failed": "เติมเงินไม่สำเร็จ",
    "balance": "ยอดเงินคงเหลือ"
  }
```

Add to `messages/en.json`:

```json
  "topup": {
    "title": "Top up",
    "amount": "Amount",
    "method": "Payment method",
    "promptpay": "PromptPay",
    "truemoney": "TrueMoney Angpao",
    "uploadSlip": "Upload slip",
    "verifying": "Verifying slip",
    "success": "Top-up complete",
    "failed": "Top-up failed",
    "balance": "Balance"
  }
```

Extend to cover every string from Step 1.

- [ ] **Step 3: Consume the messages**

Add `const t = useTranslations('topup');` and replace each literal, exactly as in Task 7 Step 3.

Leave the `฿` symbol and numeric formatting alone. Currency is Baht in both locales (see `.agents/context/SYSTEM.md`); do not "translate" it to a dollar sign or convert amounts.

- [ ] **Step 4: Verify no Thai literals remain**

Run:

```bash
grep -oP "[\x{0E00}-\x{0E7F}][^\"'\`<>{}]*" "src/app/[locale]/dashboard/topup/page.tsx" | sort -u
```

Expected: empty output.

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`

Expected: PASS and a successful build.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/dashboard/topup/page.tsx" messages/
git commit -m "i18n(panel): extract top-up page strings

The money path, and the second pilot: proves the pattern on a page with
currency, numeric state and API-driven status text.

Baht symbol and amounts are deliberately not localised. Currency is THB in
both locales; only the surrounding copy changes."
```

---

### Task 9: Pilot page - terms (prose)

The third shape: long-form legal prose rather than UI chrome. Also the highest-value legal page for English visitors.

**Files:**
- Create: `messages/legal/th.json`, `messages/legal/en.json` **or** extend the existing files with a `legal` namespace (pick one; the plan assumes the namespace approach for consistency with Tasks 7-8)
- Modify: `src/app/[locale]/terms/page.tsx`

- [ ] **Step 1: Decide the prose strategy**

Long legal prose does not belong in a flat key-value file as one giant string per paragraph, and it must not be machine-translated without review.

Use a `legal.terms` namespace with one key per **section**, where each value is that section's full text. Sections are the natural unit: they are individually meaningful, they map to the existing headings, and a lawyer reviewing the English can diff them against the Thai one to one.

- [ ] **Step 2: Add the namespace**

Add to `messages/th.json` a `legal` object whose `terms` key holds `heading`, `lastUpdated`, and one key per section, copied verbatim from the current page.

Add the English equivalent to `messages/en.json`.

**Copy accuracy matters more than fluency here.** If a clause's meaning is uncertain, keep the Thai wording in a comment and flag it in the commit body rather than guessing at a legal term.

- [ ] **Step 3: Consume the messages**

In `src/app/[locale]/terms/page.tsx`, add `const t = useTranslations('legal.terms');` and replace each section body with `{t('sectionKey')}`.

- [ ] **Step 4: Verify no Thai literals remain**

Run:

```bash
grep -oP "[\x{0E00}-\x{0E7F}][^\"'\`<>{}]*" "src/app/[locale]/terms/page.tsx" | sort -u
```

Expected: empty output.

- [ ] **Step 5: Full verification sweep**

Run:

```bash
npm test
npm run build
./scripts/route-snapshot.sh > /tmp/routes.final.txt
comm -23 scripts/routes.baseline.txt /tmp/routes.final.txt
```

Expected: tests PASS, build succeeds, and `comm` prints **empty output** - no Thai URL was lost across the entire phase.

Then confirm the other invariants:

```bash
grep -rl "fonts.googleapis\|fonts.gstatic" .next/server/app/ | wc -l
grep -o 'as="font"' .next/server/app/\[locale\]/terms.html | wc -l
```

Expected: `0` Google font references, and a font preload count of `10` or fewer.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/terms/page.tsx" messages/
git commit -m "i18n(panel): extract terms of service

Third pilot and the third content shape: long-form prose rather than UI
chrome. Keyed per section so the English can be reviewed against the Thai
clause by clause.

Completes phase 1. Route baseline verified unchanged across the whole
migration: no indexed Thai URL moved."
```

---

## Phase 1 Done When

- [ ] `comm -23 scripts/routes.baseline.txt <current>` prints nothing
- [ ] `npm test` passes
- [ ] `npm run build` succeeds with no network access
- [ ] `/terms` renders Thai, `/en/terms` renders English
- [ ] `<html lang>` is correct per locale, and English pages preload 5 font files rather than 10
- [ ] Sitemap still emits 40 URLs with homepage hreflang intact
- [ ] Switcher does not render inside `/admin`

**Not in this phase:** the remaining 6 dashboard pages, profile, the other 5 legal pages, and the ~1,571-string bulk extraction. Those get their own plans.
