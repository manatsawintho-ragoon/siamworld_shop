# Ship the Hardening Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge six commits of finished security and reliability work to `master` and roll it out to the panel plus 9 active shop tenants, without waking 6 suspended tenants.

**Architecture:** Staged canary rollout. One pre-flight code fix, then merge, then deploy in increasing blast-radius order: panel (isolated) to `testwebshop` (canary, full smoke test) to the 8 remaining active shops (behind an explicit human gate). Deploys build from the checked-out working tree, so the merge must land before any rebuild.

**Tech Stack:** Node.js + Express + TypeScript, Next.js 14, MySQL 8, Redis 7, Docker Compose, jest, `jsonwebtoken@9.0.3`.

**Spec:** `docs/superpowers/specs/2026-07-20-ship-hardening-branch-design.md`

## Global Constraints

- Deploys use `deploy/manage-customer.sh` only. Never run `docker build` or `docker run` directly, or the port and `SOURCE_ROOT` wiring will be wrong.
- Never rebuild, start, or otherwise wake a suspended tenant: `mcvalley`, `bluefinix`, `nackshop`, `jsnsmp`, `gamexd`, `edtryrtu`. If one is woken by accident, stop it again immediately.
- The merge to `master` must complete before any rebuild. `rebuild` builds from the checked-out working tree, not a tagged image.
- Pre-merge rollback point is `master` at `fa3aa59`. Branch head is `80997e4`.
- Task 6 (customer shops) requires explicit human go-ahead. Do not begin it autonomously.
- No em dash in any user-facing shop or panel copy.

---

### Task 1: Pin the JWT algorithm on the panel `/exchange` route

Closes the consistency gap found in review: `/exchange` verifies a JWT taken
straight from the request body, while its sibling middleware was pinned in the
same commit.

**On testing:** this is a one-line change to a route whose handler needs Redis
sessions and full app wiring, and no integration harness exists for it yet.
Standing up that harness is the separately-scoped money-path testing
sub-project, not this rollout. The behavioural verification for this change is
the canary login in Task 5, which exercises the pinned path end to end. Do not
fabricate a unit test that only re-asserts `jsonwebtoken`'s own behaviour.

**Files:**
- Modify: `panel/backend/src/routes/auth.routes.ts:211`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no new exports. Behaviour change only: `/exchange` now rejects
  tokens signed with HS384 or HS512.

- [ ] **Step 1: Apply the pin**

In `panel/backend/src/routes/auth.routes.ts`, change line 211 from:

```typescript
    decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
```

to:

```typescript
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
```

This matches `panel/backend/src/middleware/auth.ts:40` exactly.

- [ ] **Step 2: Typecheck the panel backend**

Run: `cd panel/backend && npx tsc --noEmit`
Expected: exits 0, no output.

- [ ] **Step 3: Run the panel backend test suite**

Run: `cd panel/backend && npm test`
Expected: PASS. Existing suites are `lifecycle.test.ts`, `customDomain.test.ts`, `activity-events.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add panel/backend/src/routes/auth.routes.ts
git commit -m "harden(panel): pin JWT algorithm on /exchange

The route verifies a token taken directly from the request body while
its sibling middleware was pinned in be3f255. Low severity on
jsonwebtoken@9.0.3, which infers HMAC-only from a string secret and
rejects alg:none, so this is consistency rather than an exploitable
hole."
```

---

### Task 2: Verify the branch builds clean before it becomes master

Nothing ships until both apps typecheck and both suites pass. A broken `master`
here means a broken build on 9 tenants.

**Files:** none modified.

**Interfaces:**
- Consumes: the pin from Task 1.
- Produces: a green build, gating Task 3.

- [ ] **Step 1: Shop backend typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 2: Shop backend tests**

Run: `cd backend && npm test`
Expected: PASS. Includes `loot-box.pick.test.ts` added on this branch, plus `wallet`, `payment.credit`, `promptpay.payload`, `receiver-match`, `wsOrigin`, `rcon-manager.bedrock`, `playerTracker.diff`, `truemoney.*`, `rotatingPassword`.

- [ ] **Step 3: Shop frontend build**

Run: `cd frontend && npm run build`
Expected: Next.js build completes. This is the real check on the new `next.config.js` security headers block, since a malformed header config fails at build time.

- [ ] **Step 4: Panel frontend build**

Run: `cd panel/frontend && npm run build`
Expected: build completes. Exercises the redesigned `app/page.tsx` (1157 lines changed) and the new `app/order/layout.tsx`.

- [ ] **Step 5: Record results**

If any step fails, STOP. Do not proceed to Task 3. Report the failure with its
output rather than working around it.

---

### Task 3: Merge to master

**Files:**
- Modify: git refs only.

**Interfaces:**
- Consumes: green build from Task 2.
- Produces: `master` containing the hardening work, the build source for every subsequent rebuild.

- [ ] **Step 1: Confirm the rollback point**

