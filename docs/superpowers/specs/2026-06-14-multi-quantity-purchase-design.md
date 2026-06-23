# ซื้อหลายชิ้นในออเดอร์เดียว (Multi-quantity purchase)

วันที่: 2026-06-14

## ปัญหา

หน้าร้าน (`frontend/src/components/ProductCard.tsx` → `handleBuy`) เลือกจำนวนได้ แต่เบื้องหลัง
**วนลูปยิง `POST /shop/buy` ทีละชิ้น** ตามจำนวน และทุก request ติด `purchaseCooldown(3)` →
ผู้เล่นต้องรอ ~3 วินาทีต่อชิ้น เช่น ซื้อ 4 ชิ้น = ยิง 4 ครั้ง + รอ 3 รอบ ทำให้ช้าและไม่สะดวก

## เป้าหมาย

กดยืนยันครั้งเดียว → 1 ออเดอร์ → ตัดเงินครั้งเดียว → ส่งของเข้าเกมรวดเดียว
โดย **ของต้องไม่ตกหล่น** และ **ไม่เก็บเงินเกินจำนวนที่ส่งได้จริง**

## การตัดสินใจหลัก (ยืนยันกับผู้ใช้แล้ว)

1. **RCON** (อัปเดต 2026-06-15 เพื่อ performance): รองรับ 2 โหมด
   - **single-shot**: ถ้าคำสั่งมี placeholder `{amount}`/`{qty}`/`{quantity}` → แทนด้วยจำนวนแล้ว
     รัน **ครั้งเดียว** เช่น `give {player} diamond {amount}` ซื้อ 4 → `give Steve diamond 4`
     (1 round-trip ไม่ว่าซื้อกี่ชิ้น, all-or-nothing)
   - **repeat (fallback)**: ถ้าไม่มี placeholder → รันชุดคำสั่งซ้ำ N ครั้ง (สำหรับยศ/สิทธิ์ที่คูณจำนวนไม่ได้)
     เช่น `give {player} diamond 1` ซื้อ 4 = รัน 4 รอบ พร้อม partial-delivery accounting
2. **DB**: เพิ่มคอลัมน์ `quantity` ใน `purchases` → 1 แถวต่อออเดอร์, `price` = ยอดรวมทั้งออเดอร์
3. **สถิติ**: นับเป็น **จำนวนชิ้น (units)** ทั้งหน้าร้านและหน้าแอดมิน

## ดีไซน์

### 1. Migration `024_purchase_quantity.sql`
- เพิ่ม `quantity INT NOT NULL DEFAULT 1` ใน `purchases`
- Idempotent ตามแพทเทิร์น `INFORMATION_SCHEMA.COLUMNS` guard (เหมือน migration เดิม)
- แถวเก่าทั้งหมด quantity = 1 (default) → สถิติย้อนหลังไม่เพี้ยน

### 2. RCON manager (`rcon-manager.ts`) — หัวใจความรัดกุม
รีแฟกเตอร์ `executeProductCommands` ให้รับพารามิเตอร์ `times` (default 1) และคืนค่าเป็น object:

```
executeProductCommands(serverId, template, username, times = 1)
  → { deliveredUnits: number; totalUnits: number; results: string[]; error?: string }
```

ภายใน:
- parse คำสั่งจาก template ครั้งเดียว (คงลอจิก strip `/`, แทน `{player}`/`{username}`, fallback `minecraft:` namespace เดิมไว้)
- วนรัน **ทีละ unit** (รอบที่ `u` = 0..times-1); แต่ละ unit รันชุดคำสั่งครบทุกบรรทัด
- **dedup key ต้องไม่ซ้ำต่อรอบ**: `product:{serverId}:{user}:{ts}:u{u}:cmd{i}`
  - สำคัญมาก: `rcon-queue` มี dedup Set บล็อกคำสั่งซ้ำ 30 วิ ถ้า key ซ้ำ รอบ 2-N จะโดนบล็อก → ของหาย
- ถ้า unit ใดสำเร็จครบทุกบรรทัด → `deliveredUnits++`
- ถ้า unit ใด throw → หยุด (break) คืนค่า `deliveredUnits` ที่ส่งสำเร็จ + `error`
- ใช้ retry เดิมของ queue (3 ครั้ง, backoff) → favor การส่งให้ถึง (at-least-once) ตามเจตนา "ไม่ตกหล่น"

### 3. `shop.service.buyProduct` — เพิ่มพารามิเตอร์ `quantity`
- `quantity` (default 1, ช่วง 1-99)
- `unitPrice` = ราคาหลังเช็ก sale/paused; `subtotal = unitPrice × quantity`
- ส่วนลด (ถ้ามี) คิดจาก `subtotal` ครั้งเดียว → `effectiveTotal`; `effectiveUnit = effectiveTotal / quantity`
- **เช็ก stock ด้วยจำนวนชิ้น**: `sold = COALESCE(SUM(quantity),0) WHERE delivered`
  - ถ้า `stock_limit != null` และ `sold + quantity > stock_limit` → ปฏิเสธทั้งออเดอร์
    - remaining = max(0, stock_limit - sold); remaining=0 → "สินค้าหมดแล้ว"; ไม่งั้น "สินค้าเหลือไม่พอ (เหลือ {remaining} ชิ้น)"
