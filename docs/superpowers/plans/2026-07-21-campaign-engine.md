# Campaign Engine Implementation Plan (Slice 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Time-windowed top-up campaigns that grant non-monetary loyalty points into a separate FIFO-expiry ledger, with admin CRUD and a player-visible balance. Nothing can be spent yet.

**Architecture:** All campaign decision logic lives in `campaign.logic.ts` as pure functions (no DB, no clock) so it is unit-testable in the style this codebase already uses. `campaign.service.ts` is a thin DB layer that calls them. Granting hangs off the two existing wallet-credit sites in `payment.service.ts` plus the admin manual top-up, always **after** commit and always inside try/catch, so a points bug can never roll back a verified payment.

**Tech Stack:** Node 22 + Express + TypeScript, MySQL 8 (mysql2 promise pool), Zod validation, Jest + ts-jest, Next.js 14 App Router + Tailwind.

## Global Constraints

- **Money path is never blocked by the points path.** `grantForTopup` is called after the payment transaction commits, wrapped in try/catch, and its failure is logged only.
- **Points never touch `wallets` or `transactions`.** Points are a one-way sink: Baht can produce points, points can never produce Baht.
- **Issued lots are immutable.** `rate_applied` and `expires_at` are frozen at grant time and never updated by later campaign edits.
- **Timezone is Asia/Bangkok (UTC+7 fixed, no DST).** All `DATETIME` columns store UTC. Window evaluation happens in Node via a pure helper, never in SQL.
- **Overlapping campaigns: highest `points_per_baht` wins.** Never stack.
- **Icons:** Font Awesome (`fas`/`far`) on the shop frontend. Never emoji.
- **No em dash (—) in any user-facing copy.** Use `-`, `:`, or parentheses.
- **Admin pages stay on the neutral admin palette.** Never add `data-theme-portal` or `.frontend-page` to admin layouts.
- **Currency symbol in copy is ฿.** Points are written as "point" (Thai UI) and are never given a ฿ symbol.
- Run all backend tests with `cd backend && npm test`.

## File Structure

| File | Responsibility |
|------|----------------|
| `migrations/032_campaign_points.sql` | Create `campaigns`, `point_lots`, `point_spends` |
| `backend/src/services/campaign.logic.ts` | Pure functions: Bangkok time parts, window match, campaign selection, point computation |
| `backend/src/services/campaign.service.ts` | DB layer: grant, revoke, balance, admin CRUD |
| `backend/src/services/__tests__/campaign.logic.test.ts` | Unit tests for the pure layer |
| `backend/src/routes/campaign.routes.ts` | Player endpoints: active campaign, my points |
| `backend/src/routes/admin.routes.ts` | Admin campaign CRUD (append to existing) |
| `backend/src/validators/schemas.ts` | Zod schemas (append to existing) |
| `backend/src/services/payment.service.ts` | Wire grant into 2 credit sites |
| `backend/src/services/user.service.ts` | Wire grant into admin manual top-up |
| `frontend/src/app/admin/campaigns/page.tsx` | Admin CRUD UI with live-active indicator + dry-run preview |
| `frontend/src/components/CampaignBanner.tsx` | Player-facing active-campaign banner with countdown |
| `.agents/context/SYSTEM.md` | Amend the "Baht only" invariant |

**Note on migration numbering:** the spec named a single `032_campaign_points.sql` covering rewards too. This plan puts only campaign + points tables in 032; reward tables move to `033` in Slice 2 so each slice migrates independently. News becomes `034`.

---

### Task 1: Migration and SYSTEM.md amendment

**Files:**
- Create: `migrations/032_campaign_points.sql`
- Modify: `.agents/context/SYSTEM.md`

**Interfaces:**
- Consumes: nothing
- Produces: tables `campaigns`, `point_lots`, `point_spends` used by every later task

- [ ] **Step 1: Write the migration**

Create `migrations/032_campaign_points.sql`:

```sql
-- ============================================================
--  032_campaign_points.sql
--  Top-up campaigns + the campaign point loyalty ledger.
--
--  Points are NON-MONETARY. They never appear in `wallets` or
--  `transactions`; those remain Baht-only. Points are a one-way
--  sink: Baht can produce points, points can never produce Baht.
--
--  All DATETIME values are UTC. Window evaluation (daily hours,
--  weekday mask) happens in Node against Asia/Bangkok, never in
--  SQL, so it stays unit-testable.
--  Idempotent.
-- ============================================================

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
  weekday_mask        TINYINT UNSIGNED DEFAULT NULL,
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
  KEY idx_live (active, paused, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS point_lots (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  campaign_id INT DEFAULT NULL,
  points_granted   INT NOT NULL,
  points_remaining INT NOT NULL,
  rate_applied DECIMAL(10,4) DEFAULT NULL,
  qualified_at DATETIME NOT NULL,
  expires_at   DATETIME NOT NULL,
  source_transaction_id INT DEFAULT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_grant_once (source_transaction_id, campaign_id),
  KEY idx_user_fifo (user_id, expires_at),
  KEY idx_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Verify the migration applies cleanly and is idempotent**

Run:

```bash
docker-compose up -d mysql
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite < migrations/032_campaign_points.sql
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite < migrations/032_campaign_points.sql
```

Expected: both runs exit 0 with no output. Re-running is the idempotency check.

- [ ] **Step 3: Confirm the unique index exists**

Run:

```bash
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "SHOW INDEX FROM point_lots WHERE Key_name='idx_grant_once';"
```

Expected: two rows (`source_transaction_id`, `campaign_id`) with `Non_unique = 0`.

- [ ] **Step 4: Amend the currency invariant**

In `.agents/context/SYSTEM.md`, replace the entire `## Currency` section with:

```markdown
## Currency
- All *monetary* transactions are in **Thai Baht (฿) only**. Wallet balance and
  every `transactions` ledger entry are Baht.
- **Campaign points** are a non-monetary loyalty token. They live in their own
  tables (`point_lots`, `point_spends`), are never credited to `wallets`, never
  appear in `transactions`, are never refundable or withdrawable, and can only
  be spent in the Reward Shop. Points are a one-way sink: Baht can produce
  points, points can never produce Baht.
```

- [ ] **Step 5: Commit**

```bash
git add migrations/032_campaign_points.sql .agents/context/SYSTEM.md
git commit -m "feat(campaign): add campaign + point ledger tables, amend currency invariant"
```

---

### Task 2: Bangkok time helper and window matching (pure)

**Files:**
- Create: `backend/src/services/campaign.logic.ts`
- Create: `backend/src/services/__tests__/campaign.logic.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export interface CampaignWindow { starts_at: Date; ends_at: Date; daily_start_time: string | null; daily_end_time: string | null; weekday_mask: number | null; paused: number; active: number; deleted_at: Date | null; }`
  - `export function bangkokParts(d: Date): { weekdayMon0: number; minutesOfDay: number }`
  - `export function isCampaignActiveAt(c: CampaignWindow, when: Date): boolean`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/__tests__/campaign.logic.test.ts`:

```ts
import { bangkokParts, isCampaignActiveAt, CampaignWindow } from '../campaign.logic';

// Base: a campaign running all of August 2026 UTC, no masks.
const base: CampaignWindow = {
  starts_at: new Date('2026-08-01T00:00:00Z'),
  ends_at:   new Date('2026-08-31T23:59:59Z'),
  daily_start_time: null,
  daily_end_time: null,
  weekday_mask: null,
  paused: 0,
  active: 1,
  deleted_at: null,
};

