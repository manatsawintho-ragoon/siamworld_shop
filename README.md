# Siamsite Shop

ระบบร้านค้าออนไลน์สำหรับ Minecraft Server ผู้เล่นล็อกอินด้วยบัญชี AuthMe เดิม เติมเงินผ่าน PromptPay หรือ TrueMoney แล้วซื้อสินค้า/สิทธิ์ที่ส่งเข้าเซิร์ฟผ่าน RCON ทันที พร้อมระบบกล่องสุ่ม (Loot Box) โค้ดแลกรับ และแดชบอร์ดแอดมินเต็มรูปแบบ

## Stack

Backend เป็น Node.js 20 + Express + TypeScript ส่วน Frontend เป็น Next.js 14 (App Router) + TailwindCSS ฐานข้อมูล MySQL 8 แคชและ real-time ใช้ Redis 7 กับ Socket.IO ล็อกอินอ่าน bcrypt จากตาราง authme โดยตรง (ไม่เก็บรหัสซ้ำ) ติดต่อเซิร์ฟผ่าน RCON แบบ connection pool ต่อเซิร์ฟ ทั้งหมดรันบน Docker Compose

## เริ่มใช้งาน

ต้องมี Docker 24+ และ Docker Compose v2 จากนั้น clone โปรเจค คัดลอก `.env.example` เป็น `.env` แก้ค่าให้ครบ แล้วสั่ง `docker compose up -d` ดูสถานะด้วย `docker compose ps` และ log ด้วย `docker compose logs -f backend` เมื่อรันแล้วจะมี container ของ MySQL (3306), Redis (6379), backend (4000), frontend (3000) และ phpMyAdmin (8080)

ตอน dev รัน hot reload ได้โดย `cd backend && npm run dev` (พอร์ต 4000) และ `cd frontend && npm run dev` (พอร์ต 3000) โดยให้ MySQL กับ Redis รันผ่าน Docker อยู่ ก่อน deploy ทุกครั้งต้อง `npm run build` ฝั่ง backend ให้ผ่าน และ rebuild frontend เสมอเพราะ Next.js ฝัง env ตอน build

## Secret และ .env

ความลับทั้งหมดอยู่ใน `.env` ซึ่งถูกใส่ใน `.gitignore` แล้ว ห้าม commit ขึ้น git เด็ดขาด (รวมถึง `deploy/panel.env`, `deploy/customers/*/.env`, `deploy/customers.json`, `deploy/certs/` และ `plugins_nlogin/` ที่ ignore ไว้เช่นกัน) ค่าที่ต้องตั้งเองและถือเป็นความลับคือ `MYSQL_PASSWORD` (อย่าใช้ค่า default), `JWT_SECRET` และ `ENCRYPTION_KEY` (ทั้งสองยาว 32 ตัวขึ้นไปและต้องไม่ซ้ำกัน) ส่วน `NEXT_PUBLIC_API_URL` กับ `NEXT_PUBLIC_WS_URL` ต้องเป็น URL ที่บราว์เซอร์ผู้เล่นเข้าถึงได้จริง และบน production ให้ตั้ง `CORS_ORIGIN` เป็นโดเมน frontend จริง อย่าใช้ `*`

RCON Password ถูกเข้ารหัส AES ด้วย `ENCRYPTION_KEY` ก่อนเก็บลง DB ถ้าเปลี่ยน `ENCRYPTION_KEY` หลังจากมีเซิร์ฟในระบบแล้ว จะถอดรหัสของเดิมไม่ได้ ต้องกรอก RCON Password ของทุกเซิร์ฟใหม่

## ตั้งค่า Minecraft Server

นี่คือสาเหตุอันดับหนึ่งที่ทำให้ส่งของหรือ track ผู้เล่นไม่ได้ ในไฟล์ `server.properties` ต้องตั้ง `enable-rcon=true`, กำหนด `rcon.port` (ค่าเริ่มต้น 25575) และ `rcon.password` ให้แข็งแรง และตั้ง `online-mode=false` เมื่อใช้ AuthMe ทุกครั้งที่แก้ไฟล์นี้ต้อง restart เซิร์ฟ