Run: `git rev-parse --short master`
Expected: `fa3aa59`. If it differs, `master` moved since planning. STOP and re-check before merging.

- [ ] **Step 2: Confirm a clean tree**

Run: `git status --short`
Expected: empty output.

- [ ] **Step 3: Merge**

```bash
git checkout master
git merge --no-ff fix/seo-ssr-schema-sitemap -m "merge: security and reliability hardening

JWT algorithm pinning, non-root containers, frontend CSP and security
headers, graceful drain, per-tenant memory limits, strict IP validation,
SSR landing page and sitemap cleanup, loot-box odds extraction + tests."
```

- [ ] **Step 4: Verify the merge**

Run: `git log --oneline -1 && git status --short`
Expected: merge commit present, tree clean.

- [ ] **Step 5: Confirm migrations did not drift**

Run: `ls migrations/*.sql | wc -l`
Expected: `32`. This guards against the recorded incident where a mid-rebuild branch switch shipped a tree with 29 migrations instead of 31.

---

### Task 4: Deploy the panel

Isolated tenant. Proves the non-root Dockerfile change works before any customer
is exposed to it.

**Files:**
- Modify: running containers only.

**Interfaces:**
- Consumes: merged `master` from Task 3.
- Produces: a verified non-root panel build, gating Task 5.

- [ ] **Step 1: Deploy**

```bash
docker compose -f deploy/panel-compose.yml --env-file deploy/panel.env up -d --build panel-backend panel-frontend
```

- [ ] **Step 2: Check status before reacting to any error**

Run: `docker ps --filter name=panel --format '{{.Names}}\t{{.Status}}'`
Expected: `panel-backend` and `panel-frontend` both `Up` and `healthy`.

Building `panel-frontend` pulls `panel-backend` into a recreate via
`depends_on`, and the resulting `<hash>_panel-backend` name conflict reads as a
failure while the container is actually running. Check this output before
re-running anything.

- [ ] **Step 3: Confirm the container user is as designed**

```bash
docker exec panel-backend id
docker exec panel-frontend id
```

Expected:
- `panel-frontend`: non-zero `uid=` (currently `uid=1000(node)`). If this is `uid=0(root)`, the non-root change did not take effect. STOP and report.
- `panel-backend`: `uid=0(root)` is **correct and intended**. `panel/backend/Dockerfile:2-4` documents why: it drives Docker on the host (docker.sock, nsenter, iptables) to deploy and manage customer shops on the same VPS. This is the accepted single-VPS control-plane design. Do not "fix" it.

The non-root hardening applies to the shop images (`backend/Dockerfile:33` and `frontend/Dockerfile:41`, both `USER node`), which is what Task 5 verifies.

- [ ] **Step 4: Confirm the panel serves**

Run: `curl -sS -o /dev/null -w '%{http_code}\n' https://panel.siamsite.shop`
Expected: `200`.

- [ ] **Step 5: Confirm panel login works**

Log in to the panel through the browser. This exercises the Task 1 pin.
Expected: login succeeds, dashboard renders.

If login fails, roll back immediately per Task 7 before touching any shop.

---

### Task 5: Canary rebuild on testwebshop

The one risk that reading the diff could not clear is whether the non-root
container change breaks file permissions at runtime. This task answers that on a
test tenant instead of on 8 paying ones.

**Files:**
- Modify: running containers only.

**Interfaces:**
- Consumes: verified panel deploy from Task 4.
- Produces: empirical proof the shop image is safe, gating Task 6.

- [ ] **Step 1: Rebuild the canary**

```bash
deploy/manage-customer.sh --action rebuild --name testwebshop
```

This runs `up -d --build --no-deps backend`, then the same for `frontend`, then
applies migrations. Migrations are a no-op here (no drift).

- [ ] **Step 2: Confirm containers are healthy**

Run: `docker ps --filter name=sw-testwebshop --format '{{.Names}}\t{{.Status}}'`
Expected: `sw-testwebshop-backend-1` and `sw-testwebshop-frontend-1` both `Up` and `healthy`.

- [ ] **Step 3: Confirm non-root**

```bash
docker exec sw-testwebshop-backend-1 id
docker exec sw-testwebshop-frontend-1 id
```
Expected: non-zero `uid=`.

- [ ] **Step 4: Check logs for permission errors**

Run: `deploy/manage-customer.sh --action logs --name testwebshop` (Ctrl+C after ~20 lines)
Expected: no `EACCES`, no `permission denied`, no restart loop. This is the specific failure mode the non-root change would produce.

- [ ] **Step 5: Smoke test in the browser**

Each item maps to a specific risk in this diff. Record pass/fail per item.

| Check | Validates |
|---|---|
| Log in as a test user | JWT algorithm pin, end to end |
| Font Awesome icons render across the shop | CSP `style-src`/`font-src` allowlist for `cdnjs.cloudflare.com` |
| Browser devtools console has zero CSP violation errors | the whole CSP block |
| Online-players widget shows a count | CSP `connect-src ... wss:` plus Socket.IO |
| Complete one purchase through to RCON delivery | the money path, unchanged but highest-consequence |

