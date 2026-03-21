# 🌏 SiamWorld Shop

ระบบร้านค้าออนไลน์สำหรับเซิร์ฟเวอร์ Minecraft ที่เชื่อมต่อกับปลั๊กอิน **AuthMe** โดยตรง  
ผู้เล่นสามารถ Login ด้วยบัญชีในเกม เติมเงิน ซื้อไอเทม เปิดลุ้นกล่องสุ่ม และผู้ดูแลสามารถจัดการทุกอย่างผ่าน Admin Dashboard

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?logo=mysql)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 🔐 **ระบบล็อกอิน** | ใช้บัญชี Minecraft (AuthMe) เข้าสู่ระบบได้เลย |
| 💰 **Wallet** | ระบบกระเป๋าเงิน เติมเงิน ดูประวัติธุรกรรม |
| 🛒 **ร้านค้า** | ซื้อไอเทม/สิทธิ์ในเกม ส่งผ่าน RCON อัตโนมัติ |
| 🎁 **กล่องสุ่ม (Loot Box)** | สุ่มรางวัลแบบ Weighted Random บน Server |
| 💳 **ชำระเงิน** | รองรับ PromptPay และ TrueMoney Gift Card |
| 🖥️ **Multi-Server** | จัดการหลายเซิร์ฟเวอร์ผ่าน RCON Pool |
| 👑 **Admin Dashboard** | จัดการสินค้า, ผู้ใช้, เซิร์ฟเวอร์, สไลด์, ตั้งค่าระบบ |
| 📊 **Real-time Stats** | ดูจำนวนผู้เล่นออนไลน์แบบ Real-time ผ่าน WebSocket |

---

## 🛠️ Tech Stack

| Layer | Technology |

# SiamWorld Shop

SiamWorld Shop เป็นแพลตฟอร์ม e-commerce สำหรับ Minecraft server แบบครบวงจร ผู้เล่นล็อกอินด้วยบัญชี AuthMe ในเกม เติมเงินเข้ากระเป๋า ซื้อไอเทมหรือ permission (ส่งผ่าน RCON) และเปิดกล่องสุ่ม (loot box) ฝั่งแอดมินมี dashboard สำหรับจัดการทุกอย่าง

## Features
- ล็อกอินด้วย AuthMe (ไม่ซ้ำรหัสผ่าน)
- เติมเงิน/ดูประวัติธุรกรรม
- ร้านค้า: ซื้อไอเทม, permission, loot box
- ส่งไอเทมผ่าน RCON แบบ real-time
- Dashboard แอดมิน: จัดการสินค้า, ผู้ใช้, server, ตั้งค่า
- รองรับ PromptPay QR, TrueMoney

## วิธีติดตั้ง (Dev/Local)

### 1. Clone โปรเจค
```bash
git clone <your-repo-url>
cd siamworld_shop
```

### 2. ตั้งค่า environment
```bash
cp .env.example .env
# เปิด .env แล้วกรอกค่าตามคอมเมนต์
```

### 3. รันทุก service ด้วย Docker Compose (แนะนำ)
```bash
docker-compose up -d
```
จะได้ MySQL, Redis, backend (Node.js), frontend (Next.js), phpMyAdmin ครบ

### 4. เข้าใช้งาน
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- phpMyAdmin: http://localhost:8080

### 5. (ทางเลือก) รัน backend/frontend แยก
- Backend: `cd backend && npm install && npm run dev`
- Frontend: `cd frontend && npm install && npm run dev`

## โครงสร้างโปรเจค
- `backend/` — Node.js + Express + TypeScript API
- `frontend/` — Next.js 14 + TailwindCSS web app
- `migrations/` — SQL migration scripts
- `init.sql` — สร้าง schema เริ่มต้น

## Database
- MySQL 8.0 (port 3306)
- Redis 7 (port 6379)

## Environment Variables
- Copy `.env.example` ไป `.env` แล้วกรอกให้ครบ
- สำคัญ: `JWT_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`

