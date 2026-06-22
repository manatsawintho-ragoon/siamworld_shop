import { z } from 'zod';

// ─── Shared base field definitions (DRY) ─────────────────────────────────────

const boolFlag    = z.preprocess((v) => Boolean(v), z.boolean());
const boolFlagAlt = z.preprocess((v) => v !== false && v !== 0, z.boolean());
const rarityEnum  = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

// ─── Auth ────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255),
  email: z.string().email('Invalid email format').max(255),
});

// ─── Password reset (email OTP) ──────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(255),
});

// ─── Wallet / Payment ────────────────────────────────────────

export const topupSchema = z.object({
  amount: z.number().min(10, 'ยอดขั้นต่ำ 10 บาท').max(999999999),
  description: z.string().max(500).optional(),
});

// Accepts a TrueMoney gift URL OR a raw voucher hash. The redeem service is the
// single source of truth for parsing (extractVoucherHash); here we just bound size.
export const trueMoneyRedeemSchema = z.object({
  giftLink: z.string().min(1).max(2048),
});

// Accepts one of: base64 image, public URL, or QR payload string
export const slipVerifySchema = z.object({
  base64:         z.string().min(1).optional(),
  url:            z.string().url().max(2048).optional(),
  payload:        z.string().min(1).max(128).optional(),
  expectedAmount: z.number().positive().optional(),  // QR amount for lock validation
  discountCode:   z.string().min(1).max(100).optional(),
}).refine(d => !!(d.base64 || d.url || d.payload), {
  message: 'Provide one of: base64, url, or payload',
});

export const discountPreviewSchema = z.object({
  code:    z.string().min(1).max(100),
  context: z.enum(['topup', 'purchase']),
  amount:  z.number().positive(),
});

// ─── Shop ────────────────────────────────────────────────────

export const buyProductSchema = z.object({
  productId: z.number().int().positive(),
  serverId:  z.number().int().positive(),
  quantity:  z.number().int().min(1).max(99).optional(),
  idempotencyKey: z.string().max(64).optional(),
  giftToUsername: z.string().max(64).optional(),
  discountCode:   z.string().min(1).max(100).optional(),
});

// ─── Loot Box ────────────────────────────────────────────────

export const openLootBoxSchema = z.object({
  idempotencyKey: z.string().max(64).optional(),
});

export const redeemInventorySchema = z.object({
  serverId: z.number().int().positive(),
});

const lootBoxBaseFields = {
  name:           z.string().min(1).max(255),
  description:    z.string().max(2000).optional().nullable(),
  image:          z.string().max(500).optional().nullable(),
  price:          z.number().positive(),
  original_price: z.number().positive().optional().nullable(),
  sort_order:     z.number().int().optional(),
  category_id:    z.number().int().positive().optional().nullable(),
  stock_limit:    z.number().int().min(0).optional().nullable(),
  sale_start:     z.string().optional().nullable(),
  sale_end:       z.string().optional().nullable(),
};

export const createLootBoxSchema = z.object(lootBoxBaseFields);

export const updateLootBoxSchema = z.object({
  name:           lootBoxBaseFields.name.optional(),
  description:    lootBoxBaseFields.description,
  image:          lootBoxBaseFields.image,
  price:          lootBoxBaseFields.price.optional(),
  original_price: lootBoxBaseFields.original_price,
  sort_order:     lootBoxBaseFields.sort_order,
  active:         boolFlag.optional(),
  category_id:    lootBoxBaseFields.category_id,
  stock_limit:    lootBoxBaseFields.stock_limit,
  sale_start:     lootBoxBaseFields.sale_start,
  sale_end:       lootBoxBaseFields.sale_end,
});

export const createLootBoxCategorySchema = z.object({
  name:       z.string().min(1).max(100),
  color:      z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#637469'),
  sort_order: z.number().int().optional(),
});

export const updateLootBoxCategorySchema = z.object({
  name:       z.string().min(1).max(100).optional(),
  color:      z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  sort_order: z.number().int().optional(),
});

