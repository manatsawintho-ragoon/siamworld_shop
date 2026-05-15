'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile widget wrapper.
 *
 * Renders nothing when `siteKey` is empty — call sites can skip CAPTCHA enforcement
 * entirely in that case (e.g. dev mode, or before an admin configures keys).
 *
 * Lifecycle:
 *   - First mount loads the global Turnstile script (idempotent across instances).
 *   - When the script + container are ready, calls window.turnstile.render(...) once.
 *   - On unmount or siteKey change, calls window.turnstile.remove(widgetId).
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        opts: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'error-callback'?: (err?: unknown) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function ensureScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise<void>((resolve) => {
      const check = () => (window.turnstile ? resolve() : setTimeout(check, 50));
      check();
    });
  }
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(s);
  });
}

interface TurnstileWidgetProps {
  siteKey: string;
  /** Receives the captcha token once the user solves the challenge. */
  onToken: (token: string) => void;
  /** Called when the token expires or verification errors. */
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  /** Bumping this value forces the widget to re-render (use after a failed submit). */
  resetKey?: number;
}

export default function TurnstileWidget({ siteKey, onToken, onExpire, theme = 'auto', resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!siteKey) return;

    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        // Remove any prior widget on the same container before rendering a fresh one.
        if (widgetIdRef.current) {
          try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size: 'flexible',
          callback: (token) => onToken(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        });
      })
      .catch(() => {
        // Script blocked (ad-blocker / network) — surface as expire so caller can react.
        onExpire?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, resetKey, onToken, onExpire]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center my-2" />;
}
