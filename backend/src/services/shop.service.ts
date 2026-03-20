import { pool } from '../database/connection';
import { NotFoundError, PlayerOfflineError, InsufficientBalanceError, RconError, ConflictError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RconManager } from './rcon-manager';
import { PlayerTracker } from './player-tracker';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';

class ShopService {
  /**
   * Purchase flow:
   * 1. Check idempotency key
   * 2. Check player is online (from Redis)
   * 3. DB transaction: lock wallet, deduct, create purchase record
   * 4. Double-check player still online (race condition prevention)
   * 5. Execute RCON commands
   * 6. If RCON fails → refund wallet
   */
  async buyProduct(
    userId: number,
    username: string,
    productId: number,
    serverId: number,
    playerTracker: PlayerTracker,
    rconManager: RconManager,
    idempotencyKey?: string
  ) {
    // 1. Idempotency check
    const idemKey = idempotencyKey || uuidv4();
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id, status FROM purchases WHERE idempotency_key = ?', [idemKey]
    );
    if (existing.length > 0) throw new ConflictError('Duplicate purchase request');

    // 2. Check player is online on target server
    const online = await playerTracker.isPlayerOnline(serverId, username);
    if (!online) throw new PlayerOfflineError('คุณต้องออนไลน์อยู่ในเกมก่อนซื้อสินค้า');

    // 3. Get product
    const [productRows] = await pool.execute<RowDataPacket[]>(
      'SELECT p.*, ps.server_id FROM products p JOIN product_servers ps ON p.id = ps.product_id WHERE p.id = ? AND p.active = 1 AND ps.server_id = ?',
      [productId, serverId]
    );
    if (productRows.length === 0) throw new NotFoundError('Product not found or not available on this server');
    const product = productRows[0];

    // 4. DB Transaction: deduct wallet + create purchase
    const conn = await pool.getConnection();
    let purchaseId: number;
    try {
      await conn.beginTransaction();

      // Lock wallet row
      const [walletRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [userId]
      );
      if (walletRows.length === 0) throw new NotFoundError('Wallet not found');
      if (parseFloat(walletRows[0].balance) < parseFloat(product.price)) {
        throw new InsufficientBalanceError('ยอดเงินไม่เพียงพอ');
      }

      // Deduct balance
      await conn.execute('UPDATE wallets SET balance = balance - ? WHERE user_id = ?', [product.price, userId]);

      // Create purchase record
      const [purchaseResult] = await conn.execute(
        'INSERT INTO purchases (user_id, product_id, server_id, price, status, idempotency_key) VALUES (?,?,?,?,?,?)',
        [userId, productId, serverId, product.price, 'pending', idemKey]
      );
      purchaseId = (purchaseResult as any).insertId;

      // Record transaction
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, reference, description) VALUES (?,?,?,?,?,?,?)',
        [userId, -product.price, 'purchase', 'wallet', 'success', `purchase:${purchaseId}`, `ซื้อ ${product.name}`]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // 5. Double-check player is still online (race condition: player might have logged out)
    const stillOnline = await playerTracker.isPlayerOnline(serverId, username);
    if (!stillOnline) {
      await this.refundPurchase(purchaseId, userId, product.price, product.name, 'Player went offline during purchase');
      throw new PlayerOfflineError('ผู้เล่นออกจากเกมระหว่างทำรายการ - ได้คืนเงินแล้ว');
    }

