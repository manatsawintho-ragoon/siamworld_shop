'use client';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

export default function OnlinePlayersWidget() {
  const { servers, totalOnline } = useOnlinePlayers();

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500"></span>
        </span>
        <h3 className="text-sm font-semibold dark:text-white">ผู้เล่นออนไลน์ {totalOnline} คน</h3>
      </div>
      {servers.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">กำลังโหลด...</p>
      ) : (
        <div className="space-y-2.5">
          {servers.map((s) => (
            <div key={s.serverId} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium dark:text-gray-200">{s.serverName}</span>
                <span className="text-gray-500 dark:text-gray-400">{s.count}/{s.maxPlayers || '?'}</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-success-400 to-success-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((s.count / (s.maxPlayers || 1)) * 100, 100)}%` }}
                />
              </div>
              {s.players.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.players.slice(0, 15).map((p) => (
                    <span key={p} className="text-xs bg-gray-200 dark:bg-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-md">{p}</span>
                  ))}
                  {s.players.length > 15 && <span className="text-xs text-gray-400">+{s.players.length - 15}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
