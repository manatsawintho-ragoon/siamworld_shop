#!/bin/bash
# ============================================================
#  Siamsite Panel — First-time Setup Script
#  Run once on the VPS to set up the panel
#
#  Usage: ./setup-panel.sh
# ============================================================

set -e

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/panel.env"
ENV_EXAMPLE="$DEPLOY_DIR/panel.env.example"

echo ""
echo "============================================================"
echo "  Siamsite Panel — Setup"
echo "============================================================"
echo ""

# Check dependencies
for cmd in docker jq openssl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "[ERROR] '$cmd' is required. Install it first."
        exit 1
    fi
done

if ! docker compose version &>/dev/null; then
    echo "[ERROR] Docker Compose v2 is required."
    exit 1
fi

# Create panel.env if not exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[1/4] Creating panel.env..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    PANEL_DOMAIN=""
    while [[ -z "$PANEL_DOMAIN" ]]; do
        read -rp "  Panel domain (e.g. panel.siamsite.shop): " PANEL_DOMAIN
    done

    ROOT_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 28)
    PANEL_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 28)
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 52)

    sed -i "s|panel.siamsite.shop|$PANEL_DOMAIN|g" "$ENV_FILE"
    sed -i "s|/path/to/siamsite_shop|$SOURCE_ROOT|g" "$ENV_FILE"
    sed -i "s|change_me_root_password|$ROOT_PASS|g" "$ENV_FILE"
    sed -i "s|change_me_panel_password|$PANEL_PASS|g" "$ENV_FILE"
    sed -i "s|change_me_jwt_secret_min_32_chars|$JWT_SECRET|g" "$ENV_FILE"

    echo "  panel.env created."
else
    echo "[1/4] panel.env already exists, skipping."
    source "$ENV_FILE"
fi

echo ""
echo "[2/4] Building and starting Panel containers..."
docker compose -f "$DEPLOY_DIR/panel-compose.yml" --env-file "$ENV_FILE" up -d --build

echo ""
echo "[3/4] Waiting for database to be ready..."
sleep 10

echo ""
echo "[4/4] Creating admin account..."
read -rp "  Admin email: " ADMIN_EMAIL
read -rsp "  Admin password (min 8 chars): " ADMIN_PASSWORD
echo ""

# Create admin via API
source "$ENV_FILE"
BACKEND_URL="http://localhost:5000"

# Register
RESP=$(curl -s -X POST "$BACKEND_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"displayName\":\"Admin\"}" 2>/dev/null)

TOKEN=$(echo "$RESP" | jq -r '.token // empty' 2>/dev/null)
if [[ -z "$TOKEN" ]]; then
    echo "  [WARN] Could not auto-create admin. Register manually at https://$PANEL_DOMAIN/register"
    echo "  Then update role in database: UPDATE panel_users SET role='admin' WHERE email='$ADMIN_EMAIL';"
else
    # Set admin role directly in MySQL
    docker exec panel-mysql mysql -u root -p"$(grep PANEL_MYSQL_ROOT_PASSWORD "$ENV_FILE" | cut -d= -f2)" \
        siamworld_panel -e "UPDATE panel_users SET role='admin' WHERE email='$ADMIN_EMAIL';" 2>/dev/null || true
    echo "  Admin account created!"
fi

echo ""
echo "============================================================"
echo "  Setup complete!"
echo "============================================================"
echo ""
echo "  Panel URL    : https://$PANEL_DOMAIN"
echo "  Admin Panel  : https://$PANEL_DOMAIN/admin"
echo ""
echo "  Next steps:"
echo "  1. Add proxy host in Nginx Proxy Manager:"
echo "     Domain: $PANEL_DOMAIN"
echo "     Forward: host.docker.internal:2000"
echo "     SSL: Let's Encrypt"
echo "     Advanced config:"
echo ""
echo "     location /api/ {"
echo "         proxy_pass http://host.docker.internal:5000/api/;"
echo "         proxy_http_version 1.1;"
echo "         proxy_set_header Host \$host;"
echo "         proxy_set_header X-Real-IP \$remote_addr;"
echo "         proxy_set_header X-Forwarded-Proto \$scheme;"
echo "     }"
echo ""
echo "  2. Log in to Admin Panel and configure:"
echo "     - PromptPay number + EasySlip API Key"
echo "     - NPM URL + credentials"
echo "     - LINE Notify token"
echo ""
