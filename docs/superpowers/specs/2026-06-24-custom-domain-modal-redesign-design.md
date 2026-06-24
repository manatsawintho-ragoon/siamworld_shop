# Custom Domain Modal Redesign + Auto-cleanup

Date: 2026-06-24
Branch: `feat/custom-domains`
Builds on: `docs/superpowers/specs/2026-06-23-custom-domains-design.md` (BYOD via Cloudflare for SaaS, already deployed 2026-06-24).

## Problem

The current custom-domain UX is a full-page route (`/dashboard/domain`). The owner wants:

1. A **popup modal** opened from the dashboard "โดเมน" button instead of navigating to a page.
2. **Per-registrar setup guides** (z.com, Hostinger, Cloudflare, GoDaddy/Namecheap, + generic fallback) so a customer knows exactly what to enter, with each registrar's own field labels and gotchas.
3. Clearer **status tracking** and **step-by-step guidance** (how to pick/enter a subdomain, what to do next at each stage).
4. Keep everything **automatic** end-to-end.
5. Resolve the **billing exposure**: Cloudflare for SaaS bills per existing custom hostname (first 100 free, then $0.10/hostname/mo). Today nothing deletes a customer's CF custom hostname when their shop goes away, so abandoned hostnames accumulate and consume the free-100 quota. Fix: tie custom-domain teardown to the shop lifecycle.

## Goals

- Replace the page with a reusable `<DomainModal>` opened from the dashboard.
- Tailored, copy-friendly CNAME instructions per registrar with a generic fallback.
- Smart subdomain input with live validation, prefix suggestion, and a live URL preview.
- A visual status stepper with auto-poll (reuse the existing `pending_dns → pending_ssl → active → failed` state machine).
- Automatic custom-domain lifecycle tied to the shop: detach on suspend, re-attach on unsuspend/renew, fully delete the CF hostname when the shop is deleted.

## Non-goals (YAGNI)

- Apex / root-domain support (subdomain only, unchanged — apex still rejected).
- Auto-detecting the customer's registrar (the user selects it).
- More than one custom domain per shop (1 shop = 1 custom domain).
- Recovery/backup of an auto-deleted shop's data. Auto-delete is permanent (`docker compose down -v` wipes the shop's MySQL volume). A final warning email is sent before deletion; there is no undo.

## Architecture

### Frontend

New component `panel/frontend/src/components/DomainModal.tsx` (+ small sub-components), following the existing hand-rolled overlay pattern in `AuthModal.tsx` (`isOpen`/`onClose`, mounted/animate, fixed overlay, Esc/backdrop close). No new UI dependency — the panel has no shadcn Dialog; we reuse Card/Button/Badge and Lucide/Font Awesome icons per the project icon rule.

The modal renders one of five content states driven by the existing API (`GET/POST/DELETE /api/subscriptions/:id/custom-domain`, `POST .../verify`):

1. **No domain yet** — subdomain input + guidance (see below).
2. **pending_dns** — CNAME instructions + registrar selector + auto-poll.
3. **pending_ssl** — "issuing certificate" spinner + auto-poll.
4. **active** — Live badge, both URLs, open-shop button, remove button.
5. **failed** — reason + retry/remove.

Sub-components:
- `DomainStepper` — 4-step progress indicator mapped from status.
- `RegistrarGuide` — registrar selector (chips/dropdown) + the selected registrar's tailored steps. Pure presentational; takes `{ host, cname }`.

#### Subdomain input (state 1)
- Field shows a suggested `shop.` prefix; live preview line: `ลูกค้าจะเข้าผ่าน https://<input>`.
- Live validation (client-side, mirrors server `validateCustomHostname`):
  - reject apex (no dot / registrable domain only) → message "ยังไม่รองรับโดเมนหลัก กรุณาใส่ subdomain เช่น shop.yourdomain.com" + a one-tap button to prepend `shop.`.
  - reject `*.siamsite.shop`.
  - reject invalid characters; auto-trim spaces and a pasted `http(s)://` scheme.
- Server remains the source of truth; client validation is UX-only.

#### Registrar guide (state pending_dns)
Selector with: z.com (GMO), Hostinger, Cloudflare, GoDaddy, Namecheap, generic. Each shows Type=CNAME, Name/Host, Value/Target with per-field copy buttons, plus registrar-specific notes:

