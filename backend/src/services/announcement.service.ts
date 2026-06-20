/**
 * Operator announcements shown as a popup in the shop admin panel.
 *
 * Content lives in the panel; this service fetches the published list from the
 * panel (via the host gateway, same host as every shop), caches it briefly so
 * frequent admin polls don't hammer the panel, and filters out announcements the
 * current admin has already dismissed ("don't show again", stored per-admin in
 * this shop's DB). Best-effort: if the panel is unreachable, callers get the last
 * cache or an empty list — never an error.
 */
import { pool } from '../database/connection';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';

export interface PanelAnnouncement {
  id: number;
  title: string;
  body: string;
  level: 'info' | 'update' | 'important';
  published_at: string | null;
}

const CACHE_TTL_MS = 12_000;   // polls run ~15s; 12s keeps panel load low yet fresh
const FETCH_TIMEOUT_MS = 4_000;

let cache: { at: number; data: PanelAnnouncement[] } = { at: 0, data: [] };

class AnnouncementService {
  /** Published announcements from the panel, cached ~12s. Best-effort. */
  private async fetchActiveFromPanel(): Promise<PanelAnnouncement[]> {
    if (Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

    const url = `${config.panelAnnounceUrl}/api/announcements/active`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`panel responded ${res.status}`);
      const data = await res.json() as { announcements?: PanelAnnouncement[] };
      cache = { at: Date.now(), data: Array.isArray(data.announcements) ? data.announcements : [] };
      return cache.data;
    } catch (err) {
      logger.warn('Announcement fetch failed, serving cache', { error: (err as Error)?.message });
      // Keep serving the last good cache; only bump timestamp to avoid hot-looping
      cache = { at: Date.now(), data: cache.data };
      return cache.data;
    } finally {
      clearTimeout(t);
    }
  }

  /** Active announcements minus the ones this admin dismissed, newest first. */
  async listForAdmin(adminUserId: number): Promise<PanelAnnouncement[]> {
    const active = await this.fetchActiveFromPanel();
    if (active.length === 0) return [];

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT announcement_id FROM announcement_dismissals WHERE admin_user_id = ?',
      [adminUserId]
    );
    const dismissed = new Set(rows.map(r => Number(r.announcement_id)));
    return active.filter(a => !dismissed.has(Number(a.id)));
  }

  /** Record "don't show again" for this admin. */
  async dismiss(announcementId: number, adminUserId: number): Promise<void> {
    await pool.execute(
      'INSERT IGNORE INTO announcement_dismissals (announcement_id, admin_user_id) VALUES (?, ?)',
      [announcementId, adminUserId]
    );
  }
}

export const announcementService = new AnnouncementService();
