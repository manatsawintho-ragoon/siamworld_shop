'use client';
import { useOnlinePlayers } from '@/hooks/useOnlinePlayers';

export default function OnlinePlayersWidget() {
  const { servers, totalOnline } = useOnlinePlayers();

  return (
    <div className="card overflow-hidden">
      <div className="card-header-mc flex items-center justify-between">
        <span><i className="fas fa-server mr-2 text-success"></i>Server Status</span>
      </div>
      <div className="p-4 bg-black/20">
        <div className="flex items-center gap-3 mb-4 bg-black/40 p-3 rounded-lg border border-white/5 shadow-inner">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
          </span>
          <div>
            <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-0.5">สถานะเซิร์ฟเวอร์ (Online)</div>
            <h3 className="text-sm font-black text-white">ผู้เล่นปัจจุบัน <span className="text-success ml-1">{totalOnline}</span> คน</h3>
          </div>
        </div>
        
        {servers.length === 0 ? (
          <p className="text-xs text-foreground-subtle text-center py-2"><i className="fas fa-spinner fa-spin mr-2"></i>กำลังโหลดข้อมูล...</p>
        ) : (
          <div className="space-y-3">
            {servers.map((s) => (
              <div key={s.serverId} className="bg-white/5 rounded-lg p-3 border border-white/5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-bold text-white drop-shadow-md">{s.serverName}</span>
                  <span className="text-primary font-black drop-shadow-sm">{s.count} <span className="text-foreground-muted text-[10px]">/ {s.maxPlayers || '?'}</span></span>
                </div>
                <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                    style={{ width: `${Math.min((s.count / (s.maxPlayers || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
