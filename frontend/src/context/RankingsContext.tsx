'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import type { RankEntry, DailyEntry } from '@/lib/serverSeo';

/**
 * The sidebar top-up rankings, seeded from the server.
 *
 * MainLayout used to fetch these itself on mount. That was the last remaining
 * layout shift on the customer site: the TOPUP RANK card only renders once its
 * list is non-empty, so it popped in after hydration and pushed the DAILY TOPUP
 * card below it down by ~140px.
 *
 * The root layout is already a server component doing one settings fetch, so it
 * fetches the rankings alongside and hands them down here. The client refetch is
 * kept for two cases the seed cannot cover: the 60s server cache going stale
 * during a long session, and a seed that came back empty because the backend was
 * briefly unreachable at render time.
 */

interface Ctx {
  ranking: RankEntry[];
  daily: DailyEntry[];
}

const RankingsContext = createContext<Ctx>({ ranking: [], daily: [] });

export function RankingsProvider({
  children,
  initial,
  enabled = true,
}: {
  children: ReactNode;
  initial?: { ranking: RankEntry[]; daily: DailyEntry[] };
  /** False when both widgets are switched off, so we skip the requests entirely. */
  enabled?: boolean;
}) {
  const [ranking, setRanking] = useState<RankEntry[]>(initial?.ranking ?? []);
  const [daily, setDaily] = useState<DailyEntry[]>(initial?.daily ?? []);

  useEffect(() => {
    if (!enabled) return;
    // Deliberately not gated on the seed being empty: an empty seed is
    // indistinguishable from a shop with no top-ups yet, and refetching costs
    // two small cached requests.
    api('/public/topup-ranking')
      .then(d => { if (Array.isArray(d.ranking)) setRanking(d.ranking as RankEntry[]); })
      .catch(() => {});
    api('/public/daily-topup')
      .then(d => { if (Array.isArray(d.daily)) setDaily(d.daily as DailyEntry[]); })
      .catch(() => {});
  }, [enabled]);

  return (
    <RankingsContext.Provider value={{ ranking, daily }}>
      {children}
    </RankingsContext.Provider>
  );
}

export const useRankings = () => useContext(RankingsContext);
