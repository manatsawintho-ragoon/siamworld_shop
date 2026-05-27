#!/bin/bash
# ================================================================
#  Siamsite Shop — New Customer Deployment Script
#  Ubuntu / Linux Server
#
#  Usage:
#    ./new-customer.sh --name <name> --domain <domain>
#
#  Example:
#    ./new-customer.sh --name craftworld --domain craftworld.siamsite.shop
#
#  Requirements: docker, docker compose v2, jq, openssl
# ================================================================

set -e

# ── Parse arguments ────────────────────────────────────────────
NAME=""
DOMAIN=""
MC_IP=""
BRIDGE_MODE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)   NAME="$2";   shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        --mc-ip)  MC_IP="$2";  shift 2 ;;
        --bridge) BRIDGE_MODE="true"; shift ;;
        -h|--help)
            echo "Usage: $0 --name <name> --domain <domain> [--mc-ip <ip>] [--bridge]"
            echo
            echo "Options:"
            echo "  --bridge   ลูกค้าใช้ Bridge plugin → ไม่เปิด MySQL port ออกข้างนอก"
            echo "             (DDoS protection by default; ลูกค้าตั้ง bridge token บน dashboard)"
            echo
            echo "Example:"
            echo "  $0 --name craftworld --domain craftworld.siamsite.shop --mc-ip 1.2.3.4    # legacy direct AuthMe"
            echo "  $0 --name craftworld --domain craftworld.siamsite.shop --bridge          # Bridge mode (แนะนำ)"
            exit 0
            ;;
        *) echo "[ERROR] Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ "$BRIDGE_MODE" == "true" && -n "$MC_IP" ]]; then
    echo "[WARN] ทั้ง --bridge และ --mc-ip ถูกระบุ — Bridge mode ไม่ใช้ MC_IP (ข้ามการ ACCEPT MySQL port)"
fi

if [[ -z "$NAME" || -z "$DOMAIN" ]]; then
    echo "[ERROR] --name and --domain are required."
    echo "Usage: $0 --name <name> --domain <domain> [--mc-ip <minecraft_server_ip>]"
    exit 1
fi

# ── Validate name ──────────────────────────────────────────────
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$ ]]; then
    echo "[ERROR] Name must be 3-30 lowercase letters/numbers/hyphens. No leading/trailing hyphens."
    exit 1
fi

# ── Check dependencies ─────────────────────────────────────────
for cmd in docker jq openssl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "[ERROR] '$cmd' is required but not installed."
        if [[ "$cmd" == "jq" ]]; then
            echo "  Install with: sudo apt install jq -y"
        fi
        exit 1
    fi
done

# Ensure docker compose v2
if ! docker compose version &>/dev/null; then
    echo "[ERROR] Docker Compose v2 is required."
    echo "  Install with: sudo apt install docker-compose-plugin -y"
    exit 1
fi

# ── Paths ──────────────────────────────────────────────────────
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# SOURCE_ROOT — path the Docker CLIENT uses for build contexts.
# When running inside the panel container the source tree is mounted at /source,
# so the inherited env var (SOURCE_ROOT=/source) is already correct.
# On a bare host, fall back to the parent directory of DEPLOY_DIR.
if [[ -n "${SOURCE_ROOT:-}" && -d "${SOURCE_ROOT}/backend" ]]; then
    : # keep inherited value (container: /source, host already set)
else
    SOURCE_ROOT="$(dirname "$DEPLOY_DIR")"
fi

# HOST_SOURCE_ROOT — path the Docker DAEMON uses for bind mounts.
# The daemon runs on the host, so it needs the real host filesystem path,
# not the container-internal mount path.
# Priority: HOST_SOURCE_ROOT env var (set in panel-compose.yml) → panel.env SOURCE_ROOT → SOURCE_ROOT
if [[ -z "${HOST_SOURCE_ROOT:-}" ]]; then
    PANEL_ENV="$DEPLOY_DIR/panel.env"
    if [[ -f "$PANEL_ENV" ]]; then
        _HR=$(grep '^SOURCE_ROOT=' "$PANEL_ENV" | cut -d= -f2-)
        [[ -n "$_HR" ]] && HOST_SOURCE_ROOT="$_HR"
    fi