describe('bangkokParts', () => {
  it('shifts UTC to UTC+7', () => {
    // 2026-08-03 is a Monday. 00:00Z -> 07:00 Bangkok, still Monday.
    expect(bangkokParts(new Date('2026-08-03T00:00:00Z')))
      .toEqual({ weekdayMon0: 0, minutesOfDay: 7 * 60 });
  });
  it('rolls the weekday forward across the Bangkok midnight boundary', () => {
    // Monday 18:00Z -> Tuesday 01:00 Bangkok
    expect(bangkokParts(new Date('2026-08-03T18:00:00Z')))
      .toEqual({ weekdayMon0: 1, minutesOfDay: 60 });
  });
  it('treats Sunday as index 6', () => {
    // 2026-08-09 is a Sunday. 05:00Z -> 12:00 Bangkok Sunday.
    expect(bangkokParts(new Date('2026-08-09T05:00:00Z')))
      .toEqual({ weekdayMon0: 6, minutesOfDay: 12 * 60 });
  });
});

describe('isCampaignActiveAt', () => {
  it('is active inside the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-08-10T10:00:00Z'))).toBe(true);
  });
  it('is inactive before the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-07-31T10:00:00Z'))).toBe(false);
  });
  it('is inactive after the range', () => {
    expect(isCampaignActiveAt(base, new Date('2026-09-01T10:00:00Z'))).toBe(false);
  });
  it('is inactive when paused', () => {
    expect(isCampaignActiveAt({ ...base, paused: 1 }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });
  it('is inactive when not active', () => {
    expect(isCampaignActiveAt({ ...base, active: 0 }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });
  it('is inactive when soft-deleted', () => {
    expect(isCampaignActiveAt({ ...base, deleted_at: new Date() }, new Date('2026-08-10T10:00:00Z'))).toBe(false);
  });

  describe('daily hours mask (Bangkok)', () => {
    const evening = { ...base, daily_start_time: '18:00:00', daily_end_time: '22:00:00' };
    it('is active inside the daily window', () => {
      // 13:00Z -> 20:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T13:00:00Z'))).toBe(true);
    });
    it('is inactive outside the daily window', () => {
      // 04:00Z -> 11:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T04:00:00Z'))).toBe(false);
    });
    it('is active exactly at the start minute', () => {
      // 11:00Z -> 18:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T11:00:00Z'))).toBe(true);
    });
    it('is inactive exactly at the end minute (end is exclusive)', () => {
      // 15:00Z -> 22:00 Bangkok
      expect(isCampaignActiveAt(evening, new Date('2026-08-10T15:00:00Z'))).toBe(false);
    });
    it('handles a window crossing Bangkok midnight', () => {
      const overnight = { ...base, daily_start_time: '22:00:00', daily_end_time: '02:00:00' };
      // 16:00Z -> 23:00 Bangkok, inside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T16:00:00Z'))).toBe(true);
      // 18:00Z -> 01:00 Bangkok next day, inside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T18:00:00Z'))).toBe(true);
      // 07:00Z -> 14:00 Bangkok, outside
      expect(isCampaignActiveAt(overnight, new Date('2026-08-10T07:00:00Z'))).toBe(false);
    });
  });

  describe('weekday mask', () => {
    // bit0=Mon .. bit6=Sun. Sat|Sun = bit5|bit6 = 32|64 = 96
    const weekend = { ...base, weekday_mask: 96 };
    it('is active on Saturday', () => {
      // 2026-08-08 is a Saturday. 05:00Z -> 12:00 Bangkok Sat.
      expect(isCampaignActiveAt(weekend, new Date('2026-08-08T05:00:00Z'))).toBe(true);
    });
    it('is active on Sunday', () => {
      expect(isCampaignActiveAt(weekend, new Date('2026-08-09T05:00:00Z'))).toBe(true);
    });
    it('is inactive on Monday', () => {
      expect(isCampaignActiveAt(weekend, new Date('2026-08-03T05:00:00Z'))).toBe(false);
    });
    it('a zero mask matches nothing', () => {
      expect(isCampaignActiveAt({ ...base, weekday_mask: 0 }, new Date('2026-08-08T05:00:00Z'))).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest campaign.logic -v`

Expected: FAIL, `Cannot find module '../campaign.logic'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/campaign.logic.ts`:

```ts
/**
 * Pure campaign decision logic. No DB, no ambient clock, no I/O.
 *
 * Everything here is a function of its arguments so it can be unit-tested the
 * same way computeTopupCredit / resolveTopupBonus are. The DB layer lives in
 * campaign.service.ts and calls into this module.
 *
 * TIME MODEL: all Date values are absolute instants (stored UTC in MySQL).
 * Thailand is a fixed UTC+7 with no DST, so Bangkok wall-clock parts are
 * derived by shifting the instant and reading UTC fields. No tz library needed.
 */

const BANGKOK_OFFSET_MIN = 7 * 60;

export interface CampaignWindow {
  starts_at: Date;
  ends_at: Date;
  daily_start_time: string | null;   // 'HH:MM:SS' Bangkok wall clock
  daily_end_time: string | null;     // exclusive
  weekday_mask: number | null;       // bit0=Mon .. bit6=Sun; null = every day
  paused: number;
  active: number;
  deleted_at: Date | null;
}

/** Bangkok wall-clock parts of an instant: weekday (0=Mon..6=Sun) and minutes since midnight. */
export function bangkokParts(d: Date): { weekdayMon0: number; minutesOfDay: number } {
  const shifted = new Date(d.getTime() + BANGKOK_OFFSET_MIN * 60_000);
  // getUTCDay(): 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  const weekdayMon0 = (shifted.getUTCDay() + 6) % 7;
  const minutesOfDay = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { weekdayMon0, minutesOfDay };
}

/** 'HH:MM:SS' -> minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Is this campaign granting points at instant `when`?
 *
 * Order matters: cheap flag checks first, then the absolute range, then the
 * Bangkok-local masks.
 */
export function isCampaignActiveAt(c: CampaignWindow, when: Date): boolean {
  if (c.active !== 1) return false;
  if (c.paused === 1) return false;
  if (c.deleted_at !== null) return false;

  const t = when.getTime();
  if (t < c.starts_at.getTime()) return false;
  if (t > c.ends_at.getTime()) return false;

  const { weekdayMon0, minutesOfDay } = bangkokParts(when);

  if (c.weekday_mask !== null && c.weekday_mask !== undefined) {
    if ((c.weekday_mask & (1 << weekdayMon0)) === 0) return false;
  }

  if (c.daily_start_time && c.daily_end_time) {
    const start = timeToMinutes(c.daily_start_time);
    const end   = timeToMinutes(c.daily_end_time);
    if (start === end) return false;             // zero-width window
    const inWindow = start < end
      ? (minutesOfDay >= start && minutesOfDay < end)          // same-day
      : (minutesOfDay >= start || minutesOfDay < end);         // crosses midnight
    if (!inWindow) return false;
  }

  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx jest campaign.logic -v`

Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/campaign.logic.ts backend/src/services/__tests__/campaign.logic.test.ts
git commit -m "feat(campaign): pure Bangkok-aware campaign window matching"
```

---

### Task 3: Campaign selection and point computation (pure)

**Files:**
- Modify: `backend/src/services/campaign.logic.ts`
- Modify: `backend/src/services/__tests__/campaign.logic.test.ts`

**Interfaces:**
- Consumes: `CampaignWindow`, `isCampaignActiveAt` from Task 2
- Produces:
  - `export interface CampaignRule extends CampaignWindow { id: number; points_per_baht: number; min_topup_amount: number; max_points_per_user: number | null; max_points_budget: number | null; points_expire_days: number; }`
  - `export function selectCampaignAt(list: CampaignRule[], when: Date): CampaignRule | null`
  - `export function computeGrant(args: { amountBaht: number; campaign: CampaignRule; userAlreadyGranted: number; campaignAlreadyGranted: number; }): { points: number; capped: 'none' | 'user' | 'budget' }`
  - `export function computeExpiry(campaign: CampaignRule): Date`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/services/__tests__/campaign.logic.test.ts`:

```ts
import { selectCampaignAt, computeGrant, computeExpiry, CampaignRule } from '../campaign.logic';

const rule = (over: Partial<CampaignRule> = {}): CampaignRule => ({
  id: 1,
  starts_at: new Date('2026-08-01T00:00:00Z'),
  ends_at:   new Date('2026-08-31T23:59:59Z'),
  daily_start_time: null,
  daily_end_time: null,
  weekday_mask: null,
  paused: 0,
  active: 1,
  deleted_at: null,
  points_per_baht: 0.1,
  min_topup_amount: 0,
  max_points_per_user: null,
  max_points_budget: null,
  points_expire_days: 30,
  ...over,
});

const when = new Date('2026-08-10T10:00:00Z');

describe('selectCampaignAt', () => {
  it('returns null when nothing is active', () => {
    expect(selectCampaignAt([rule({ paused: 1 })], when)).toBeNull();
  });
  it('returns the only active campaign', () => {
    expect(selectCampaignAt([rule({ id: 7 })], when)?.id).toBe(7);
  });
  it('picks the highest rate when several overlap (never stacks)', () => {
    const picked = selectCampaignAt([
      rule({ id: 1, points_per_baht: 0.1 }),
      rule({ id: 2, points_per_baht: 0.5 }),
      rule({ id: 3, points_per_baht: 0.2 }),
    ], when);
    expect(picked?.id).toBe(2);
  });
  it('ignores inactive campaigns when picking the highest rate', () => {
    const picked = selectCampaignAt([
      rule({ id: 1, points_per_baht: 0.1 }),
      rule({ id: 2, points_per_baht: 9.9, paused: 1 }),
    ], when);
    expect(picked?.id).toBe(1);
  });
  it('breaks a rate tie deterministically by lowest id', () => {
    const picked = selectCampaignAt([
      rule({ id: 5, points_per_baht: 0.3 }),
      rule({ id: 2, points_per_baht: 0.3 }),
    ], when);
    expect(picked?.id).toBe(2);
  });
});

describe('computeGrant', () => {
  it('computes points at the linear rate', () => {
    expect(computeGrant({
      amountBaht: 500, campaign: rule(), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 50, capped: 'none' });
  });
  it('floors fractional points', () => {
    expect(computeGrant({
      amountBaht: 55, campaign: rule({ points_per_baht: 0.1 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 5, capped: 'none' });
  });
  it('grants nothing below min_topup_amount', () => {
    expect(computeGrant({
      amountBaht: 40, campaign: rule({ min_topup_amount: 50 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'none' });
  });
  it('grants at exactly min_topup_amount', () => {
    expect(computeGrant({
      amountBaht: 50, campaign: rule({ min_topup_amount: 50 }), userAlreadyGranted: 0, campaignAlreadyGranted: 0,
    })).toEqual({ points: 5, capped: 'none' });
  });
  it('clamps to the per-user cap and reports it', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_per_user: 60 }), userAlreadyGranted: 40, campaignAlreadyGranted: 0,
    })).toEqual({ points: 20, capped: 'user' });
  });
  it('returns zero when the per-user cap is already exhausted', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_per_user: 60 }), userAlreadyGranted: 60, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'user' });
  });
  it('clamps to the campaign budget and reports it', () => {
    expect(computeGrant({
      amountBaht: 1000, campaign: rule({ max_points_budget: 500 }), userAlreadyGranted: 0, campaignAlreadyGranted: 480,
    })).toEqual({ points: 20, capped: 'budget' });
  });
  it('applies the tighter of the two caps', () => {
    expect(computeGrant({
      amountBaht: 1000,
      campaign: rule({ max_points_per_user: 50, max_points_budget: 500 }),
      userAlreadyGranted: 45, campaignAlreadyGranted: 490,
    })).toEqual({ points: 5, capped: 'user' });
  });
  it('never returns negative points', () => {
    expect(computeGrant({
      amountBaht: 100, campaign: rule({ max_points_per_user: 10 }), userAlreadyGranted: 999, campaignAlreadyGranted: 0,
    })).toEqual({ points: 0, capped: 'user' });
  });
});

describe('computeExpiry', () => {
  it('expires N days after the campaign ends', () => {
    expect(computeExpiry(rule({
      ends_at: new Date('2026-08-31T00:00:00Z'), points_expire_days: 30,
    }))).toEqual(new Date('2026-09-30T00:00:00Z'));
  });
  it('supports a zero grace (expires at campaign end)', () => {
    expect(computeExpiry(rule({
      ends_at: new Date('2026-08-31T00:00:00Z'), points_expire_days: 0,
    }))).toEqual(new Date('2026-08-31T00:00:00Z'));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest campaign.logic -v`

Expected: FAIL, `selectCampaignAt is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `backend/src/services/campaign.logic.ts`:

```ts
export interface CampaignRule extends CampaignWindow {
  id: number;
  points_per_baht: number;
  min_topup_amount: number;
  max_points_per_user: number | null;
  max_points_budget: number | null;
  points_expire_days: number;
}

/**
 * The single campaign that applies at `when`.
 *
 * Overlapping campaigns do NOT stack: the highest rate wins, ties broken by
 * lowest id so the choice is deterministic and reproducible in support tickets.
 */
export function selectCampaignAt(list: CampaignRule[], when: Date): CampaignRule | null {
  const active = list.filter(c => isCampaignActiveAt(c, when));
  if (active.length === 0) return null;
  return active.reduce((best, c) => {
    if (c.points_per_baht > best.points_per_baht) return c;
    if (c.points_per_baht === best.points_per_baht && c.id < best.id) return c;
    return best;
  });
}

/**
 * Points earned by a qualifying top-up, after both caps.
 *
 * A partially-available cap grants the remainder rather than zero: the player
 * gets what is left and is told honestly, which beats silently zeroing them.
 */
export function computeGrant(args: {
  amountBaht: number;
  campaign: CampaignRule;
  userAlreadyGranted: number;
  campaignAlreadyGranted: number;
}): { points: number; capped: 'none' | 'user' | 'budget' } {
  const { amountBaht, campaign, userAlreadyGranted, campaignAlreadyGranted } = args;

  if (amountBaht < campaign.min_topup_amount) return { points: 0, capped: 'none' };

  let points = Math.floor(amountBaht * campaign.points_per_baht);
  let capped: 'none' | 'user' | 'budget' = 'none';

  if (campaign.max_points_budget !== null) {
    const room = Math.max(0, campaign.max_points_budget - campaignAlreadyGranted);
    if (room < points) { points = room; capped = 'budget'; }
  }
  if (campaign.max_points_per_user !== null) {
    const room = Math.max(0, campaign.max_points_per_user - userAlreadyGranted);
    if (room < points) { points = room; capped = 'user'; }
  }

  return { points: Math.max(0, points), capped };
}

/** Frozen onto the lot at grant time. Later campaign edits never change it. */
export function computeExpiry(campaign: CampaignRule): Date {
  return new Date(campaign.ends_at.getTime() + campaign.points_expire_days * 86_400_000);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx jest campaign.logic -v`

Expected: PASS, 33 tests total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/campaign.logic.ts backend/src/services/__tests__/campaign.logic.test.ts
git commit -m "feat(campaign): campaign selection (highest rate wins) and capped point computation"
```

---

### Task 4: Campaign service - grant, balance, history

**Files:**
- Create: `backend/src/services/campaign.service.ts`

**Interfaces:**
- Consumes: `selectCampaignAt`, `computeGrant`, `computeExpiry`, `CampaignRule` from Tasks 2-3; `pool` from `../database/connection`; `logger` from `../utils/logger`
- Produces:
  - `export const campaignService`
  - `campaignService.grantForTopup(args: { userId: number; transactionId: number; amountBaht: number; qualifiedAt: Date }): Promise<{ granted: number; campaignId: number | null }>`
  - `campaignService.getBalance(userId: number): Promise<number>`
  - `campaignService.getLots(userId: number): Promise<PointLotRow[]>`
  - `campaignService.getActiveCampaign(when?: Date): Promise<CampaignRule | null>`

- [ ] **Step 1: Write the implementation**

Create `backend/src/services/campaign.service.ts`:

```ts
/**
 * Campaign point ledger (DB layer).
 *
 * Decision logic lives in campaign.logic.ts; this file only talks to MySQL.
 *
 * INVARIANT: points never touch `wallets` or `transactions`. This service is
 * called AFTER a payment has committed and its failure must never propagate
 * back into the payment flow - see grantForTopup's contract below.
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  CampaignRule, selectCampaignAt, computeGrant, computeExpiry,
} from './campaign.logic';

export interface PointLotRow extends RowDataPacket {
  id: number;
  campaign_id: number | null;
  points_granted: number;
  points_remaining: number;
  qualified_at: Date;
  expires_at: Date;
  reason: string | null;
}

const CAMPAIGN_COLS = `
  id, points_per_baht, min_topup_amount, starts_at, ends_at,
  daily_start_time, daily_end_time, weekday_mask,
  max_points_per_user, max_points_budget, points_expire_days,
  paused, active, deleted_at
`;

/** MySQL returns DECIMAL as string; normalize into the numeric shape logic expects. */
function toRule(r: RowDataPacket): CampaignRule {
  return {
    id: r.id,
    points_per_baht: parseFloat(r.points_per_baht),
    min_topup_amount: parseFloat(r.min_topup_amount),
    starts_at: new Date(r.starts_at),
    ends_at: new Date(r.ends_at),
    daily_start_time: r.daily_start_time,
    daily_end_time: r.daily_end_time,
    weekday_mask: r.weekday_mask,
    max_points_per_user: r.max_points_per_user,
    max_points_budget: r.max_points_budget,
    points_expire_days: r.points_expire_days,
    paused: r.paused,
    active: r.active,
    deleted_at: r.deleted_at ? new Date(r.deleted_at) : null,
  };
}

class CampaignService {
  /** Campaigns whose absolute range could contain `when`. Masks are applied in logic. */
  private async candidatesAt(when: Date): Promise<CampaignRule[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${CAMPAIGN_COLS} FROM campaigns
       WHERE deleted_at IS NULL AND active = 1 AND paused = 0
         AND starts_at <= ? AND ends_at >= ?`,
      [when, when]
    );
    return rows.map(toRule);
  }

  /** The campaign granting points right now, or null. Used by the UI banner too. */
  async getActiveCampaign(when: Date = new Date()): Promise<CampaignRule | null> {
    return selectCampaignAt(await this.candidatesAt(when), when);
  }

  /**
   * Grant campaign points for a completed top-up.
   *
   * CONTRACT: callers invoke this AFTER their payment transaction has committed,
   * wrapped in try/catch. It must never be called inside the payment transaction
   * - a points failure must not be able to roll back real money.
   *
   * Idempotency is enforced by UNIQUE(source_transaction_id, campaign_id): a
   * retried call for the same transaction is swallowed, not double-granted.
   */
  async grantForTopup(args: {
    userId: number; transactionId: number; amountBaht: number; qualifiedAt: Date;
  }): Promise<{ granted: number; campaignId: number | null }> {
    const { userId, transactionId, amountBaht, qualifiedAt } = args;

    const campaign = await this.getActiveCampaign(qualifiedAt);
    if (!campaign) return { granted: 0, campaignId: null };

    const [[userAgg]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_granted), 0) AS total FROM point_lots
       WHERE user_id = ? AND campaign_id = ? AND points_granted > 0`,
      [userId, campaign.id]
    ) as unknown as [RowDataPacket[], unknown];

    const [[campAgg]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_granted), 0) AS total FROM point_lots
       WHERE campaign_id = ? AND points_granted > 0`,
      [campaign.id]
    ) as unknown as [RowDataPacket[], unknown];

    const { points, capped } = computeGrant({
      amountBaht,
      campaign,
      userAlreadyGranted: Number(userAgg.total),
      campaignAlreadyGranted: Number(campAgg.total),
    });

    if (points <= 0) return { granted: 0, campaignId: campaign.id };

    try {
      await pool.execute<ResultSetHeader>(
        `INSERT INTO point_lots
           (user_id, campaign_id, points_granted, points_remaining,
            rate_applied, qualified_at, expires_at, source_transaction_id)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          userId, campaign.id, points, points,
          campaign.points_per_baht, qualifiedAt, computeExpiry(campaign), transactionId,
        ]
      );
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        // Already granted for this transaction (retry or reconciler race). Not an error.
        return { granted: 0, campaignId: campaign.id };
      }
      throw e;
    }

    if (capped !== 'none') {
      logger.info('Campaign grant was capped', { userId, campaignId: campaign.id, capped, points });
    }
    return { granted: points, campaignId: campaign.id };
  }

  /** Spendable balance: unexpired lots only, including negative clawback debt. */
  async getBalance(userId: number): Promise<number> {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points_remaining), 0) AS balance FROM point_lots
       WHERE user_id = ? AND expires_at > NOW()`,
      [userId]
    ) as unknown as [RowDataPacket[], unknown];
    return Number(row.balance);
  }

  /** Unexpired lots, soonest-expiring first, for the player's points page. */
  async getLots(userId: number): Promise<PointLotRow[]> {
    const [rows] = await pool.execute<PointLotRow[]>(
      `SELECT id, campaign_id, points_granted, points_remaining,
              qualified_at, expires_at, reason
       FROM point_lots
       WHERE user_id = ? AND expires_at > NOW() AND points_remaining != 0
       ORDER BY expires_at ASC`,
      [userId]
    );
    return rows;
  }
}

export const campaignService = new CampaignService();
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`

Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/campaign.service.ts
git commit -m "feat(campaign): point ledger service with idempotent grant and balance"
```

---

### Task 5: Clawback on reversed top-ups

**Files:**
- Modify: `backend/src/services/campaign.service.ts`
- Modify: `backend/src/services/__tests__/campaign.logic.test.ts`
- Modify: `backend/src/services/campaign.logic.ts`

**Interfaces:**
- Consumes: `campaignService` from Task 4
- Produces:
  - `export function planClawback(lot: { points_granted: number; points_remaining: number }): { reduceRemainingBy: number; debtToRecord: number }`
  - `campaignService.revokeForTransaction(transactionId: number): Promise<{ revoked: number; debt: number }>`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/services/__tests__/campaign.logic.test.ts`:

```ts
import { planClawback } from '../campaign.logic';

describe('planClawback', () => {
  it('takes it all back when nothing was spent', () => {
    expect(planClawback({ points_granted: 100, points_remaining: 100 }))
      .toEqual({ reduceRemainingBy: 100, debtToRecord: 0 });
  });
  it('records debt for the spent portion', () => {
    expect(planClawback({ points_granted: 100, points_remaining: 40 }))
      .toEqual({ reduceRemainingBy: 40, debtToRecord: 60 });
  });
  it('records the full amount as debt when fully spent', () => {
    expect(planClawback({ points_granted: 100, points_remaining: 0 }))
      .toEqual({ reduceRemainingBy: 0, debtToRecord: 100 });
  });
  it('is a no-op for an already-revoked lot', () => {
    expect(planClawback({ points_granted: 0, points_remaining: 0 }))
      .toEqual({ reduceRemainingBy: 0, debtToRecord: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest campaign.logic -v`

Expected: FAIL, `planClawback is not a function`.

- [ ] **Step 3: Add the pure function**

Append to `backend/src/services/campaign.logic.ts`:

```ts
/**
 * Reversing a top-up must reverse its points, otherwise
 * "top up, take points, redeem, dispute the payment" is free money.
 *
 * Unspent points are simply removed. Points already spent cannot be un-spent
 * (the reward is already in the player's inventory), so the shortfall is
 * recorded as debt: a negative lot that future earnings must repay first.
 */
export function planClawback(lot: { points_granted: number; points_remaining: number }):
  { reduceRemainingBy: number; debtToRecord: number } {
  const granted = Math.max(0, lot.points_granted);
  const remaining = Math.max(0, lot.points_remaining);
  const reduceRemainingBy = Math.min(granted, remaining);
  return { reduceRemainingBy, debtToRecord: granted - reduceRemainingBy };
}
```

- [ ] **Step 4: Add the service method**

Add this method to `CampaignService` in `backend/src/services/campaign.service.ts`, immediately after `grantForTopup`, and add `planClawback` to the import from `./campaign.logic`:

```ts
  /**
   * Reverse the points granted for a top-up that was refunded or reversed.
   * Safe to call for transactions that never earned points.
   */
  async revokeForTransaction(transactionId: number): Promise<{ revoked: number; debt: number }> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [lots] = await conn.execute<RowDataPacket[]>(
        `SELECT id, user_id, campaign_id, points_granted, points_remaining
         FROM point_lots WHERE source_transaction_id = ? FOR UPDATE`,
        [transactionId]
      );
      if (lots.length === 0) { await conn.commit(); return { revoked: 0, debt: 0 }; }

      let revoked = 0;
      let debt = 0;

      for (const lot of lots) {
        const plan = planClawback(lot as any);
        if (plan.reduceRemainingBy > 0) {
          await conn.execute(
            'UPDATE point_lots SET points_remaining = points_remaining - ? WHERE id = ?',
            [plan.reduceRemainingBy, lot.id]
          );
          revoked += plan.reduceRemainingBy;
        }
        if (plan.debtToRecord > 0) {
          // Debt never expires, so it cannot be waited out.
          await conn.execute(
            `INSERT INTO point_lots
               (user_id, campaign_id, points_granted, points_remaining,
                qualified_at, expires_at, reason)
             VALUES (?,?,?,?, NOW(), '2099-12-31 23:59:59', ?)`,
            [lot.user_id, lot.campaign_id, -plan.debtToRecord, -plan.debtToRecord,
             `clawback: transaction ${transactionId} reversed`]
          );
          debt += plan.debtToRecord;
        }
      }

      await conn.commit();
      logger.info('Campaign points revoked', { transactionId, revoked, debt });
      return { revoked, debt };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd backend && npx jest campaign.logic -v && npx tsc --noEmit`

Expected: PASS, 37 tests total; tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/campaign.logic.ts backend/src/services/campaign.service.ts backend/src/services/__tests__/campaign.logic.test.ts
git commit -m "feat(campaign): clawback reversed top-ups via negative debt lots"
```

---

### Task 6: Wire granting into the three top-up paths

**Files:**
- Modify: `backend/src/services/payment.service.ts` (TrueMoney credit, around line 204; slip credit, around line 478)
- Modify: `backend/src/services/user.service.ts` (admin manual balance set, around line 308)

**Interfaces:**
- Consumes: `campaignService.grantForTopup` from Task 4
- Produces: nothing new; wires existing behaviour

- [ ] **Step 1: Import the service**

Add to the imports at the top of `backend/src/services/payment.service.ts`:

```ts
import { campaignService } from './campaign.service';
```

- [ ] **Step 2: Capture the transaction id at the TrueMoney credit site**

In `redeemTrueMoney`, the `transactions` INSERT currently discards its result. Change it to capture `insertId`:

```ts
      const [txResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'truemoney', 'success', ?, ?)`,
        [userId, amount, voucherHash, desc]
      );
      const transactionId = txResult.insertId;
```

Ensure `ResultSetHeader` is in the `mysql2` import at the top of the file.

- [ ] **Step 3: Grant after the TrueMoney commit**

Immediately after the `await conn.commit();` that ends `redeemTrueMoney`'s transaction, add:

```ts
      // Campaign points are granted AFTER the money has committed and can never
      // roll it back. TrueMoney has no bank timestamp, so the redemption instant
      // IS the payment instant.
      try {
        await campaignService.grantForTopup({
          userId,
          transactionId,
          amountBaht: amount,
          qualifiedAt: new Date(),
        });
      } catch (err) {
        logger.error('Campaign grant failed after truemoney topup', {
          userId, transactionId, error: (err as Error)?.message,
        });
      }
```

- [ ] **Step 4: Capture the transaction id at the slip credit site**

In the slip verification flow, change the `transactions` INSERT the same way:

```ts
      const [txResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO transactions (user_id, amount, type, method, status, reference, description)
         VALUES (?, ?, 'topup', 'slip', 'success', ?, ?)`,
        [userId, amount, transRef, slipDesc]
      );
      const transactionId = txResult.insertId;
```

- [ ] **Step 5: Grant after the slip commit**

Immediately after the `await conn.commit();` that ends the slip credit transaction, add:

```ts
      // qualified_at is the BANK TRANSFER time (slipDate), not the upload time.
      // This is both fairer (pay 23:58, verify 00:05, still counts) and safer
      // (a slip hoarded from before the window does not qualify).
      try {
        await campaignService.grantForTopup({
          userId,
          transactionId,
          amountBaht: amount,
          qualifiedAt: slipDate,
        });
      } catch (err) {
        logger.error('Campaign grant failed after slip topup', {
          userId, transactionId, error: (err as Error)?.message,
        });
      }
```

`slipDate` is already computed earlier in this function (`const slipDate = raw.date ? new Date(raw.date) : new Date();`).

- [ ] **Step 6: Deliberately do NOT wire `updateUserProfile`**

`user.service.ts:280` `updateUserProfile` sets an **absolute** wallet balance and writes only a `wallet_logs` row, never a `transactions` row. Do not add point granting there. Two reasons:

1. It is a **correction** tool, not a top-up path. An admin fixing a wrong balance is not a player topping up, and granting campaign points for a correction is both semantically wrong and abusable.
2. It has no `transactions` row, so there is no transaction id, and the transaction id **is** the idempotency key. Without it, a re-saved profile form would double-grant.

Admins who genuinely want to give a player points use the dedicated endpoint built in Task 8 (`POST /api/admin/campaigns/points/grant`), which requires a reason and writes to `audit_logs`. That is the correct tool and it already exists.

Add this comment above the `if (data.balance !== undefined) {` block in `updateUserProfile` so the omission is not later "fixed" by mistake:

```ts
      // NOTE: no campaign points here on purpose. This sets an ABSOLUTE balance
      // as an admin correction, has no `transactions` row (so no idempotency
      // key), and is not a top-up. To give a player points, use
      // POST /api/admin/campaigns/points/grant, which requires a reason and is
      // audited.
```

This means the only automatic grant paths are slip and TrueMoney, both wired above.

- [ ] **Step 7: Typecheck and run the full suite**

Run: `cd backend && npx tsc --noEmit && npm test`

Expected: tsc exits 0; all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/payment.service.ts backend/src/services/user.service.ts
git commit -m "feat(campaign): grant points from slip, truemoney, and admin top-ups"
```

---

### Task 7: Player-facing API

**Files:**
- Create: `backend/src/routes/campaign.routes.ts`
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `campaignService` from Tasks 4-5; `requireAuth` from `../middleware/auth`; `asyncRoute` from `../middleware/asyncRoute`
- Produces: `GET /api/campaign/active`, `GET /api/campaign/points`

- [ ] **Step 1: Write the routes**

Create `backend/src/routes/campaign.routes.ts`:

```ts
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncRoute } from '../middleware/asyncRoute';
import { campaignService } from '../services/campaign.service';

const router = Router();

/** Public: the campaign granting points right now, for the banner. */
router.get('/active', asyncRoute(async (_req: Request, res: Response) => {
  const c = await campaignService.getActiveCampaign();
  if (!c) return res.json({ success: true, campaign: null });
  res.json({
    success: true,
    campaign: {
      id: c.id,
      pointsPerBaht: c.points_per_baht,
      minTopupAmount: c.min_topup_amount,
      endsAt: c.ends_at,
    },
  });
}));

/** Authenticated: this player's point balance and unexpired lots. */
router.get('/points', requireAuth, asyncRoute(async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const [balance, lots] = await Promise.all([
    campaignService.getBalance(userId),
    campaignService.getLots(userId),
  ]);
  res.json({ success: true, balance, lots });
}));

export default router;
```

Match the exact export style and `requireAuth` import path used by the neighbouring files in `backend/src/routes/` - check `wallet.routes.ts` first and mirror it.

- [ ] **Step 2: Register the router**

In `backend/src/server.ts`, alongside the other `app.use('/api/...')` registrations, add:

```ts
import campaignRoutes from './routes/campaign.routes';
// ...
app.use('/api/campaign', campaignRoutes);
```

- [ ] **Step 3: Verify the endpoints respond**

Run:

```bash
cd backend && npm run dev &
sleep 5
curl -s localhost:4000/api/campaign/active
```

Expected: `{"success":true,"campaign":null}` (no campaign seeded yet).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/campaign.routes.ts backend/src/server.ts
git commit -m "feat(campaign): player endpoints for active campaign and point balance"
```

---

### Task 8: Admin CRUD API

**Files:**
- Modify: `backend/src/validators/schemas.ts`
- Modify: `backend/src/routes/admin.routes.ts`
- Modify: `backend/src/services/campaign.service.ts`

**Interfaces:**
- Consumes: `campaignService`, `auditService` (existing), `validate` middleware
- Produces:
  - `export const campaignSchema` (Zod)
  - `campaignService.listAll()`, `.create(data)`, `.update(id, data)`, `.softDelete(id)`, `.stats(id)`, `.grantManual(...)`
  - `GET/POST/PUT/DELETE /api/admin/campaigns`, `GET /api/admin/campaigns/:id/stats`, `POST /api/admin/campaigns/points/grant`

- [ ] **Step 1: Add the Zod schema**

Append to `backend/src/validators/schemas.ts`:

```ts
export const campaignSchema = z.object({
  name: z.string().min(1, 'ต้องระบุชื่อแคมเปญ').max(255),
  description: z.string().max(2000).optional().nullable(),
  bannerImage: z.string().max(500).optional().nullable(),
  pointsPerBaht: z.number().positive('อัตราแต้มต้องมากกว่า 0').max(1000),
  minTopupAmount: z.number().min(0).default(0),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  dailyStartTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  dailyEndTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  weekdayMask: z.number().int().min(0).max(127).optional().nullable(),
  maxPointsPerUser: z.number().int().positive().optional().nullable(),
  maxPointsBudget: z.number().int().positive().optional().nullable(),
  pointsExpireDays: z.number().int().min(0).max(3650).default(30),
  paused: z.boolean().default(false),
  active: z.boolean().default(true),
})
  .refine(d => d.endsAt > d.startsAt, {
    message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม', path: ['endsAt'],
  })
  .refine(d => (d.dailyStartTime == null) === (d.dailyEndTime == null), {
    message: 'ต้องระบุเวลาเริ่มและสิ้นสุดรายวันคู่กัน', path: ['dailyEndTime'],
  });

export const grantPointsSchema = z.object({
  userId: z.number().int().positive(),
  points: z.number().int().refine(n => n !== 0, 'จำนวนแต้มต้องไม่เป็น 0'),
  reason: z.string().min(1, 'ต้องระบุเหตุผล').max(255),
  expireDays: z.number().int().min(1).max(3650).default(365),
});
```

- [ ] **Step 2: Add the service methods**

Append these methods to `CampaignService` in `backend/src/services/campaign.service.ts`:

```ts
  /** Every campaign including paused and soft-deleted, newest first. */
  async listAll(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT c.*,
              COALESCE((SELECT SUM(points_granted) FROM point_lots
                        WHERE campaign_id = c.id AND points_granted > 0), 0) AS points_issued,
              COALESCE((SELECT COUNT(DISTINCT user_id) FROM point_lots
                        WHERE campaign_id = c.id AND points_granted > 0), 0) AS participants
       FROM campaigns c
       WHERE c.deleted_at IS NULL
       ORDER BY c.starts_at DESC`
    );
    return rows;
  }

  async create(d: any): Promise<number> {
    const [r] = await pool.execute<ResultSetHeader>(
      `INSERT INTO campaigns
         (name, description, banner_image, points_per_baht, min_topup_amount,
          starts_at, ends_at, daily_start_time, daily_end_time, weekday_mask,
          max_points_per_user, max_points_budget, points_expire_days, paused, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.name, d.description ?? null, d.bannerImage ?? null, d.pointsPerBaht,
       d.minTopupAmount, d.startsAt, d.endsAt, d.dailyStartTime ?? null,
       d.dailyEndTime ?? null, d.weekdayMask ?? null, d.maxPointsPerUser ?? null,
       d.maxPointsBudget ?? null, d.pointsExpireDays, d.paused ? 1 : 0, d.active ? 1 : 0]
    );
    return r.insertId;
  }

  /**
   * Edits apply FORWARD ONLY. Already-issued lots keep their points, their
   * rate_applied and their expires_at - this method never touches point_lots.
   */
  async update(id: number, d: any): Promise<void> {
    await pool.execute(
      `UPDATE campaigns SET
         name=?, description=?, banner_image=?, points_per_baht=?, min_topup_amount=?,
         starts_at=?, ends_at=?, daily_start_time=?, daily_end_time=?, weekday_mask=?,
         max_points_per_user=?, max_points_budget=?, points_expire_days=?, paused=?, active=?
       WHERE id=?`,
      [d.name, d.description ?? null, d.bannerImage ?? null, d.pointsPerBaht,
       d.minTopupAmount, d.startsAt, d.endsAt, d.dailyStartTime ?? null,
       d.dailyEndTime ?? null, d.weekdayMask ?? null, d.maxPointsPerUser ?? null,
       d.maxPointsBudget ?? null, d.pointsExpireDays, d.paused ? 1 : 0,
       d.active ? 1 : 0, id]
    );
  }

  /** Soft-delete. Issued lots survive and stay spendable. */
  async softDelete(id: number): Promise<void> {
    await pool.execute('UPDATE campaigns SET deleted_at = NOW() WHERE id = ?', [id]);
  }

  /** Dashboard figures for one campaign, including outstanding liability. */
  async stats(id: number): Promise<Record<string, number>> {
    const [[row]] = await pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN points_granted > 0 THEN points_granted END), 0) AS issued,
         COALESCE(SUM(CASE WHEN points_granted > 0 AND expires_at > NOW()
                           THEN points_remaining END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN points_granted > 0 AND expires_at <= NOW()
                           THEN points_remaining END), 0) AS expired_unspent,
         COUNT(DISTINCT user_id) AS participants
       FROM point_lots WHERE campaign_id = ?`,
      [id]
    ) as unknown as [RowDataPacket[], unknown];
    const issued = Number(row.issued);
    return {
      issued,
      outstanding: Number(row.outstanding),
      expiredUnspent: Number(row.expired_unspent),
      participants: Number(row.participants),
      redeemed: issued - Number(row.outstanding) - Number(row.expired_unspent),
    };
  }

  /** Manual admin adjustment. Positive grants, negative deducts. Reason is mandatory. */
  async grantManual(userId: number, points: number, reason: string, expireDays: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expireDays * 86_400_000);
    await pool.execute(
      `INSERT INTO point_lots
         (user_id, campaign_id, points_granted, points_remaining,
          qualified_at, expires_at, reason)
       VALUES (?, NULL, ?, ?, NOW(), ?, ?)`,
      [userId, points, points, expiresAt, reason]
    );
  }
```

- [ ] **Step 3: Add the admin routes**

Append to `backend/src/routes/admin.routes.ts`, following the exact style of the existing `/slides` handlers at ~line 906:

```ts
router.get('/campaigns', asyncRoute(async (_req: Request, res: Response) => {
  res.json({ success: true, campaigns: await campaignService.listAll() });
}));

router.get('/campaigns/:id/stats', asyncRoute(async (req: Request, res: Response) => {
  res.json({ success: true, stats: await campaignService.stats(Number(req.params.id)) });
}));

router.post('/campaigns', validate(campaignSchema), asyncRoute(async (req: Request, res: Response) => {
  const id = await campaignService.create(req.body);
  await auditService.log((req as any).user.id, 'campaign_create', { campaignId: id, name: req.body.name });
  res.json({ success: true, id });
}));

router.put('/campaigns/:id', validate(campaignSchema), asyncRoute(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await campaignService.update(id, req.body);
  await auditService.log((req as any).user.id, 'campaign_update', { campaignId: id, name: req.body.name });
  res.json({ success: true });
}));

router.delete('/campaigns/:id', asyncRoute(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await campaignService.softDelete(id);
  await auditService.log((req as any).user.id, 'campaign_delete', { campaignId: id });
  res.json({ success: true });
}));

router.post('/campaigns/points/grant', validate(grantPointsSchema), asyncRoute(async (req: Request, res: Response) => {
  const { userId, points, reason, expireDays } = req.body;
  await campaignService.grantManual(userId, points, reason, expireDays);
  await auditService.log((req as any).user.id, 'campaign_points_grant', { userId, points, reason });
  res.json({ success: true });
}));
```

Add `campaignService`, `campaignSchema`, and `grantPointsSchema` to the imports at the top of the file. Verify `auditService.log`'s real signature before using it and match it exactly.

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`

Expected: exit 0.

- [ ] **Step 5: Smoke-test create and read back**

Run:

```bash
TOKEN=<admin jwt>
curl -s -X POST localhost:4000/api/admin/campaigns \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Test","pointsPerBaht":0.1,"minTopupAmount":50,
       "startsAt":"2026-08-01T00:00:00Z","endsAt":"2026-08-31T23:59:59Z",
       "pointsExpireDays":30}'
