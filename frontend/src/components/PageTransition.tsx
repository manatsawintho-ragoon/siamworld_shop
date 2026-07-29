'use client';
import { usePathname } from 'next/navigation';

// Enter-only fade, done in CSS.
//
// This used framer-motion with `initial={{ opacity: 0 }}`, which put
// `opacity: 0` on the entire page body in the server-rendered HTML - nothing
// became visible until the JS bundle had downloaded, hydrated and started the
// animation. Lighthouse measured that as 5.4s of "render delay", 82% of a 6.6s
// LCP, on a page whose LCP image had already finished downloading.
//
// A CSS animation starts as soon as the element is painted, so first paint no
// longer waits for JavaScript. `key={pathname}` remounts the wrapper on
// navigation, which restarts the animation, so route changes still fade in.
//
// (An even earlier version used <AnimatePresence mode="wait"> with a 0.35s exit
// as well, which blocked every navigation for ~0.7s before the incoming page
// mounted. Do not reintroduce either shape.)
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-fade-in flex-1 w-full">
      {children}
    </div>
  );
}