AuthMe ต้องตั้ง DataSource เป็น MYSQL (ห้าม SQLite) ชี้ไปฐานข้อมูลเดียวกับระบบร้าน (ตาราง authme) เพราะระบบอ่านรหัสจาก MySQL โดยตรง ด้าน firewall ต้องเปิดให้เครื่องเว็บเข้าพอร์ต RCON (25575) ของเครื่อง Minecraft ได้ ส่วน 3306 เปิดให้ AuthMe ต่อ MySQL และ 25565 เปิดสาธารณะให้ผู้เล่น

เพิ่มเซิร์ฟในแอดมินที่หน้า "จัดการเซิร์ฟเวอร์" กรอก Host (ใช้ `host.docker.internal` ถ้า Minecraft อยู่เครื่องเดียวกับเว็บ หรือ IP จริงถ้าคนละเครื่อง), Port, RCON Port, RCON Password แล้วกด "ตรวจ RCON" ถ้าขึ้น RCON Online คือเชื่อมได้ ตอนสร้างสินค้าใช้ตัวแปร `{username}` หรือ `{player}` ในคำสั่ง RCON ได้ หลายบรรทัดคือหลายคำสั่ง

## Migration

หลัง `docker compose up` ครั้งแรก `init.sql` จะถูกโหลดอัตโนมัติ ส่วนไฟล์ใน `migrations/` ต้อง apply เองตามลำดับ เช่น `for f in migrations/0*.sql; do cat "$f" | docker exec -i siamsite-mysql mysql -uroot -p<PASSWORD> siamsite; done` ทุก migration เขียนแบบ idempotent รันซ้ำได้ เมื่อเพิ่มไฟล์ใหม่ให้ตั้งชื่อ `0XX_description.sql` และเขียนให้ idempotent ด้วย

## โครงสร้าง

`backend/src` แบ่งเป็น config (validate env ด้วย zod), database (MySQL pool, Redis), middleware (auth, validate, cooldown, error), routes (บางเบา delegate ไป services), services (business logic ทั้งหมด เช่น auth, wallet, shop, loot-box, payment, rcon-*, player-tracker), utils และ validators ส่วน `frontend/src` มี app (หน้าเพจ App Router), components, context (Auth, Settings, Theme), hooks และ lib/api.ts (axios + แนบ JWT) โฟลเดอร์ `migrations/` เก็บไฟล์ SQL และ `init.sql` คือ schema เริ่มต้น

## แก้ปัญหาที่พบบ่อย

ถ้า RCON ใช้ไม่ได้ ให้ไล่เช็ก: `enable-rcon=true`, พอร์ตและรหัส RCON ตรงกับที่กรอกในแอดมิน, restart เซิร์ฟหลังแก้ config, เปิด firewall พอร์ต 25575, และเปิดเซิร์ฟในระบบ (ปุ่ม power เขียว) ทดสอบจากเครื่องเว็บด้วย `nc -zv <MINECRAFT_IP> 25575` หรือ `mcrcon` และดู log ด้วย `docker compose logs backend | grep -i rcon`

ถ้าส่งของแล้วผู้เล่นไม่ได้รับ ผู้เล่นต้อง online บนเซิร์ฟที่เลือกตอนกดซื้อ (ระบบเช็กก่อนเสมอ) ดูผลคำสั่งได้ที่ Audit Log ถ้าจำนวนผู้เล่น online ขึ้น 0 ตลอด แปลว่า RCON เชื่อมไม่ได้ ให้กลับไปเช็ก RCON ก่อน ถ้าล็อกอิน AuthMe ไม่ได้ ให้ตรวจว่า AuthMe ใช้ MySQL และมีตาราง authme อยู่จริง

## ความปลอดภัย

มี rate limit ราย IP: auth 10 ครั้ง/15 นาที, payment 20 ครั้ง/10 นาที, redeem-code 5 ครั้ง/10 นาที และ global 300 ครั้ง/15 นาที ก่อนขึ้น production ต้องตั้ง `CORS_ORIGIN` เป็นโดเมนจริง, ตั้ง `JWT_SECRET`/`ENCRYPTION_KEY` ให้ยาวและไม่ซ้ำ, ใช้ HTTPS ผ่าน reverse proxy + Let's Encrypt และเปลี่ยน `MYSQL_PASSWORD` จากค่า default ส่วน audit log ทุกประเภทถูกลบอัตโนมัติหลัง 7 วัน (MySQL event ตี 2 ทุกคืน) หรือกดล้างเองในแอดมินได้