const lootBoxItemBaseFields = {
  name:        z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  image:       z.string().max(500).optional().nullable(),
  command:     z.string().min(1).max(5000),
  weight:      z.number().int().positive(),
  rarity:      rarityEnum.optional(),
  color:       z.string().max(20).optional().nullable(),
};

export const createLootBoxItemSchema = z.object(lootBoxItemBaseFields);

export const updateLootBoxItemSchema = z.object({
  name:        lootBoxItemBaseFields.name.optional(),
  description: lootBoxItemBaseFields.description,
  image:       lootBoxItemBaseFields.image,
  command:     lootBoxItemBaseFields.command.optional(),
  weight:      lootBoxItemBaseFields.weight.optional(),
  rarity:      rarityEnum.optional(),
  color:       lootBoxItemBaseFields.color,
});

// ─── Products ────────────────────────────────────────────────

const productBaseFields = {
  name:          z.string({ required_error: 'กรุณากรอกชื่อสินค้า', invalid_type_error: 'ชื่อสินค้าไม่ถูกต้อง' })
                  .min(1, 'กรุณากรอกชื่อสินค้า').max(255, 'ชื่อสินค้ายาวเกิน 255 ตัวอักษร'),
  description:   z.string().max(2000, 'คำอธิบายยาวเกิน 2000 ตัวอักษร').optional().nullable(),
  price:         z.number({ required_error: 'กรุณากรอกราคา', invalid_type_error: 'ราคาต้องเป็นตัวเลข' })
                  .positive('ราคาต้องมากกว่า 0'),
  original_price: z.number({ invalid_type_error: 'ราคาเดิมต้องเป็นตัวเลข' }).positive('ราคาเดิมต้องมากกว่า 0').optional().nullable(),
  image:         z.string().max(500, 'ลิงก์รูปภาพยาวเกินไป').optional().nullable(),
  image2:        z.string().max(500, 'ลิงก์รูปภาพยาวเกินไป').optional().nullable(),
  image3:        z.string().max(500, 'ลิงก์รูปภาพยาวเกินไป').optional().nullable(),
  command:       z.string({ required_error: 'กรุณากรอกคำสั่ง RCON', invalid_type_error: 'คำสั่ง RCON ไม่ถูกต้อง' })
                  .min(1, 'กรุณากรอกคำสั่ง RCON ที่จะส่งเมื่อมีคนซื้อ').max(5000, 'คำสั่ง RCON ยาวเกิน 5000 ตัวอักษร'),
  category_id:   z.number({ invalid_type_error: 'หมวดหมู่ไม่ถูกต้อง' }).int().positive('หมวดหมู่ไม่ถูกต้อง').optional().nullable(),
  featured:      boolFlag.optional(),
  active:        boolFlag.optional(),
  server_ids:    z.array(z.number().int().positive(), { invalid_type_error: 'กรุณาเลือกเซิร์ฟเวอร์' }).optional(),
  stock_limit:   z.number({ invalid_type_error: 'จำนวนสต็อกต้องเป็นตัวเลข' }).int('จำนวนสต็อกต้องเป็นจำนวนเต็ม').min(0, 'จำนวนสต็อกต้องไม่ติดลบ').optional().nullable(),
  sale_start:    z.string().optional().nullable(),
  sale_end:      z.string().optional().nullable(),
};

export const createProductSchema = z.object(productBaseFields);

export const updateProductSchema = z.object({
  name:           productBaseFields.name.optional(),
  description:    productBaseFields.description,
  price:          productBaseFields.price.optional(),
  original_price: z.number().positive().nullable().optional(),
  image:          z.string().max(500).nullable().optional(),
  image2:         z.string().max(500).nullable().optional(),
  image3:         z.string().max(500).nullable().optional(),
  command:        productBaseFields.command.optional(),
  category_id:    z.number().int().positive().nullable().optional(),
  featured:       boolFlag.optional(),
  active:         boolFlag.optional(),
  sort_order:     z.number().int().optional(),
  server_ids:     productBaseFields.server_ids,
  stock_limit:    z.number().int().min(0).nullable().optional(),
  sale_start:     z.string().nullable().optional(),
  sale_end:       z.string().nullable().optional(),
});