## หมายเหตุ
- **ห้าม** commit `.env` หรือ secrets ใดๆ
- **ห้าม** commit `package-lock.json` (ใช้ `npm install` สร้างเอง)
- ignore `.agents/` และ `CLAUDE.md`

## License
MIT
cd siamworld_shop
cp .env.example .env
```

Edit `.env` and set secure values for:
- `MYSQL_PASSWORD` — strong database password
```bash
cp .env.example .env
# แก้ไขค่าใน .env ตามต้องการ
```

ตัวอย่างไฟล์ `.env`:

```env
# ── Database ──────────────────────────────
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_strong_password
MYSQL_DATABASE=siamworld

# ── Redis ─────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379

# ── JWT (เปลี่ยนเป็น string สุ่มยาวอย่างน้อย 32 ตัวอักษร) ──
JWT_SECRET=your_very_long_random_secret_key_here_32chars
JWT_EXPIRES_IN=24h

# ── Backend ───────────────────────────────
BACKEND_PORT=4000
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000

# ── Frontend ──────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=ws://localhost:4000

# ── Encryption (optional, สำหรับเข้ารหัส RCON password) ──
ENCRYPTION_KEY=your_32_char_encryption_key_here!!

# ── Rate Limiting ─────────────────────────
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

**3. รัน Docker Compose**

```bash
docker-compose up --build -d
```

**4. เปิดในเบราว์เซอร์**

| บริการ | URL |
|--------|-----|
| 🌐 Frontend | http://localhost:3000 |
| ⚙️ Backend API | http://localhost:4000/api |
| 🗄️ phpMyAdmin | http://localhost:8080 |

> **บัญชีทดสอบ (init.sql):** `admin` / `admin123`  
> ⚠️ เปลี่ยน password ทันทีก่อนใช้งานจริง

**5. หยุด / ลบ containers**

```bash
# หยุดชั่วคราว
docker-compose stop

# หยุดและลบ containers (ข้อมูลใน volume ยังอยู่)
docker-compose down

# ลบทุกอย่างรวม volume (ข้อมูลหาย!)
docker-compose down -v
```

---

## 🔧 วิธีติดตั้งแบบ Development (ไม่ใช้ Docker)

### ข้อกำหนด

- **Node.js** 20+
- **MySQL** 8.0+
- **Redis** 7+

### ขั้นตอน

**1. ตั้งค่า Database**

```bash
# นำเข้า schema เริ่มต้น
mysql -u root -p < init.sql
mysql -u root -p < migrations/001_add_logs_tables.sql
```

**2. รัน Backend**

```bash
cd backend
npm install
cp ../.env .env       # หรือสร้าง .env ใน folder backend
npm run dev           # Dev server ที่ port 4000
```

**3. รัน Frontend**

