import { pool } from '../database/connection';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  updated_at: string;
  user_email?: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_email?: string;
}

class TicketService {
  async getCustomerTickets(userId: number): Promise<Ticket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT t.* FROM tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC',
      [userId]
    );
    return rows as Ticket[];
  }

  async getAllTickets(): Promise<Ticket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT t.*, u.email as user_email 
       FROM tickets t 
       LEFT JOIN panel_users u ON t.user_id = u.id 
       ORDER BY t.updated_at DESC`
    );
    return rows as Ticket[];
  }

  async getTicketById(ticketId: number, userId?: number, isAdmin = false): Promise<Ticket | null> {
    const query = isAdmin 
      ? `SELECT t.*, u.email as user_email FROM tickets t LEFT JOIN panel_users u ON t.user_id = u.id WHERE t.id = ?`
      : `SELECT * FROM tickets WHERE id = ? AND user_id = ?`;
    const params = isAdmin ? [ticketId] : [ticketId, userId || 0];
    
    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    if (!rows.length) return null;
    return rows[0] as Ticket;
  }

  async createTicket(userId: number, subject: string, initialMessage: string): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO tickets (user_id, subject) VALUES (?, ?)',
        [userId, subject]
      );
      const ticketId = result.insertId;
      
      await connection.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
        [ticketId, userId, initialMessage, false]
      );
      
      await connection.commit();
      return ticketId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getTicketMessages(ticketId: number, userId?: number, isAdmin = false): Promise<TicketMessage[]> {
    const ticket = await this.getTicketById(ticketId, userId, isAdmin);
    if (!ticket) throw new Error('Ticket not found or unauthorized');

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.*, u.email as user_email 
       FROM ticket_messages m 
       LEFT JOIN panel_users u ON m.user_id = u.id 
       WHERE m.ticket_id = ? 
       ORDER BY m.created_at ASC`,
      [ticketId]
    );
    return rows as TicketMessage[];
  }

  async addMessage(ticketId: number, userId: number, message: string, isAdmin = false): Promise<void> {
    const ticket = await this.getTicketById(ticketId, userId, isAdmin);
    if (!ticket) throw new Error('Ticket not found or unauthorized');

    if (ticket.status === 'closed') {
      throw new Error('Cannot reply to a closed ticket');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)',
        [ticketId, userId, message, isAdmin]
      );

      const newStatus = isAdmin ? 'answered' : 'open';
      await connection.execute(
        'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, ticketId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async closeTicket(ticketId: number, userId?: number, isAdmin = false): Promise<void> {
    const ticket = await this.getTicketById(ticketId, userId, isAdmin);
    if (!ticket) throw new Error('Ticket not found or unauthorized');

    await pool.execute('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', ['closed', ticketId]);
  }
}

export const ticketService = new TicketService();