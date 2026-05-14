export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-[var(--shadow-md)] animate-pulse-slow">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-2/3" />
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0 bg-white dark:bg-slate-800 rounded-2xl">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4 border-b-2 border-gray-50 dark:border-slate-700/50 animate-pulse-slow" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
            <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
          </div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-8 w-20 bg-gray-200 dark:bg-slate-700 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="card p-5 flex items-center gap-4 animate-pulse-slow shadow-[var(--shadow-off-lg)]">
      <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
      <div className="space-y-2.5">
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-16" />
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-24" />
      </div>
    </div>
  );
}
