import { pool } from '../database/connection';
import {
  NotFoundError,
  InsufficientBalanceError,
  RconError,
  PlayerOfflineError,
} from '../utils/errors';
import { RconManager } from './rcon-manager';
import { PlayerTracker } from './player-tracker';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

class LootBoxService {
  // ─── Public / Shop ──────────────────────────────────────

  async getLootBoxes() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT lb.*,
             COUNT(wi.id) AS total_opens,
             (SELECT COUNT(*) FROM web_inventory wi2
              WHERE wi2.loot_box_id = lb.id
                AND (lb.sale_start IS NULL OR wi2.won_at >= lb.sale_start)) AS sold_count,
             lbc.name AS category_name, lbc.color AS category_color
      FROM loot_boxes lb
      LEFT JOIN web_inventory wi ON wi.loot_box_id = lb.id
      LEFT JOIN loot_box_categories lbc ON lbc.id = lb.category_id
      WHERE lb.active = 1
        AND (lb.sale_end IS NULL OR lb.sale_end > DATE_SUB(NOW(), INTERVAL 5 MINUTE))
      GROUP BY lb.id
      ORDER BY lb.sort_order ASC, lb.id DESC
    `);
    return rows;
  }

  async getLootBox(id: number) {
    const [boxes] = await pool.execute<RowDataPacket[]>(
      `SELECT lb.*,
         (SELECT COUNT(*) FROM web_inventory wi
          WHERE wi.loot_box_id = lb.id
            AND (lb.sale_start IS NULL OR wi.won_at >= lb.sale_start)) AS sold_count
       FROM loot_boxes lb WHERE lb.id = ? AND lb.active = 1
         AND (lb.sale_end IS NULL OR lb.sale_end > DATE_SUB(NOW(), INTERVAL 5 MINUTE))`,
      [id]
    );
    if (boxes.length === 0) throw new NotFoundError('Loot box not found');

    const [items] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, description, image, weight, rarity, color FROM loot_box_items WHERE loot_box_id = ? ORDER BY weight DESC',
      [id]
    );
    return { ...boxes[0], items };
  }

  /**
   * Weighted random selection — all RNG happens server-side.
   * Frontend never touches odds.
   */
  private pickItem(items: RowDataPacket[]): RowDataPacket {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight as number), 0);
    let random = Math.random() * totalWeight;
    for (const item of items) {
      random -= item.weight as number;
      if (random <= 0) return item;
    }
    return items[items.length - 1]; // fallback (should not reach)
  }

  /**
   * Open a loot box:
   * 1. Verify box + items exist
   * 2. DB transaction with row-level lock: check balance, deduct, save won item as PENDING
   * 3. Return won item to frontend for animation only
   */
  async openBox(
    userId: number,
    boxId: number,
    idempotencyKey?: string
  ) {
    const idemKey = idempotencyKey || uuidv4();

    // Verify box exists and is active
    const [boxRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_boxes WHERE id = ? AND active = 1',
      [boxId]
    );
    if (boxRows.length === 0) throw new NotFoundError('Loot box not found');
    const box = boxRows[0];

    // Check if sale period has ended
    if (box.sale_end && new Date(box.sale_end) < new Date()) {
      throw new Error('การขายสิ้นสุดแล้ว');
    }

    // Check if sale is paused
    if (box.is_paused) {
      throw new Error('กล่องสุ่มนี้หยุดจำหน่ายชั่วคราว');
    }

    // Check stock limit (count only opens since current sale_start)
    if (box.stock_limit != null) {
      const [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS sold FROM web_inventory WHERE loot_box_id = ? AND (? IS NULL OR won_at >= ?)',
        [boxId, box.sale_start ?? null, box.sale_start ?? null]
      );
      const sold = Number((countRows[0] as any).sold);
      if (sold >= Number(box.stock_limit)) {
        throw new Error('กล่องสุ่มนี้หมดแล้ว');
      }
    }

    // Get items (include command for storing in inventory)
    const [itemRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_items WHERE loot_box_id = ?',
      [boxId]
    );
    if (itemRows.length === 0) throw new NotFoundError('This loot box has no items configured');

    const conn = await pool.getConnection();
    let inventoryId: number;
    let wonItem: RowDataPacket;

    try {
      await conn.beginTransaction();

      // Row-level lock on wallet to prevent race conditions
      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');

      const balance = parseFloat(walletRows[0].balance as string);
      const price = parseFloat(box.price as string);
      if (balance < price) {
        throw new InsufficientBalanceError('ยอดเงินไม่เพียงพอ');
      }

      // Server-side RNG — frontend receives result only after this completes
      wonItem = this.pickItem(itemRows);

      // Deduct balance
      await conn.execute(
        'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
        [price, userId]
      );

      // Record transaction
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, description) VALUES (?,?,?,?,?,?)',
        [userId, -price, 'purchase', 'wallet', 'success', `เปิดกล่อง ${box.name}`]
      );

      // Save won item to web_inventory (PENDING — awaiting in-game delivery)
      const [invResult] = await conn.execute(
        `INSERT INTO web_inventory
           (user_id, loot_box_id, loot_box_item_id, item_name, item_image, item_command, item_rarity, status)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          userId,
          boxId,
          wonItem.id,
          wonItem.name,
          wonItem.image ?? null,
          wonItem.command,
          wonItem.rarity,
          'PENDING',
        ]
      );
      inventoryId = (invResult as any).insertId;

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    logger.info('Loot box opened', {
      userId,
      boxId,
      wonItem: wonItem.name,
      inventoryId,
    });

    return {
      inventoryId,
      wonItem: {
        id: wonItem.id as number,
        name: wonItem.name as string,
        image: wonItem.image as string | null,
        rarity: wonItem.rarity as string,
        color: wonItem.color as string | null,
        description: wonItem.description as string | null,
      },
    };
  }

  // ─── User Inventory ──────────────────────────────────────

  async getUserInventory(userId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT wi.*, COALESCE(lb.name, '(ลบแล้ว)') as box_name
       FROM web_inventory wi
       LEFT JOIN loot_boxes lb ON wi.loot_box_id = lb.id
       WHERE wi.user_id = ?
       ORDER BY wi.won_at DESC`,
      [userId]
    );
    return rows;
  }

  /**
   * Redeem a PENDING inventory item:
   * - Send RCON command
   * - Only mark REDEEMED if RCON succeeds
   * - If RCON fails/times out → stay PENDING so player can retry later
   */
  async redeemItem(
    inventoryId: number,
    userId: number,
    username: string,
    serverId: number,
    rconManager: RconManager,
    playerTracker: PlayerTracker
  ) {
    // Check player is online before sending RCON
    const online = await playerTracker.isPlayerOnline(serverId, username);
    if (!online) throw new PlayerOfflineError('คุณต้องออนไลน์อยู่ในเกมก่อนรับของ');

    // Verify item belongs to user and is PENDING
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM web_inventory WHERE id = ? AND user_id = ? AND status = ?',
      [inventoryId, userId, 'PENDING']
    );
    if (rows.length === 0) {
      throw new NotFoundError('ไม่พบไอเท็มหรือไอเท็มถูกรับเข้าเกมไปแล้ว');
    }
    const item = rows[0];

    try {
      await rconManager.executeProductCommands(
        serverId,
        item.item_command as string,
        username
      );

      await pool.execute(
        'UPDATE web_inventory SET status = ?, redeemed_at = NOW() WHERE id = ?',
        ['REDEEMED', inventoryId]
      );

      logger.info('Inventory item redeemed via RCON', { inventoryId, userId, username, serverId });
      return { status: 'REDEEMED', itemName: item.item_name as string };
    } catch (err) {
      logger.error('RCON failed during inventory redeem', {
        inventoryId,
        error: (err as Error).message,
      });
      throw new RconError('ส่งของเข้าเกมล้มเหลว กรุณาออนไลน์อยู่ในเกมแล้วลองใหม่อีกครั้ง');
    }
  }

  /**
   * Redeem all PENDING items for a user on a given server.
   * Stops on first player-offline error, continues past per-item RCON errors.
   */
  async redeemAllItems(
    userId: number,
    username: string,
    serverId: number,
    rconManager: RconManager,
    playerTracker: PlayerTracker
  ) {
    const online = await playerTracker.isPlayerOnline(serverId, username);
    if (!online) throw new PlayerOfflineError('คุณต้องออนไลน์อยู่ในเกมก่อนรับของ');

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM web_inventory WHERE user_id = ? AND status = ? ORDER BY id ASC',
      [userId, 'PENDING']
    );

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const item of rows) {
      try {
        await rconManager.executeProductCommands(serverId, item.item_command as string, username);
        await pool.execute(
          'UPDATE web_inventory SET status = ?, redeemed_at = NOW() WHERE id = ?',
          ['REDEEMED', item.id]
        );
        successCount++;
        logger.info('Bulk redeem item', { inventoryId: item.id, userId });
      } catch (err) {
        failCount++;
        errors.push(item.item_name as string);
        logger.error('Bulk redeem RCON failed', { inventoryId: item.id, error: (err as Error).message });
      }
    }

    return { successCount, failCount, total: rows.length, errors };
  }

  // ─── Admin CRUD ──────────────────────────────────────────

  async getAllLootBoxes() {
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT lb.*,
        (SELECT COUNT(*) FROM web_inventory wi
         WHERE wi.loot_box_id = lb.id
           AND (lb.sale_start IS NULL OR wi.won_at >= lb.sale_start)) AS sold_count
      FROM loot_boxes lb
      ORDER BY lb.sort_order ASC, lb.id DESC
    `);
    for (const box of rows) {
      const [items] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM loot_box_items WHERE loot_box_id = ? ORDER BY weight DESC',
        [box.id]
      );
      box.items = items;
    }
    return rows;
  }

  async createLootBox(data: {
    name: string;
    description?: string;
    image?: string;
    price: number;
    original_price?: number | null;
    sort_order?: number;
    category_id?: number | null;
    stock_limit?: number | null;
    sale_start?: string | null;
    sale_end?: string | null;
  }) {
    const [result] = await pool.execute(
      'INSERT INTO loot_boxes (name, description, image, price, original_price, sort_order, category_id, stock_limit, sale_start, sale_end) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        data.name, data.description ?? null, data.image ?? null, data.price,
        data.original_price ?? null, data.sort_order ?? 0, data.category_id ?? null,
        data.stock_limit ?? null, data.sale_start ?? null, data.sale_end ?? null,
      ]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_boxes WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  private toMysqlDatetime(v: any): string | null {
    if (!v) return null;
    return new Date(v).toISOString().slice(0, 19).replace('T', ' ');
  }

  async updateLootBox(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of ['name', 'description', 'image', 'price', 'original_price', 'sort_order', 'stock_limit']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (data.active !== undefined) {
      fields.push('active = ?');
      values.push(data.active ? 1 : 0);
    }
    if ('category_id' in data) {
      fields.push('category_id = ?');
      values.push(data.category_id ?? null);
    }
    if ('sale_start' in data) {
      fields.push('sale_start = ?');
      values.push(this.toMysqlDatetime(data.sale_start));
    }
    if ('sale_end' in data) {
      fields.push('sale_end = ?');
      values.push(this.toMysqlDatetime(data.sale_end));
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE loot_boxes SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_boxes WHERE id = ?',
      [id]
    );
    if (rows.length === 0) throw new NotFoundError('Loot box not found');
    return rows[0];
  }

  async releaseLootBox(id: number, durationMinutes: number | null, stockLimit?: number | null) {
    if (durationMinutes && durationMinutes > 0) {
      await pool.execute(
        'UPDATE loot_boxes SET sale_start = NOW(), sale_end = DATE_ADD(NOW(), INTERVAL ? MINUTE), stock_limit = ?, active = 1 WHERE id = ?',
        [durationMinutes, stockLimit ?? null, id]
      );
    } else {
      // No time limit — clear sale_end so box stays active indefinitely
      await pool.execute(
        'UPDATE loot_boxes SET sale_start = NOW(), sale_end = NULL, stock_limit = ?, active = 1 WHERE id = ?',
        [stockLimit ?? null, id]
      );
    }
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM loot_boxes WHERE id = ?', [id]);
    if (rows.length === 0) throw new NotFoundError('Loot box not found');
    return rows[0];
  }

  async stopLootBox(id: number) {
    await pool.execute(
      'UPDATE loot_boxes SET sale_end = NOW() WHERE id = ?',
      [id]
    );
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM loot_boxes WHERE id = ?', [id]);
    if (rows.length === 0) throw new NotFoundError('Loot box not found');
    return rows[0];
  }

  async pauseLootBox(id: number) {
    // Save remaining seconds (if timed sale), then clear sale_end so auto-deactivate ignores it
    await pool.execute(`
      UPDATE loot_boxes SET
        is_paused = 1,
        sale_remaining_seconds = CASE
          WHEN sale_end IS NOT NULL AND sale_end > NOW()
          THEN TIMESTAMPDIFF(SECOND, NOW(), sale_end)
          ELSE NULL
        END,
        sale_end = NULL
      WHERE id = ?
    `, [id]);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM loot_boxes WHERE id = ?', [id]);
    if (rows.length === 0) throw new NotFoundError('Loot box not found');
    return rows[0];
  }

  async resumeLootBox(id: number) {
    // Restore sale_end from remaining seconds (if any), clear pause state
    await pool.execute(`
      UPDATE loot_boxes SET
        is_paused = 0,
        sale_end = CASE
          WHEN sale_remaining_seconds IS NOT NULL AND sale_remaining_seconds > 0
          THEN DATE_ADD(NOW(), INTERVAL sale_remaining_seconds SECOND)
          ELSE NULL
        END,
        sale_remaining_seconds = NULL
      WHERE id = ?
    `, [id]);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM loot_boxes WHERE id = ?', [id]);
    if (rows.length === 0) throw new NotFoundError('Loot box not found');
    return rows[0];
  }

  // ─── Categories ──────────────────────────────────────────

  async getAllCategories() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_categories ORDER BY sort_order ASC, id ASC'
    );
    return rows;
  }

  async createCategory(data: { name: string; color: string; sort_order?: number }) {
    const [result] = await pool.execute(
      'INSERT INTO loot_box_categories (name, color, sort_order) VALUES (?,?,?)',
      [data.name, data.color, data.sort_order ?? 0]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_categories WHERE id = ?', [id]
    );
    return rows[0];
  }

  async updateCategory(id: number, data: { name?: string; color?: string; sort_order?: number }) {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name  !== undefined) { fields.push('name = ?');       values.push(data.name); }
    if (data.color !== undefined) { fields.push('color = ?');      values.push(data.color); }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }
    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE loot_box_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_categories WHERE id = ?', [id]
    );
    if (rows.length === 0) throw new NotFoundError('Category not found');
    return rows[0];
  }

  async deleteCategory(id: number) {
    // Unlink boxes before deleting category
    await pool.execute('UPDATE loot_boxes SET category_id = NULL WHERE category_id = ?', [id]);
    await pool.execute('DELETE FROM loot_box_categories WHERE id = ?', [id]);
  }

  async reorderCategories(order: { id: number; sort_order: number }[]) {
    for (const item of order) {
      await pool.execute('UPDATE loot_box_categories SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
  }

  async deleteLootBox(id: number) {
    // We no longer manually delete web_inventory records here.
    // Migration 017 changed the foreign key to ON DELETE SET NULL.
    await pool.execute('DELETE FROM loot_boxes WHERE id = ?', [id]);
  }

  async createLootBoxItem(
    boxId: number,
    data: {
      name: string;
      description?: string;
      image?: string;
      command: string;
      weight: number;
      rarity?: string;
      color?: string;
    }
  ) {
    const [boxes] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM loot_boxes WHERE id = ?',
      [boxId]
    );
    if (boxes.length === 0) throw new NotFoundError('Loot box not found');

    const [result] = await pool.execute(
      'INSERT INTO loot_box_items (loot_box_id, name, description, image, command, weight, rarity, color) VALUES (?,?,?,?,?,?,?,?)',
      [
        boxId,
        data.name,
        data.description ?? null,
        data.image ?? null,
        data.command,
        data.weight,
        data.rarity ?? 'common',
        data.color ?? null,
      ]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_items WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  async updateLootBoxItem(itemId: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of ['name', 'description', 'image', 'command', 'weight', 'rarity', 'color']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (fields.length > 0) {
      values.push(itemId);
      await pool.execute(
        `UPDATE loot_box_items SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM loot_box_items WHERE id = ?',
      [itemId]
    );
    if (rows.length === 0) throw new NotFoundError('Item not found');
    return rows[0];
  }

  async deleteLootBoxItem(itemId: number) {
    // We no longer manually delete web_inventory records here.
    // Migration 017 changed the foreign key to ON DELETE SET NULL.
    await pool.execute('DELETE FROM loot_box_items WHERE id = ?', [itemId]);
  }

  async reorderLootBoxes(order: { id: number; sort_order: number }[]) {
    for (const item of order) {
      await pool.execute('UPDATE loot_boxes SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
  }
}

export const lootBoxService = new LootBoxService();