```bash
cd frontend
npm install
npm run dev           # Next.js ที่ port 3000
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| `POST` | `/api/auth/login` | เข้าสู่ระบบด้วยบัญชี Minecraft (AuthMe) |

### User
| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|---------|
| `GET` | `/api/user/profile` | JWT | ดูข้อมูลโปรไฟล์ |

### Wallet
| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|---------|
| `GET` | `/api/wallet` | JWT | ดูยอดเงิน |
| `POST` | `/api/wallet/topup` | JWT | เติมเงิน (manual) |
| `GET` | `/api/wallet/transactions` | JWT | ประวัติธุรกรรม |
| `GET` | `/api/wallet/logs` | JWT | ประวัติการเปลี่ยนแปลงกระเป๋า |

### Shop
| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|---------|
| `GET` | `/api/shop/products` | Public | ดูสินค้าทั้งหมด |
| `GET` | `/api/shop/products/:id` | Public | ดูสินค้าชิ้นเดียว |
| `GET` | `/api/shop/categories` | Public | หมวดหมู่สินค้า |
| `GET` | `/api/shop/featured` | Public | สินค้าแนะนำ |
| `POST` | `/api/shop/buy` | JWT | ซื้อสินค้า (RCON อัตโนมัติ) |

### Loot Box
| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|---------|
| `GET` | `/api/lootbox` | Public | ดูกล่องสุ่มทั้งหมด |
| `GET` | `/api/lootbox/:id` | Public | ดูรายละเอียดกล่อง |
| `POST` | `/api/lootbox/:id/open` | JWT | เปิดกล่องสุ่ม |

### Payment
| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|---------|
| `POST` | `/api/payment/promptpay/create` | JWT | สร้าง QR PromptPay |
| `POST` | `/api/payment/promptpay/confirm` | JWT | ยืนยันการชำระ PromptPay |
| `POST` | `/api/payment/truemoney/redeem` | JWT | แลก TrueMoney Gift Card |

### Admin (ต้องเป็น Admin เท่านั้น)
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| `GET` | `/api/admin/stats` | สถิติ Dashboard |
| `GET/PUT` | `/api/admin/users` | จัดการผู้ใช้งาน |
| `POST` | `/api/admin/users/:id/topup` | เติมเงินให้ผู้ใช้ |
| `GET/POST/PUT/DELETE` | `/api/admin/products` | จัดการสินค้า |
| `GET/POST/PUT/DELETE` | `/api/admin/servers` | จัดการเซิร์ฟเวอร์ RCON |
| `GET/POST/PUT/DELETE` | `/api/admin/lootboxes` | จัดการกล่องสุ่ม |
| `GET/POST/PUT/DELETE` | `/api/admin/slides` | จัดการ Hero Slides |
| `GET/PUT` | `/api/admin/settings` | ตั้งค่าระบบ |

---

## 🔒 ความปลอดภัย

- **AuthMe bcrypt** — ตรวจสอบรหัสผ่านจาก hash ใน AuthMe โดยตรง ไม่เก็บซ้ำ
- **JWT** — Stateless token พร้อม expiry ปรับได้
- **RBAC** — แยกระดับสิทธิ์ `user` / `admin` ทุก route
- **Rate Limiting** — ป้องกัน brute-force ด้วย express-rate-limit
- **Input Validation** — ตรวจสอบทุก request ด้วย Zod schema
- **Helmet.js** — HTTP security headers
- **Parameterized Queries** — ป้องกัน SQL Injection ผ่าน mysql2
- **CORS** — กำหนด origin ที่อนุญาตได้
- **ENCRYPTION_KEY** — เข้ารหัส RCON password ใน database

---

## 🌐 Port ที่ใช้งาน

| Service | Port | คำอธิบาย |
|---------|------|---------|
| Frontend | `3000` | Next.js Web App |
| Backend | `4000` | Express REST API + WebSocket |
| MySQL | `3306` | ฐานข้อมูล |
| Redis | `6379` | Cache / Session |
| phpMyAdmin | `8080` | GUI จัดการ Database |

---

## ⚙️ Environment Variables

| Variable | คำอธิบาย | Default |
|----------|---------|---------|
| `MYSQL_HOST` | MySQL host | `mysql` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `MYSQL_USER` | MySQL username | `root` |
| `MYSQL_PASSWORD` | MySQL password | — |
| `MYSQL_DATABASE` | ชื่อ Database | `siamworld` |
| `REDIS_HOST` | Redis host | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | Secret key สำหรับ JWT (≥32 chars) | — |
| `JWT_EXPIRES_IN` | Token หมดอายุใน | `24h` |
| `ENCRYPTION_KEY` | Key เข้ารหัส RCON password (≥32 chars) | — |
| `BACKEND_PORT` | Port ของ Backend | `4000` |
| `NODE_ENV` | `development` / `production` | `production` |
| `CORS_ORIGIN` | Origin ที่อนุญาต | `*` |
| `NEXT_PUBLIC_API_URL` | URL ของ Backend API | `http://localhost:4000/api` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:4000` |
| `RATE_LIMIT_WINDOW_MS` | ช่วงเวลา Rate Limit (ms) | `900000` |
| `RATE_LIMIT_MAX` | จำนวน request สูงสุดต่อช่วง | `100` |

---

## 📜 License

MIT — ใช้งานได้อย่างอิสระ
