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

function parsePayload(payload: RawPayload): PlayersData {
  const servers: ServerPlayers[] = Object.entries(payload.servers || {}).map(([id, s]) => ({
    serverId: parseInt(id, 10),
    serverName: s.serverName,
    players: s.players || [],
    count: s.count || 0,
    maxPlayers: 0,
  }));
  return { servers, totalOnline: payload.totalOnline || 0 };
}

export function useOnlinePlayers() {
  const [data, setData] = useState<PlayersData>({ servers: [], totalOnline: 0 });
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // ── Initial HTTP fetch from Redis cache (shows data immediately, no spinner) ──
  useEffect(() => {
    fetch('/api/public/online-players')
      .then(r => r.json())
      .then((d: any) => {
        if (d?.servers) {
          setData(parsePayload(d as RawPayload));
          setConnected(true);
        }
      })
      .catch(() => {});
  }, []);

  // ── WebSocket for live updates every 10s ──
  useEffect(() => {
    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const urlPointsToLocalhost = configuredUrl && (configuredUrl.includes('://localhost') || configuredUrl.includes('://127.0.0.1'));
    const wsUrl =
      (configuredUrl && !(urlPointsToLocalhost && isLocalhost))
        ? configuredUrl
        : (typeof window !== 'undefined'
          ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:4000`
          : 'ws://localhost:4000');

    const socket = io(wsUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:players');
    });

    socket.on('players:update', (payload: RawPayload) => {
      setData(parsePayload(payload));
      setConnected(true);
    });

    return () => { socket.disconnect(); };
  }, []);

  return { ...data, connected };
}
