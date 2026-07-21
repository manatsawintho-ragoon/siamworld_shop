# Top-up Campaign, Reward Shop, and News - Design

Date: 2026-07-21
Status: Approved (brainstorming complete, ready for implementation plan)

## Summary

Three subsystems for the shop frontend and admin:

1. **Campaign engine** - time-windowed top-up promotions that grant campaign points.
2. **Reward Shop** - a permanent catalog where points are spent on in-game rewards.
3. **News** - player-facing announcements with a 1-3 image carousel or one embedded video.

Campaign and Reward Shop are coupled (points earned then spent). News is fully
independent.

---

## 0. Decisions locked during brainstorming

| # | Decision | Chosen |
|---|----------|--------|
| 1 | Currency model | Separate loyalty ledger. Points never touch `wallets` / `transactions`. |
| 2 | Earn rule | Linear `points_per_baht` with a `min_topup_amount` floor. |
| 3 | Point scope | One global balance per player, with FIFO expiry lots. |
| 4 | Reward delivery | Claim to `web_inventory` (PENDING), claimed later when online. |
| 5 | Window shape | Fixed datetime range plus optional daily-hours and weekday masks. |
| 6 | Qualifying time | Real payment time (bank/provider), wallet-credit time as fallback. |
| 7 | News shape | Full system with `/news` index and indexable `/news/[slug]` pages. |

### 0.1 Amendment to SYSTEM.md

`.agents/context/SYSTEM.md` currently states: *"All transactions are in Thai Baht
(฿) only. No points, RP, or virtual currency."*

This design introduces campaign points, so that invariant must be restated
rather than silently broken. Proposed replacement wording:

> **Currency**
> - All *monetary* transactions are in Thai Baht (฿) only. Wallet balance and
>   every `transactions` ledger entry are Baht.
> - **Campaign points** are a non-monetary loyalty token. They live in their own
>   tables, are never credited to `wallets`, never appear in `transactions`,
>   are never refundable or withdrawable, and can only be spent in the Reward
>   Shop. Points are a one-way sink: Baht can produce points, points can never
>   produce Baht.

This must be applied as part of implementation, not left as a follow-up.

---

## Part A: Campaign + Reward Shop

### A1. Governing rule

> **The money path must never be blocked by the points path.**

Wallet credit commits in its own transaction. Point granting runs afterwards in
a separate transaction, guarded by a uniqueness key, and its failure is logged
but never propagated to the payment flow. A reconciler backfills any grant that
was missed.

Rationale: a points bug that rolls back a verified payment would be a support
catastrophe. This ordering makes that structurally impossible.

### A2. Schema

