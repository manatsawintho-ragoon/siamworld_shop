'use client';

import { useEffect } from 'react';

/**
 * Catches errors thrown by a root layout itself.
 *
 * When this fires, the root layout never rendered, so there is no globals.css,
 * no theme, no NextIntlClientProvider and no font. Everything here has to be
 * self-contained: its own <html>/<body>, inline styles, and copy in both
 * languages since we cannot know which locale the reader wanted.
 *
 * This is the floor beneath [locale]/error.tsx and (operator)/error.tsx, which
 * handle the far more common case of a page throwing inside an intact layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[panel] root layout error:', error);
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem', fontWeight: 600 }}>
            ระบบขัดข้องชั่วคราว
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: '0 0 1.5rem', lineHeight: 1.7 }}>
            หน้านี้โหลดไม่สำเร็จ ทีมงานได้รับแจ้งแล้ว ลองใหม่อีกครั้งได้เลย
            <br />
            Something went wrong. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#71717a',
                margin: '0 0 2rem',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              background: '#fafafa',
              color: '#09090b',
              fontWeight: 700,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ลองใหม่อีกครั้ง / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
