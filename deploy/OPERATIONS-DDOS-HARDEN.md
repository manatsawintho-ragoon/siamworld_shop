# Operations — DDoS Hardening

## สถานะปัจจุบัน (2026-05-26)

✅ **Web ports 80/443 protected ทั้ง VPS** — `deploy/harden-web-ports.sh` ทำงานแล้ว
  - DROP non-Cloudflare traffic บน DOCKER-USER ก่อน catch-all
  - ลูกค้าทุกราย (CF-proxied via wildcard `*.siamsite.shop`) ใช้งานได้ปกติ
  - Direct-to-IP attack ถูก block ทั้งหมด

✅ **honeyland MySQL port 33003 บล็อกแล้ว** — DROP บน DOCKER-USER position 295

✅ **Auto-harden เมื่อออก Bridge token** — POST `/api/bridge/:subId/token` จะเรียก `hardenMysqlPort()` อัตโนมัติ (best-effort, idempotent)

✅ **new-customer.sh --bridge flag** — ลูกค้าใหม่ใช้ Bridge mode → ไม่เปิด MySQL port

## สถาปัตยกรรมการป้องกัน 2 ชั้น

```
┌─────────────────────────────────────────────────────┐
│ Cloudflare (DDoS shield, WAF, Rate limit)           │
└──────────────────┬──────────────────────────────────┘
                   │ ผ่านได้เฉพาะ CF IP ranges
                   ▼
┌─────────────────────────────────────────────────────┐
│ VPS DOCKER-USER chain:                              │
│   1. ACCEPT CF IPs → ports 80/443                   │
│   2. ACCEPT MC_IPs → ลูกค้า direct AuthMe (per-IP)  │
│   3. DROP ทุก request อื่น → ports 80/443/33XXX     │
└─────────────────────────────────────────────────────┘
```

ผู้โจมตี **direct-to-IP ผ่าน Cloudflare ไม่ได้แล้ว** — ปกป้องลูกค้าทุกราย (CF-proxied) อัตโนมัติ

## ที่มา (ก่อนแก้)

ลูกค้าทุกรายตอน deploy เริ่มต้นจะได้ DNS แบบ **DNS-only (grey-cloud)** — เพื่อให้ AuthMe plugin บนเครื่อง MC ลูกค้าต่อ MySQL ที่ panel VPS ได้ (Cloudflare ไม่ proxy non-HTTP ports). ผลคือ:

- ผู้โจมตี resolve `<customer>.siamsite.shop` → ได้ panel VPS IP โดยตรง
- ยิง L7/L4 ตรงเข้า VPS IP (bypass Cloudflare) → NPM/origin TLS overload → `panel.siamsite.shop` ขึ้น CF 5xx
- **ลูกค้าที่ migrate ไป Bridge แล้ว ไม่ต้องการ MySQL port เปิดออกข้างนอกอีก** — ใช้โอกาสปิดช่องนี้ได้ปลอดภัย

**ปัจจุบัน Cloudflare wildcard `*.siamsite.shop` เป็น proxied=True อยู่แล้ว** — ลูกค้าทุกราย web traffic วิ่งผ่าน CF. ปัญหาที่เหลือคือ direct-to-IP attack (ผู้โจมตีรู้ VPS IP จาก `yokaicraft`, `db`, `ssh.siamsite.shop` ที่เป็น DNS-only). แก้ด้วย harden-web-ports.sh แล้ว

## ใครควร harden?

| สถานะลูกค้า | ต้อง harden? |
|---|---|
| `BRIDGE_ENABLED=true` ใน `.env` | **ใช่ — harden ได้เลย** |
| ใช้ AuthMe direct (default ตอน deploy) | ห้าม harden — MC plugin จะต่อ MySQL ไม่ได้ |
| ไม่ได้ตั้ง AuthMe เลย (mode='none' บน dashboard) | harden ได้ — ลูกค้าไม่ใช้ MySQL port อยู่แล้ว |

ตรวจสถานะลูกค้าทั้งหมด:

```bash
grep -L 'BRIDGE_ENABLED=true' deploy/customers/*/.env  # ลูกค้าที่ยัง direct (ห้าม harden)
grep -l 'BRIDGE_ENABLED=true' deploy/customers/*/.env  # ลูกค้า Bridge (harden ได้)
```

## ขั้นตอน Harden ลูกค้า 1 ราย

ตัวอย่างใช้ลูกค้า `honeyland`:

### 1. Flip DNS เป็น Cloudflare-proxied

เข้า admin panel → Customers → กดร้านนั้น → กดปุ่ม **"กัน DDoS (CF Proxy)"**

หรือเรียก API ตรงๆ:

```bash
curl -X POST https://panel.siamsite.shop/api/admin/subscriptions/<SUB_ID>/dns-mode \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"proxied"}'
```

ผล:
- Cloudflare DNS A record ของ `<customer>.siamsite.shop` เปลี่ยนเป็น proxied (orange-cloud)
- HTTP/HTTPS traffic ทั้งหมดจะวิ่งผ่าน Cloudflare (รวม DDoS shield, WAF)
- MySQL port **จะเข้าจากภายนอกไม่ได้แล้ว** เพราะ CF proxy ไม่รองรับ TCP raw

