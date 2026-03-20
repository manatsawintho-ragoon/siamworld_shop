'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface RankingUser {
  username: string;
  total_topup: number;
}

export default function RankingWidget() {
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/public/topup-ranking')
      .then(d => {
        setRanking((d.ranking as RankingUser[]) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card overflow-hidden animate-pulse">
        <div className="card-header-mc flex items-center justify-between">
          <span><i className="fas fa-trophy mr-2 text-warning"></i>Top Donate</span>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center font-bold text-[10px] text-foreground-muted">
                {i + 1}
              </div>
              <div className="h-4 w-24 skeleton" />
              <div className="ml-auto h-4 w-12 skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (ranking.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="card-header-mc flex items-center justify-between">
        <span><i className="fas fa-medal mr-2 text-warning"></i>Top Donate ยอดเติมสูงสุด</span>
      </div>

      <div className="p-3 space-y-2">
        {ranking.slice(0, 10).map((user, index) => {
          let rankIcon;
          if (index === 0) rankIcon = <i className="fas fa-crown text-warning text-sm drop-shadow-md"></i>;
          else if (index === 1) rankIcon = <i className="fas fa-medal text-gray-400 text-sm drop-shadow-md"></i>;
          else if (index === 2) rankIcon = <i className="fas fa-medal text-amber-700 text-sm drop-shadow-md"></i>;
          else rankIcon = <span className="text-[10px] font-black text-foreground-muted">{index + 1}</span>;

          return (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors border ${
                index === 0 ? 'bg-warning/10 border-warning/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 
                index === 1 ? 'bg-gray-400/10 border-gray-400/30' :
                index === 2 ? 'bg-amber-700/10 border-amber-700/30' :
                'bg-black/20 border-white/5 hover:bg-white/5'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 bg-black/40 rounded-full border border-white/5">
                {rankIcon}
              </div>
              
              <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center flex-shrink-0 border border-white/10 overflow-hidden shadow-inner">
                <img 
                  src={`https://mc-heads.net/avatar/${user.username}/32`} 
                  alt={user.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://mc-heads.net/avatar/steve/32';
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black truncate tracking-wide ${index === 0 ? 'text-warning drop-shadow-sm' : 'text-foreground'}`}>
                  {user.username}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <i className="fas fa-coins text-[8px] text-warning" aria-hidden="true"></i>
                  <p className="text-[10px] font-bold text-foreground-muted tabular-nums">
                    {user.total_topup.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
