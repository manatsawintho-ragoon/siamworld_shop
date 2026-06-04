#!/usr/bin/env bash
# ============================================================
#  harden-web-ports.sh — block direct-to-IP access on 80/443
#
#  ป้องกัน DDoS ที่ bypass Cloudflare โดยยิงตรงไปที่ VPS IP บน
#  port 80/443 (ผู้โจมตีหา VPS IP ได้จาก DNS-only records เช่น
#  db.siamsite.shop, ssh.siamsite.shop, หรือ historical DNS).
#
#  Strategy:
#    - DOCKER-USER chain มี ACCEPT สำหรับทุก Cloudflare IPv4 ranges
#      อยู่แล้ว (ตั้งโดย admin ก่อนหน้า) — traffic จาก CF ผ่านได้
#    - เพิ่ม DROP สำหรับ port 80/443 *ก่อน catch-all ACCEPT*
#      → CF IPs ที่ accept ด้านบน fires first → through
#      → non-CF IPs ตกถึง DROP → blocked
#    - Idempotent: re-running ไม่ทำซ้ำ
#    - Reversible: --unblock ลบ DROP rules
#
#  ผลกระทบ:
#    ✓ ป้องกัน direct-to-IP DDoS บน HTTP/HTTPS
#    ✓ ลูกค้าทุกราย (CF-proxied อยู่แล้ว via wildcard *.siamsite.shop)
#      ใช้งานได้ต่อ — traffic วิ่งผ่าน CF
#    ✓ Let's Encrypt HTTP-01 renewal ยังทำงานเพราะ LE → DNS → CF →
#      origin (CF passes /.well-known/acme-challenge/ through ตามปกติ)
#    ✗ DNS-only subdomain (yokaicraft, db, ssh) ที่เข้าทาง HTTPS โดยตรง
#      จะถูก DROP — admin ต้อง flip เป็น CF-proxied หรือ migrate ไป DNS-01
#
#  Usage:
#    sudo ./harden-web-ports.sh                # block non-CF on 80/443
#    sudo ./harden-web-ports.sh --unblock      # rollback
#    sudo ./harden-web-ports.sh --status       # show current rules
# ============================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ต้อง sudo: sudo $0 $@" >&2
  exit 1
fi

MODE="${1:-block}"
IPT="/usr/sbin/iptables"
PORTS=(80 443)

rule_exists() {
  local port="$1"
  nsenter -t 1 -m -u -i -n -p -- $IPT -C DOCKER-USER -p tcp --dport "$port" -j DROP 2>/dev/null
}

find_catchall_pos() {
  nsenter -t 1 -m -u -i -n -p -- $IPT -L DOCKER-USER -n --line-numbers -v \
    | awk '$4=="ACCEPT" && $7=="*" && $8=="*" && $9=="0.0.0.0/0" && $10=="0.0.0.0/0" && NF==10 {pos=$1} END{print pos}'
}

count_cf_accepts() {
  local port="$1"
  nsenter -t 1 -m -u -i -n -p -- $IPT -L DOCKER-USER -n --line-numbers -v \
    | awk -v p="dpt:$port" '$0 ~ p && $4=="ACCEPT" && $9 != "0.0.0.0/0" {count++} END{print count+0}'
}

if [[ "$MODE" == "--status" ]]; then
  echo "Current DOCKER-USER state for ports 80/443:"
  for port in "${PORTS[@]}"; do
    echo
    echo "── port $port ──"
    nsenter -t 1 -m -u -i -n -p -- $IPT -L DOCKER-USER -n --line-numbers -v \
      | awk -v p="dpt:$port" '/dpt:/ && $0 ~ p {print}'
    echo "  CF ACCEPT rules:  $(count_cf_accepts $port)"
    if rule_exists "$port"; then
      echo "  DROP rule:        YES (port $port hardened)"
    else
      echo "  DROP rule:        no (port $port reachable from any IP)"
    fi
  done
  exit 0
fi

if [[ "$MODE" == "--unblock" ]]; then
  for port in "${PORTS[@]}"; do
    if rule_exists "$port"; then
      nsenter -t 1 -m -u -i -n -p -- $IPT -D DOCKER-USER -p tcp --dport "$port" -j DROP
      echo "[OK] ลบ DROP rule สำหรับ port $port"
    else
      echo "[NOOP] ไม่มี DROP rule สำหรับ port $port อยู่แล้ว"
    fi
  done
  echo
  echo "⚠️  ports 80/443 ตอนนี้รับ traffic จากทุก source — origin IP exposed อีกครั้ง"
  exit 0
fi

# Block mode: sanity-check CF ACCEPTs exist before applying DROP.
# If CF ACCEPTs are missing, the DROP would block ALL traffic including legitimate CF.
for port in "${PORTS[@]}"; do
  cf_count=$(count_cf_accepts "$port")
  if [[ "$cf_count" -lt 5 ]]; then
    echo "[ERR] พบ ACCEPT rule สำหรับ Cloudflare IP บน port $port เพียง $cf_count ตัว — น้อยกว่า 5 (ปกติ 15)"
    echo "       ไม่ apply DROP ป้องกันลูกค้าทุกรายเข้าไม่ได้"
    echo "       แก้: เพิ่ม CF IPv4 ranges บน DOCKER-USER ก่อน (https://www.cloudflare.com/ips-v4/)"
    exit 1
  fi
done

CATCH_POS="$(find_catchall_pos || true)"

for port in "${PORTS[@]}"; do
  if rule_exists "$port"; then
    echo "[NOOP] DROP rule สำหรับ port $port มีอยู่แล้ว"
    continue
  fi

  if [[ -n "$CATCH_POS" && "$CATCH_POS" =~ ^[0-9]+$ ]]; then
    nsenter -t 1 -m -u -i -n -p -- $IPT -I DOCKER-USER "$CATCH_POS" -p tcp --dport "$port" -j DROP
    echo "[OK] เพิ่ม DROP port $port ที่ position $CATCH_POS (ก่อน catch-all)"
    # Re-find catch-all because position shifted +1 each insert
    CATCH_POS="$(find_catchall_pos)"
  else
    nsenter -t 1 -m -u -i -n -p -- $IPT -A DOCKER-USER -p tcp --dport "$port" -j DROP
    echo "[OK] ใส่ DROP port $port แบบ append (ไม่พบ catch-all)"
  fi
done

echo
echo "เสร็จแล้ว — ตรวจสถานะปัจจุบัน:"
"$0" --status

echo
echo "🔒 Cloudflare traffic ยัง pass through (CF IPs ACCEPT'd ก่อน DROP)"
echo "🔍 Verify จากเครื่อง *นอก* VPS (ที่ไม่ใช่ CF):"
echo "    nc -zv 49.231.43.49 443     # ต้องได้ 'connection refused' หรือ timeout"
echo "    curl -sI https://siamsite.shop  # ต้องผ่าน เพราะ CF resolves + proxies"
echo
echo "⚠️  ลูกค้าที่ DNS-only (yokaicraft, db, ssh) เข้าทาง HTTPS โดยตรงไม่ได้แล้ว"
echo "    ตรวจ: dig +short yokaicraft.siamsite.shop"
echo "    ถ้าได้ VPS IP (49.231.43.49) ต้อง flip เป็น proxied ใน CF ก่อน LE renewal"