### 2. Block MySQL port ที่ host firewall (defense in depth)

แม้ CF proxy จะทำให้ port 33XXX ไม่ resolve ผ่าน DNS ใหม่ได้ แต่ผู้โจมตีอาจรู้ VPS IP จากลูกค้ารายอื่นที่ยัง DNS-only — ต้องปิด port ที่ firewall ด้วย:

```bash
cd /path/to/siamworld_shop
sudo ./deploy/harden-mysql-port.sh honeyland
```

ผล: script จะ detect catch-all `ACCEPT 0.0.0.0/0 → 0.0.0.0/0` ใน DOCKER-USER (อยู่ท้าย chain) แล้วใส่ DROP **ก่อน catch-all 1 ตำแหน่ง** — Docker subnet ACCEPTs ที่อยู่บน DROP ยังทำให้ container ภายในต่อ MySQL ได้ปกติ ส่วน external SYN จะถูก DROP ก่อนถึง Docker NAT

Script จะปริ๊นต์ Self-test command ให้รันจากเครื่องอื่นเพื่อยืนยันว่า DROP ทำงาน:

Rollback ถ้าจำเป็น:

```bash
sudo ./deploy/harden-mysql-port.sh honeyland --unblock
```

### 3. ตรวจสอบ

```bash
# A) DNS ต้อง proxied
dig +short <customer>.siamsite.shop                # ควรได้ Cloudflare IP (104.x / 172.x range)
                                                    # ไม่ใช่ VPS IP ของเรา

# B) ภายนอกต่อ MySQL ไม่ได้
nc -zv <customer>.siamsite.shop 33XXX               # ควร connection refused/timeout

# C) ภายในยังต่อ MySQL ได้ปกติ (panel-backend → shop's mysql container)
docker exec panel-backend nc -zv host.docker.internal 33XXX

# D) เว็บร้านยังเข้าได้
curl -sI https://<customer>.siamsite.shop | head -3
```

## ⚠️ Caveats

### Let's Encrypt cert renewal จะเสีย

NPM ขอ cert ผ่าน **HTTP-01 challenge** (เปิด `/.well-known/acme-challenge/`) ตอนที่ DNS เป็น direct ทำงานได้ แต่หลัง flip เป็น proxied แล้ว Cloudflare จะ intercept request — Let's Encrypt validate ไม่ผ่าน

**ทางเลือก** (เลือก 1 ใน 2):

1. **Cloudflare Origin Certificate (แนะนำ)**:
   - Cloudflare → SSL/TLS → Origin Server → Create Certificate (อายุ 15 ปี)
   - Paste cert + key เข้า NPM proxy host → SSL → Custom
   - SSL/TLS mode บน CF ตั้งเป็น **Full (strict)**

2. **DNS-01 challenge ผ่าน CF API**:
   - ต้องตั้งค่า acme.sh หรือ certbot ให้รู้จัก CF API token
   - ยุ่งกว่า — แนะนำ Origin Cert แทน

**ก่อน cert หมดอายุครั้งต่อไป** (NPM cert อายุ 90 วันต่อ renewal) ต้องเปลี่ยนเป็น Origin Cert ไม่งั้นเว็บลูกค้า cert พังตอน renewal

### Bridge plugin ยังต่อ panel ได้

Bridge plugin ต่อไปที่ `wss://panel.siamsite.shop/bridge` (subdomain ของ panel ที่ CF-proxied อยู่แล้ว — Cloudflare รองรับ WebSocket) → **ไม่กระทบ**

### Shop backend → panel internal call

Shop backend container เรียก `host.docker.internal:5000` (panel-backend) ผ่าน Docker network ตรงๆ ไม่ผ่าน DNS → **ไม่กระทบ**

## Rollback ทั้งระบบ

ถ้า harden แล้วมีปัญหา (เช่น cert พัง):

```bash
# 1. ปลด DROP rule
sudo ./deploy/harden-mysql-port.sh <shop> --unblock

# 2. ปลด CF proxy
curl -X POST https://panel.siamsite.shop/api/admin/subscriptions/<SUB_ID>/dns-mode \
  -H "Authorization: Bearer <admin-jwt>" -H "Content-Type: application/json" \
  -d '{"mode":"dns-only"}'
```

หรือกดปุ่ม **"ปลดกัน (DNS-only)"** ใน admin panel

## Long-term hardening (ทำเพิ่มเมื่อพร้อม)

- เปลี่ยน NPM ทุก proxy host มาใช้ Cloudflare Origin Cert แทน Let's Encrypt
- เพิ่ม Cloudflare WAF Rate-Limit rule กับ `*.siamsite.shop` (เช่น 100 req/min/IP)
- พิจารณาแยก VPS ของ panel ออกจาก customer shops — ถึงตอนนั้น customer shops โดน DDoS ก็ไม่กระทบ panel เลย
- เปลี่ยน `deploy.service.ts` ให้ default = CF-proxied สำหรับลูกค้า Bridge ตั้งแต่ตอน deploy (ปัจจุบัน default ยังเป็น DNS-only เพื่อ backward compat)
