'use client';
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ServerPlayers {
  serverId: number;
  serverName: string;
  players: string[];
  count: number;
  maxPlayers: number;
}

interface PlayersData {
  servers: ServerPlayers[];
  totalOnline: number;
}

// Shape of the raw payload emitted by the backend
interface RawPayload {
  servers: Record<string, { serverName: string; players: string[]; count: number }>;
  totalOnline: number;
}

export function useOnlinePlayers() {
  const [data, setData] = useState<PlayersData>({ servers: [], totalOnline: 0 });
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const socket = io(wsUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:players');
    });

    socket.on('players:update', (payload: RawPayload) => {
      const servers: ServerPlayers[] = Object.entries(payload.servers || {}).map(([id, s]) => ({
        serverId: parseInt(id, 10),
        serverName: s.serverName,
        players: s.players,
        count: s.count,
        maxPlayers: 0,
      }));
      setData({ servers, totalOnline: payload.totalOnline || 0 });
    });

    return () => { socket.disconnect(); };
  }, []);

  return data;
}
