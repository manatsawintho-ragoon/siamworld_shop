# SiamWorld Shop

ระบบร้านค้าออนไลน์สำหรับ Minecraft Server
ผู้เล่นเข้าสู่ระบบด้วยบัญชี **AuthMe**, เติมเงินผ่าน **PromptPay / TrueMoney** และซื้อสินค้า/สิทธิ์ที่ส่งผ่าน **RCON** เข้าเซิร์ฟโดยตรง

---

## สารบัญ

1. [Tech Stack](#tech-stack)
2. [ฟีเจอร์ทั้งหมด](#ฟีเจอร์ทั้งหมด)
3. [ข้อกำหนดเบื้องต้น](#ข้อกำหนดเบื้องต้น)
4. [Quick Start — Docker](#quick-start--docker-แนะนำ)
5. [ตั้งค่า .env](#ตั้งค่า-env)
6. [ตั้งค่า Minecraft Server (สำคัญมาก)](#ตั้งค่า-minecraft-server)
7. [Apply Database Migrations](#apply-database-migrations)
8. [Team Workflow — ทำงานเป็นทีม](#team-workflow)
9. [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
10. [Troubleshooting — RCON / Player Tracking](#troubleshooting--rcon--player-tracking)
11. [API Routes](#api-routes)
12. [Security Notes](#security-notes)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 + Express + TypeScript |
| Frontend | Next.js 14 App Router + TailwindCSS |
| Database | MySQL 8.0 |
| Cache / Real-time | Redis 7 + Socket.IO |
| Auth | JWT + AuthMe bcrypt (อ่านจาก authme table โดยตรง) |
| RCON | rcon-client — persistent connection pool per server |
| Container | Docker + Docker Compose |

---

## ฟีเจอร์ทั้งหมด

### ฝั่งผู้เล่น
- **สมัคร / Login** ด้วยบัญชี AuthMe (password ไม่ถูกเก็บซ้ำ — อ่านจาก authme table)
- **Wallet** — ดูยอดเงิน, ประวัติการทำรายการ
- **เติมเงิน** — PromptPay (สร้าง QR) และ TrueMoney Gift Card
- **ร้านค้า** — ซื้อสินค้า/Permission ส่งผ่าน RCON ทันที (ต้อง online บนเซิร์ฟก่อน)
- **Loot Box** — เปิดกล่องสุ่มไอเท็ม แยก Rarity, รับของผ่าน RCON
- **Inventory** — ของที่ได้จาก Loot Box เก็บไว้ก่อน กด Redeem ได้ทีหลัง
- **Redeem Code** — กรอกโค้ดรับ Point หรือ RCON Command
- **Online Players** — ดูผู้เล่น Online แบบ Real-time ผ่าน WebSocket

### ฝั่ง Admin
- **Dashboard** — ยอดขาย, สมาชิก, สถิติ
- **จัดการสินค้า** — เพิ่ม/แก้ไข/ลบ พร้อม RCON Command Template (`{username}`, `{player}`)
- **จัดการ Loot Box** — กำหนด Category, Rarity (Common→Mythic), Weight
- **จัดการ Redeem Code** — สร้าง Code แบบ Point หรือ RCON
- **จัดการเซิร์ฟเวอร์** — เพิ่มหลายเซิร์ฟ, ตรวจ RCON Health จริง, ดูผู้เล่นแต่ละเซิร์ฟ, เปิด/ปิดเซิร์ฟในระบบ
- **จัดการ User** — ดูประวัติ, ปรับยอดเงิน, เปลี่ยน Role
- **Audit Log** — บันทึกทุกกิจกรรม (Login, ซื้อ, เติมเงิน, Admin actions) พร้อม Auto-purge
- **Settings** — ชื่อร้าน, สกุลเงิน, การตั้งค่าระบบ

---

## ข้อกำหนดเบื้องต้น

### Web Server (เครื่องที่รันเว็บ)

| ซอฟต์แวร์ | เวอร์ชัน |
|-----------|---------|
| Docker | 24.x ขึ้นไป |
| Docker Compose | v2.x ขึ้นไป |

### Minecraft Server (ทุก Server ที่จะเชื่อม)

| สิ่งที่ต้องมี | หมายเหตุ |
|-------------|---------|
| Spigot / Paper 1.8+ | หรือ Fork ที่รองรับ AuthMe |
| **AuthMe Reloaded 5.6+** | ต้องตั้ง MySQL storage — **ไม่ใช่ SQLite** |
| **RCON เปิดอยู่** | `enable-rcon=true` ใน server.properties |
| **Port RCON เปิด Firewall** | ค่าเริ่มต้น 25575 — Web server ต้องเข้าถึงได้ |

---

## Quick Start — Docker (แนะนำ)

```bash
# 1. Clone
git clone https://github.com/yourorg/siamworld-shop.git
cd siamworld-shop

# 2. สร้าง .env จาก template
cp .env.example .env
# แก้ไข .env (ดูหัวข้อถัดไป)

# 3. รัน
docker compose up -d

# 4. ตรวจสอบ
docker compose ps
docker compose logs -f backend
```

Container ที่ควรมีสถานะ `running`:

| Container | Port | คำอธิบาย |
|-----------|------|---------|
| `siamworld-mysql` | 3306 | MySQL Database |
| `siamworld-redis` | 6379 | Redis Cache |
| `siamworld-backend` | 4000 | Backend API |
| `siamworld-frontend` | 3000 | หน้าเว็บ |
| `siamworld-phpmyadmin` | 8080 | จัดการ Database |

---

## ตั้งค่า .env

คัดลอกจาก `.env.example` แล้วแก้ค่าเหล่านี้:

```env
# ── Database ──────────────────────────────────────────────────
MYSQL_HOST=mysql          # ใช้ "mysql" ถ้ารัน Docker / "localhost" ถ้า Manual
MYSQL_PORT=3306
MYSQL_USER=siamworld
MYSQL_PASSWORD=ใส่_password_แข็งแรง   # ห้ามใช้ค่า default
MYSQL_DATABASE=siamworld

# ── Redis ─────────────────────────────────────────────────────
REDIS_HOST=redis          # ใช้ "redis" ถ้ารัน Docker / "localhost" ถ้า Manual
REDIS_PORT=6379

# ── JWT & Encryption ──────────────────────────────────────────
# ทั้งสองค่าต้องยาว 32+ ตัวอักษร และต้องไม่ซ้ำกัน
JWT_SECRET=random_string_อย่างน้อย_32_ตัว
ENCRYPTION_KEY=random_string_อีกอัน_32_ตัว_ห้ามซ้ำ_JWT_SECRET

# ── Frontend URLs ─────────────────────────────────────────────
# ต้องเป็น URL ที่ Browser ของผู้เล่นเข้าถึงได้จริง
# Local Dev:
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=ws://localhost:4000
# VPS (ใช้ IP จริง):
# NEXT_PUBLIC_API_URL=http://1.2.3.4:4000/api
# NEXT_PUBLIC_WS_URL=ws://1.2.3.4:4000
# Domain + HTTPS:
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
# NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com

# ── CORS ──────────────────────────────────────────────────────
# ตั้งเป็น URL ของ Frontend เพื่อความปลอดภัย
# CORS_ORIGIN=https://shop.yourdomain.com
CORS_ORIGIN=*   # ใช้ * เฉพาะ dev เท่านั้น

# ── Rate Limiting ─────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000   # 15 นาที
RATE_LIMIT_MAX=300            # 300 req ต่อ 15 นาที ต่อ IP
```

> **หมายเหตุ:** ไฟล์ `.env` อยู่ใน `.gitignore` แล้ว — **ห้าม commit ขึ้น Git เด็ดขาด**

---

## ตั้งค่า Minecraft Server

> **นี่คือสาเหตุอันดับ 1 ที่ทำให้ระบบส่งของไม่ได้ / track ผู้เล่นไม่ได้**

### 1. เปิด RCON ใน `server.properties`

```properties
# เปิด RCON
enable-rcon=true
rcon.port=25575
rcon.password=ใส่_password_ที่แข็งแรง_ตรงกับที่จะกรอกในระบบ

# ต้องปิด online-mode ถ้าใช้ AuthMe (Cracked server)
online-mode=false
```

> **สำคัญ:** หลังแก้ `server.properties` ต้อง **restart Minecraft Server** ทุกครั้ง

### 2. ตั้งค่า AuthMe ให้ใช้ MySQL

แก้ไฟล์ `plugins/AuthMe/config.yml`:

```yaml
DataSource:
  backend: MYSQL
  mySQLHost: IP_ของ_MySQL_Server   # เช่น 1.2.3.4 หรือ host.docker.internal
  mySQLPort: 3306
  mySQLUsername: siamworld
  mySQLPassword: ใส่_password_เดียวกับ_.env
  mySQLDatabase: siamworld
  mySQLTablename: authme
```

> **สำคัญ:** AuthMe ต้องใช้ MySQL database เดียวกับระบบร้าน (`siamworld` database)
> ห้ามใช้ SQLite (ค่า default ของ AuthMe) เพราะระบบอ่าน password จาก MySQL โดยตรง

### 3. Firewall — เปิด Port ที่จำเป็น

| Port | Protocol | จากไหน | ไปไหน | จุดประสงค์ |
|------|----------|--------|-------|-----------|
| 25575 | TCP | Web Server IP | Minecraft Server | **RCON** — สำคัญที่สุด |
| 3306 | TCP | Minecraft Server IP | MySQL Server | AuthMe ↔ MySQL |
| 25565 | TCP | Public | Minecraft Server | ผู้เล่นเชื่อมต่อ |

```bash
# ตัวอย่าง UFW (Ubuntu)
ufw allow from <WEB_SERVER_IP> to any port 25575
```

### 4. กรณี Minecraft อยู่เครื่องเดียวกับ Web (Docker)

Docker backend จะใช้ `host.docker.internal` เชื่อม Minecraft บน Host:

```
# ใน Admin Panel → จัดการเซิร์ฟเวอร์ → เพิ่มเซิร์ฟเวอร์
Host: host.docker.internal     ← ถ้า Minecraft อยู่เครื่องเดียวกัน
Port: 25565
RCON Port: 25575
RCON Password: ตามที่ตั้งใน server.properties
```

### 5. กรณี Minecraft อยู่คนละเครื่อง

```
Host: 1.2.3.4      ← IP จริงของเครื่อง Minecraft
Port: 25565
RCON Port: 25575
RCON Password: ตามที่ตั้งใน server.properties
```

### 6. เพิ่ม Server ใน Admin Panel

1. ไปที่ Admin → จัดการเซิร์ฟเวอร์
2. กด "เพิ่มเซิร์ฟเวอร์"
3. กรอก Host, Port, RCON Port, RCON Password
4. กด "บันทึก"
5. กด **"ตรวจ RCON"** เพื่อทดสอบการเชื่อมต่อ
6. ถ้า badge แสดง **"RCON Online"** = เชื่อมได้แล้ว ✅

### 7. RCON Command Template

ตอนสร้างสินค้า ใช้ตัวแปรเหล่านี้ใน Command:

```
{username}  หรือ  {player}   →  จะถูกแทนด้วย Username ของผู้เล่น
```

ตัวอย่าง:
```
lp user {username} permission set group.vip
give {player} diamond 64
eco give {username} 1000
```

หลายบรรทัดได้ — แต่ละบรรทัด = 1 คำสั่ง

---

## Apply Database Migrations

หลัง `docker compose up` ครั้งแรก `init.sql` จะถูก import อัตโนมัติ
แต่ **Migration** ต้อง apply ด้วยตนเองตามลำดับ:

```bash
# รัน migration ทีละไฟล์ตามลำดับ
for f in migrations/0*.sql; do
  echo "Running $f..."
  cat "$f" | docker exec -i siamworld-mysql mysql -uroot -p${MYSQL_PASSWORD} ${MYSQL_DATABASE}
done
```

หรือรันทีละไฟล์:

```bash
cat migrations/001_add_logs_tables.sql     | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/002_add_downloads.sql       | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/003_add_email_to_users.sql  | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/004_add_redeem_codes.sql    | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/004_fix_downloads_schema.sql| docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/005_add_reward_type_to_codes.sql | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/006_add_mythic_rarity.sql   | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/007_add_lootbox_categories.sql   | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/008_audit_logs.sql          | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/009_add_performance_indexes.sql  | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
cat migrations/010_audit_log_retention.sql | docker exec -i siamworld-mysql mysql -uroot -p<PASSWORD> siamworld
```

> migration ทุกไฟล์เขียนแบบ idempotent (รันซ้ำได้ไม่เสียหาย)

---

## Team Workflow

### Setup ครั้งแรก

```bash
git clone <repo>
cd siamworld-shop
cp .env.example .env     # แก้ค่าใน .env
docker compose up -d     # รัน containers
# Apply migrations (ดูหัวข้อด้านบน)
```

### พัฒนา (Development mode)

```bash
# Backend — hot reload (ต้องมี MySQL + Redis รันอยู่)
cd backend && npm install && npm run dev    # port 4000

# Frontend — hot reload (ต้องมี backend รันอยู่)
cd frontend && npm install && npm run dev  # port 3000

# หรือรัน DB + Redis ผ่าน Docker แล้ว dev backend/frontend นอก Docker:
docker compose up -d mysql redis
```

### Deploy การแก้ไข

```bash
# Backend เปลี่ยน
docker compose build backend
docker compose up -d backend

# Frontend เปลี่ยน (ต้อง rebuild เพราะ Next.js bake env ตอน build)
docker compose build frontend
docker compose up -d frontend

# ทุกอย่าง
docker compose build && docker compose up -d
```

### ดู Logs

```bash
docker compose logs -f backend        # backend real-time
docker compose logs -f backend --tail=50   # ดู 50 บรรทัดล่าสุด
docker compose logs -f                # ทุก service
```

### TypeScript Build Check

```bash
cd backend && npm run build    # ต้องไม่มี error ก่อน deploy
```

### เพิ่ม Migration ใหม่

1. สร้างไฟล์ `migrations/0XX_description.sql`
2. เขียนให้ idempotent (ใช้ `IF NOT EXISTS`, `IF EXISTS`)
3. Apply บน server ด้วยคำสั่งข้างต้น
4. อัปเดต README นี้ในรายการ migration

---

## โครงสร้างโปรเจค

```
siamworld-shop/
├── backend/
│   ├── src/
│   │   ├── config/          # Env validation (zod)
│   │   ├── database/        # MySQL pool, Redis client
│   │   ├── middleware/       # auth, validate, cooldown, errorHandler
│   │   ├── routes/          # Route handlers (얇음 — delegates to services)
│   │   ├── services/        # Business logic ทั้งหมด
│   │   │   ├── auth.service.ts      # Login/Register vs AuthMe MySQL
│   │   │   ├── wallet.service.ts    # FOR UPDATE locking
│   │   │   ├── shop.service.ts      # Purchase + RCON + refund
│   │   │   ├── loot-box.service.ts  # Weighted random + inventory
│   │   │   ├── payment.service.ts   # PromptPay, TrueMoney
│   │   │   ├── rcon-manager.ts      # RCON orchestration
│   │   │   ├── rcon-pool.ts         # Persistent connection pool (1 conn/server)
│   │   │   ├── rcon-queue.ts        # Queued commands + retry + logging
│   │   │   ├── player-tracker.ts    # Polls RCON list every 10s → Redis → WebSocket
│   │   │   ├── audit.service.ts     # Fire-and-forget audit logging
│   │   │   └── settings.service.ts  # Key-value settings from DB
│   │   ├── utils/           # logger, crypto, errors
│   │   └── validators/      # Zod schemas
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # Shared UI
│       ├── context/         # AuthContext, SettingsContext, ThemeContext
│       ├── hooks/           # useOnlinePlayers (WebSocket)
│       └── lib/api.ts       # Axios + JWT injection
├── migrations/              # SQL migration files (apply in order)
├── init.sql                 # Initial schema (auto-loaded by Docker)
├── docker-compose.yml
├── .env.example             # Template — copy to .env
└── README.md
```

---

## Troubleshooting — RCON / Player Tracking

> ปัญหานี้คือสาเหตุที่ทีมเจอบ่อยที่สุด

### ✅ Checklist ก่อนรายงานว่า RCON ใช้ไม่ได้

```
□ enable-rcon=true ใน server.properties
□ rcon.port ตรงกับที่กรอกใน Admin Panel
□ rcon.password ตรงกับที่กรอกใน Admin Panel
□ Minecraft Server ถูก restart หลังแก้ server.properties
□ Port 25575 เปิด Firewall บนเครื่อง Minecraft
□ Web Server เชื่อม Port 25575 บน Minecraft Server ได้
□ Server ถูก "เปิดในระบบ" (ปุ่ม Power บนการ์ดเซิร์ฟเวอร์ = เขียว)
□ กด "ตรวจ RCON" ใน Admin Panel แล้วดู badge
```

### ทดสอบ RCON จากภายนอก

```bash
# ทดสอบว่า Port เปิดอยู่ไหม (จากเครื่อง Web Server)
nc -zv <MINECRAFT_IP> 25575

# ทดสอบ RCON connection (ต้องติดตั้ง mcrcon)
mcrcon -H <MINECRAFT_IP> -P 25575 -p <RCON_PASSWORD> "list"
```

### ดู RCON error จาก backend log

```bash
docker compose logs backend | grep -i rcon
docker compose logs backend | grep -i "connection"
```

### ปัญหา: ส่งของแล้ว ผู้เล่นไม่ได้รับ

1. **ผู้เล่นต้อง online บนเซิร์ฟเวอร์ที่เลือก** ตอนกดซื้อ/redeem — ระบบเช็คก่อนเสมอ
2. ดู RCON response ใน Admin → Audit Log (กรอง `admin_rcon_cmd`)
3. ดู log: `docker compose logs backend | grep "RCON"`
4. ลองส่ง RCON command ตรงจาก Admin Panel → จัดการเซิร์ฟเวอร์ → แก้ไข → ทดสอบ

### ปัญหา: Player Online แสดง 0 ตลอด

1. ตรวจ RCON Health ใน Admin Panel → จัดการเซิร์ฟเวอร์ → กด "ตรวจ RCON"
2. ถ้า badge แดง = RCON เชื่อมไม่ได้ → ดู Checklist ด้านบน
3. ดู log: `docker compose logs backend | grep "player tracker"`
4. Redis TTL 30 วิ — ถ้า backend ไม่ได้รัน tracker จะหมดเอง

### ปัญหา: AuthMe login ไม่ได้

1. ตรวจ AuthMe config ใน Minecraft server — ต้องใช้ MySQL ไม่ใช่ SQLite
2. ตรวจว่า `authme` table มีอยู่ใน Database (`siamworld` schema)
3. ดู: `docker compose logs backend | grep "auth"`

---

## API Routes

ทุก route ขึ้นต้นด้วย `/api`

| Prefix | Auth | คำอธิบาย |
|--------|------|---------|
| `/auth` | — | Login, Register |
| `/user` | JWT | Profile, Inventory, Redeem Code |
| `/wallet` | JWT | Balance, History |
| `/payment` | JWT | PromptPay, TrueMoney |
| `/shop` | JWT | สินค้า, ซื้อ, Loot Box |
| `/admin` | JWT + Admin | ทุกอย่างใน Admin Panel |
| `/public` | — | สินค้าแนะนำ, Server Status (ไม่ต้อง login) |
| `/setup` | — | Initial setup ครั้งแรก |

---

## Security Notes

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/api/auth/*` | 10 req / 15 นาที ต่อ IP |
| `/api/payment/*` | 20 req / 10 นาที ต่อ IP |
| `/api/user/redeem-code` | 5 req / 10 นาที ต่อ IP |
| ทุก route (global) | 300 req / 15 นาที ต่อ IP |

### สิ่งที่ต้องทำก่อน Production

- [ ] ตั้ง `CORS_ORIGIN=https://your-frontend-domain.com` (ไม่ใช่ `*`)
- [ ] ตั้ง `JWT_SECRET` และ `ENCRYPTION_KEY` ให้ยาว 32+ ตัวและไม่ซ้ำกัน
- [ ] ใช้ HTTPS ผ่าน Nginx reverse proxy + Let's Encrypt
- [ ] เปลี่ยน `MYSQL_PASSWORD` จากค่า default

### RCON Password

RCON Password ถูกเข้ารหัส AES ก่อนเก็บ DB — ใช้ `ENCRYPTION_KEY` ในการถอดรหัสตอนส่งคำสั่ง
ถ้าเปลี่ยน `ENCRYPTION_KEY` หลังจากมีเซิร์ฟเวอร์ใน DB แล้ว = ต้องกรอก RCON Password ของทุกเซิร์ฟใหม่

### Audit Log Retention

- Log ทุกประเภท (Login + Admin actions) → ลบอัตโนมัติหลัง **7 วัน** (MySQL Event ทุกคืน 02:00)
- Manual purge: Admin Panel → Audit Log → ปุ่ม "ล้าง Log เก่า" (ลบทันทีสิ่งที่เก่ากว่า 7 วัน)
