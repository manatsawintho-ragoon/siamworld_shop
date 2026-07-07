'use client';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Enter-only fade. Previously this used <AnimatePresence mode="wait"> with a
// 0.35s exit AND a 0.35s enter, so every navigation blocked for the exit to
// finish before the new route mounted — ~0.7s of dead time per click on top of
// data loading. mode="wait" also delays mounting (and thus the data fetches) of
// the incoming page. A short enter-only fade keyed on pathname keeps the polish
// without the perceived lag.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex-1 w-full"
    >
      {children}
    </motion.div>
  );
}
