# SiamWorld Shop — Production SaaS Deployment Guide

> คู่มือ deploy จริงบน Ubuntu 24.04 VPS ตั้งแต่ศูนย์จนเปิดรับลูกค้าได้
> อัปเดต: 2026-03-30

---

## สารบัญ

- [1. ภาพรวม Architecture](#1-ภาพรวม-architecture)
- [2. เตรียม VPS Ubuntu 24.04](#2-เตรียม-vps-ubuntu-2404)
- [3. ติดตั้ง Dependencies](#3-ติดตั้ง-dependencies)
- [4. Clone โปรเจกต์ + ตั้งค่า Scripts](#4-clone-โปรเจกต์--ตั้งค่า-scripts)
- [5. Deploy Nginx Proxy Manager](#5-deploy-nginx-proxy-manager)
- [6. สร้าง Shop ลูกค้าแรก (ทดสอบ)](#6-สร้าง-shop-ลูกค้าแรก-ทดสอบ)
- [7. ตั้งค่า Domain + SSL ใน Nginx Proxy Manager](#7-ตั้งค่า-domain--ssl-ใน-nginx-proxy-manager)
- [8. ส่งให้ลูกค้าตั้งค่า Setup Wizard](#8-ส่งให้ลูกค้าตั้งค่า-setup-wizard)
- [9. จัดการลูกค้า (start / stop / logs)](#9-จัดการลูกค้า-start--stop--logs)
- [10. Firewall & Security](#10-firewall--security)
- [11. Backup อัตโนมัติ](#11-backup-อัตโนมัติ)
- [12. Monitoring & Alerting](#12-monitoring--alerting)
- [13. Business Model & ราคา](#13-business-model--ราคา)
- [14. ทำ Linux Deploy Script (แทน PowerShell)](#14-ทำ-linux-deploy-script-แทน-powershell)

---

## 1. ภาพรวม Architecture

```
Internet / ลูกค้า Minecraft
         │
         ▼
  [Cloudflare DNS]  ← hide IP จริง + WAF + DDoS protection (ฟรี)
         │
         ▼
  [Ubuntu 24.04 VPS]
         │
  ┌──────┴─────────────────────────────────────────────┐
  │  Nginx Proxy Manager (port 80/443)                  │
  │  ├── shop-a.siamsite.com  → localhost:3001 (fe-a)  │
  │  ├── shop-b.siamsite.com  → localhost:3002 (fe-b)  │
  │  ├── /api/ + /socket.io/ → localhost:4001 (be-a)   │
  │  └── /api/ + /socket.io/ → localhost:4002 (be-b)   │
  └──────────────────────────────────────────────────────┘
         │
  ┌──────┴──────────────────────────────────────────────────────┐
  │  Docker containers (per customer — isolated stack)           │
  │                                                              │
  │  Customer A (sw-shopA):    Customer B (sw-shopB):           │
  │  ├── frontend :3001        ├── frontend :3002               │
  │  ├── backend  :4001        ├── backend  :4002               │
  │  ├── mysql    :3401 ──────────────────── :3402              │
  │  └── redis    (internal)   └── redis    (internal)          │
  └──────────────────────────────────────────────────────────────┘
         │
         │  Port MySQL เปิดเฉพาะสำหรับ AuthMe Plugin
         │  (Minecraft Server → VPS:34XX → MySQL ใน container)
         ▼
  [Minecraft Server ของลูกค้า]
  └── AuthMe Plugin ← เชื่อมต่อ MySQL บน VPS
```

**หลักการ**:
- แต่ละลูกค้าได้ Docker stack แยกกัน (MySQL, Redis, Backend, Frontend)
- MySQL ของแต่ละลูกค้า **expose port ออกมา** ให้ AuthMe plugin เชื่อมต่อได้จาก Minecraft server
- Nginx Proxy Manager ทำ SSL + routing ทั้งหมดผ่าน UI ไม่ต้องแก้ config file

---

## 2. เตรียม VPS Ubuntu 24.04

### 2.1 ซื้อ VPS

| Provider | Plan | RAM | Disk | Price | เหมาะ |
|----------|------|-----|------|-------|-------|
| **Hetzner** (EU) | CX22 | 4 GB | 40 GB | ~€4/เดือน | ถูกสุด, ดี |
| **DigitalOcean** | 4 GB | 4 GB | 80 GB | $24/เดือน | เริ่มต้น |
| **Vultr** | 4 GB | 4 GB | 80 GB | $24/เดือน | ตัวเลือกดี |
| **AWS Lightsail** | 4 GB | 4 GB | 80 GB | $20/เดือน | มือใหม่ |

> **แนะนำ**: Hetzner CX22 (4 GB RAM, 2 vCPU) — รองรับ 3-6 ลูกค้าพร้อมกัน ราคาถูกที่สุด

**Spec ขั้นต่ำต่อลูกค้า 1 ราย**: RAM ~800 MB, CPU 0.5 core, Disk 8 GB

### 2.2 ตั้งค่า VPS ครั้งแรก (root)

```bash
# SSH เข้าครั้งแรก
ssh root@YOUR_VPS_IP

# อัปเดตระบบ
apt update && apt upgrade -y

# ติดตั้งพื้นฐาน
apt install -y curl wget git ufw fail2ban htop unzip jq

# ตั้ง timezone ไทย
timedatectl set-timezone Asia/Bangkok

# สร้าง user ใหม่ (ห้ามใช้ root)
adduser deploy
usermod -aG sudo deploy

# Copy SSH key ไปให้ user ใหม่
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

### 2.3 Hardening SSH (สำคัญมาก)

```bash
nano /etc/ssh/sshd_config
```

แก้หรือเพิ่มบรรทัดเหล่านี้:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
```

```bash
systemctl restart sshd

# ทดสอบ login ด้วย user ใหม่ก่อนปิด session เก่า!
ssh deploy@YOUR_VPS_IP
```

### 2.4 ตั้งค่า fail2ban (ป้องกัน brute force)

```bash
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban && systemctl start fail2ban
```

---

## 3. ติดตั้ง Dependencies

ทำทุกอย่างต่อจากนี้ด้วย user `deploy`:

```bash
# Switch user
su - deploy

# ── Docker ──────────────────────────────────────────────────────
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker deploy

# Log out แล้ว log in ใหม่เพื่อให้ group มีผล
exit
ssh deploy@YOUR_VPS_IP

# ทดสอบ
docker run --rm hello-world
docker compose version

# ── jq (ใช้ใน deploy scripts) ───────────────────────────────────
sudo apt install -y jq
```

---

## 4. Clone โปรเจกต์ + ตั้งค่า Scripts

```bash
# สร้างโฟลเดอร์หลัก
sudo mkdir -p /opt/siamworld
sudo chown deploy:deploy /opt/siamworld
cd /opt/siamworld

# Clone repository
git clone https://github.com/YOUR_ORG/siamworld_shop.git app
cd app

# ให้สิทธิ์ execute กับ script
chmod +x deploy/new-customer.sh
chmod +x deploy/manage-customer.sh
```

> ถ้ายังไม่มี Linux scripts ให้ดู [Section 14](#14-ทำ-linux-deploy-script-แทน-powershell) ก่อน

---

## 5. Deploy Nginx Proxy Manager

Nginx Proxy Manager คือ reverse proxy ที่มี UI จัดการง่าย รองรับ Let's Encrypt SSL ฟรี

```bash
mkdir -p /opt/siamworld/nginx-proxy-manager
cd /opt/siamworld/nginx-proxy-manager

cat > docker-compose.yml << 'EOF'
services:
  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"       # HTTP
      - "443:443"     # HTTPS
      - "127.0.0.1:81:81"  # Admin UI (localhost only!)
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt
    environment:
      DISABLE_IPV6: "true"

volumes:
  npm_data:
  npm_letsencrypt:
EOF

docker compose up -d
```

### เข้า Admin UI

เปิด SSH tunnel ชั่วคราวเพื่อเข้า UI:

```bash
# บนเครื่อง local ของคุณ:
ssh -L 8181:127.0.0.1:81 deploy@YOUR_VPS_IP -N
```

เปิดเบราว์เซอร์: `http://localhost:8181`

- Default email: `admin@example.com`
- Default password: `changeme`
- **เปลี่ยน password ทันที!**

---

## 6. สร้าง Shop ลูกค้าแรก (ทดสอบ)

```bash
cd /opt/siamworld/app

# สร้าง shop ใหม่
./deploy/new-customer.sh craftworld craftworld.siamsite.com

# ตรวจสอบว่า containers ขึ้นครบ
docker ps | grep sw-craftworld

# ดู logs
docker compose -p sw-craftworld logs -f backend
```

Script จะสร้าง:
- `.env` พร้อม secrets สุ่มอัตโนมัติ
- Docker containers: mysql, redis, backend, frontend
- บันทึก port ลง `deploy/customers.json`

**Output ตัวอย่าง**:
```
✅ craftworld deployed successfully
   Frontend : port 3001
   Backend  : port 4001
   MySQL    : port 3401  (AuthMe เชื่อมที่นี่)
   Domain   : craftworld.siamsite.com
   Setup    : https://craftworld.siamsite.com/admin/setup
```

---

## 7. ตั้งค่า Domain + SSL ใน Nginx Proxy Manager

### 7.1 ตั้งค่า DNS ก่อน (Cloudflare แนะนำ)

```
Type  Name          Content          Proxy
A     craftworld    YOUR_VPS_IP      ✅ Proxied
```

> ใช้ Cloudflare Proxy (สีส้ม) เพื่อซ่อน IP จริงและได้ DDoS protection ฟรี

### 7.2 เพิ่ม Proxy Host ใน NPM

เข้า Nginx Proxy Manager UI → **Proxy Hosts** → **Add Proxy Host**

| Field | Value |
|-------|-------|
| Domain Names | `craftworld.siamsite.com` |
| Forward Hostname | `host.docker.internal` |
| Forward Port | `3001` (frontend port) |
| Block Common Exploits | ✅ เปิด |
| Websockets Support | ✅ เปิด |

ไปที่ tab **SSL**:
| Field | Value |
|-------|-------|
| SSL Certificate | Request a new SSL Certificate |
| Force SSL | ✅ เปิด |
| HTTP/2 Support | ✅ เปิด |
| Email | your@email.com |

ไปที่ tab **Advanced** — ใส่ config นี้:

```nginx
# Backend API
location /api/ {
    proxy_pass http://host.docker.internal:4001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10M;
}

# WebSocket (Socket.IO)
location /socket.io/ {
    proxy_pass http://host.docker.internal:4001/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

กด **Save** — SSL จะออกอัตโนมัติใน ~30 วินาที

> **ลูกค้าถัดไป**: ทำซ้ำข้อ 6-7 เปลี่ยนแค่ชื่อ domain และ port (3002/4002, 3003/4003, ...)

---

## 8. ส่งให้ลูกค้าตั้งค่า Setup Wizard

หลังจาก deploy และ SSL พร้อมแล้ว ส่งข้อมูลนี้ให้ลูกค้า:

---

**ขั้นตอนตั้งค่า Shop ของคุณ**

1. เปิด `https://craftworld.siamsite.com/admin/setup`
2. ทำตาม Setup Wizard ครบ 6 ขั้นตอน:
   - สร้างบัญชี Admin
   - ตั้งชื่อร้าน
   - กรอกข้อมูล AuthMe MySQL (ข้อมูลจาก AuthMe config.yml ของ Minecraft server)
   - กรอก IP และ RCON port ของ Minecraft server
   - ทดสอบ RCON connection
3. หลัง Setup เสร็จ ไปที่ `Admin Panel > ตั้งค่า > ระบบเติมเงิน` เพื่อใส่ EasySlip API Key

**ข้อมูล MySQL สำหรับใส่ใน AuthMe config.yml**:

```yaml
DataSource:
  backend: MYSQL
  mySQLHost: YOUR_VPS_IP
  mySQLPort: 3401          # ← port ของลูกค้านี้ (ดูจาก customers.json)
  mySQLUsername: siamworld
  mySQLPassword: [ดูใน deploy/customers/craftworld/.env]
  mySQLDatabase: siamworld
  mySQLTablename: authme
```

---

## 9. จัดการลูกค้า (start / stop / logs)

### ดูรายการลูกค้าทั้งหมด

```bash
cd /opt/siamworld/app
./deploy/manage-customer.sh list
```

Output:
```
NAME            DOMAIN                    FE    BE    MYSQL  STATUS
craftworld      craftworld.siamsite.com   3001  4001  3401   ✅ running
pixelcraft      pixelcraft.siamsite.com   3002  4002  3402   ✅ running
oldserver       oldserver.siamsite.com    3003  4003  3403   ⛔ stopped
```

### Commands

```bash
# Start
./deploy/manage-customer.sh start craftworld

# Stop
./deploy/manage-customer.sh stop craftworld

# Restart (หลัง config เปลี่ยน)
./deploy/manage-customer.sh restart craftworld

# ดู logs realtime
./deploy/manage-customer.sh logs craftworld

# ดู logs เฉพาะ backend
docker compose -p sw-craftworld logs -f backend --tail=50

# Rebuild หลังอัปเดต code
./deploy/manage-customer.sh rebuild craftworld
```

---

## 10. Firewall & Security

```bash
# ตั้งค่า UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# อนุญาตเฉพาะ ports ที่จำเป็น
sudo ufw allow ssh           # 22
sudo ufw allow 80/tcp        # HTTP (Nginx)
sudo ufw allow 443/tcp       # HTTPS (Nginx)

# MySQL ports สำหรับ AuthMe (เปิดเฉพาะ range ที่ใช้)
# ตัวอย่าง: ลูกค้า 10 คน ใช้ port 3401-3410
sudo ufw allow 3401:3420/tcp   # ปรับตามจำนวนลูกค้าจริง

# เปิด Firewall
sudo ufw enable

# ตรวจสอบ
sudo ufw status verbose
```

> ⚠️ **สำคัญ**: port MySQL (34XX) ต้องเปิดเฉพาะที่ AuthMe ต้องการ ห้ามเปิด 3306 (default MySQL port) สาธารณะ

### ตรวจสอบ ports ที่เปิดอยู่

```bash
sudo ss -tlnp | grep -E "80|443|34[0-9]{2}"
```

---

## 11. Backup อัตโนมัติ

### สร้าง Backup Script

```bash
cat > /opt/siamworld/backup.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/siamworld/backups"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/siamworld/app"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

# อ่าน customers registry
CUSTOMERS=$(jq -r '.customers[].name' "$APP_DIR/deploy/customers.json" 2>/dev/null || echo "")

if [ -z "$CUSTOMERS" ]; then
    echo "No customers found, skipping DB backup"
else
    for NAME in $CUSTOMERS; do
        ENV_FILE="$APP_DIR/deploy/customers/$NAME/.env"
        if [ ! -f "$ENV_FILE" ]; then continue; fi

        MYSQL_PASS=$(grep MYSQL_PASSWORD "$ENV_FILE" | cut -d= -f2 | tr -d '"')

        echo "Backing up $NAME..."
        docker exec "sw-${NAME}-mysql-1" mysqldump \
            -u root -p"${MYSQL_PASS}" siamworld \
            --single-transaction --quick \
            | gzip > "$BACKUP_DIR/db_${NAME}_${DATE}.sql.gz"
    done
fi

# Backup config files (.env ทุกลูกค้า)
tar -czf "$BACKUP_DIR/configs_${DATE}.tar.gz" \
    "$APP_DIR/deploy/customers/" \
    "$APP_DIR/deploy/customers.json" \
    2>/dev/null || true

# ลบ backup เก่ากว่า KEEP_DAYS วัน
find "$BACKUP_DIR" -name "*.gz" -mtime +$KEEP_DAYS -delete

echo "✅ Backup done: $DATE"
SCRIPT

chmod +x /opt/siamworld/backup.sh

# ทดสอบ
/opt/siamworld/backup.sh
```

### ตั้ง Cron ทำ Backup ทุกวันตี 3

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/siamworld/backup.sh >> /var/log/siamworld-backup.log 2>&1") | crontab -
```

### ส่ง Backup ออก VPS (Optional แต่แนะนำ)

```bash
# ใช้ rclone ส่งไป Cloudflare R2 / Google Drive / S3
sudo apt install -y rclone
rclone config  # ทำตาม wizard

# เพิ่มใน backup.sh ก่อน exit:
rclone copy "$BACKUP_DIR" r2:my-bucket/siamworld-backups/ --max-age 24h
```

---

## 12. Monitoring & Alerting

### ตรวจสอบสถานะ

```bash
# ดู resource ทั้งหมด
docker stats --no-stream

# ดู disk
df -h && docker system df

# ดู memory
free -h

# ตรวจสอบ containers ที่ crash
docker ps -a | grep -v Up
```

### ตั้ง UptimeRobot (ฟรี, แจ้งเตือน Line/Email)

1. สมัครที่ [uptimerobot.com](https://uptimerobot.com)
2. เพิ่ม monitor **ต่อลูกค้า 1 ราย**:
   - Type: `HTTPS`
   - URL: `https://craftworld.siamsite.com/api/health`
   - Interval: 5 นาที
3. ตั้ง Alert Contact: Line Notify หรือ Email

### Health Check Endpoint

ทดสอบว่า backend ทำงานปกติ:

```bash
curl -s https://craftworld.siamsite.com/api/health | jq
# {"success":true,"timestamp":"2026-03-30T..."}
```

### Auto-restart containers ถ้า crash

Docker Compose มี `restart: unless-stopped` อยู่แล้ว — containers จะ restart อัตโนมัติหลัง VPS reboot

---

## 13. Business Model & ราคา

### แพ็กเกจแนะนำ

| แพ็กเกจ | ราคา/เดือน | สิ่งที่ได้ | เหมาะ |
|---------|-----------|----------|-------|
| **Starter** | 299 ฿ | 1 เซิร์ฟเวอร์, ไม่มี EasySlip, Support ช้า | ทดลอง |
| **Standard** | 699 ฿ | 3 เซิร์ฟเวอร์, EasySlip, Lootbox, Support ปกติ | ร้านทั่วไป |
| **Pro** | 1,299 ฿ | Unlimited เซิร์ฟเวอร์, Custom domain, Priority support | ร้านใหญ่ |
| **Setup Fee** | 300 ฿ | ค่าตั้งค่าครั้งแรก (ใช้เวลา ~20 นาที) | ทุกแพ็กเกจ |

### ต้นทุนจริงต่อเดือน

| รายการ | ราคา |
|-------|------|
| Hetzner CX22 (4 GB) | ~230 ฿ |
| Domain (.com) | ~40 ฿ |
| Cloudflare | ฟรี |
| EasySlip API | ตามจริง (~1-2 ฿/ครั้ง) |
| **รวม** | **~280 ฿/เดือน** |

### Breakeven & กำไร

| จำนวนลูกค้า | รายได้ (Standard) | กำไรสุทธิ |
|------------|-----------------|----------|
| 1 | 699 ฿ | ~420 ฿ |
| 3 | 2,097 ฿ | ~1,817 ฿ |
| 5 | 3,495 ฿ | ~3,215 ฿ |
| 10 | 6,990 ฿ | ~6,710 ฿ |

> ลูกค้า 10 คนบน VPS 4 GB เดียว — **passive income ~6,700 ฿/เดือน**
> อัปเกรด VPS ถ้าเกิน 10 คน (~500 ฿ ได้ 8 GB RAM)

### Workflow รับลูกค้าใหม่

```
ลูกค้าติดต่อ
    │
    ▼
รับเงิน (โอน / PromptPay)
    │
    ▼
รัน: ./deploy/new-customer.sh [ชื่อ] [domain]   ← 2 นาที
    │
    ▼
เพิ่ม Proxy Host ใน Nginx Proxy Manager          ← 3 นาที
    │
    ▼
ส่ง Setup URL + ข้อมูล MySQL AuthMe ให้ลูกค้า   ← 1 นาที
    │
    ▼
ลูกค้าตั้งค่าเอง (Setup Wizard ~10 นาที)
    │
    ▼
เสร็จสิ้น ✅  (total admin time: ~6 นาที)
```

---

## 14. ทำ Linux Deploy Script (แทน PowerShell)

สร้างไฟล์ `deploy/new-customer.sh`:

```bash
cat > /opt/siamworld/app/deploy/new-customer.sh << 'SCRIPT'
#!/bin/bash
# ================================================================
#  SiamWorld Shop — New Customer Deploy (Linux/Ubuntu)
#  Usage: ./new-customer.sh <name> <domain>
#  Example: ./new-customer.sh craftworld craftworld.siamsite.com
# ================================================================

set -euo pipefail

NAME="${1:?Usage: $0 <name> <domain>}"
DOMAIN="${2:?Usage: $0 <name> <domain>}"

# Validate name
if [[ ! "$NAME" =~ ^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$ ]]; then
    echo "❌ Name must be 3-30 lowercase letters/numbers/hyphens"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CUSTOMERS_DIR="$SCRIPT_DIR/customers"
CUSTOMER_DIR="$CUSTOMERS_DIR/$NAME"
CUSTOMER_ENV="$CUSTOMER_DIR/.env"
REGISTRY="$SCRIPT_DIR/customers.json"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.customer.yml"

# Init registry
if [ ! -f "$REGISTRY" ]; then
    echo '{"next_frontend_port":3001,"next_backend_port":4001,"next_mysql_port":3401,"customers":[]}' > "$REGISTRY"
fi

# Check duplicate
if jq -e --arg n "$NAME" '.customers[] | select(.name==$n)' "$REGISTRY" > /dev/null 2>&1; then
    echo "❌ Customer '$NAME' already exists"
    jq --arg n "$NAME" '.customers[] | select(.name==$n)' "$REGISTRY"
    exit 1
fi

# Read ports
FRONTEND_PORT=$(jq '.next_frontend_port' "$REGISTRY")
BACKEND_PORT=$(jq  '.next_backend_port'  "$REGISTRY")
MYSQL_PORT=$(jq    '.next_mysql_port'    "$REGISTRY")

# Generate secrets
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
MYSQL_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c24)

mkdir -p "$CUSTOMER_DIR"

# Write .env
cat > "$CUSTOMER_ENV" << ENV
# ================================================
#  Customer : $NAME
#  Domain   : $DOMAIN
#  Created  : $(date '+%Y-%m-%d %H:%M:%S')
#  Ports    : Frontend=$FRONTEND_PORT  Backend=$BACKEND_PORT  MySQL=$MYSQL_PORT
# ================================================

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=siamworld
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_DATABASE=siamworld
MYSQL_EXPOSED_PORT=$MYSQL_PORT

REDIS_HOST=redis
REDIS_PORT=6379

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=$ENCRYPTION_KEY

NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_WS_URL=wss://$DOMAIN

BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
NODE_ENV=production
CORS_ORIGIN=https://$DOMAIN

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300

EASYSLIP_API_KEY=

SOURCE_ROOT=$PROJECT_ROOT
CUSTOMER_ENV_FILE=$CUSTOMER_ENV
ENV

echo ""
echo "🚀 Deploying $NAME..."
echo "   Frontend : $FRONTEND_PORT"
echo "   Backend  : $BACKEND_PORT"
echo "   MySQL    : $MYSQL_PORT (AuthMe connects here)"
echo ""

# Build & Start
SOURCE_ROOT="$PROJECT_ROOT" \
CUSTOMER_ENV_FILE="$CUSTOMER_ENV" \
docker compose \
    --project-name "sw-$NAME" \
    --env-file "$CUSTOMER_ENV" \
    -f "$COMPOSE_FILE" \
    up -d --build

# Update registry
RECORD=$(jq -n \
    --arg name "$NAME" \
    --arg domain "$DOMAIN" \
    --argjson fp "$FRONTEND_PORT" \
    --argjson bp "$BACKEND_PORT" \
    --argjson mp "$MYSQL_PORT" \
    --arg created "$(date '+%Y-%m-%d %H:%M:%S')" \
    '{name:$name,domain:$domain,frontend_port:$fp,backend_port:$bp,mysql_port:$mp,created:$created}')

jq \
    --argjson record "$RECORD" \
    '.next_frontend_port += 1 | .next_backend_port += 1 | .next_mysql_port += 1 |
     .customers += [$record]' \
    "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"

echo ""
echo "✅ $NAME deployed!"
echo ""
echo "━━━ Nginx Proxy Manager Config ━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Domain      : $DOMAIN"
echo "  Forward Host: host.docker.internal"
echo "  Forward Port: $FRONTEND_PORT"
echo ""
echo "  Advanced tab — paste this:"
cat << NGINX

location /api/ {
    proxy_pass http://host.docker.internal:$BACKEND_PORT/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 10M;
}
location /socket.io/ {
    proxy_pass http://host.docker.internal:$BACKEND_PORT/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
}
NGINX
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  AuthMe MySQL Config (ส่งให้ลูกค้า):"
echo "    mySQLHost     : YOUR_VPS_IP"
echo "    mySQLPort     : $MYSQL_PORT"
echo "    mySQLUsername : siamworld"
echo "    mySQLPassword : $MYSQL_PASSWORD"
echo "    mySQLDatabase : siamworld"
echo "    mySQLTablename: authme"
echo ""
echo "  Setup URL: https://$DOMAIN/admin/setup"
echo ""
SCRIPT

chmod +x /opt/siamworld/app/deploy/new-customer.sh
```

สร้าง `deploy/manage-customer.sh`:

```bash
cat > /opt/siamworld/app/deploy/manage-customer.sh << 'SCRIPT'
#!/bin/bash
# Usage: ./manage-customer.sh <action> [name]
# Actions: list, start, stop, restart, logs, rebuild, remove

set -euo pipefail

ACTION="${1:-list}"
NAME="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY="$SCRIPT_DIR/customers.json"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.customer.yml"

get_env() {
    echo "$SCRIPT_DIR/customers/$NAME/.env"
}

case "$ACTION" in
    list)
        echo ""
        printf "  %-20s %-35s %-6s %-6s %-6s %s\n" "NAME" "DOMAIN" "FE" "BE" "MYSQL" "STATUS"
        echo "  $(printf '─%.0s' {1..90})"
        jq -r '.customers[] | "\(.name) \(.domain) \(.frontend_port) \(.backend_port) \(.mysql_port)"' "$REGISTRY" | \
        while read -r name domain fp bp mp; do
            STATUS=$(docker inspect "sw-${name}-frontend-1" --format '{{.State.Status}}' 2>/dev/null || echo "stopped")
            COLOR="\033[32m" ; [ "$STATUS" != "running" ] && COLOR="\033[31m"
            printf "  ${COLOR}%-20s %-35s %-6s %-6s %-6s %s\033[0m\n" "$name" "$domain" "$fp" "$bp" "$mp" "$STATUS"
        done
        echo ""
        ;;
    start|stop|restart)
        ENV_FILE=$(get_env)
        docker compose --project-name "sw-$NAME" --env-file "$ENV_FILE" \
            -f "$COMPOSE_FILE" "$ACTION"
        echo "✅ $ACTION $NAME"
        ;;
    logs)
        ENV_FILE=$(get_env)
        docker compose --project-name "sw-$NAME" --env-file "$ENV_FILE" \
            -f "$COMPOSE_FILE" logs -f --tail=100
        ;;
    rebuild)
        ENV_FILE=$(get_env)
        SOURCE_ROOT="$PROJECT_ROOT" CUSTOMER_ENV_FILE="$ENV_FILE" \
        docker compose --project-name "sw-$NAME" --env-file "$ENV_FILE" \
            -f "$COMPOSE_FILE" up -d --build
        echo "✅ Rebuilt $NAME"
        ;;
    remove)
        echo "⚠️  This will DELETE all data for $NAME. Type '$NAME' to confirm:"
        read -r CONFIRM
        if [ "$CONFIRM" != "$NAME" ]; then echo "Cancelled."; exit 0; fi
        ENV_FILE=$(get_env)
        docker compose --project-name "sw-$NAME" --env-file "$ENV_FILE" \
            -f "$COMPOSE_FILE" down -v
        rm -rf "$SCRIPT_DIR/customers/$NAME"
        jq --arg n "$NAME" 'del(.customers[] | select(.name==$n))' \
            "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
        echo "🗑️  Removed $NAME"
        ;;
    *)
        echo "Usage: $0 <list|start|stop|restart|logs|rebuild|remove> [name]"
        ;;
esac
SCRIPT

chmod +x /opt/siamworld/app/deploy/manage-customer.sh
```

---

## Quick Reference Card

```bash
# ── Deploy ลูกค้าใหม่ ─────────────────────────────────────
./deploy/new-customer.sh <name> <domain>

# ── จัดการลูกค้า ─────────────────────────────────────────
./deploy/manage-customer.sh list
./deploy/manage-customer.sh restart craftworld
./deploy/manage-customer.sh logs craftworld
./deploy/manage-customer.sh rebuild craftworld    # หลัง git pull

# ── อัปเดต code ─────────────────────────────────────────
cd /opt/siamworld/app
git pull
# Rebuild ทุกลูกค้า:
jq -r '.customers[].name' deploy/customers.json | \
    xargs -I{} ./deploy/manage-customer.sh rebuild {}

# ── ดู resource ─────────────────────────────────────────
docker stats --no-stream
df -h
free -h

# ── Backup ทันที ─────────────────────────────────────────
/opt/siamworld/backup.sh

# ── เช็ค health ─────────────────────────────────────────
curl -s https://craftworld.siamsite.com/api/health
```

---

*SiamWorld Shop v2.x — ห้ามเผยแพร่โดยไม่ได้รับอนุญาต*
