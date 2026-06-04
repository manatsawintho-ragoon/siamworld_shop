#!/usr/bin/env bash
# ============================================================
#  harden-mysql-port.sh — block a customer's MySQL port from
#  external access via DOCKER-USER chain.
#
#  Use this AFTER a customer migrates to Bridge mode and you've
#  flipped their DNS to Cloudflare-proxied in the admin panel
#  (which hides the origin IP from web traffic). Closing the
#  MySQL port removes the last vector for an attacker who has
#  already learned the VPS IP (e.g. from another DNS-only shop).
#
#  Usage:
#    sudo ./harden-mysql-port.sh <shop-name>           # block
#    sudo ./harden-mysql-port.sh <shop-name> --unblock # rollback
#
#  Behavior:
#    - Reads MYSQL_EXPOSED_PORT from deploy/customers/<shop>/.env
#    - Inserts DROP into DOCKER-USER *right before* the catch-all
#      `ACCEPT 0.0.0.0/0 -> 0.0.0.0/0` (the rule that lets non-matched
#      traffic through to Docker's NAT). This way:
#        - Docker subnet ACCEPT rules above still allow internal
#          container→container traffic to MySQL.
#        - External traffic falls through subnet ACCEPTs (no match,
#          source not in 172.x.x.x), hits our DROP, and is denied
#          before reaching Docker's NAT rules.
#      If the catch-all isn't present (some Docker installs), falls
#      back to -A (append) which works on those layouts.
#    - --unblock removes the DROP rule
#    - Idempotent: re-running won't duplicate rules
#
#  Why DOCKER-USER and not UFW?
#    Docker bypasses UFW. DOCKER-USER is the only chain that runs
#    before Docker's NAT rules for container ports.
# ============================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ต้อง sudo: sudo $0 $@" >&2
  exit 1
fi

SHOP="${1:-}"
MODE="${2:-block}"

if [[ -z "$SHOP" ]]; then
  echo "Usage: sudo $0 <shop-name> [--unblock]"
  echo "Lists available customers:"
  ls deploy/customers/ 2>/dev/null | sed 's/^/  - /' || ls /home/*/siamworld_shop/deploy/customers/ 2>/dev/null | sed 's/^/  - /'
  exit 1
fi

# Locate the customer env file (works whether script is run from repo root or deploy/)
ENV_FILE=""
for candidate in "deploy/customers/$SHOP/.env" "customers/$SHOP/.env" "$SHOP/.env"; do
  if [[ -f "$candidate" ]]; then ENV_FILE="$candidate"; break; fi
done
if [[ -z "$ENV_FILE" ]]; then
  echo "[ERR] ไม่พบ .env ของ $SHOP — รัน script จาก repo root หรือ deploy/ ครับ" >&2
  exit 1
fi

PORT="$(grep '^MYSQL_EXPOSED_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]"')"
if [[ -z "$PORT" || ! "$PORT" =~ ^[0-9]+$ ]]; then
  echo "[ERR] อ่าน MYSQL_EXPOSED_PORT จาก $ENV_FILE ไม่ได้" >&2
  exit 1
fi

IPT="/usr/sbin/iptables"

rule_exists() {
  # Check via -C (return 0 if rule is present). Suppress noise.
  nsenter -t 1 -m -u -i -n -p -- $IPT -C DOCKER-USER -p tcp --dport "$PORT" -j DROP 2>/dev/null
}

if [[ "$MODE" == "--unblock" ]]; then
  if rule_exists; then
    nsenter -t 1 -m -u -i -n -p -- $IPT -D DOCKER-USER -p tcp --dport "$PORT" -j DROP
    echo "[OK] ลบ DROP rule สำหรับ port $PORT แล้ว — MySQL เปิดให้ external เหมือนเดิม"
  else
    echo "[NOOP] ไม่มี DROP rule สำหรับ port $PORT อยู่แล้ว"
  fi
  exit 0
fi

# Find line number of the catch-all "ACCEPT all -- 0.0.0.0/0 0.0.0.0/0".
# If found, insert DROP at that line (DROP goes before catch-all, catch-all
# moves down by 1). If not found, fall back to append.
find_catchall_pos() {
  # Need -v to see the in/out interface columns; a rule that's bare in the
  # non-verbose output can actually have `in=br+` (internal-only). The true
  # catch-all has in=* AND out=* AND no conntrack/extra match. Take the LAST
  # such rule (typically the final fallthrough ACCEPT).
  nsenter -t 1 -m -u -i -n -p -- $IPT -L DOCKER-USER -n --line-numbers -v \
    | awk '$4=="ACCEPT" && $7=="*" && $8=="*" && $9=="0.0.0.0/0" && $10=="0.0.0.0/0" && NF==10 {pos=$1} END{print pos}'
}

if rule_exists; then
  echo "[NOOP] DROP rule สำหรับ port $PORT มีอยู่แล้ว — $SHOP ถูก harden แล้ว"
else
  CATCH_POS="$(find_catchall_pos || true)"
  if [[ -n "$CATCH_POS" && "$CATCH_POS" =~ ^[0-9]+$ ]]; then
    nsenter -t 1 -m -u -i -n -p -- $IPT -I DOCKER-USER "$CATCH_POS" -p tcp --dport "$PORT" -j DROP
    echo "[OK] ใส่ DROP ที่ position $CATCH_POS (ก่อน catch-all ACCEPT) สำหรับ port $PORT ของ $SHOP"
  else
    nsenter -t 1 -m -u -i -n -p -- $IPT -A DOCKER-USER -p tcp --dport "$PORT" -j DROP
    echo "[OK] ไม่พบ catch-all ACCEPT — ใช้ -A แทน สำหรับ port $PORT ของ $SHOP"
  fi
fi

echo
echo "ตรวจ rule ใน DOCKER-USER (DROP ของเราควรอยู่ position 1):"
nsenter -t 1 -m -u -i -n -p -- $IPT -L DOCKER-USER -n --line-numbers -v | head -10

echo
echo "Self-test (ภายใน VPS — ควรเชื่อมต่อ MySQL container ได้):"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "sw-${SHOP}-mysql"; then
  if docker exec "sw-${SHOP}-mysql-1" sh -c "command -v nc >/dev/null && nc -z 127.0.0.1 3306 && echo 'OK: internal MySQL still reachable from container'" 2>/dev/null; then
    :
  else
    echo "  (ข้าม — container ไม่มี nc หรือ container ยังไม่พร้อม)"
  fi
fi
echo
echo "⚠ ต้องทดสอบจาก *นอก* VPS ด้วย — รันจากเครื่องอื่น:"
echo "    nc -zv <vps-ip> $PORT     # ต้องได้ 'connection refused' หรือ 'timed out'"
echo "    ถ้ายังเชื่อมต่อได้แสดงว่า rule ไม่ทำงาน — รัน --unblock แล้วแจ้ง dev ตรวจ"