// ─── Release Schema ───────────────────────────────────────────

export const releaseSchema = z.object({
  duration_minutes: z.number().int().min(0),
  stock_limit:      z.number().int().min(1).optional().nullable(),
});

// ─── Servers ─────────────────────────────────────────────────

const serverBaseFields = {
  name:              z.string().min(1).max(255),
  host:              z.string().min(1).max(255),
  port:              z.number().int().positive().optional(),
  rcon_port:         z.number().int().positive(),
  rcon_password:     z.string().min(1).max(255),
  minecraft_version: z.string().max(50).optional().nullable(),
  max_players:       z.number().int().positive().optional(),
  is_enabled:        boolFlag.optional(),
};

export const createServerSchema = z.object(serverBaseFields);

export const updateServerSchema = z.object({
  name:              serverBaseFields.name.optional(),
  host:              serverBaseFields.host.optional(),
  port:              serverBaseFields.port,
  rcon_port:         serverBaseFields.rcon_port.optional(),
  rcon_password:     z.string().max(255).optional(),
  minecraft_version: serverBaseFields.minecraft_version,
  max_players:       serverBaseFields.max_players,
  is_enabled:        boolFlag.optional(),
});

// ─── Settings / Slides ───────────────────────────────────────

export const updateSettingsSchema = z.object({
  settings: z.array(z.object({ key: z.string(), value: z.string().nullable().transform(v => v ?? '') })),
});

export const createSlideSchema = z.object({
  title:      z.string().max(255).optional().nullable(),
  image_url:  z.string().min(1).max(500),
  link_url:   z.string().max(500).optional().nullable(),
  sort_order: z.number().int().optional(),
  active:     boolFlag.optional(),
});

// ─── Downloads ───────────────────────────────────────────────

const downloadBaseFields = {
  filename:     z.string().min(1, 'Filename is required').max(255),
  description:  z.string().max(2000).optional().nullable(),
  file_size:    z.string().max(50).optional().nullable(),
  download_url: z.string().url('Invalid URL format').min(1).max(1000),
  category:     z.string().max(100).optional().nullable(),
  active:       boolFlagAlt.optional(),
  sort_order:   z.number().int().optional(),
};

export const createDownloadSchema = z.object(downloadBaseFields);
export const updateDownloadSchema  = z.object(downloadBaseFields);

// ─── Redeem Codes ────────────────────────────────────────────

const redeemCodeBaseFields = {
  description:      z.string().max(500).optional().nullable(),
  reward_type:      z.enum(['rcon', 'point', 'discount_topup', 'discount_purchase', 'discount_any']).optional(),
  point_amount:     z.number().positive().optional().nullable(),
  // Discount: at most one of percent/amount should be set. We don't enforce
  // mutual-exclusion at the schema level — discount.service.preview prefers
  // percent when both are non-zero, which is documented.
  discount_percent: z.number().min(0).max(100).optional().nullable(),
  discount_amount:  z.number().min(0).optional().nullable(),
  min_topup_amount: z.number().min(0).optional().nullable(),
  command:          z.string().max(5000).optional().nullable(),
  max_uses:         z.number().int().min(0).optional(),
  active:           boolFlag.optional(),
  expires_at:       z.string().optional().nullable(),
};

const codeRegex = /^[a-zA-Z0-9_-]+$/;

export const createRedeemCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100).regex(codeRegex, 'Code may only contain letters, numbers, hyphens and underscores'),
  ...redeemCodeBaseFields,
});

export const updateRedeemCodeSchema = z.object({
  code: z.string().min(1).max(100).regex(codeRegex, 'Code may only contain letters, numbers, hyphens and underscores').optional(),
  ...redeemCodeBaseFields,
});

export const redeemCodeSchema = z.object({
  code:     z.string().min(1, 'Code is required').max(100),
  serverId: z.number().int().positive().optional(),
});
