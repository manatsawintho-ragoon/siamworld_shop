# Custom Domains - one-time setup & rollout

Feature: customers self-serve their own domain (e.g. `shop.theirstore.com`) via the panel,
using Cloudflare for SaaS custom hostnames. Spec:
`docs/superpowers/specs/2026-06-23-custom-domains-design.md`.

## A. Enable Cloudflare for SaaS (siamsite.shop zone)
1. Cloudflare dashboard -> siamsite.shop -> SSL/TLS -> Custom Hostnames -> Enable
   Cloudflare for SaaS (100 hostnames free, then $0.10/hostname/mo).
2. The panel sets the fallback origin automatically on first use
   (`custom.siamsite.shop`). To pre-create it manually:
   ```
   docker exec panel-backend node -e "require('/app/dist/services/cloudflare.service').cloudflareService.ensureFallbackOrigin('custom.siamsite.shop').then(()=>console.log('ok')).catch(e=>{console.error(e.message);process.exit(1)})"
   ```

## B. NPM fallback-origin proxy host (TLS handshake target)
Cloudflare connects to origin with SNI = `custom.siamsite.shop`. NPM must have a proxy
host whose `domain_names` include `custom.siamsite.shop`, using the `*.siamsite.shop`
cert (the same cert other shops use), so the Full(strict) handshake succeeds. Create it
once in NPM (any forward target is fine; it only needs to terminate TLS for the SNI).
Verify:
```
curl -sI --resolve custom.siamsite.shop:443:<CF_IP> https://custom.siamsite.shop/
```
should return a TLS/HTTP response (not a handshake error).

## C. Apply panel migration 014 (manual - panel has no auto-runner)
Panel root password is `PANEL_MYSQL_ROOT_PASSWORD` in `deploy/panel.env`.
```
docker exec -i panel-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamworld_panel' < panel/database/migrations/014_custom_domain.sql
```
Verify:
```
docker exec -i panel-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW COLUMNS FROM siamworld_panel.subscriptions LIKE \"custom_%\""'
```
Expect 4 rows: `custom_domain`, `custom_hostname_id`, `custom_domain_status`,
`custom_domain_added_at`.

## D. Rebuild shared shop image (host-agnostic WS/CORS)
Per feedback_customer_deploy: rebuild shops via `manage-customer.sh rebuild` (never
`docker build` directly, or ports/SOURCE_ROOT break). Existing shops keep working on
their siamsite subdomains after rebuild (host-relative WS is backwards-compatible).

## E. Rebuild panel
```
docker compose -f deploy/panel-compose.yml --env-file deploy/panel.env up -d --build --no-deps panel-backend panel-frontend
```

## F. End-to-end test on a real test domain
1. In a test shop's dashboard -> "โดเมน", enter `shop.<testdomain>.com`.
2. Add the shown CNAME at the registrar (`shop.<testdomain>.com  CNAME  custom.siamsite.shop`).
3. Watch status: `pending_dns` -> `pending_ssl` -> `active`.
4. Visit `https://shop.<testdomain>.com`: shop loads, login works, the online-players
   widget connects (WS over the custom domain - check devtools Network -> WS).
5. Remove the domain; confirm it detaches from NPM and the CF custom hostname is gone.

## Notes
- No per-domain origin cert is needed: Cloudflare terminates the customer-facing cert at
  the edge; origin keeps the `*.siamsite.shop` cert (matched by the fallback-origin SNI).
- The shop's HTTP API is same-origin (`/api`), so no CORS change is needed for it. Only
  the Socket.IO handshake is gated host-aware (`backend/src/utils/wsOrigin.ts`).