- transaction: ตัดเงิน `effectiveTotal`, insert `purchases` ด้วย `quantity` + `price = effectiveTotal`
- description ของ transaction: `ซื้อ {name}` + (ถ้า quantity>1) ` ×{quantity}` → โชว์ในหน้า log/ประวัติอัตโนมัติ
- re-verify online เดิม (ก่อนส่ง RCON) คงไว้ — ถ้า offline คืนเงินเต็ม + throw (ยังไม่ได้ส่งของ)

**การส่ง RCON + การกระทบยอด (partial delivery accounting):**
- เรียก `executeProductCommands(..., quantity)` → ได้ `deliveredUnits`
- `deliveredUnits === quantity` → status `delivered` เต็มจำนวน (return status `delivered`)
- `deliveredUnits === 0` → คืนเงินเต็ม (status `refunded`) + throw `RconError` (พฤติกรรมเดิม)
- `0 < deliveredUnits < quantity` (**partial**):
  - คืนเงินเฉพาะส่วนที่ส่งไม่ได้: `refund = effectiveTotal × (quantity - deliveredUnits) / quantity`
  - update `purchases`: `status='delivered'`, `quantity=deliveredUnits`, `price=effectiveTotal - refund`, เก็บ rcon_response + หมายเหตุ
  - insert transaction refund: `คืนเงินบางส่วน {name} (ส่งได้ {deliveredUnits}/{quantity})`
  - return `{ status: 'partial', deliveredUnits, requestedUnits: quantity, refunded: refund }`
  - ผล: ผู้เล่นได้ของทุกชิ้นที่ส่งสำเร็จ (ไม่ตกหล่น) และจ่ายเฉพาะที่ได้รับจริง (ไม่เกิน)

### 4. `shop.service.retryDelivery` (แอดมินสั่งส่งซ้ำ)
- ส่ง `purchase.quantity` ให้ `executeProductCommands`; สำเร็จครบ → delivered
- partial ที่กระทบยอดแล้ว status = delivered จึงไม่อยู่ในเงื่อนไข retry (`failed`/`pending`) อยู่แล้ว

### 5. ยอดขายเป็นจำนวนชิ้น
- **`shop.service`** 4 จุด (stock check + sold_count subquery ×3): `COUNT(*)` → `COALESCE(SUM(quantity),0)`
- **`admin-stats.service`**:
  - `totalPurchases`, `delivered`, `todayPurchases` (delivered units): `COUNT(*)` → `COALESCE(SUM(quantity),0)`
  - `failed`, `pending`, `refunded`: คงเป็น `COUNT(*)` (จำนวนออเดอร์ที่มีปัญหา ตามสภาพออเดอร์)
  - top products: `COUNT(*) as purchase_count` → `COALESCE(SUM(p.quantity),0)` (revenue `SUM(price)` ถูกอยู่แล้วเพราะ price=ยอดรวม)
  - recentPurchases / getPurchases: เพิ่ม `p.quantity` ในผลลัพธ์ (เผื่อแสดงผล)

### 6. Validator `buyProductSchema`
เพิ่ม `quantity: z.number().int().min(1).max(99).optional()`

### 7. Route `/shop/buy`
ส่ง `req.body.quantity` เข้า `buyProduct`

### 8. Frontend `ProductCard.handleBuy`
- เปลี่ยนจากลูปเป็น **ยิง API ครั้งเดียว** พร้อม `quantity` + idempotency key เดียว
- จัดการ response:
  - status `delivered` → toast สำเร็จ (`ซื้อสำเร็จ {quantity} ชิ้น!`)
  - status `partial` → toast เตือน (`ส่งได้ {deliveredUnits}/{quantity} ชิ้น คืนเงินส่วนที่เหลือแล้ว`)
  - error (เช่น เงินไม่พอ/offline/RconError) → แสดง result error เดิม
- คง gift / discount flow เดิม (ฝั่ง gift ยังส่ง quantity ได้)

## ความเสี่ยงที่ยอมรับ
- **ภายใน 1 unit หลายบรรทัด**: ถ้าบรรทัดแรกของ unit สำเร็จแต่บรรทัดถัดไป fail → unit นั้นนับเป็นไม่สำเร็จ
  และอาจเหลือ effect บางส่วนในเกม (ความเสี่ยงเดิมของ flow ชิ้นเดียวอยู่แล้ว ไม่แย่ลง)
- **retry ของ queue กับ `give`**: ถ้า RCON ทำงานจริงแต่ response หาย แล้ว retry อาจ give ซ้ำ
  (พฤติกรรมเดิม MAX_RETRIES=3 ไม่เปลี่ยน) — เลือก favor "ไม่ตกหล่น" มากกว่า "ไม่ให้ซ้ำ" ตามเจตนาผู้ใช้

## แผนทดสอบ / ตรวจสอบ
- `cd backend && npm run build` ผ่าน (tsc)
- `cd frontend && npm run build` ผ่าน (next build)
- ตรวจ migration idempotent (รันซ้ำได้ไม่ error)
- หลังเสร็จ: rebuild + deploy ตามสคริปต์ลูกค้า (manage-customer.sh rebuild — ห้าม docker build/run เอง)
