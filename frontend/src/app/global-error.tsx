'use client';

import { useEffect } from 'react';

/**
 * Catches errors thrown by the shop's root layout itself.
 *
 * When this fires the root layout never rendered, so there is no globals.css, no
 * theme tokens, no font and no providers. Everything has to be self-contained:
 * its own <html>/<body> and inline styles.
 *
 * Deliberately neutral rather than themed. The shop's palette lives in CSS
 * variables that are unavailable here, and a half-styled page looks more broken
 * than a plain one.
 *
 * This is the floor beneath app/error.tsx, which handles the far more common
 * case of a page throwing inside an intact layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[shop] root layout error:', error);
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
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '26rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem', fontWeight: 800 }}>
            ระบบขัดข้องชั่วคราว
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1.5rem', lineHeight: 1.8 }}>
            หน้านี้โหลดไม่สำเร็จ ยอดเงินและรายการซื้อของคุณไม่ได้รับผลกระทบ
            <br />
            ลองใหม่อีกครั้ง หรือแจ้งแอดมินของเซิร์ฟเวอร์
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                margin: '0 0 1.75rem',
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
              borderRadius: '0.75rem',
              background: '#f8fafc',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '0.875rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </body>
    </html>
  );
}