Any failure STOPS the rollout. Roll back per Task 7 before touching customer shops.

- [ ] **Step 6: Verify graceful drain**

```bash
deploy/manage-customer.sh --action restart --name testwebshop
rtk proxy bash -c "docker logs sw-testwebshop-backend-1 --tail 40 2>&1"
```
Expected: a `SIGTERM received, shutting down...` line followed by
`RCON pool: all connections closed`, and no `Graceful shutdown timed out` line.
Confirms the handler runs and completes inside its 10s budget.

Two gotchas observed when this ran on 2026-07-20:

1. **Read the log through `rtk proxy`.** RTK truncates and filters long output,
   which made a successful drain look like a missing log line. Any verification
   step whose conclusion depends on complete output must bypass RTK.
2. **`--action restart` restarts MySQL and Redis too**, so the backend briefly
   logs `Failed to start server ... ECONNREFUSED :3306` and restarts once or
   twice before MySQL is ready. This is pre-existing retry behaviour, not a
   regression, and it self-heals. It does **not** affect Task 6, because
   `rebuild` uses `--no-deps` and never touches the database tier.

---

### Task 6: Roll out to the 8 remaining active shops

**STOP. This task requires explicit human go-ahead.** It is the first task that
touches paying customers, and approval of the spec or plan does not cover it.
Ask, and wait for a clear yes.

**Files:**
- Modify: running containers only.

**Interfaces:**
- Consumes: a fully passed canary from Task 5.
- Produces: hardened build on all active tenants.

- [ ] **Step 1: Confirm the suspended list is unchanged**

Run: `docker ps -a --filter name=sw- --format '{{.Names}}\t{{.Status}}' | grep Exited`
Expected: only containers belonging to `mcvalley`, `bluefinix`, `nackshop`, `jsnsmp`, `gamexd`, `edtryrtu`.

If an unexpected shop appears here, STOP and report. Do not rebuild it to "fix" it.

- [ ] **Step 2: Rebuild each shop, one at a time**

Run these one at a time, not as a loop. Confirm health after each before
starting the next.

```bash
deploy/manage-customer.sh --action rebuild --name gfloorsmp
deploy/manage-customer.sh --action rebuild --name helloworld
deploy/manage-customer.sh --action rebuild --name mylove
deploy/manage-customer.sh --action rebuild --name mimo
deploy/manage-customer.sh --action rebuild --name jackcraft
deploy/manage-customer.sh --action rebuild --name honeyland
deploy/manage-customer.sh --action rebuild --name yokaicraft
deploy/manage-customer.sh --action rebuild --name mchanom
```

After each one:

```bash
docker ps --filter name=sw-<name> --format '{{.Names}}\t{{.Status}}'
```
Expected: backend and frontend both `Up` and `healthy`. If a shop fails, STOP the sequence and roll back that shop per Task 7. Do not continue down the list.

- [ ] **Step 3: Final state check**

Run: `docker ps -a --filter name=sw- --format '{{.Names}}\t{{.Status}}'`
Expected: 9 active shops `Up (healthy)`; the 6 suspended shops still `Exited`, with their original exit codes and no restart.

- [ ] **Step 4: Spot-check two live shops in the browser**

Pick any two rebuilt shops. Confirm the page loads, icons render, and the
console is free of CSP violations.

---

### Task 7: Rollback procedure

Not a task to execute in sequence. This is the documented recovery path
referenced by Tasks 4, 5 and 6.

- [ ] **Step 1: Return the working tree to the pre-merge state**

```bash
git checkout fa3aa59
```

- [ ] **Step 2: Rebuild the affected tenant from that tree**

For a shop:
```bash
deploy/manage-customer.sh --action rebuild --name <name>
```

For the panel:
```bash
docker compose -f deploy/panel-compose.yml --env-file deploy/panel.env up -d --build panel-backend panel-frontend
```

- [ ] **Step 3: Confirm recovery**

Run: `docker ps --filter name=<name> --format '{{.Names}}\t{{.Status}}'`
Expected: `Up` and `healthy`.

Because builds come from the working tree, rollback is a checkout plus a
rebuild. No image registry is involved.

- [ ] **Step 4: Report before retrying**

Report what failed, with the actual command output, before attempting a fix.
Do not retry the same rebuild and hope for a different result.

---

## Success Criteria

- Panel and all 9 active shops run the hardened build.
- All 6 suspended shops remain stopped, unchanged.
- Non-root confirmed by `id` output, not assumed.
- Canary smoke test passed every item.
- No customer-visible regression in login, purchase, icons, or the online-players widget.

## Out of Scope

Money-path test coverage, the admin config-first overhaul, and customer-facing
conversion work are separate sub-projects. This plan ships existing work and
adds no features.
