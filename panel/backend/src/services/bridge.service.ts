import crypto from 'crypto';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import type { Server } from 'http';
import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ── Protocol types ─────────────────────────────────────────────
type FrameKind = 'req' | 'res' | 'evt';

interface BridgeFrame {
  id: string;
  op: string;
  kind: FrameKind;
  data?: unknown;
  err?: { code: string; message: string } | null;
}

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

interface BridgeConnection {
  subscriptionId: number;
  tokenId: number;
  ws: WebSocket;
  pluginVersion?: string;
  connectedAt: number;
  lastSeen: number;
  pending: Map<string, PendingRequest>;
  inflightCount: number;
}

// Pluggable for tests; defaults are protocol-mandated values.
const DEFAULTS = {
  REQUEST_TIMEOUT_MS: 5000,
  IDLE_TIMEOUT_MS: 90_000,
  HEARTBEAT_INTERVAL_MS: 30_000,
  MAX_INFLIGHT_PER_CONN: 256,
  MAX_FRAME_BYTES: 64 * 1024,
} as const;

class BridgeService {
  private wss: WebSocketServer | null = null;
  // Latest connection per subscription (one customer reconnect supersedes the previous)
  private connections = new Map<number, BridgeConnection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  // ── Token CRUD ────────────────────────────────────────────────
  /** Issue a new token for a subscription. Returns the plaintext (only shown once). */
  async issueToken(subscriptionId: number): Promise<{ token: string; prefix: string }> {
    // Revoke any existing active tokens for this subscription
    await pool.execute(
      'UPDATE bridge_tokens SET revoked_at = NOW() WHERE subscription_id = ? AND revoked_at IS NULL',
      [subscriptionId]
    );
    const plaintext = crypto.randomBytes(32).toString('base64url');
    const prefix = plaintext.slice(0, 8);
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    await pool.execute<ResultSetHeader>(
      'INSERT INTO bridge_tokens (subscription_id, token_hash, token_prefix) VALUES (?,?,?)',
      [subscriptionId, hash, prefix]
    );
    return { token: plaintext, prefix };
  }

  async revokeToken(subscriptionId: number): Promise<void> {
    await pool.execute(
      'UPDATE bridge_tokens SET revoked_at = NOW() WHERE subscription_id = ? AND revoked_at IS NULL',
      [subscriptionId]
    );
    // Force-disconnect any live connection
    const conn = this.connections.get(subscriptionId);
    if (conn) conn.ws.close(4401, 'token revoked');
  }

