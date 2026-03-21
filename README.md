# SiamWorld Shop

ระบบร้านค้าออนไลน์สำหรับ Minecraft Server ที่รองรับหลาย Server พร้อมกัน
ผู้เล่นเข้าสู่ระบบด้วยบัญชี AuthMe, เติมเงินผ่าน PromptPay / TrueMoney และซื้อสินค้า/สิทธิ์ผ่าน RCON

---

## สารบัญ

1. [ข้อกำหนดเบื้องต้น](#ข้อกำหนดเบื้องต้น)
2. [วิธีติดตั้ง — Docker (แนะนำ)](#วิธีติดตั้ง--docker-แนะนำ)
3. [วิธีติดตั้ง — Manual ไม่ใช้ Docker](#วิธีติดตั้ง--manual-ไม่ใช้-docker)
4. [ตั้งค่า Minecraft Server](#ตั้งค่า-minecraft-server)
   - [server.properties](#serverproperties)
   - [AuthMe config.yml](#authme-configyml)
   - [เพิ่ม Server ใน Admin Panel](#เพิ่ม-server-ใน-admin-panel)
5. [ตั้งค่า Admin Panel ครั้งแรก](#ตั้งค่า-admin-panel-ครั้งแรก)
6. [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
7. [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
8. [ฟีเจอร์ทั้งหมด](#ฟีเจอร์ทั้งหมด)
9. [ตัวแปร Environment](#ตัวแปร-environment)
10. [API Routes](#api-routes)
11. [การอัปเดต / Migration](#การอัปเดต--migration)
12. [Troubleshooting](#troubleshooting)

---

## ข้อกำหนดเบื้องต้น

### สำหรับ Web Server (เครื่องที่รันเว็บ)

| ซอฟต์แวร์ | เวอร์ชันขั้นต่ำ | หมายเหตุ |
|-----------|---------------|---------|
| Docker | 24.x ขึ้นไป | สำหรับวิธี Docker |
| Docker Compose | v2.x ขึ้นไป | สำหรับวิธี Docker |
| Node.js | 20 LTS ขึ้นไป | สำหรับวิธี Manual |
| MySQL | 8.0 ขึ้นไป | สำหรับวิธี Manual |
| Redis | 7.x ขึ้นไป | สำหรับวิธี Manual |

### สำหรับ Minecraft Server

| ซอฟต์แวร์ | หมายเหตุ |
|-----------|---------|
| Spigot / Paper 1.8 ขึ้นไป | หรือ Fork อื่นๆ ที่รองรับ AuthMe |
| AuthMe Reloaded 5.6.0 ขึ้นไป | **ต้องตั้งค่าให้ใช้ MySQL storage** (ไม่ใช่ SQLite ค่าเริ่มต้น) |
| RCON เปิดอยู่ | ต้องเปิด `enable-rcon=true` ใน `server.properties` |

---

## วิธีติดตั้ง — Docker (แนะนำ)

วิธีนี้ง่ายที่สุด Docker จะจัดการ MySQL, Redis, Backend และ Frontend ให้ทั้งหมดโดยอัตโนมัติ

### ขั้นตอนที่ 1 — Clone โปรเจค

```bash
git clone https://github.com/yourname/siamworld-shop.git
cd siamworld-shop
```

### ขั้นตอนที่ 2 — สร้างไฟล์ Environment

```bash
cp .env.example .env
```

จากนั้นเปิดและแก้ไขไฟล์ `.env`:

```env
# ── Database ─────────────────────────────────────────────────
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=siamworld
MYSQL_PASSWORD=ใส่_password_ที่แข็งแรง_ที่นี่
MYSQL_DATABASE=siamworld

# ── Redis ────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379

# ── JWT & Encryption ─────────────────────────────────────────
# สองค่านี้ต้องยาวอย่างน้อย 32 ตัวอักษร และต้องไม่ซ้ำกัน
JWT_SECRET=เปลี่ยนเป็น_random_string_ยาวๆ_อย่างน้อย_32_ตัว
ENCRYPTION_KEY=เปลี่ยนเป็น_random_string_อีกอัน_ยาว_32_ตัว

# ── Backend ──────────────────────────────────────────────────
BACKEND_PORT=4000
NODE_ENV=production

# ── Frontend URLs (URL ที่ Browser ของผู้เล่นมองเห็นได้) ────
# ถ้ารันในเครื่องตัวเอง:
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=ws://localhost:4000
# ถ้า Deploy บน VPS (ใช้ IP จริงของ Server):
# NEXT_PUBLIC_API_URL=http://1.2.3.4:4000/api
# NEXT_PUBLIC_WS_URL=ws://1.2.3.4:4000
# ถ้าใช้ Domain + HTTPS:
# NEXT_PUBLIC_API_URL=https://api.siamworld.com/api
# NEXT_PUBLIC_WS_URL=wss://api.siamworld.com

# ── Rate Limiting ────────────────────────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

> **สำคัญ:** `NEXT_PUBLIC_API_URL` และ `NEXT_PUBLIC_WS_URL` ต้องเป็น IP หรือ Domain ที่ **Browser ของผู้เล่นเข้าถึงได้จริง** ไม่ใช่ internal Docker hostname เช่น `backend`

### ขั้นตอนที่ 3 — รัน Docker Compose

```bash
docker compose up -d
```

Docker จะดาวน์โหลด Image และ Build Container ทั้งหมด รอประมาณ 2-5 นาทีในครั้งแรก

### ขั้นตอนที่ 4 — ตรวจสอบสถานะ Container

```bash
docker compose ps
```

Container ทั้ง 5 ตัวต้องมีสถานะ `running`:

| Container | Port | คำอธิบาย |
|-----------|------|---------|
| `siamworld-mysql` | 3306 | MySQL Database |
| `siamworld-redis` | 6379 | Redis Cache |
| `siamworld-backend` | 4000 | Backend API |
| `siamworld-frontend` | 3000 | หน้าเว็บ |
| `siamworld-phpmyadmin` | 8080 | จัดการ Database |

### ขั้นตอนที่ 5 — ดู Log หากมีปัญหา

```bash
# ดู log ทุก service
docker compose logs -f

# ดูเฉพาะ backend
docker compose logs -f backend

# ดูเฉพาะ frontend
docker compose logs -f frontend
```

---

## วิธีติดตั้ง — Manual ไม่ใช้ Docker

ใช้กรณีที่มี MySQL และ Redis ติดตั้งไว้แล้วในเครื่อง หรือต้องการ Deploy บน Server โดยตรง

### ขั้นตอนที่ 1 — เตรียม MySQL Database

```sql
-- รัน SQL นี้ใน MySQL ก่อน
CREATE DATABASE siamworld CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'siamworld'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON siamworld.* TO 'siamworld'@'%';
FLUSH PRIVILEGES;
```

Import Schema หลัก:

```bash
mysql -u siamworld -p siamworld < init.sql
```

Apply Migration ทั้งหมดตามลำดับ:

```bash
mysql -u siamworld -p siamworld < migrations/001_add_logs_tables.sql
mysql -u siamworld -p siamworld < migrations/002_add_downloads.sql
mysql -u siamworld -p siamworld < migrations/003_add_email_to_users.sql
mysql -u siamworld -p siamworld < migrations/004_add_redeem_codes.sql
mysql -u siamworld -p siamworld < migrations/004_fix_downloads_schema.sql
mysql -u siamworld -p siamworld < migrations/005_add_reward_type_to_codes.sql
```

### ขั้นตอนที่ 2 — ตั้งค่า Environment

```bash
cp .env.example .env
# แก้ไข .env:
# MYSQL_HOST=localhost
# REDIS_HOST=localhost
```

### ขั้นตอนที่ 3 — รัน Backend

```bash
cd backend
npm install

# Development (Hot reload)
npm run dev

# Production
npm run build
npm start
```

Backend รันที่ `http://localhost:4000`

### ขั้นตอนที่ 4 — รัน Frontend

```bash
cd frontend
npm install

# Development
npm run dev

# Production (ต้อง Build ก่อน เพราะ NEXT_PUBLIC_* ถูก Embed ตอน Build)
npm run build
npm start
```

Frontend รันที่ `http://localhost:3000`

---

## ตั้งค่า Minecraft Server

ส่วนนี้สำคัญมาก ต้องแก้ไขทั้งฝั่ง Minecraft Server และ AuthMe Plugin ให้ถูกต้อง มิฉะนั้นผู้เล่น Login ไม่ได้และระบบส่งของไม่ได้

---

### server.properties

เปิดไฟล์ `server.properties` ในโฟลเดอร์ Minecraft Server แล้วแก้ไขค่าต่อไปนี้:

```properties
# ── เปิดใช้งาน RCON (จำเป็นสำหรับส่งของ/คำสั่งอัตโนมัติ) ───
enable-rcon=true

# ── RCON Port ────────────────────────────────────────────────
# ค่าเริ่มต้นคือ 25575 เปลี่ยนได้ถ้าต้องการ
rcon.port=25575

# ── RCON Password ────────────────────────────────────────────
# ตั้งให้แข็งแรง ต้องตรงกับที่กรอกใน Admin Panel ทุกตัวอักษร
rcon.password=ตั้ง_password_ที่แข็งแรงที่นี่

# ── Online Mode ──────────────────────────────────────────────
# Cracked Server (ใช้ AuthMe) ต้องปิด online-mode
online-mode=false

# ── Server IP ────────────────────────────────────────────────
# ปล่อยว่างเพื่อ Bind ทุก Interface หรือระบุ IP เฉพาะได้
server-ip=
```

> **หมายเหตุ:**
> - หลังแก้ไข `server.properties` ต้อง **Restart Minecraft Server** ทุกครั้ง
> - Port 25575 (RCON) ต้องเปิดใน Firewall หากเว็บ Server กับ Minecraft Server อยู่คนละเครื่อง
> - ห้าม Expose Port RCON ออก Public Internet โดยตรง ควรใช้ Firewall จำกัดให้เฉพาะ IP ของ Web Server

**ทดสอบว่า RCON ทำงาน (Linux):**

```bash
# ติดตั้ง mcrcon แล้วทดสอบ
mcrcon -H IP_MINECRAFT_SERVER -P 25575 -p rcon_password "list"
# ถ้าเห็นรายชื่อผู้เล่นหรือ "There are 0 of..." แสดงว่าทำงานได้
```

---

### AuthMe config.yml

AuthMe ต้องตั้งค่าให้ใช้ **MySQL** เป็น Storage Backend แทน SQLite (ค่าเริ่มต้น) เพื่อให้เว็บสามารถตรวจสอบรหัสผ่านผู้เล่นได้ โดยใช้ Database เดียวกันกับเว็บ

เปิดไฟล์ `plugins/AuthMe/config.yml` แล้วแก้ไขส่วนต่างๆ ดังนี้:

#### 1. เปลี่ยน DataSource เป็น MySQL

```yaml
DataSource:
  # เปลี่ยนจาก SQLITE เป็น MYSQL
  backend: MYSQL

  # ── การเชื่อมต่อ MySQL ────────────────────────────────────
  # ถ้า Minecraft Server และ MySQL อยู่เครื่องเดียวกัน:
  mySQLHost: 127.0.0.1
  # ถ้า MySQL อยู่คนละเครื่อง ใส่ IP ของเครื่องที่รัน MySQL:
  # mySQLHost: 1.2.3.4

  mySQLPort: 3306
  mySQLUsername: siamworld
  mySQLPassword: password_เดียวกับที่ตั้งใน_.env
  mySQLDatabase: siamworld

  # ── ชื่อตารางและคอลัมน์ (ห้ามเปลี่ยน ต้องตรงตามนี้) ─────
  mySQLTablename: authme
  mySQLColumnName: username
  mySQLColumnPassword: password
  mySQLColumnIp: ip
  mySQLColumnLastLogin: lastlogin
  mySQLColumnSalt: ''
  mySQLColumnGroup: ''
  mySQLColumnEmail: email
  mySQLColumnRealName: realname
  mySQLColumnLogged: isLogged
  mySQLColumnHasSession: hasSession
  mySQLColumnRegDate: regdate
  mySQLColumnRegIp: regip
  mySQLColumnLocX: x
  mySQLColumnLocY: y
  mySQLColumnLocZ: z
  mySQLColumnLocWorld: world
  mySQLColumnLocYaw: yaw
  mySQLColumnLocPitch: pitch
  mySQLColumnLastIp: ''
  mySQLColumnTotp: totp
```

#### 2. ตั้งค่า Hashing Algorithm เป็น BCRYPT

```yaml
security:
  # ต้องเป็น BCRYPT เท่านั้น ระบบเว็บรองรับเฉพาะ bcrypt
  passwordHash: BCRYPT

  # จำนวนรอบ bcrypt — 10 เหมาะสมดี (สูงขึ้น = ปลอดภัยขึ้นแต่ช้าขึ้น)
  bCryptLog2Round: 10
  legacyMigration: true #ถ้าต้องการให้ password เก่า(SHA256) ยังล็อคอินได้
```

> **สำคัญมาก:** `passwordHash` ต้องตั้งเป็น `BCRYPT` ตั้งแต่เริ่มต้น
> ถ้าเคยใช้ Algorithm อื่นมาก่อน (เช่น SHA256) รหัสผ่านเก่าจะเข้าสู่ระบบไม่ได้
> ต้องให้ผู้เล่น `/changepassword` ทุกคน

#### 3. การตั้งค่าอื่นๆ ที่แนะนำ

```yaml
settings:
  sessions:
    # ปิด Session เพื่อให้ Login ทุกครั้งที่เข้า Server (ปลอดภัยกว่า)
    enabled: false

  restrictions:
    # จำกัดตัวอักษรชื่อผู้เล่น (ป้องกันชื่อแปลกๆ)
    allowedNicknameCharacters: '[a-zA-Z0-9_]*'
    maxNicknameLength: 16
    minPasswordLength: 5

Email:
  # ปิดถ้าไม่ได้ใช้งาน Email verification
  recallPlayers: false
```

#### 4. รีโหลด AuthMe หลังแก้ไข

```
# พิมพ์ใน Minecraft Console หรือ RCON
/authme reload
```

หรือ Restart Minecraft Server

---

### เพิ่ม Server ใน Admin Panel

หลังจากตั้งค่า Minecraft Server เสร็จ ให้เพิ่ม Server ใน Admin Panel เพื่อให้ระบบเชื่อมต่อ RCON ได้:

1. เปิด `http://localhost:3000/admin` แล้ว Login ด้วยบัญชี Admin
2. ไปที่ **Admin Panel → จัดการ Server**
3. กด **เพิ่ม Server ใหม่**
4. กรอกข้อมูล:

| ช่อง | ตัวอย่าง | คำอธิบาย |
|------|---------|---------|
| ชื่อ Server | `SiamWorld Main` | ชื่อที่แสดงในเว็บ |
| Host | `play.siamworld.com` หรือ `1.2.3.4` | IP หรือ Domain ของ Minecraft Server |
| Minecraft Port | `25565` | Port ปกติของ Minecraft |
| RCON Port | `25575` | ต้องตรงกับ `rcon.port` ใน server.properties |
| RCON Password | `...` | ต้องตรงกับ `rcon.password` ใน server.properties |

5. กด **ทดสอบการเชื่อมต่อ** ต้องขึ้นว่า "เชื่อมต่อสำเร็จ" ก่อน Save

---

## ตั้งค่า Admin Panel ครั้งแรก

หลังจากรันระบบสำเร็จ จะยังไม่มี Admin Account เลย ต้องสร้างผ่านหน้า Setup ก่อน

### ขั้นตอนที่ 1 — เปิดหน้า Setup

```
http://localhost:3000/setup
```

> หน้านี้จะถูกปิดอัตโนมัติหลังจากสร้าง Admin Account สำเร็จแล้ว

### ขั้นตอนที่ 2 — สร้าง Admin Account

1. กรอก **ชื่อผู้ใช้** — ต้องตรงกับชื่อใน Minecraft ทุกตัวอักษร (Case-sensitive)
2. กรอก **รหัสผ่าน**
3. กด **สร้าง Admin**

ระบบจะสร้าง Record ในตาราง `authme` (Minecraft) และ `users` (เว็บ) พร้อมกัน

### ขั้นตอนที่ 3 — เข้า Admin Panel และตั้งค่าพื้นฐาน

เข้าที่ `http://localhost:3000/admin` แล้วตั้งค่าตามลำดับ:

1. **ตั้งค่าทั่วไป** — ชื่อร้าน, สกุลเงิน, Banner Slides
2. **จัดการ Server** — เพิ่ม Minecraft Server + RCON (ดูหัวข้อด้านบน)
3. **ร้านค้า** — สร้างหมวดหมู่ → เพิ่มสินค้า → กำหนด RCON Command
4. **กล่องสุ่ม** — สร้างกล่อง → เพิ่มไอเทม → กำหนด Rarity และ Weight

---

## โครงสร้างโปรเจค

```
siamworld-shop/
│
├── backend/                        # Node.js + Express API Server
│   └── src/
│       ├── config/index.ts         # โหลดและ Validate Environment Variables
│       ├── database/
│       │   ├── connection.ts       # MySQL Connection Pool (20 connections)
│       │   └── redis.ts            # Redis Client Singleton
│       ├── middleware/
│       │   ├── auth.ts             # JWT Verification + RBAC (requireAuth, requireAdmin)
│       │   ├── cooldown.ts         # Per-user Cooldown (ซื้อ 5s, กล่องสุ่ม 3s)
│       │   └── validate.ts         # Zod Schema Middleware
│       ├── routes/                 # HTTP Route Handlers (얇음, delegates to services)
│       │   ├── auth.routes.ts
│       │   ├── user.routes.ts
│       │   ├── wallet.routes.ts
│       │   ├── shop.routes.ts
│       │   ├── payment.routes.ts
│       │   ├── public.routes.ts
│       │   ├── admin.routes.ts
│       │   └── setup.routes.ts
│       ├── services/               # Business Logic ทั้งหมดอยู่ที่นี่
│       │   ├── auth.service.ts         # Register/Login ผ่าน AuthMe bcrypt
│       │   ├── wallet.service.ts       # Balance + Transaction (ใช้ FOR UPDATE)
│       │   ├── shop.service.ts         # ซื้อสินค้า: idempotency → online check → RCON
│       │   ├── loot-box.service.ts     # Weighted random + inventory tracking
│       │   ├── payment.service.ts      # PromptPay QR + TrueMoney Gift Card
│       │   ├── rcon-manager.ts         # RCON Connection Pool ต่อ Server
│       │   ├── rcon-queue.ts           # Queue + Retry + Logging RCON Commands
│       │   ├── player-tracker.ts       # Poll /list ทุก 10s → Redis → WebSocket
│       │   ├── settings.service.ts     # Key-value Store จากตาราง settings
│       │   ├── admin-stats.service.ts  # Dashboard Statistics
│       │   └── setup.service.ts        # สร้าง Admin Account ครั้งแรก
│       ├── utils/
│       │   └── crypto.ts           # AES-256 Encryption สำหรับ RCON Password
│       └── validators/
│           └── schemas.ts          # Zod Request Schemas ทั้งหมด
│
├── frontend/                       # Next.js 14 App Router
│   └── src/
│       ├── app/
│       │   ├── page.tsx            # หน้าแรก Showcase + Server Status
│       │   ├── shop/               # ร้านค้าสินค้า (ซื้อ Item / Permission)
│       │   ├── lootbox/            # หน้าเปิดกล่องสุ่ม
│       │   ├── topup/              # หน้าเติมเงิน (PromptPay + TrueMoney)
│       │   ├── redeem/             # กรอกโค้ดรับ Point หรือ RCON
│       │   ├── inventory/          # ของรางวัลที่ยังไม่ได้รับ
│       │   ├── profile/            # โปรไฟล์ + ประวัติทุกอย่าง
│       │   ├── download/           # ดาวน์โหลดไฟล์ Mod / ResourcePack
│       │   └── admin/              # Admin Panel
│       │       ├── page.tsx        # Dashboard + สถิติ
│       │       ├── users/          # จัดการสมาชิก
│       │       ├── products/       # จัดการสินค้า
│       │       ├── lootboxes/      # จัดการกล่องสุ่ม
│       │       ├── servers/        # จัดการ Server + RCON
│       │       ├── codes/          # จัดการโค้ดรับรางวัล
│       │       ├── payments/       # ประวัติการชำระเงิน
│       │       └── settings/       # ตั้งค่าระบบ
│       ├── context/
│       │   ├── AuthContext.tsx     # JWT Token Storage + User State
│       │   ├── SettingsContext.tsx # ค่า Config ร้านค้า (ชื่อ, สกุลเงิน)
│       │   └── ThemeContext.tsx    # Dark / Light Mode
│       ├── components/             # Shared UI Components
│       └── lib/
│           └── api.ts              # Axios Instance + JWT Auto-inject
│
├── migrations/                     # SQL Migration Files (ใช้หลัง init.sql)
│   ├── 001_add_logs_tables.sql
│   ├── 002_add_downloads.sql
│   ├── 003_add_email_to_users.sql
│   ├── 004_add_redeem_codes.sql
│   ├── 004_fix_downloads_schema.sql
│   └── 005_add_reward_type_to_codes.sql
│
├── init.sql                        # Database Schema เริ่มต้น (โหลดอัตโนมัติโดย Docker)
├── docker-compose.yml              # Docker Services Configuration
└── .env.example                    # Template ตัวแปร Environment
```

---

## เทคโนโลยีที่ใช้

### Backend

| Package | Version | บทบาท |
|---------|---------|------|
| Node.js | 20 LTS | JavaScript Runtime |
| Express | 4.x | HTTP Web Framework |
| TypeScript | 5.x | Static Type Checking |
| mysql2 | 3.x | MySQL Driver + Connection Pool (20 connections) |
| ioredis | 5.x | Redis Client (Cache + Player Online Status) |
| socket.io | 4.x | WebSocket Server (Real-time Player Tracking) |
| jsonwebtoken | 9.x | JWT Sign / Verify |
| bcrypt | 5.x | Password Hash Verification (AuthMe compatible) |
| rcon-client | 4.x | Minecraft RCON Protocol |
| zod | 3.x | Request Schema Validation |
| helmet | 7.x | HTTP Security Headers |
| express-rate-limit | 7.x | API Rate Limiting |
| uuid | 10.x | Idempotency Key Generation |

### Frontend

| Package | Version | บทบาท |
|---------|---------|------|
| Next.js | 14.x | React Framework (App Router) |
| React | 18.x | UI Library |
| TypeScript | 5.x | Static Type Checking |
| TailwindCSS | 3.x | Utility-first CSS Framework |
| socket.io-client | 4.x | WebSocket Client (Real-time) |
| Framer Motion | 12.x | Animation Library |
| next-themes | 0.4.x | Dark / Light Mode |
| Font Awesome | 6.x (CDN) | Icon Library |

### Infrastructure

| Service | Image | บทบาท |
|---------|-------|------|
| MySQL | `mysql:8.0` | Primary Database |
| Redis | `redis:7-alpine` | Cache + Player Online State |
| phpMyAdmin | `phpmyadmin:latest` | Database Management UI (Port 8080) |
| Docker Compose | v2 | Container Orchestration |

---

## ฟีเจอร์ทั้งหมด

### ระบบสำหรับผู้เล่น

| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Login / Register** | ใช้บัญชี AuthMe (Minecraft) เข้าสู่ระบบโดยตรง ไม่ต้องสร้าง Account ใหม่ |
| **Wallet** | กระเป๋าเงินส่วนตัว ดูยอดคงเหลือ ประวัติ Transaction ทุกรายการ |
| **เติมเงิน PromptPay** | สร้าง QR Code พร้อมเพย์ แอดมิน Confirm เงินเข้า Wallet อัตโนมัติ |
| **เติมเงิน TrueMoney** | วาง Gift Voucher Link ระบบตรวจสอบและเติมเงินอัตโนมัติ |
| **ร้านค้าสินค้า** | ซื้อ Item / Permission / สิทธิ์ต่างๆ ด้วยเงิน Wallet ส่งผ่าน RCON ทันที |
| **ตรวจสอบ Online** | ระบบตรวจสอบว่าผู้เล่น Online อยู่ใน Server ก่อนอนุญาตซื้อทุกครั้ง |
| **กล่องสุ่ม (Gacha)** | เปิดกล่องสุ่ม ระบบสุ่มตาม Rarity Weight ส่งของผ่าน RCON ทันที |
| **Inventory** | เก็บรางวัลที่ยังไม่ได้รับ กด Redeem เมื่อ Online เพื่อรับของ |
| **โค้ดรับรางวัล** | กรอกโค้ดเพื่อรับ Point เข้า Wallet หรือ Execute RCON Command |
| **โปรไฟล์** | ดูข้อมูล ประวัติซื้อสินค้า ประวัติเติมเงิน ประวัติโค้ด |
| **ดาวน์โหลด** | หน้าดาวน์โหลดไฟล์ (Mod, Resource Pack, Client ฯลฯ) |

### ระบบ Admin Panel

| หมวด | ฟีเจอร์ |
|------|--------|
| **Dashboard** | สถิติรวม ยอดขายวันนี้/เดือนนี้ จำนวนสมาชิก กราฟรายได้ |
| **จัดการสมาชิก** | ค้นหา เปลี่ยน Role ดูยอดเงิน เข้าหน้าจัดการเต็มของสมาชิก |
| **จัดการสมาชิก (เต็ม)** | แก้ไขข้อมูล เติม/หักยอดเงิน ดูประวัติซื้อ เติมเงิน และโค้ด |
| **ร้านค้าสินค้า** | เพิ่ม/แก้ไข/ลบสินค้า กำหนด RCON Command ต่อ Server กำหนดราคา |
| **กล่องสุ่ม** | สร้างกล่อง เพิ่มไอเทม กำหนด Rarity + Weight ดู % โอกาสสุ่ม |
| **จัดการ Server** | เพิ่ม Minecraft Server หลายเครื่อง ตั้งค่า RCON ทดสอบการเชื่อมต่อ |
| **โค้ดรับรางวัล** | สร้างโค้ด Point/RCON จำกัดจำนวนการใช้ ตั้งวันหมดอายุ |
| **ประวัติชำระเงิน** | ดูและ Confirm PromptPay, ประวัติ TrueMoney ทุกรายการ |
| **Slides / Banner** | จัดการ Banner Slide หน้าแรก ลำดับแสดง |
| **ดาวน์โหลด** | จัดการไฟล์ดาวน์โหลด ใส่ Link และรายละเอียด |
| **ตั้งค่าระบบ** | ชื่อร้าน, สกุลเงิน, ตั้งค่าต่างๆ |

### ระบบ RCON

| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Connection Pool** | เชื่อมต่อ RCON แบบ Pool ต่อ Server ลด Overhead การสร้าง Connection ซ้ำ |
| **Queue + Retry** | คำสั่งที่ล้มเหลวจะ Retry อัตโนมัติ 3 ครั้งก่อน Fail |
| **Auto-refund** | ถ้า RCON ล้มเหลวทั้งหมด ระบบคืนเงิน Wallet อัตโนมัติ |
| **Player Tracker** | Poll คำสั่ง `list` ทุก 10 วินาที Cache ใน Redis Broadcast ผ่าน WebSocket |
| **Encrypted Password** | รหัสผ่าน RCON เข้ารหัส AES-256 ก่อนเก็บใน Database ไม่โชว์ใน Log |
| **RCON Logs** | บันทึกทุกคำสั่งที่ส่ง ผลลัพธ์ และจำนวน Attempt ใน Database |

---

## ตัวแปร Environment

| ตัวแปร | ค่าตัวอย่าง | จำเป็น | คำอธิบาย |
|--------|-----------|:------:|---------|
| `MYSQL_HOST` | `mysql` | ✅ | Host MySQL (`mysql` ใน Docker, `localhost` ใน Manual) |
| `MYSQL_PORT` | `3306` | ✅ | Port MySQL |
| `MYSQL_USER` | `siamworld` | ✅ | Username MySQL |
| `MYSQL_PASSWORD` | `StrongPass123!` | ✅ | Password MySQL |
| `MYSQL_DATABASE` | `siamworld` | ✅ | ชื่อ Database |
| `REDIS_HOST` | `redis` | ✅ | Host Redis (`redis` ใน Docker, `localhost` ใน Manual) |
| `REDIS_PORT` | `6379` | ✅ | Port Redis |
| `JWT_SECRET` | `random-32-chars` | ✅ | Secret สำหรับ Sign JWT Token (min 32 ตัว) |
| `ENCRYPTION_KEY` | `another-32-chars` | ✅ | Key เข้ารหัส RCON Password (min 32 ตัว, ต่างจาก JWT_SECRET) |
| `BACKEND_PORT` | `4000` | ✅ | Port ของ Backend API |
| `NODE_ENV` | `production` | ✅ | Environment Mode |
| `NEXT_PUBLIC_API_URL` | `http://1.2.3.4:4000/api` | ✅ | URL API ที่ Browser เข้าถึงได้ |
| `NEXT_PUBLIC_WS_URL` | `ws://1.2.3.4:4000` | ✅ | URL WebSocket ที่ Browser เข้าถึงได้ |
| `RATE_LIMIT_WINDOW_MS` | `900000` | ❌ | ระยะเวลา Rate Limit (ms) ค่าเริ่มต้น 15 นาที |
| `RATE_LIMIT_MAX` | `100` | ❌ | จำนวน Request สูงสุดต่อ Window |

---

## API Routes

ทุก Route มี Prefix `/api`

| Method | Route | Auth | คำอธิบาย |
|--------|-------|:----:|---------|
| POST | `/auth/register` | — | สมัครสมาชิก |
| POST | `/auth/login` | — | Login รับ JWT Token |
| GET | `/user/profile` | JWT | ดูโปรไฟล์ตัวเอง |
| GET | `/wallet/balance` | JWT | ดูยอดเงินคงเหลือ |
| GET | `/wallet/transactions` | JWT | ประวัติ Transaction |
| POST | `/wallet/redeem` | JWT | กรอกโค้ดรับรางวัล |
| GET | `/shop/products` | JWT | ดูสินค้าทั้งหมด |
| POST | `/shop/purchase` | JWT | ซื้อสินค้า |
| GET | `/shop/lootboxes` | JWT | ดูกล่องสุ่ม |
| POST | `/shop/lootboxes/:id/open` | JWT | เปิดกล่องสุ่ม |
| GET | `/shop/inventory` | JWT | ดู Inventory (ของที่ยังไม่ได้รับ) |
| POST | `/shop/inventory/:id/redeem` | JWT | Redeem ของใน Inventory |
| POST | `/payment/promptpay/create` | JWT | สร้าง QR PromptPay |
| POST | `/payment/promptpay/confirm` | JWT | ยืนยันการชำระ PromptPay |
| POST | `/payment/truemoney/redeem` | JWT | Redeem TrueMoney Gift Voucher |
| GET | `/public/slides` | — | Banner Slides หน้าแรก |
| GET | `/public/featured` | — | สินค้า Featured |
| GET | `/public/server-status` | — | สถานะ Server + จำนวนผู้เล่น Online |
| GET | `/admin/*` | JWT + Admin | ทุก Admin Endpoint |
| POST | `/setup` | — (ครั้งแรกเท่านั้น) | สร้าง Admin Account แรก |

---

## การอัปเดต / Migration

เมื่อ Pull Code ใหม่และมี Migration File ใหม่ใน `/migrations/`:

### Docker

```bash
# วิธีที่ 1: ผ่าน Docker exec
docker exec -i siamworld-mysql mysql -u root -p${MYSQL_PASSWORD} siamworld < migrations/006_xxx.sql

# วิธีที่ 2: ผ่าน phpMyAdmin ที่ http://localhost:8080

# Rebuild และ Restart หลัง Update Code
docker compose up -d --build
```

### Manual

```bash
mysql -u siamworld -p siamworld < migrations/006_xxx.sql

# Restart Backend
cd backend && npm run build
# pm2 restart all  (ถ้าใช้ pm2)
```

---

## Troubleshooting

### Backend เชื่อมต่อ MySQL ไม่ได้

```bash
# ตรวจสอบสถานะ Container
docker compose ps

# ดู Log MySQL
docker compose logs mysql

# ตรวจสอบ Healthcheck
docker inspect siamworld-mysql --format='{{json .State.Health}}'
```

สาเหตุที่พบบ่อย:
- `MYSQL_PASSWORD` ใน `.env` ไม่ตรงกัน
- MySQL ยังไม่พร้อม รอ 30–60 วินาทีหลัง `docker compose up`

---

### RCON เชื่อมต่อไม่ได้

ตรวจสอบตามลำดับ:

1. `server.properties` มี `enable-rcon=true` และ Restart Server แล้ว
2. `rcon.port` และ `rcon.password` ใน Admin Panel ตรงกับใน `server.properties`
3. Firewall เปิด Port 25575 ระหว่าง Web Server และ Minecraft Server
4. ทดสอบ Port เปิดอยู่:
   ```bash
   nc -zv IP_MINECRAFT_SERVER 25575
   ```

---

### Login ด้วยบัญชี AuthMe ไม่ได้

ตรวจสอบตามลำดับ:

1. AuthMe ใช้ `backend: MYSQL` ไม่ใช่ `SQLITE`
2. MySQL Credentials ใน `plugins/AuthMe/config.yml` ชี้ไปยัง Database เดียวกับเว็บ
3. `passwordHash: BCRYPT` ใน AuthMe config
4. ตรวจสอบข้อมูลในตาราง:
   ```sql
   SELECT username, LEFT(password, 10) as pw_prefix FROM authme LIMIT 5;
   -- รหัสผ่านต้องขึ้นต้นด้วย $2a$ (bcrypt format)
   ```

---

### หน้าเว็บขึ้น Error เชื่อมต่อ API ไม่ได้

ตรวจสอบ `NEXT_PUBLIC_API_URL` ใน `.env`:

- ต้องเป็น IP/Domain ที่ Browser ของผู้ใช้เข้าถึงได้
- **ผิด:** `http://backend:4000/api` (Docker internal hostname)
- **ถูก:** `http://1.2.3.4:4000/api`

หลังแก้ `.env` ต้อง Build Frontend ใหม่:

```bash
docker compose up -d --build frontend
```

---

### Player Tracker ไม่แสดงสถานะ Online

1. ตรวจสอบ RCON เชื่อมต่อได้ใน Admin Panel → จัดการ Server
2. ตรวจสอบ Redis ทำงาน: `docker compose ps redis`
3. ดู Log Backend:
   ```bash
   docker compose logs backend | grep -i "tracker\|rcon\|player"
   ```

---

### Reset ทั้งหมด (ล้าง Data)

> **⚠️ คำเตือน:** คำสั่งนี้จะ **ลบข้อมูลทั้งหมด** รวมถึงสมาชิก ยอดเงิน และ Transaction

```bash
docker compose down -v   # ลบ Container + Volume
docker compose up -d     # สร้างใหม่ทั้งหมด
```

---

## Port Summary

| Port | Service | หมายเหตุ |
|------|---------|---------|
| `3000` | Frontend (Next.js) | หน้าเว็บผู้เล่น + Admin Panel |
| `4000` | Backend (Express API) | REST API + WebSocket |
| `3306` | MySQL | ปิดใน Production |
| `6379` | Redis | ปิดใน Production |
| `8080` | phpMyAdmin | ปิดใน Production |
| `25565` | Minecraft Game Port | เครื่อง Minecraft Server |
| `25575` | Minecraft RCON Port | เครื่อง Minecraft Server |

> **Production:** เปิดเฉพาะ Port 3000 และ 4000 (หรือผ่าน Reverse Proxy 80/443)
> ปิด Port 3306, 6379 และ 8080 ไม่ให้เข้าถึงจาก Public Internet
