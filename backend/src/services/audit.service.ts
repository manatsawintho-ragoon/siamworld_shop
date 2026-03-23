import { pool } from '../database/connection';

export type AuditActionType =
  | 'user_login'
  // Products
  | 'admin_product_create' | 'admin_product_update' | 'admin_product_delete' | 'admin_product_release' | 'admin_product_stop'
  // Loot boxes
  | 'admin_lootbox_create' | 'admin_lootbox_update' | 'admin_lootbox_delete' | 'admin_lootbox_release' | 'admin_lootbox_stop' | 'admin_lootbox_pause' | 'admin_lootbox_resume'
  // Loot box items
  | 'admin_lootbox_item_create' | 'admin_lootbox_item_update' | 'admin_lootbox_item_delete'
  // Redeem codes
  | 'admin_code_create' | 'admin_code_update' | 'admin_code_delete'
  // Servers
  | 'admin_server_create' | 'admin_server_update' | 'admin_server_delete' | 'admin_server_toggle'
  // Users
  | 'admin_wallet_adjust' | 'admin_user_role' | 'admin_user_edit'
  // System
  | 'admin_settings' | 'admin_rcon_cmd';

interface AuditParams {
  userId: number;
  username: string;
  role?: string;
  actionType: AuditActionType;
  description: string;
  amount?: number;
  refId?: string;
  meta?: Record<string, any>;
}

class AuditService {
  /** Fire-and-forget audit log — never blocks the main request flow */
  log(params: AuditParams): void {
    pool.execute(
      'INSERT INTO audit_logs (user_id, username, role, action_type, description, amount, ref_id, meta) VALUES (?,?,?,?,?,?,?,?)',
      [
        params.userId,
        params.username,
        params.role ?? 'admin',
        params.actionType,
        params.description,
        params.amount ?? null,
        params.refId ?? null,
        params.meta ? JSON.stringify(params.meta) : null,
      ]
    ).catch(err => console.error('[audit] insert failed:', err));
  }
}

export const auditService = new AuditService();
