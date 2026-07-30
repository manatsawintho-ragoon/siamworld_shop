/**
 * Instant feedback for admin route changes.
 *
 * Clicking a sidebar link used to freeze the panel for one to five seconds
 * before anything moved. The cause was not a slow server - the origin answers
 * an admin RSC request in 6-14ms. It was that the router had nothing to show
 * and nothing prefetched:
 *
 * Every route in this app is dynamic, because the root layout reads the host
 * header (lib/serverSeo.ts) to build per-tenant metadata. For a dynamic route
 * Next only prefetches down to the nearest loading boundary, and there was no
 * loading.tsx anywhere under /admin. So `<Link>` prefetch returned a 153 byte
 * stub with no page in it, and the click had to pay for the full 49KB payload
 * plus the route's JS chunk, in sequence, over the network. With no Suspense
 * fallback to swap in, the App Router kept the *old* page on screen for the
 * whole trip. Nothing moved, so it read as a freeze rather than a load.
 *
 * This file fixes both halves at once. It gives the router a fallback to
 * render the instant a link is clicked, and because Next prefetches a route's
 * loading state, the skeleton is already in the browser before the click.
 *
 * One boundary here covers every nested admin route via the nearest-ancestor
 * rule. Kept as a server component on purpose: it ships no JS and keeps the
 * prefetched payload small.
 *
 * Shapes match the layout the admin pages actually use - a header row, a stat
 * strip, then a table card - so content swapping in does not shift anything.
 * Neutral greys only: the admin shell does not follow the customer theme.
 */
export default function Loading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-pulse" aria-hidden="true">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-6 w-52 bg-gray-200 rounded-lg" />
          <div className="h-3 w-72 bg-gray-200/70 rounded-full" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-xl" />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-2.5 w-16 bg-gray-200/70 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200" />
          <div className="h-3.5 w-40 bg-gray-200 rounded-full" />
          <div className="h-9 w-56 bg-gray-200/70 rounded-xl ml-auto" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3 bg-gray-200 rounded-full w-1/3" />
                <div className="h-2.5 bg-gray-200/70 rounded-full w-1/4" />
              </div>
              <div className="hidden sm:block h-3 w-24 bg-gray-200/70 rounded-full" />
              <div className="h-8 w-8 rounded-lg bg-gray-200 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Screen readers get a status, not a wall of decorative boxes. */}
      <p role="status" className="sr-only">กำลังโหลด</p>
    </div>
  );
}