| Registrar | Tailored note |
|-----------|---------------|
| z.com (GMO) | DNS settings → add CNAME; "ホスト名 / Host" = the subdomain part only (e.g. `shop`). |
| Hostinger | hPanel → DNS / Nameservers → Manage → Add record → CNAME; Name=`shop`, Target=`custom.siamsite.shop`, TTL 14400. |
| Cloudflare | ⚠️ Set **Proxy status = DNS only (grey cloud)**. Orange cloud causes an SSL loop / error 1014. |
| GoDaddy | DNS → Add → CNAME; Name=`shop`, Value=target. |
| Namecheap | Advanced DNS → Add New Record → CNAME; Host=`shop`, Target=target. |
| generic | Type=CNAME, Host/Name=`shop` (front part only, not the full domain), Value/Target=`custom.siamsite.shop`. |

Shared note on every registrar: "บางค่ายช่อง Name ใส่แค่ส่วนหน้า (`shop`) ไม่ใช่โดเมนเต็ม" + a "ไม่เจอเมนู? ดูแบบ generic" link. The "Name" example is derived from the entered host (label before the registrable domain).

#### Info always shown
- Both domains: `xxx.siamsite.shop` (สำรอง ใช้ได้ตลอด) and the custom domain.
- Approx timing hint ("DNS อาจใช้ 5-30 นาที").
- Active state note: "ถ้าร้านหมดอายุ โดเมนนี้จะหยุดทำงานชั่วคราว ต่ออายุแล้วกลับมาเองอัตโนมัติ".

### Routing
`dashboard/page.tsx`: the "โดเมน" button (currently a `<Link href="/dashboard/domain?id=...">`) becomes a button that opens `<DomainModal subId={sub.id} />`.
`dashboard/domain/page.tsx`: reduced to a thin client redirect to `/dashboard` (preserves old bookmarks). All logic moves into the modal component.

### Backend — automatic custom-domain lifecycle

No new cron. Hook into existing shop-lifecycle transitions. All operations are best-effort/idempotent and must not block the primary action (wrap in try/catch + log), matching the existing `applySSL` non-critical pattern.

| Shop event | Code site | Custom-domain action |
|------------|-----------|----------------------|
| Suspend (auto, past grace) | `notification.service.ts` `suspendExpired()` | If `custom_domain` set & active → `npmService.removeDomainFromProxyHost(domain, custom_domain)`. **Keep** the CF hostname and all DB fields (including `custom_domain_status='active'`) untouched; the NPM detach alone takes the domain offline while the shop is down. Status stays `active` so unsuspend/renew can detect it and re-attach. |
| Suspend/stop (manual) | `subscription.service.ts` action `'suspend'`/`'stop'` | Same NPM detach as above. |
| Unsuspend (manual) | `subscription.service.ts` action `'unsuspend'` | If `custom_domain` active & CF hostname still present → `npmService.addDomainToProxyHost(domain, custom_domain)` (re-attach). |
| Renew | `subscription.service.ts` `renew()` | If sub was suspended and `custom_domain` active → re-attach NPM (same as unsuspend). |
| Delete shop (manual) | `subscription.service.ts` `adminRemove()` | Before `DELETE FROM subscriptions`: delete the CF custom hostname (`cloudflareService.deleteCustomHostname(custom_hostname_id)`) if set. (NPM detach is implicit: `removeShop` deletes the whole shop proxy host.) |
| **Delete shop (auto, NEW)** | new `notification.service.ts` `deleteExpired()` + daily cron | See "Auto-suspend & auto-delete lifecycle" below. |

### Auto-suspend & auto-delete lifecycle (NEW)

Owner requirement (2026-06-24): suspend a non-renewed shop after **3 days** overdue, then **permanently delete** the shop (containers + MySQL volume/database + custom domain + DNS + subscription row) after **7 days** overdue.

Timeline measured from `expires_at`:

| Day overdue | Action | Mechanism |
|-------------|--------|-----------|
| 0 | expires | — |
| ≥ `auto_suspend_days` (default **3**) | suspend: stop container, `status='suspended'`, detach custom domain from NPM, send suspension email that states the deletion date | existing `suspendExpired()` (already uses `auto_suspend_days`, currently 3) + new NPM detach + email copy update |
| ≥ `auto_delete_days` (default **7**) | permanent delete: `deployService.removeShop` (`down -v` wipes DB volume) + `cloudflareService.deleteCustomHostname` + `DELETE FROM subscriptions`, send "shop deleted" email | new `deleteExpired()` + new daily cron job |