fi
HOST_SOURCE_ROOT="${HOST_SOURCE_ROOT:-$SOURCE_ROOT}"

# MYSQL_HOSTNAME — optional DNS-only subdomain for AuthMe plugin (bypasses Cloudflare proxy).
# Read from panel.env if not already set in environment.
if [[ -z "${MYSQL_HOSTNAME:-}" ]]; then
    PANEL_ENV="$DEPLOY_DIR/panel.env"
    if [[ -f "$PANEL_ENV" ]]; then
        _MH=$(grep '^MYSQL_HOSTNAME=' "$PANEL_ENV" | cut -d= -f2-)
        [[ -n "$_MH" ]] && MYSQL_HOSTNAME="$_MH"
    fi
fi

# Validate
if [[ "$SOURCE_ROOT" == "/" || -z "$SOURCE_ROOT" ]]; then
    echo "[ERROR] Cannot locate source root for build context."
    echo "  Set SOURCE_ROOT= in $DEPLOY_DIR/panel.env"
    exit 1
fi
if [[ "$HOST_SOURCE_ROOT" == "/" || -z "$HOST_SOURCE_ROOT" ]]; then
    echo "[ERROR] Cannot locate host source root for volume mounts."
    echo "  Set SOURCE_ROOT= in $DEPLOY_DIR/panel.env"
    exit 1
fi

CUSTOMERS_DIR="$DEPLOY_DIR/customers"
CUSTOMER_DIR="$CUSTOMERS_DIR/$NAME"
CUSTOMER_ENV="$CUSTOMER_DIR/.env"
CUSTOMERS_JSON="$DEPLOY_DIR/customers.json"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.customer.yml"

# ── Load registry ──────────────────────────────────────────────
if [[ -f "$CUSTOMERS_JSON" ]]; then
    FRONTEND_PORT=$(jq -r '.next_frontend_port' "$CUSTOMERS_JSON")
    BACKEND_PORT=$(jq -r '.next_backend_port' "$CUSTOMERS_JSON")

    EXISTING=$(jq -r --arg name "$NAME" '.customers[] | select(.name == $name) | .name' "$CUSTOMERS_JSON")
    if [[ -n "$EXISTING" ]]; then
        echo "[ERROR] Customer '$NAME' already exists."
        echo "  To restart: docker compose --project-name sw-$NAME restart"
        echo "  To manage:  ./manage-customer.sh --action status --name $NAME"
        exit 1
    fi
else
    FRONTEND_PORT=3001
    BACKEND_PORT=4001
fi

MYSQL_EXPOSED_PORT=$((33000 + FRONTEND_PORT - 3001))

# ── Generate secrets ───────────────────────────────────────────
gen_secret() {
    local len=${1:-48}
    openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c "$len"
}

