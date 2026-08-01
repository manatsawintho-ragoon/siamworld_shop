'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

/**
 * Is this viewer allowed to claim the trial / first-month offer?
 *
 * Exists because the marketing pages used to hardcode `/order?kind=trial` as
 * their primary call to action for every visitor. A customer who had already
 * used their trial clicked the biggest button on the site and was told they had
 * already used it, which reads as an accusation rather than an offer. The CTA
 * now has to know who is looking at it.
 *
 * A signed-out visitor is treated as eligible on purpose: they can still sign up
 * and claim the trial, and we cannot know anything about them until they do.
 */
export interface PromoEligibility {
  /** False until we know enough to answer. Render the default CTA meanwhile. */
  loaded: boolean;
  loggedIn: boolean;
  trialEligible: boolean;
  introEligible: boolean;
}

const OPTIMISTIC: PromoEligibility = {
  loaded: false,
  loggedIn: false,
  trialEligible: true,
  introEligible: true,
};

export function usePromoEligibility(): PromoEligibility {
  const { user, loading } = useAuth();
  const [state, setState] = useState<PromoEligibility>(OPTIMISTIC);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setState({ loaded: true, loggedIn: false, trialEligible: true, introEligible: true });
      return;
    }

    let cancelled = false;
    api
      .get('/api/subscriptions')
      .then(({ data }) => {
        if (cancelled) return;
        setState({
          loaded: true,
          loggedIn: true,
          // Fall back to the raw used_* flags if an older backend is still
          // serving this frontend mid-deploy, so the CTA never hard-fails.
          trialEligible: data.trialEligible ?? !data.usedTrial,
          introEligible: data.introEligible ?? !data.usedIntro,
        });
      })
      .catch(() => {
        // Can't tell. Leave the trial CTA up rather than hiding a real offer:
        // the order page re-checks server-side, so the worst case is one extra
        // click, not a wrong charge.
        if (!cancelled) {
          setState({ loaded: true, loggedIn: true, trialEligible: true, introEligible: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return state;
}

export type PromoCtaKind = 'trial' | 'intro' | 'regular';

/**
 * Which offer this viewer should actually be pointed at, best first.
 * Returns the order URL plus the `home` message key describing it.
 */
export function resolvePromoCta(e: PromoEligibility): {
  kind: PromoCtaKind;
  href: string;
  labelKey: string;
  shortLabelKey: string;
} {
  if (!e.loaded || !e.loggedIn || e.trialEligible) {
    return {
      kind: 'trial',
      href: '/order?kind=trial',
      labelKey: 'ctaStartTrial',
      shortLabelKey: 'ctaStartTrialShort',
    };
  }
  if (e.introEligible) {
    return {
      kind: 'intro',
      href: '/order?kind=intro',
      labelKey: 'ctaStartIntro',
      shortLabelKey: 'ctaStartIntroShort',
    };
  }
  return {
    kind: 'regular',
    href: '/order',
    labelKey: 'ctaOpenShop',
    shortLabelKey: 'ctaOpenShopShort',
  };
}