curl -s localhost:4000/api/campaign/active
```

Expected: create returns `{"success":true,"id":1}`. The `active` call returns `campaign: null` unless the current date is inside the window.

- [ ] **Step 6: Commit**

```bash
git add backend/src/validators/schemas.ts backend/src/routes/admin.routes.ts backend/src/services/campaign.service.ts
git commit -m "feat(campaign): admin CRUD, stats, and manual point adjustment"
```

---

### Task 9: Admin UI

**Files:**
- Create: `frontend/src/app/admin/campaigns/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx` (sidebar entry)

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/admin/campaigns` from Task 8; `api` from `@/lib/api`
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Read the existing admin page conventions**

Read `frontend/src/app/admin/products/page.tsx` in full before writing anything. Match its table markup, modal pattern, button classes, loading and empty states, and toast handling exactly. Do not invent new styling.

- [ ] **Step 2: Build the page**

Create `frontend/src/app/admin/campaigns/page.tsx` following that page's structure, with a campaign list table showing: name, rate (`0.1 point/฿`), window, a **live status pill**, participants, points issued, and outstanding.

The status pill must be computed client-side from the same rules as the backend, because a misconfigured hours or weekday mask is the most likely admin error and the config alone does not reveal it:

```tsx
// bit0=Mon .. bit6=Sun, evaluated in Asia/Bangkok (UTC+7, no DST)
function isLiveNow(c: Campaign): boolean {
  const now = new Date();
  if (!c.active || c.paused) return false;
  if (now < new Date(c.starts_at) || now > new Date(c.ends_at)) return false;

  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const weekdayMon0 = (shifted.getUTCDay() + 6) % 7;
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();

  if (c.weekday_mask != null && (c.weekday_mask & (1 << weekdayMon0)) === 0) return false;

  if (c.daily_start_time && c.daily_end_time) {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const s = toMin(c.daily_start_time);
    const e = toMin(c.daily_end_time);
    if (s === e) return false;
    return s < e ? (minutes >= s && minutes < e) : (minutes >= s || minutes < e);
  }
  return true;
}
```

