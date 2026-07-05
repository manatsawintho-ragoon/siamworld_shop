import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icon';

interface Props {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, actionHref, onAction }: Props) {
  return (
    <div className="card shadow-[var(--shadow-md)] flex flex-col items-center justify-center py-24 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-800">
      <div className="w-20 h-20 rounded-[2rem] bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center border-2 border-gray-100 dark:border-slate-700/50 mb-6 shadow-inner">
        <Icon name={icon} className="text-3xl text-gray-300 dark:text-slate-600" />
      </div>
      <p className="text-sm font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      {description && <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-8 max-w-sm text-center">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn bg-amber-500 text-white border-2 border-amber-600 shadow-[0_3px_0_0_rgba(180,83,9,1)] active:translate-y-[3px] active:shadow-none hover:bg-amber-600 transition-all font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl mt-2">{actionLabel}</Link>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn bg-amber-500 text-white border-2 border-amber-600 shadow-[0_3px_0_0_rgba(180,83,9,1)] active:translate-y-[3px] active:shadow-none hover:bg-amber-600 transition-all font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl mt-2">{actionLabel}</button>
      )}
    </div>
  );
}