# Idempotent on retry: if a .env from a previous (possibly failed) deploy
# exists, reuse its secrets. Regenerating MYSQL_PASSWORD would diverge from
# the password already baked into the existing MySQL data volume, leaving
# the backend permanently unable to connect.
PREV_MYSQL_PASSWORD=""; PREV_JWT_SECRET=""; PREV_ENCRYPTION_KEY=""
if [[ -f "$CUSTOMER_ENV" ]]; then
    PREV_MYSQL_PASSWORD=$(grep -E '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | head -1 | cut -d= -f2-)
    PREV_JWT_SECRET=$(grep -E '^JWT_SECRET=' "$CUSTOMER_ENV" | head -1 | cut -d= -f2-)
    PREV_ENCRYPTION_KEY=$(grep -E '^ENCRYPTION_KEY=' "$CUSTOMER_ENV" | head -1 | cut -d= -f2-)
fi

MYSQL_PASSWORD=${PREV_MYSQL_PASSWORD:-$(gen_secret 28)}
JWT_SECRET=${PREV_JWT_SECRET:-$(gen_secret 52)}
ENCRYPTION_KEY=${PREV_ENCRYPTION_KEY:-$(gen_secret 52)}

# ── Create customer directory ──────────────────────────────────
mkdir -p "$CUSTOMER_DIR"

# ── Write .env ─────────────────────────────────────────────────
cat > "$CUSTOMER_ENV" << EOF
# ================================================
#  Customer : $NAME
#  Domain   : $DOMAIN
#  Created  : $(date '+%Y-%m-%d %H:%M:%S')
#  Ports    : Frontend=$FRONTEND_PORT  Backend=$BACKEND_PORT
# ================================================

# MySQL
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=siamworld
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_DATABASE=siamworld
MYSQL_EXPOSED_PORT=$MYSQL_EXPOSED_PORT

# Redis (internal)
REDIS_HOST=redis
REDIS_PORT=6379

# Security — DO NOT SHARE
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=$ENCRYPTION_KEY

# API URLs (baked into frontend build)
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
NEXT_PUBLIC_WS_URL=wss://$DOMAIN

# Backend
BACKEND_PORT=$BACKEND_PORT
NODE_ENV=production
CORS_ORIGIN=https://$DOMAIN

# Frontend
FRONTEND_PORT=$FRONTEND_PORT

# Bridge mode — left disabled at deploy time. The panel auto-provisions the 4
# BRIDGE_*/PANEL_BRIDGE_* vars + rebuilds this shop when the customer (or admin)
# clicks "Issue Token" on the dashboard. Setting BRIDGE_ENABLED=true here without
# the other 3 vars would make the shop backend fail zod validation at startup.
BRIDGE_ENABLED=false

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=2000

# MySQL external hostname for AuthMe plugin (DNS-only subdomain bypassing Cloudflare proxy)
# Set MYSQL_HOSTNAME in panel.env to configure this value automatically.
MYSQL_HOSTNAME=${MYSQL_HOSTNAME:-}

# EasySlip — fill in Admin Panel > ตั้งค่า > ระบบเติมเงิน
EASYSLIP_API_KEY=

# Internal paths (do not change)
SOURCE_ROOT=$SOURCE_ROOT
HOST_SOURCE_ROOT=$HOST_SOURCE_ROOT
CUSTOMER_ENV_FILE=$CUSTOMER_ENV
EOF

# ── Print deploy info ──────────────────────────────────────────
echo ""
echo "============================================================"
echo "  Deploying customer : $NAME"
echo "  Domain             : $DOMAIN"
echo "  Frontend port      : $FRONTEND_PORT"
echo "  Backend port       : $BACKEND_PORT"
echo "  MySQL exposed port : $MYSQL_EXPOSED_PORT"
echo "  Minecraft server IP: ${MC_IP:-"(not set — UFW rule skipped)"}"
echo "============================================================"
echo ""
echo "[1/2] Building & starting Docker containers..."
echo "      (First build: 5-10 minutes | Cached: ~30 seconds)"
echo ""

# ── Run Docker Compose ─────────────────────────────────────────
export SOURCE_ROOT
export HOST_SOURCE_ROOT
export CUSTOMER_ENV_FILE="$CUSTOMER_ENV"

docker compose \
    --project-name "sw-$NAME" \
    --env-file "$CUSTOMER_ENV" \
    -f "$COMPOSE_FILE" \
    up -d --build

if [[ $? -ne 0 ]]; then
    echo ""
    echo "[ERROR] Docker Compose failed. See messages above."
    exit 1
fi

# ── Apply DB migrations ────────────────────────────────────────
# init.sql only seeds baseline tables — incremental schema changes
# live in migrations/*.sql and must be applied after MySQL is healthy.
echo ""
echo "[1.5/2] Applying database migrations..."
if ! "$DEPLOY_DIR/apply-migrations.sh" --name "$NAME"; then
    echo ""
    echo "[ERROR] Migrations failed. The shop containers are running but"
    echo "        the DB schema is incomplete. Inspect the output above,"
    echo "        then re-run: ./manage-customer.sh --action migrate --name $NAME"
    exit 1
fi

# ── Update registry ────────────────────────────────────────────
CREATED_AT=$(date '+%Y-%m-%d %H:%M:%S')
NEW_RECORD=$(jq -n \
    --arg  name    "$NAME" \
    --arg  domain  "$DOMAIN" \
    --argjson fp   "$FRONTEND_PORT" \
    --argjson bp   "$BACKEND_PORT" \
    --arg  created "$CREATED_AT" \
    '{name: $name, domain: $domain, frontend_port: $fp, backend_port: $bp, created: $created, status: "running"}')

NEXT_FP=$((FRONTEND_PORT + 1))
NEXT_BP=$((BACKEND_PORT  + 1))

if [[ -f "$CUSTOMERS_JSON" ]]; then
    jq \
        --argjson rec     "$NEW_RECORD" \
        --argjson next_fp "$NEXT_FP" \
        --argjson next_bp "$NEXT_BP" \
        '.customers += [$rec] | .next_frontend_port = $next_fp | .next_backend_port = $next_bp' \
        "$CUSTOMERS_JSON" > /tmp/sw_customers_tmp.json
    mv /tmp/sw_customers_tmp.json "$CUSTOMERS_JSON"
else
    jq -n \
        --argjson rec     "$NEW_RECORD" \
        --argjson next_fp "$NEXT_FP" \
        --argjson next_bp "$NEXT_BP" \
        '{next_frontend_port: $next_fp, next_backend_port: $next_bp, customers: [$rec]}' \
        > "$CUSTOMERS_JSON"
fi

# ── Host firewall rules for the MySQL port ─────────────────────
if [[ "$BRIDGE_MODE" == "true" ]]; then
    # Bridge customers don't need external MySQL access — block at the host
    # firewall by default. Inserts DROP right before DOCKER-USER's catch-all
    # ACCEPT so CF/Docker-subnet ACCEPTs higher up still match first.
    echo "[UFW] Bridge mode — บล็อก MySQL port $MYSQL_EXPOSED_PORT จาก external (DDoS protection)"
    CATCH_POS=$(nsenter -t 1 -m -u -i -n -p -- /usr/sbin/iptables -L DOCKER-USER -n --line-numbers -v 2>/dev/null \
        | awk '$4=="ACCEPT" && $7=="*" && $8=="*" && $9=="0.0.0.0/0" && $10=="0.0.0.0/0" && NF==10 {pos=$1} END{print pos}')
    if [[ -n "$CATCH_POS" && "$CATCH_POS" =~ ^[0-9]+$ ]]; then
        nsenter -t 1 -m -u -i -n -p -- /usr/sbin/iptables -I DOCKER-USER "$CATCH_POS" -p tcp --dport "$MYSQL_EXPOSED_PORT" -j DROP 2>/dev/null \
            && echo "[UFW] DROP ใส่แล้วที่ position $CATCH_POS (ก่อน catch-all)"
    else
        nsenter -t 1 -m -u -i -n -p -- /usr/sbin/iptables -A DOCKER-USER -p tcp --dport "$MYSQL_EXPOSED_PORT" -j DROP 2>/dev/null \
            && echo "[UFW] DROP ใส่แล้วด้วย -A (ไม่พบ catch-all)"
    fi
    nsenter -t 1 -m -u -i -n -p -- /usr/sbin/netfilter-persistent save 2>/dev/null || true
elif [[ -n "$MC_IP" ]]; then
    echo "[UFW] เพิ่ม firewall rule สำหรับ MySQL port $MYSQL_EXPOSED_PORT จาก $MC_IP..."
    nsenter -t 1 -m -u -i -n -p -- /usr/sbin/iptables -I DOCKER-USER 1 -p tcp --dport "$MYSQL_EXPOSED_PORT" -s "$MC_IP" -j ACCEPT 2>/dev/null && \
    nsenter -t 1 -m -u -i -n -p -- /usr/sbin/netfilter-persistent save 2>/dev/null || \
        echo "[FW] WARNING: ไม่สามารถเพิ่ม rule ได้ — กรุณาเพิ่มด้วยตนเอง: iptables -I DOCKER-USER 1 -p tcp --dport $MYSQL_EXPOSED_PORT -s $MC_IP -j ACCEPT"
    echo "[UFW] เสร็จแล้ว"
else
    echo "[UFW] ไม่ได้ระบุ --mc-ip — ข้ามการตั้งค่า firewall"
    echo "[UFW] หมายเหตุ: MySQL port $MYSQL_EXPOSED_PORT ยังไม่ถูกจำกัด IP"
fi

# ── Print NPM instructions ─────────────────────────────────────
echo ""
echo "============================================================"
echo "  SUCCESS! '$NAME' is running"
echo "============================================================"
echo ""
echo "[2/2] Setup Nginx Proxy Manager:"
echo "  Open: http://$(hostname -I | awk '{print $1}'):81"
echo ""
echo "  Add Proxy Host:"
echo "    Domain Names  : $DOMAIN"
echo "    Forward Host  : host.docker.internal"
echo "    Forward Port  : $FRONTEND_PORT"
echo "    Websockets    : ON"
echo "    Enable SSL    : Yes (Let's Encrypt)"
echo "    Force SSL     : Yes"
echo ""
echo "  In 'Advanced' tab, paste:"
echo ""
cat << NGINX_CONF
location /api/ {
    proxy_pass         http://host.docker.internal:$BACKEND_PORT/api/;
    proxy_http_version 1.1;
    proxy_set_header   Host              \$host;
    proxy_set_header   X-Real-IP         \$remote_addr;
    proxy_set_header   X-Forwarded-Proto \$scheme;
}
location /socket.io/ {
    proxy_pass         http://host.docker.internal:$BACKEND_PORT/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    \$http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       \$host;
}
NGINX_CONF
echo ""
echo "  First-time setup URL (share with customer):"
echo "    https://$DOMAIN/admin/setup"
echo ""
echo "  Credentials saved at:"
echo "    $CUSTOMER_ENV"
echo ""
echo "============================================================"
echo "  AuthMe Plugin (config.yml) — ส่งให้ลูกค้าตั้งค่า"
echo "============================================================"
echo ""
echo "  แก้ไข plugins/AuthMe/config.yml บน Minecraft server:"
echo ""
echo "    DataSource:"
echo "      backend: MYSQL"
echo "      caching: false"
echo "      mySQLHost: ${MYSQL_HOSTNAME:-$DOMAIN}"
echo "      mySQLPort: '$MYSQL_EXPOSED_PORT'"
echo "      mySQLUseSSL: true"
echo "      mySQLCheckServerCertificate: false"
echo "      mySQLAllowPublicKeyRetrieval: true"
echo "      mySQLUsername: siamworld"
echo "      mySQLPassword: '$MYSQL_PASSWORD'"
echo "      mySQLDatabase: siamworld"
echo "      mySQLTablename: authme"
echo "      poolSize: 10"
echo "      maxLifetime: 1770"
echo ""
echo "  สำคัญ:"
echo "    - caching: false   (ต้อง false เพราะมี web integration)"
echo "    - maxLifetime: 1770  (ต้อง < wait_timeout 1800 บน MySQL)"
echo "    - หลังแก้ config ให้ restart Minecraft server"
echo ""
echo "============================================================"
echo "  AuthMe Connection Mode — เลือกตามความต้องการ"
echo "============================================================"
echo ""
echo "  Option 1 (Default — ง่าย, ไม่ต้องตั้งค่าเพิ่ม)"
echo "  ─────────────────────────────────────────────────────"
echo "  AuthMe → Panel MySQL (ตาม config ด้านบน)"
echo "  ✓ ไม่ต้องทำอะไรเพิ่ม"
echo "  ✗ ถ้า Panel server ดับ = Minecraft server login ไม่ได้"
echo ""
echo "  Option 2 (HA — Minecraft ทำงานได้แม้ Panel ดับ)"
echo "  ─────────────────────────────────────────────────────"
echo "  Customer MySQL (Master) → Panel MySQL (Replica)"
echo "  AuthMe → localhost (customer's own MySQL)"
echo "  ✓ Panel ดับ = Minecraft ยัง login/register ได้ปกติ"
echo "  ✓ replication sync อัตโนมัติเมื่อ Panel กลับมา"
echo "  ต้องการ: Tailscale + MySQL บนเครื่อง Minecraft"
echo ""
echo "  วิธี upgrade เป็น Option 2 (ทำทีหลังได้):"
echo "  1. (มีข้อมูลเก่า) ./manage-customer.sh --action migrate-to-replica --name $NAME"
echo "  2.                 ./manage-customer.sh --action setup-replica      --name $NAME"
echo "  3.                 ./manage-customer.sh --action connect-replica    --name $NAME --host <tailscale-ip>"
echo ""