Status pill copy (no em dash, no emoji):

| Condition | Label |
|-----------|-------|
| `isLiveNow` | `กำลังแจกแต้ม` (green) |
| `paused` | `หยุดชั่วคราว` (amber) |
| now < `starts_at` | `รอเริ่ม` (blue) |
| now > `ends_at` | `จบแล้ว` (gray) |
| in range but masked out | `นอกช่วงเวลา` (gray) |

- [ ] **Step 3: Add the dry-run preview to the create/edit modal**

Inside the modal, below the rate field, render a live preview so a misplaced decimal is caught before saving:

```tsx
<div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
  <div className="flex items-center gap-2 text-slate-600">
    <i className="fas fa-calculator" aria-hidden="true" />
    <span>ตัวอย่างการคำนวณ</span>
  </div>
  <ul className="mt-2 space-y-1 text-slate-700">
    {[100, 500, 1000].map(amt => (
      <li key={amt} className="flex justify-between">
        <span>เติม ฿{amt.toLocaleString()}</span>
        <span className="font-medium">
          {amt < (form.minTopupAmount || 0)
            ? 'ไม่ได้รับแต้ม (ต่ำกว่าขั้นต่ำ)'
            : `${Math.floor(amt * (form.pointsPerBaht || 0)).toLocaleString()} point`}
        </span>
      </li>
    ))}
  </ul>
</div>
```