  async getStatus(subscriptionId: number) {
    const conn = this.connections.get(subscriptionId);
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT token_prefix, plugin_version, last_seen, last_error, created_at
       FROM bridge_tokens WHERE subscription_id = ? AND revoked_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [subscriptionId]
    );
    const t = rows[0];
    return {
      hasToken: !!t,
      tokenPrefix: t?.token_prefix || null,
      online: !!conn,
      pluginVersion: conn?.pluginVersion || t?.plugin_version || null,
      lastSeen: conn ? new Date(conn.lastSeen).toISOString() : t?.last_seen || null,
      lastError: t?.last_error || null,
      issuedAt: t?.created_at || null,
    };
  }

  // ── Outbound: callable by other services to talk to a plugin ──
  /**
   * Send a request to a connected plugin and await its response.
   * Throws if no plugin connected, or on timeout/protocol error.
   */
  async request<T = unknown>(subscriptionId: number, op: string, data: unknown, timeoutMs = DEFAULTS.REQUEST_TIMEOUT_MS): Promise<T> {
    const conn = this.connections.get(subscriptionId);
    if (!conn) throw new BridgeError('not_connected', `No bridge connection for subscription ${subscriptionId}`);
    if (conn.inflightCount >= DEFAULTS.MAX_INFLIGHT_PER_CONN) {
      throw new BridgeError('rate_limited', 'Too many in-flight requests for this connection');
    }

    const id = crypto.randomUUID();
    const frame: BridgeFrame = { id, op, kind: 'req', data };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        conn.pending.delete(id);
        conn.inflightCount = Math.max(0, conn.inflightCount - 1);
        reject(new BridgeError('timeout', `Plugin did not respond to ${op} within ${timeoutMs}ms`));
      }, timeoutMs);

      conn.pending.set(id, {
        resolve: (d) => resolve(d as T),
        reject,
        timer,
      });
      conn.inflightCount++;

      try {
        conn.ws.send(JSON.stringify(frame));
      } catch (e) {
        const p = conn.pending.get(id);
        if (p) { clearTimeout(p.timer); conn.pending.delete(id); conn.inflightCount = Math.max(0, conn.inflightCount - 1); }
        reject(new BridgeError('send_failed', String(e)));
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  attach(httpServer: Server) {
    if (this.wss) throw new Error('BridgeService already attached');
    this.wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
      // Only handle /bridge — leave other paths alone
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/bridge') return;
      this.wss!.handleUpgrade(req, socket, head, (ws) => this.handleConnection(ws, req));
    });

    this.heartbeatTimer = setInterval(() => this.heartbeat(), DEFAULTS.HEARTBEAT_INTERVAL_MS);
    console.log('[Bridge] WebSocket gateway attached at /bridge');
  }

  detach() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    for (const c of this.connections.values()) c.ws.close(1001, 'shutdown');
    this.connections.clear();
    this.wss?.close();
    this.wss = null;
  }

  // ── Internal: handshake + dispatch ────────────────────────────
  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    let conn: BridgeConnection | null = null;
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token') || '';
      const pluginVersion = url.searchParams.get('v') || undefined;
      if (!token) return ws.close(4401, 'unauthorized');

      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT bt.id AS token_id, bt.subscription_id, s.status
         FROM bridge_tokens bt
         JOIN subscriptions s ON s.id = bt.subscription_id
         WHERE bt.token_hash = ? AND bt.revoked_at IS NULL
         LIMIT 1`,
        [hash]
      );
      const t = rows[0];
      if (!t) return ws.close(4401, 'unauthorized');
      if (['cancelled', 'expired'].includes(t.status)) return ws.close(4403, 'inactive');

      // Replace any prior connection for this subscription
      const existing = this.connections.get(t.subscription_id);
      if (existing) existing.ws.close(1000, 'replaced by newer connection');

      conn = {
        subscriptionId: t.subscription_id,
        tokenId: t.token_id,
        ws,
        pluginVersion,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
        pending: new Map(),
        inflightCount: 0,
      };
      this.connections.set(t.subscription_id, conn);

      // Update last_seen + plugin_version on the token row
      await pool.execute(
        'UPDATE bridge_tokens SET last_seen = NOW(), plugin_version = ? WHERE id = ?',
        [pluginVersion || null, t.token_id]
      );

      ws.on('message', (raw) => this.handleMessage(conn!, raw));
      ws.on('close', () => this.handleClose(conn!));
      ws.on('error', (err) => console.error(`[Bridge] socket error sub=${conn!.subscriptionId}:`, err.message));
      ws.on('pong', () => { conn!.lastSeen = Date.now(); });

      // Hello evt — plugin will respond with hello_ack
      this.sendFrame(ws, { id: crypto.randomUUID(), op: 'hello', kind: 'evt',
        data: { serverTime: Date.now(), subscriptionId: conn.subscriptionId } });

      console.log(`[Bridge] connected sub=${conn.subscriptionId} v=${pluginVersion || '?'}`);
    } catch (e) {
      console.error('[Bridge] handshake error:', e);
      try { ws.close(1011, 'handshake error'); } catch { /* noop */ }
      if (conn) this.connections.delete(conn.subscriptionId);
    }
  }

  private handleMessage(conn: BridgeConnection, raw: RawData) {
    conn.lastSeen = Date.now();
    let frame: BridgeFrame;
    try {
      const text = raw.toString('utf8');
      if (text.length > DEFAULTS.MAX_FRAME_BYTES) throw new Error('frame too large');
      frame = JSON.parse(text);
    } catch {
      return; // Ignore malformed frames
    }

    if (frame.kind === 'res') {
      const pending = conn.pending.get(frame.id);
      if (!pending) return; // Late or duplicate response — drop
      clearTimeout(pending.timer);
      conn.pending.delete(frame.id);
      conn.inflightCount = Math.max(0, conn.inflightCount - 1);
      if (frame.err) pending.reject(new BridgeError(frame.err.code, frame.err.message));
      else pending.resolve(frame.data);
      return;
    }

    if (frame.kind === 'evt' && frame.op === 'hello_ack') {
      const data = frame.data as { pluginVersion?: string } | undefined;
      if (data?.pluginVersion) {
        conn.pluginVersion = data.pluginVersion;
        pool.execute('UPDATE bridge_tokens SET plugin_version = ? WHERE id = ?',
          [data.pluginVersion, conn.tokenId]).catch(() => {});
      }
      return;
    }

    if (frame.kind === 'evt' && frame.op === 'pong') return;

    // Unknown frame from plugin — log but don't disconnect
    console.warn(`[Bridge] unexpected frame sub=${conn.subscriptionId}:`, frame.op, frame.kind);
  }

  private handleClose(conn: BridgeConnection) {
    // Reject all pending requests
    for (const [, p] of conn.pending) {
      clearTimeout(p.timer);
      p.reject(new BridgeError('disconnected', 'Plugin disconnected'));
    }
    conn.pending.clear();
    if (this.connections.get(conn.subscriptionId) === conn) {
      this.connections.delete(conn.subscriptionId);
    }
    console.log(`[Bridge] disconnected sub=${conn.subscriptionId}`);
  }

  private heartbeat() {
    const cutoff = Date.now() - DEFAULTS.IDLE_TIMEOUT_MS;
    for (const conn of this.connections.values()) {
      if (conn.lastSeen < cutoff) {
        conn.ws.close(4408, 'idle');
        continue;
      }
      try {
        conn.ws.ping();
        this.sendFrame(conn.ws, { id: crypto.randomUUID(), op: 'ping', kind: 'evt' });
      } catch { /* will be cleaned up by close handler */ }
    }
  }

  private sendFrame(ws: WebSocket, frame: BridgeFrame) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(frame));
  }
}

export class BridgeError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export const bridgeService = new BridgeService();
