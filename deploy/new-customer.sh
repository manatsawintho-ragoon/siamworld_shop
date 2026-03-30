#!/bin/bash
# ================================================================
#  SiamWorld Shop — New Customer Deployment Script
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

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)   NAME="$2";   shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 --name <name> --domain <domain>"
            echo "Example: $0 --name craftworld --domain craftworld.siamsite.shop"
            exit 0
            ;;
        *) echo "[ERROR] Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ -z "$NAME" || -z "$DOMAIN" ]]; then
    echo "[ERROR] --name and --domain are required."
    echo "Usage: $0 --name <name> --domain <domain>"
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
SOURCE_ROOT="$(dirname "$DEPLOY_DIR")"
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

MYSQL_PASSWORD=$(gen_secret 28)
JWT_SECRET=$(gen_secret 52)
ENCRYPTION_KEY=$(gen_secret 52)

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

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300

# EasySlip — fill in Admin Panel > ตั้งค่า > ระบบเติมเงิน
EASYSLIP_API_KEY=

# Internal paths (do not change)
SOURCE_ROOT=$SOURCE_ROOT
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
echo "============================================================"
echo ""
echo "[1/2] Building & starting Docker containers..."
echo "      (First build: 5-10 minutes | Cached: ~30 seconds)"
echo ""

# ── Run Docker Compose ─────────────────────────────────────────
export SOURCE_ROOT
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