    // 6. Execute RCON commands
    try {
      const results = await rconManager.executeProductCommands(serverId, product.command, username);
      await pool.execute(
        'UPDATE purchases SET status = ?, rcon_response = ? WHERE id = ?',
        ['delivered', JSON.stringify(results), purchaseId]
      );
      logger.info('Purchase delivered', { purchaseId, userId, productId, serverId });
      return { purchaseId, status: 'delivered', rconResponse: results };
    } catch (err) {
      logger.error('RCON delivery failed', { purchaseId, error: (err as Error).message });
      await this.refundPurchase(purchaseId, userId, product.price, product.name, 'RCON delivery failed');
      throw new RconError('การส่งไอเท็มล้มเหลว - ได้คืนเงินแล้ว');
    }
  }

  private async refundPurchase(purchaseId: number, userId: number, amount: number, productName: string, reason: string) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE purchases SET status = ? WHERE id = ?', ['refunded', purchaseId]);
      await conn.execute('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
      await conn.execute(
        'INSERT INTO transactions (user_id, amount, type, method, status, description) VALUES (?,?,?,?,?,?)',
        [userId, amount, 'refund', 'system', 'success', `คืนเงิน ${productName}: ${reason}`]
      );
      await conn.commit();
      logger.info('Purchase refunded', { purchaseId, userId, amount, reason });
    } catch (err) {
      await conn.rollback();
      logger.error('CRITICAL: Refund failed!', { purchaseId, userId, amount, error: (err as Error).message });
    } finally {
      conn.release();
    }
  }

  /** Retry delivery for failed/pending purchases (admin) */
  async retryDelivery(purchaseId: number, rconManager: RconManager, playerTracker: PlayerTracker) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, pr.command, pr.name as product_name, u.username
       FROM purchases p JOIN products pr ON p.product_id = pr.id JOIN users u ON p.user_id = u.id
       WHERE p.id = ? AND p.status IN ('failed','pending')`, [purchaseId]
    );
    if (rows.length === 0) throw new NotFoundError('Purchase not found or not retriable');

    const purchase = rows[0];
    const online = await playerTracker.isPlayerOnline(purchase.server_id, purchase.username);
    if (!online) throw new PlayerOfflineError('Player must be online for retry delivery');

    try {
      const results = await rconManager.executeProductCommands(purchase.server_id, purchase.command, purchase.username);
      await pool.execute(
        'UPDATE purchases SET status = ?, rcon_response = ? WHERE id = ?',
        ['delivered', JSON.stringify(results), purchaseId]
      );
      return { status: 'delivered', rconResponse: results };
    } catch (err) {
      await pool.execute(
        'UPDATE purchases SET status = ?, rcon_response = ? WHERE id = ?',
        ['failed', (err as Error).message, purchaseId]
      );
      throw new RconError('Retry delivery failed');
    }
  }

  // ── Product queries ──

  async getProducts(serverId?: number) {
    let query = `SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
                 FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1`;
    const params: (string | number)[] = [];

    if (serverId) {
      query += ' AND p.id IN (SELECT product_id FROM product_servers WHERE server_id = ?)';
      params.push(serverId);
    }
    query += ' ORDER BY p.sort_order ASC, p.created_at DESC';

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);

    // Attach server info to each product
    for (const product of rows) {
      const [servers] = await pool.execute<RowDataPacket[]>(
        'SELECT s.id, s.name FROM servers s JOIN product_servers ps ON s.id = ps.server_id WHERE ps.product_id = ?',
        [product.id]
      );
      product.servers = servers;
    }
    return rows;
  }

  async getProduct(productId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [productId]
    );
    if (rows.length === 0) throw new NotFoundError('Product not found');
    const [servers] = await pool.execute<RowDataPacket[]>(
      'SELECT s.id, s.name FROM servers s JOIN product_servers ps ON s.id = ps.server_id WHERE ps.product_id = ?',
      [productId]
    );
    rows[0].servers = servers;
    return rows[0];
  }

  async getFeaturedProducts() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.active = 1 AND p.featured = 1 ORDER BY p.sort_order ASC LIMIT 8`
    );
    return rows;
  }

  async getCategories() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM categories ORDER BY sort_order ASC'
    );
    return rows;
  }

  // ── Admin product CRUD ──

  async getAllProducts() {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1 ORDER BY p.id DESC`
    );
    for (const p of rows) {
      const [servers] = await pool.execute<RowDataPacket[]>(
        'SELECT s.id, s.name FROM servers s JOIN product_servers ps ON s.id = ps.server_id WHERE ps.product_id = ?', [p.id]
      );
      p.servers = servers;
    }
    return rows;
  }

  async createProduct(data: {
    name: string; description?: string; price: number; original_price?: number;
    image?: string; command: string; category_id?: number; featured?: boolean;
    server_ids?: number[];
  }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.execute(
        'INSERT INTO products (name, description, price, original_price, image, command, category_id, featured) VALUES (?,?,?,?,?,?,?,?)',
        [data.name, data.description || null, data.price, data.original_price || null, data.image || null, data.command, data.category_id || null, data.featured ? 1 : 0]
      );
      const productId = (result as any).insertId;

      if (data.server_ids && data.server_ids.length > 0) {
        for (const sid of data.server_ids) {
          await conn.execute('INSERT INTO product_servers (product_id, server_id) VALUES (?,?)', [productId, sid]);
        }
      }
      await conn.commit();
      return this.getProduct(productId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateProduct(id: number, data: Record<string, any>) {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    for (const key of ['name', 'description', 'price', 'original_price', 'image', 'command', 'category_id', 'sort_order']) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
    }
    if (data.featured !== undefined) { fields.push('featured = ?'); values.push(data.featured ? 1 : 0); }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0); }

    if (fields.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Update server assignments
    if (data.server_ids !== undefined) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM product_servers WHERE product_id = ?', [id]);
        for (const sid of data.server_ids) {
          await conn.execute('INSERT INTO product_servers (product_id, server_id) VALUES (?,?)', [id, sid]);
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    return this.getProduct(id);
  }

  async deleteProduct(id: number) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM product_servers WHERE product_id = ?', [id]);
      await conn.execute('DELETE FROM products WHERE id = ?', [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getPurchases(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, u.username, pr.name as product_name, s.name as server_name
       FROM purchases p JOIN users u ON p.user_id = u.id JOIN products pr ON p.product_id = pr.id
       JOIN servers s ON p.server_id = s.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [String(limit), String(offset)]
    );
    const [countResult] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as total FROM purchases');
    return { purchases: rows, pagination: { page, totalPages: Math.ceil(countResult[0].total / limit), total: countResult[0].total } };
  }

  /** Admin refund a purchase */
  async adminRefund(purchaseId: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, pr.name as product_name FROM purchases p JOIN products pr ON p.product_id = pr.id WHERE p.id = ? AND p.status IN ('delivered','failed','pending')`,
      [purchaseId]
    );
    if (rows.length === 0) throw new NotFoundError('Purchase not found or already refunded');
    const purchase = rows[0];
    await this.refundPurchase(purchaseId, purchase.user_id, purchase.price, purchase.product_name, 'Admin refund');
    return { message: 'Refund successful' };
  }
}

export const shopService = new ShopService();