- [ ] **Step 4: Warn on overlapping windows**

When the admin saves, if another non-deleted campaign's `[starts_at, ends_at]` overlaps the one being saved, show a non-blocking warning before confirming:

```
มีแคมเปญอื่นทับช่วงเวลานี้อยู่ ระบบจะใช้แคมเปญที่ให้แต้มต่อบาทสูงสุดเพียงอันเดียว (ไม่รวมแต้ม)
```

- [ ] **Step 5: Add the sidebar entry**

In `frontend/src/app/admin/layout.tsx`, add a nav item to the existing array pointing at `/admin/campaigns` labelled `แคมเปญเติมเงิน` with icon `fas fa-bullhorn`. Match the surrounding entries' shape exactly.

- [ ] **Step 6: Verify the build**

Run: `cd frontend && npm run build`

Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/campaigns/page.tsx frontend/src/app/admin/layout.tsx
git commit -m "feat(campaign): admin UI with live status, dry-run preview, overlap warning"
```

---

### Task 10: Player-facing balance and banner

**Files:**
- Create: `frontend/src/components/CampaignBanner.tsx`
- Modify: `frontend/src/app/topup/page.tsx`
- Modify: `frontend/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `GET /api/campaign/active`, `GET /api/campaign/points` from Task 7

- [ ] **Step 1: Build the banner component**

