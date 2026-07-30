'use client';
import MainLayout from '@/components/MainLayout';

/**
 * The instant-feedback screen for a route change.
 *
 * Every customer page renders its own <MainLayout>, so the site has no Next
 * layout above the page to keep the chrome on screen during a navigation. With
 * no `loading.tsx` either, Next had nothing to render while it waited and the
 * old page simply sat there - a click on the navbar looked like a 1.5s freeze
 * before anything moved.
 *
 * Rendering the chrome plus a skeleton fixes two things at once. The bar and
 * sidebar stay put and the content area shows it is working, so the click feels
 * immediate; and because Next prefetches a route's loading state, the skeleton is
 * usually already in the browser before the click happens.
 *
 * Deliberately the same card shapes the real pages use, so the swap to content
 * does not move anything.
 */
export default function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <MainLayout>
      <div className="animate-pulse" aria-hidden="true">
        <div className="theme-card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border-muted flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-border" />
            <div className="h-3 w-40 bg-border rounded-full" />
            <div className="h-4 w-16 bg-border rounded-full ml-auto" />
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border-muted overflow-hidden">
                <div className="aspect-square bg-border" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-2.5 bg-border rounded-full w-3/4" />
                  <div className="h-5 bg-border rounded-lg w-1/2 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Screen readers get a status rather than a wall of decorative boxes. */}
      <p role="status" className="sr-only">กำลังโหลด</p>
    </MainLayout>
  );
}