`deleteExpired()` safety guards:
- Selects only `status='suspended'` AND `expires_at < NOW() - INTERVAL auto_delete_days DAY`. A shop must already be suspended (so it passed the 3-day stage and the customer was emailed) before it can be deleted — double gate.
- Enforces `auto_delete_days > auto_suspend_days` (clamp/skip if misconfigured) so delete never precedes suspend.
- Per-shop try/catch: one failing teardown does not abort the batch.
- Redis lock (`panel_cron_lock:delete`) like the suspend job, for multi-replica safety.

Settings (panel_settings, operator-adjustable): `auto_suspend_days` (exists, =3), `auto_delete_days` (new, default 7).

Billing consequence: a suspended shop keeps its CF custom hostname only during the 3→7 day window (counts toward the free 100, currently $0). At day 7 the hostname is deleted with the shop. Manual `adminRemove` also deletes it immediately.

Deployment safety: verified 2026-06-24 that no current subscription is >7 days overdue, so enabling the cron deletes nothing immediately (the only overdue shop, cyoriasmp, is 1 day overdue).

Re-attach helper: add a small idempotent method (e.g. `customDomainService.reattachIfActive(subscriptionId)`) that re-adds NPM only when `custom_domain_status='active'`, so unsuspend/renew share one path. `addDomainToProxyHost` is already idempotent (early-returns if present).

## Data flow (unchanged API)
1. Add → `POST /custom-domain` → CF `createCustomHostname` → `pending_dns`.
2. Customer adds CNAME → auto-poll `POST /custom-domain/verify` → CF status → on first `active`, `addDomainToProxyHost`.
3. Remove (manual) → `DELETE /custom-domain` → CF delete + NPM detach.
4. Lifecycle (new) → suspend/unsuspend/renew/delete hooks above.

## Error handling
- Client validation is advisory; the server `validateCustomHostname` is authoritative and its error string is shown inline.
- All backend lifecycle hooks are best-effort: failure to detach/re-attach/delete logs a warning and never blocks suspend/renew/delete of the shop.
- Modal surfaces CF/NPM errors from the API as inline field errors / toasts (existing behavior preserved).

## Testing
- Backend (jest, panel already has it):
  - `adminRemove` deletes the CF custom hostname when set; no-op when none.
  - `suspendExpired` detaches NPM but does not delete the CF hostname.
  - unsuspend/renew re-attach NPM only when status is `active`.
  - `deleteExpired` selects only suspended shops past `auto_delete_days`; skips active shops; enforces `auto_delete_days > auto_suspend_days`; one failure does not abort the batch.
  - lifecycle hooks swallow CF/NPM errors (do not throw).
- Frontend: validation unit (apex reject, siamsite reject, scheme trim, prefix suggestion), and `RegistrarGuide` renders the right note + Name example per registrar. Component render smoke for each of the 5 states.
- Manual: open modal from dashboard; full flow on a real test domain (deferred per owner — separate e2e).

## Files touched
- New: `panel/frontend/src/components/DomainModal.tsx`, `RegistrarGuide.tsx`, `DomainStepper.tsx` (co-located or under `components/domain/`).
- Edit: `panel/frontend/src/app/dashboard/page.tsx` (open modal), `panel/frontend/src/app/dashboard/domain/page.tsx` (redirect), `panel/backend/src/services/notification.service.ts` (suspend detach + new `deleteExpired()`), `panel/backend/src/services/subscription.service.ts` (suspend/unsuspend/renew/adminRemove hooks), `panel/backend/src/services/custom-domain.service.ts` (`reattachIfActive` helper), `panel/backend/src/services/cron.service.ts` (new daily delete job), `panel/backend/src/services/email.service.ts` (deletion-warning copy + "deleted" email).

## Rollout
Frontend + backend ship together via the existing panel rebuild (`docker compose -f deploy/panel-compose.yml --env-file deploy/panel.env up -d --build --no-deps panel-backend panel-frontend`). No migration (schema already in place from migration 014). No shop rebuild required for this change.