Create `frontend/src/components/CampaignBanner.tsx`. It fetches `/api/campaign/active`, renders nothing when `campaign` is null, and otherwise shows the rate, the minimum, and a live countdown to `endsAt`.

Copy rules: no em dash, no emoji, Font Awesome icons, semantic tokens from `globals.css`. Example strings:

- Headline: `แคมเปญเติมเงินพิเศษ`
- Rate line: `เติมทุก ฿10 รับ 1 point`
- Minimum line: `ขั้นต่ำ ฿50 ต่อครั้ง`
- Countdown: `เหลือเวลา 2 วัน 04:12:33`

- [ ] **Step 2: Mount the banner on the top-up page**

Render `<CampaignBanner />` at the top of `frontend/src/app/topup/page.tsx`, above the amount selector, so a player sees the offer before choosing an amount.

- [ ] **Step 3: Add a progress nudge to the amount selector**

When a campaign is active and the entered amount is below `minTopupAmount`, show below the input:

```
เติมอีก ฿{minTopupAmount - amount} จึงจะได้รับแต้มแคมเปญ
```

When at or above it, show:

```
จะได้รับ {Math.floor(amount * pointsPerBaht)} point
```

- [ ] **Step 4: Show the balance on the profile page**

In `frontend/src/app/profile/page.tsx`, fetch `/api/campaign/points` and add a card showing the balance plus the soonest-expiring lot. Copy:

