# Ship the hardening branch to production

Date: 2026-07-20
Branch: `fix/seo-ssr-schema-sitemap` (head `80997e4`)
Target: `master` (pre-merge `fa3aa59`)

## Problem

Six commits of finished security and reliability work sit unmerged on
`fix/seo-ssr-schema-sitemap`. The branch is 6 ahead / 0 behind `master` with a
clean tree. Production runs 9 active shops plus the panel, none of which have
these fixes. The work is already paid for; it is simply not deployed.

Included in the branch:

- `harden(security)` (`be3f255`): JWT algorithm pinning, non-root containers,
  frontend CSP and security headers.
- `harden(reliability)` (`d192f63`): graceful drain, per-tenant memory limits,
  strict IP validation.
- `fix(seo)` (`bc1ef6f`): server-rendered landing page, removed a fabricated
  rating, cleaned sitemap.
- Panel landing page redesign and a loot-box odds extraction with unit tests.

## Goal

Get the security and reliability fixes onto every active tenant without waking
suspended tenants and without discovering a container regression across all of
them at once.

## Risk review (completed by reading the diff)

| Change | Blast radius | Verdict |
|---|---|---|
| JWT algorithm pin | 9 shops | Safe. Every `jwt.sign` call passes a string secret with no `algorithm` option, so tokens are already HS256. Pinning cannot lock anyone out. |
| Shop CSP and headers | 9 shops | Safe. `cdnjs.cloudflare.com` (Font Awesome), Google Fonts and `wss:` are allowlisted. Inline JSON-LD is covered by `script-src 'unsafe-inline'`. |
| Graceful drain | 9 shops | Safe. 10s force-exit timer, `unref()`'d, so the process always exits. |
| Non-root containers | 9 shops | Unverified by reading. File-permission behaviour at runtime is an empirical question. This is the reason the rollout is staged. |
| Panel landing redesign | Panel only | Cosmetic, isolated tenant. |
| Migrations | None | No drift: 32 files on both `master` and branch. The recorded mass-rebuild migration hazard is not triggered. |

### Defect found during review

`panel/backend/src/routes/auth.routes.ts:211` verifies a JWT taken directly from
the request body without an algorithm pin, while its sibling
`panel/backend/src/middleware/auth.ts:40` was hardened in the same commit.

Severity is low, not critical. Both services run `jsonwebtoken@9.0.3`, which
infers HMAC-only algorithms from a string secret and rejects `alg: none`, so
neither algorithm confusion nor `none` forgery is reachable. It is fixed here
for consistency because the codebase clearly intends the pin, not because it is
exploitable. Recording the accurate severity matters more than an alarming one.

## Approach

Staged canary: panel, then one test shop, then the remaining active shops.

Rejected alternatives:

- **Merge and rebuild everything.** Fastest, but a non-root permission
  regression would surface on 9 tenants simultaneously.
- **Split the branch into separate panel and shop merges first.** Cleaner
  rollback granularity, but it delays shipping security fixes to do git
  archaeology, and the staged rollout already provides the safety the split
  would buy.

## Plan

### Phase 0: pre-flight

1. Add `{ algorithms: ['HS256'] }` to the `jwt.verify` call at
   `panel/backend/src/routes/auth.routes.ts:211`.
2. Run the backend test suite and `tsc` for both shop and panel. The branch must
   build clean before it becomes `master`.

### Phase 1: merge

Merge `fix/seo-ssr-schema-sitemap` into `master`.

This must precede every rebuild. `manage-customer.sh rebuild` builds from the
checked-out working tree, not from a tagged image, so the branch that is checked
out at build time determines what ships. This is the mechanism behind the
previously recorded incident where a mid-rebuild branch switch shipped a tree
with 29 migrations instead of 31.

### Phase 2: deploy panel

Deploy the panel first. It is an isolated tenant and proves the non-root
Dockerfile change before any customer is exposed to it.

Known gotcha: building `panel-frontend` pulls `panel-backend` into a recreate
through `depends_on`, and the resulting `<hash>_panel-backend` name conflict
reads as a failure while the container is in fact running. Check `docker ps`
before re-running anything.

### Phase 3: canary on `testwebshop`

```
deploy/manage-customer.sh --action rebuild --name testwebshop
```

Smoke test, where each item targets a specific risk in this diff:

- `docker exec sw-testwebshop-backend-1 id` returns a non-root UID. This is the
  single risk that reading the diff could not clear.
- Log in. Exercises the JWT algorithm pin end to end.
- Load the shop. Browser console free of CSP violations, Font Awesome icons
  render. Validates the `cdnjs` allowlist.
- Online-players widget connects. Validates `connect-src ... wss:`.
- Complete one purchase through to RCON delivery. The money path.
- Redeploy once and confirm the graceful-drain log line on `SIGTERM`.

Any failure stops the rollout and triggers rollback before other tenants are
touched.

### Phase 4: remaining active shops

Requires explicit human go-ahead. Phase 4 is not covered by approval of this
spec, because it is the first phase that touches paying customers.

Targets: `gfloorsmp`, `helloworld`, `mylove`, `mimo`, `jackcraft`, `honeyland`,
`yokaicraft`, `mchanom`.

Rebuild one at a time, confirming health between each.

### Never touch: suspended shops

`mcvalley`, `bluefinix`, `nackshop`, `jsnsmp`, `gamexd`, `edtryrtu`.

All six show the suspended signature: mysql and redis `Exited (0)`. Skipping is
mandatory, not a preference. `rebuild` runs
`up -d --build --no-deps backend`, which starts the web tier without its
database and cache, producing a backend crash loop on a suspended tenant. These
shops resume through the panel when the subscription is renewed. If one is woken
by accident, stop it again immediately.

## Rollback

`git checkout fa3aa59` (pre-merge `master`), then re-run `rebuild` for the
affected shop. Because builds come from the working tree, rollback is a checkout
plus a rebuild and involves no image registry.

## Success criteria

- Panel and all 9 active shops run the hardened build.
- All 6 suspended shops remain stopped, in the same state as before.
- Canary smoke test passes every item, with the non-root UID confirmed by
  command output rather than assumed.
- No customer-visible regression in login, purchase, icons or the online-players
  widget.

## Out of scope

Money-path test coverage, the admin config-first overhaul and customer-facing
conversion work are separate sub-projects. This spec covers shipping existing
work only, and adds no features.
