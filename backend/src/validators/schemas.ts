import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(255),
  email: z.string().email('Invalid email format').max(255),
});

export const topupSchema = z.object({
  amount: z.number().positive().max(999999999),
  description: z.string().max(500).optional(),
});

export const promptPayCreateSchema = z.object({
  amount: z.number().positive().max(100000),
});

export const trueMoneyRedeemSchema = z.object({
  giftLink: z.string().url().min(1),
});

export const buyProductSchema = z.object({
  productId: z.number().int().positive(),
  serverId: z.number().int().positive(),
  idempotencyKey: z.string().max(64).optional(),
});

// ─── Loot Box ───────────────────────────────────────────────

export const openLootBoxSchema = z.object({
  idempotencyKey: z.string().max(64).optional(),
});

export const redeemInventorySchema = z.object({
  serverId: z.number().int().positive(),
});

export const createLootBoxSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  price: z.number().positive(),
  sort_order: z.number().int().optional(),
});

export const updateLootBoxSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  price: z.number().positive().optional(),
  sort_order: z.number().int().optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
});

export const createLootBoxItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  command: z.string().min(1).max(5000),
  weight: z.number().int().positive(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  color: z.string().max(20).optional().nullable(),
});

export const updateLootBoxItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  command: z.string().min(1).max(5000).optional(),
  weight: z.number().int().positive().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).optional(),
  color: z.string().max(20).optional().nullable(),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive(),
  original_price: z.number().positive().optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  command: z.string().min(1).max(5000),
  category_id: z.number().int().positive().optional().nullable(),
  featured: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  server_ids: z.array(z.number().int().positive()).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive().optional(),
  original_price: z.number().positive().nullable().optional(),
  image: z.string().max(500).nullable().optional(),
  command: z.string().min(1).max(5000).optional(),
  category_id: z.number().int().positive().nullable().optional(),
  featured: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  sort_order: z.number().int().optional(),
  server_ids: z.array(z.number().int().positive()).optional(),
});

export const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  host: z.string().min(1).max(255),
  port: z.number().int().positive().optional(),
  rcon_port: z.number().int().positive(),
  rcon_password: z.string().min(1).max(255),
  minecraft_version: z.string().max(50).optional().nullable(),
  max_players: z.number().int().positive().optional(),
  is_enabled: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().positive().optional(),
  rcon_port: z.number().int().positive().optional(),
  rcon_password: z.string().max(255).optional(),
  minecraft_version: z.string().max(50).optional().nullable(),
  max_players: z.number().int().positive().optional(),
  is_enabled: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
});

export const updateSettingsSchema = z.object({
  settings: z.array(z.object({ key: z.string(), value: z.string().nullable().transform(v => v ?? '') }))
});

export const createSlideSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  image_url: z.string().min(1).max(500),
  link_url: z.string().max(500).optional().nullable(),
  sort_order: z.number().int().optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
});

// ─── Downloads ──────────────────────────────────────────────

export const createDownloadSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  file_size: z.string().max(50).optional().nullable(),
  download_url: z.string().url('Invalid URL format').min(1).max(1000),
  category: z.string().max(100).optional().nullable(),
  active: z.preprocess((v) => v !== false && v !== 0 ? true : false, z.boolean()).optional(),
  sort_order: z.number().int().optional(),
});

export const updateDownloadSchema = z.object({
  filename: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  file_size: z.string().max(50).optional().nullable(),
  download_url: z.string().url('Invalid URL format').min(1).max(1000),
  category: z.string().max(100).optional().nullable(),
  active: z.preprocess((v) => v !== false && v !== 0 ? true : false, z.boolean()).optional(),
  sort_order: z.number().int().optional(),
});

// ─── Redeem Codes ───────────────────────────────────────────

export const createRedeemCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens and underscores'),
  description: z.string().max(500).optional().nullable(),
  reward_type: z.enum(['rcon', 'point']).optional(),
  point_amount: z.number().positive().optional().nullable(),
  command: z.string().max(5000).optional().nullable(),
  max_uses: z.number().int().min(0).optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  expires_at: z.string().optional().nullable(),
});

export const updateRedeemCodeSchema = z.object({
  code: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Code may only contain letters, numbers, hyphens and underscores').optional(),
  description: z.string().max(500).optional().nullable(),
  reward_type: z.enum(['rcon', 'point']).optional(),
  point_amount: z.number().positive().optional().nullable(),
  command: z.string().max(5000).optional().nullable(),
  max_uses: z.number().int().min(0).optional(),
  active: z.preprocess((v) => Boolean(v), z.boolean()).optional(),
  expires_at: z.string().optional().nullable(),
});

export const redeemCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100),
  serverId: z.number().int().positive().optional(),
});