- Card title: `แต้มแคมเปญ`
- Balance: `{balance} point`
- Expiry hint: `{n} point จะหมดอายุ {date}`
- Empty state: `ยังไม่มีแต้มแคมเปญ เติมเงินช่วงแคมเปญเพื่อรับแต้ม`
- If balance is negative: `ยอดแต้มติดลบจากการยกเลิกรายการเติมเงิน แต้มที่ได้รับใหม่จะถูกหักคืนก่อน`

That last string matters: a negative balance with no explanation reads as a bug.

- [ ] **Step 5: Verify the build**

Run: `cd frontend && npm run build`

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/CampaignBanner.tsx frontend/src/app/topup/page.tsx frontend/src/app/profile/page.tsx
git commit -m "feat(campaign): player banner, top-up nudge, and point balance card"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Seed a campaign that is live right now**

```bash
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "
INSERT INTO campaigns (name, points_per_baht, min_topup_amount, starts_at, ends_at, points_expire_days)
VALUES ('E2E Test', 0.1, 50, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 1 DAY), 30);"
```

- [ ] **Step 2: Confirm the API reports it active**

Run: `curl -s localhost:4000/api/campaign/active`

Expected: `campaign` is non-null with `pointsPerBaht: 0.1`.

- [ ] **Step 3: Grant via an admin manual top-up and verify the lot**