Migration `032_campaign_points.sql`:

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  banner_image VARCHAR(500) DEFAULT NULL,
  points_per_baht     DECIMAL(10,4) NOT NULL,
  min_topup_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
  starts_at           DATETIME NOT NULL,
  ends_at             DATETIME NOT NULL,
  daily_start_time    TIME DEFAULT NULL,
  daily_end_time      TIME DEFAULT NULL,
  weekday_mask        TINYINT UNSIGNED DEFAULT NULL,  -- bit0=Mon .. bit6=Sun
  max_points_per_user INT DEFAULT NULL,
  max_points_budget   INT DEFAULT NULL,
  points_expire_days  INT NOT NULL DEFAULT 30,
  paused     TINYINT(1) NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_window (starts_at, ends_at),
  KEY idx_active (active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS point_lots (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  campaign_id INT DEFAULT NULL,          -- NULL = manual admin grant
  points_granted   INT NOT NULL,         -- may be negative (clawback debt)
  points_remaining INT NOT NULL,
  rate_applied DECIMAL(10,4) DEFAULT NULL,
  qualified_at DATETIME NOT NULL,
  expires_at   DATETIME NOT NULL,
  source_transaction_id INT DEFAULT NULL,
  reason VARCHAR(255) DEFAULT NULL,      -- required for manual grants
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_grant_once (source_transaction_id, campaign_id),
  KEY idx_user_fifo (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS point_spends (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  redemption_id INT NOT NULL,
  lot_id INT NOT NULL,
  points INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_redemption (redemption_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rewards (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  image VARCHAR(500) DEFAULT NULL,
  point_cost INT NOT NULL,
  stock INT DEFAULT NULL,                -- NULL = unlimited
  per_user_limit INT DEFAULT NULL,
  command TEXT NOT NULL,
  requires_campaign_id INT DEFAULT NULL,
  visible_from  DATETIME DEFAULT NULL,
  visible_until DATETIME DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_active (active, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_servers (
  reward_id INT NOT NULL,
  server_id INT NOT NULL,
  PRIMARY KEY (reward_id, server_id),
  FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  point_cost INT NOT NULL,
  status ENUM('pending','claimed','failed') NOT NULL DEFAULT 'pending',
  inventory_id INT DEFAULT NULL,
  idempotency_key VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_idempotency (idempotency_key),
  KEY idx_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Two constraints carry most of the safety:

- **`UNIQUE (source_transaction_id, campaign_id)`** is the entire double-grant
  defense. Retried webhooks, double-clicked verifications, and the reconciler
  racing the live path all collapse into one row.
- **`rate_applied` and `expires_at` are frozen onto the lot at grant time.**
  Issued points are immutable, which is precisely what makes admin editing of a
  running campaign safe.

Note on the unique index: MySQL permits multiple NULLs in a UNIQUE key, so
manual admin grants and clawback debt rows (both columns NULL) are not
constrained by `idx_grant_once`. That is the intended behaviour - the index
exists solely to deduplicate automatic top-up grants - but it must not be
mistaken for a general "one lot per user" guarantee.

### A3. Balance and FIFO burn

Balance is computed, never swept:

```sql
SELECT COALESCE(SUM(points_remaining), 0)
FROM point_lots
WHERE user_id = ? AND expires_at > NOW();
```

Correctness therefore never depends on a cron job firing on time. The nightly
job exists only for cleanup and for expiry-warning notifications.

Redemption burns oldest-expiring-first under row locks, mirroring the discipline
in `wallet.service.ts`:

```
redeem(userId, rewardId, idempotencyKey):
  BEGIN
    SELECT ... FROM point_lots
      WHERE user_id = ? AND expires_at > NOW() AND points_remaining > 0
      ORDER BY expires_at ASC
      FOR UPDATE
    assert SUM(points_remaining) >= reward.point_cost
    assert per_user_limit not exceeded
    UPDATE rewards SET stock = stock - 1
      WHERE id = ? AND (stock IS NULL OR stock > 0)
      -- affectedRows = 0 means sold out, abort
    decrement lots in order, INSERT point_spends per lot touched
    INSERT web_inventory (status PENDING)
    INSERT reward_redemptions (status pending, inventory_id)
  COMMIT
```

There is no online check, no RCON call, and no refund path at redeem time. RCON
runs only at claim time, reusing the existing loot-box claim flow.

### A4. Grant hook

A single choke point, called after wallet credit has committed:

```ts
campaignService.grantForTopup({
  userId, transactionId, amountBaht, qualifiedAt, method
})
```

`qualifiedAt` resolution:

| Source | Timestamp used |
|--------|----------------|
| EasySlip | bank transfer time from the verified slip |
| TrueMoney | redemption time |
| Admin manual top-up | wallet credit time |

Compared in `Asia/Bangkok`. This is simultaneously the fairest rule (pay 23:58,
verify 00:05, still counts) and the least exploitable (a slip hoarded from last
week does not qualify).

Grant algorithm:

1. Find campaigns active at `qualifiedAt` (range + daily-hours + weekday mask,
   not paused, not deleted).
2. If several match, **the highest `points_per_baht` wins**. No stacking.
3. Abort if `amountBaht < min_topup_amount`.
4. Compute `floor(amountBaht * points_per_baht)`.
5. Clamp against `max_points_per_user` and `max_points_budget`. If a cap is
   partially available, grant the partial amount and notify the player honestly.
6. Insert the lot with `expires_at = campaign.ends_at + points_expire_days`,
   `rate_applied`, and `qualified_at`.
7. `UNIQUE` violation means already granted. Swallow and return.

Callers wrap this in try/catch and never propagate failure into the payment
flow.

### A5. Clawback

If a top-up is later reversed or refunded by an admin,
`campaignService.revokeForTransaction(transactionId)` runs:

1. Locate the lot by `source_transaction_id`.
2. Reduce `points_remaining` by as much as is still unspent.
3. If points were already spent, insert a **negative lot** (debt) for the
   shortfall, with `expires_at` far future.
4. Balance sums include negative lots, so future earnings repay the debt before
   becoming spendable.

Without this, "top up ฿2000, take the points, redeem a rank, dispute the
payment" is free money.

### A6. Anti-abuse summary

| Vector | Defense |
|--------|---------|
| Double grant (retry / race) | `UNIQUE(source_transaction_id, campaign_id)` |
| Slip hoarding across windows | `qualified_at` = bank transfer time |
| Top-up, earn, redeem, then refund | Clawback with negative-lot debt (A5) |
| Concurrent double-redeem | `FOR UPDATE` on lots + `idempotency_key` UNIQUE |
| Stock oversell | Conditional `UPDATE ... WHERE stock > 0` inside the txn |
| Redeem spam | Existing `middleware/cooldown.ts` |
| Banned users | Migration 031 `banned_at` blocks both earn and redeem |
| Alt-account farming | Per-user points, `min_topup_amount`, `max_points_per_user`; alts still cost real Baht so it is never profitable |
| Admin abuse | Manual grant/revoke requires a reason, writes to `audit_logs` |

### A7. Edge cases

Admin edits a running campaign:

| Edit | Behaviour |
|------|-----------|
| Extend `ends_at` | Forward only, no retroactive grants |
| Shrink `ends_at` | Issued lots keep points **and** original `expires_at` |
| Change `points_per_baht` | Forward only, old lots keep `rate_applied` |
| Change `points_expire_days` | Future lots only |
| Pause | Granting stops immediately, Reward Shop stays open |
| Delete | Soft-delete, lots survive and remain spendable |

Other cases:

- **Overlapping campaigns**: highest rate wins, one grant. Admin sees an overlap
  warning at save time.
- **Budget cap reached mid-top-up**: partial grant, player notified.
- **Reward claim while server offline**: stays PENDING, retryable. By design.
- **Points expire between page load and redeem**: balance is re-checked under
  lock, so the redeem fails cleanly.
- **DST**: Thailand has none, so `Asia/Bangkok` arithmetic is safe.

### A8. Admin controls

- Campaign CRUD with a live "active right now?" indicator (masks are easy to
  misconfigure, so show the computed truth rather than the config).
- **Dry-run preview**: "a ฿500 top-up right now earns 50 points". This is the
  guardrail against decimal-place errors, which are the most likely production
  incident in this system.
- **Cost preview**: estimated Baht cost per point at current reward pricing.
- Pause without delete. Manual grant/revoke with mandatory reason.
- Reward CRUD: stock, per-user limit, campaign exclusivity, server targeting.
- Redemption log with retry for failed RCON claims.

### A9. Analytics

Headline metric is **incremental lift**, not gross volume:

```
lift = in-window revenue - baseline revenue
       (same weekday and hour, averaged over prior N weeks)
```

Supporting metrics: unique participants, points issued vs redeemed,
**points outstanding** (open liability), breakage rate (expired unspent), reward
popularity, and a cohort view of whether participants keep topping up after the
window closes.

### A10. Known weaknesses (accepted, with mitigations)

1. **Outstanding points are a real liability.** The dashboard must surface it
   prominently, and reward price increases require a confirmation step.
2. **Breakage generates resentment** even though it is technically margin.
   Mitigated by an expiry-warning notification 7 days out via the existing
   `018_notifications` table.
3. **A misconfigured `points_per_baht` can bankrupt a shop owner.** The dry-run
   preview is a guardrail, not a nice-to-have.
4. **Reward Shop looks abandoned between campaigns** unless the catalog carries
   evergreen items. Seed a few at launch.

### A11. Engagement additions

- Progress nudge on the top-up page: "เติมอีก ฿250 รับ 25 point"
- Live campaign banner with countdown
- Point expiry reminder notification
- "New" badge on recently added rewards

---

## Part B: News

### B1. Schema

Migration `033_news.sql`:

```sql
CREATE TABLE IF NOT EXISTS news (
  id INT NOT NULL AUTO_INCREMENT,
  slug VARCHAR(200) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt VARCHAR(500) DEFAULT NULL,
  body MEDIUMTEXT DEFAULT NULL,
  category ENUM('update','event','maintenance','patch','general')
    NOT NULL DEFAULT 'general',
  cover_image VARCHAR(500) DEFAULT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME DEFAULT NULL,
  expires_at   DATETIME DEFAULT NULL,
  view_count INT NOT NULL DEFAULT 0,
  author_id INT DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_slug (slug),
  KEY idx_published (published_at, expires_at, deleted_at),
  KEY idx_pinned (pinned, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS news_media (
  id INT NOT NULL AUTO_INCREMENT,
  news_id INT NOT NULL,
  type ENUM('image','youtube') NOT NULL,
  url VARCHAR(500) NOT NULL,   -- image path, or bare 11-char YouTube id
  caption VARCHAR(255) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_news (news_id, sort_order),
  FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Media rule**: a post is *either* up to 3 images *or* exactly one video, never
mixed. Enforced in the Zod schema, not only in the UI. Mixing would require a
carousel that also pauses video, handles autoplay conflicts, and manages focus,
which is disproportionate complexity for no requested benefit.

### B2. Lifecycle

```
draft -> scheduled -> published -> expired
```

State is computed from timestamps, never toggled by a job:

```sql
WHERE published_at IS NOT NULL
  AND published_at <= NOW()
  AND (expires_at IS NULL OR expires_at > NOW())
  AND deleted_at IS NULL
ORDER BY pinned DESC, published_at DESC
```

So a late cron can never leave a maintenance notice up after the maintenance
ended.

### B3. Security

News carries a body and remote URLs, so it is a higher-risk surface than
settings. Stored XSS here would be a full compromise, since admins hold wallet
controls.

- **YouTube**: never store or render a user-supplied embed. Parse the URL
  server-side, extract the video id against `^[A-Za-z0-9_-]{11}$`, reject
  anything else, store only the id. Render as
  `https://www.youtube-nocookie.com/embed/{id}` in a sandboxed iframe with an
  explicit `allow` list. Accept `watch?v=`, `youtu.be/`, `shorts/`, and
  `embed/` input forms.
- **Body**: Markdown, sanitized to a whitelist on render (headings, bold, lists,
  links, images). No raw HTML passthrough. Links get
  `rel="noopener noreferrer"`.
- **Images**: uploads or same-origin paths only. No arbitrary remote URLs, which
  also avoids SSRF and mixed content.

### B4. Frontend

| Route | Purpose |
|-------|---------|
| `/` | Latest 3 cards (pinned first), below the hero |
| `/news` | Paginated index with category filter |
| `/news/[slug]` | Article page with `Article` JSON-LD and OG/Twitter tags |

These pages compound with the per-tenant metadata already shipped in
`serverSeo.ts`: every event post becomes durable indexable surface per shop.

Project conventions apply: Font Awesome icons (`fas fa-bullhorn`,
`fas fa-calendar`), no emoji, no em dash in player-facing copy, semantic tokens
from `globals.css`, and admin pages stay on the neutral admin palette
(no `data-theme-portal`, no `.frontend-page`).

`/api/public/news` joins the existing catalog cache tier in `public.routes.ts`
(60s fresh + 5min SWR), invalidated on admin save.

### B5. Edge cases

| Case | Behaviour |
|------|-----------|
| Slug collision | Auto-suffix `-2`, `-3` |
| Slug edit after publish | Blocked by default; override writes a 301 |
| Deleted post with inbound links | Soft-delete, serves 410 Gone (not a silent 404) |
| Unavailable or private video | Iframe fails gracefully to the cover image |
| Post with no media | Valid. Text-only patch notes are normal. |
| Very long body | Card shows `excerpt`; auto-derived from body if blank |
| Scheduled post | Hidden from the public API, shown in admin with a "scheduled" badge |

### B6. Admin controls

- CRUD with live preview rendering exactly as players see it
- Schedule publish and auto-expire
- Pin to top, drag to reorder media
- Paste any YouTube URL form, parser normalizes
- Duplicate post (for recurring events)
- Soft-delete with restore
- All mutations to `audit_logs`

### B7. Analytics

View count per post, card-to-article click-through, and category performance.
The genuinely useful metric: correlate publish time against top-up volume in the
following 24 hours, so the owner learns which announcement types drive revenue.

### B8. Known weaknesses (accepted)

1. **View counts are inflatable by refresh.** Debounce per session and label the
   metric "views", never "unique readers".
2. **Markdown-only will eventually frustrate an admin** who wants a colored
   heading. That friction is the price of eliminating stored XSS, and it is the
   right trade.
3. **Naming collision**: the player-facing system and the operator
   `AnnouncementPopup` are different systems with similar names. The
   player-facing one is called **News** everywhere in code and UI, and is never
   called "announcements".

---

## Build order

Three shippable slices:

1. **Campaign engine** - migration, grant hook, admin CRUD, player balance
   display. No spending yet.
2. **Reward Shop** - catalog, redeem, claim-to-inventory. Closes the loop.
3. **News** - fully independent, may ship in parallel.

Slice 1 is safe to ship alone: points accrue but nothing can be spent, so a
pricing mistake costs nothing and rates can be corrected before any value leaves
the system.

## Testing focus

- `grantForTopup` unit tests: window matching (range, daily hours, weekday
  mask), overlap resolution, cap clamping, `UNIQUE` idempotency on retry.
- FIFO burn tests: exact-fit, spanning multiple lots, insufficient balance,
  expired lots excluded.
- Clawback tests: unspent, partially spent, fully spent (negative-lot debt).
- Concurrency: two simultaneous redeems against one lot, and last-item stock.
- YouTube URL parser: all accepted forms plus rejection of hostile input.
- News visibility: draft, scheduled, published, expired, soft-deleted.