Use the admin UI to raise a test user's wallet by ฿500, then:

```bash
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "
SELECT id, user_id, points_granted, points_remaining, rate_applied, expires_at
FROM point_lots ORDER BY id DESC LIMIT 1;"
```

Expected: one row, `points_granted = 50`, `rate_applied = 0.1000`, `expires_at` about 31 days out.

- [ ] **Step 4: Verify idempotency**

Re-run `grantForTopup` for the same transaction id via `node -e` against the built service, or repeat the identical slip verification. Confirm `SELECT COUNT(*) FROM point_lots WHERE source_transaction_id = <id>` stays at 1.

- [ ] **Step 5: Verify the money path is not coupled to points**

Temporarily rename the `point_lots` table, then perform a top-up:

```bash
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "RENAME TABLE point_lots TO point_lots_hidden;"
# perform a top-up through the UI
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "RENAME TABLE point_lots_hidden TO point_lots;"
```

Expected: the wallet is still credited and the `transactions` row still written. The error is logged, not raised. **This is the single most important check in the plan** - if the top-up fails here, the try/catch wiring in Task 6 is wrong and must be fixed before shipping.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test`

Expected: all suites pass.

- [ ] **Step 7: Clean up test data and commit nothing**

```bash
docker exec -i $(docker-compose ps -q mysql) mysql -uroot -p"$MYSQL_ROOT_PASSWORD" siamsite -e "
DELETE FROM point_lots WHERE campaign_id IN (SELECT id FROM campaigns WHERE name='E2E Test');
DELETE FROM campaigns WHERE name='E2E Test';"
```

---

## Out of scope for this slice

- Reward Shop catalog, FIFO burn, redemption, `web_inventory` delivery (Slice 2, `033_reward_shop.sql`)
- News system (Slice 3, `034_news.sql`)
- Expiry-warning notifications (Slice 2, once there is somewhere to spend points)
- Incremental-lift analytics dashboard (Slice 2, needs redemption data to be meaningful)

Points accrue and are visible after this slice but cannot be spent. That is deliberate: a rate misconfiguration costs nothing while nothing can be redeemed, so rates can be corrected before any value leaves the system.
