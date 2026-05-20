#!/bin/bash
# ================================================================
#  Siamsite Shop — Customer Management Script
#  Ubuntu / Linux Server
#
#  Usage:
#    ./manage-customer.sh --action list
#    ./manage-customer.sh --action status             --name <name>
#    ./manage-customer.sh --action start              --name <name>
#    ./manage-customer.sh --action stop               --name <name>
#    ./manage-customer.sh --action restart            --name <name>
#    ./manage-customer.sh --action rebuild            --name <name>
#    ./manage-customer.sh --action logs               --name <name>
#    ./manage-customer.sh --action remove             --name <name>   # WARNING: deletes all data
#
#  AuthMe HA — Minecraft ยังทำงานได้เมื่อ Panel ดับ (Option 2):
#    Step 0 (มีข้อมูลเก่า): ./manage-customer.sh --action migrate-to-replica --name <name>
#    Step 1:                 ./manage-customer.sh --action setup-replica      --name <name>
#    Step 2:                 ./manage-customer.sh --action connect-replica    --name <name> --host <tailscale-ip>
#    ตรวจสอบ:               ./manage-customer.sh --action check-replica      --name <name>
# ================================================================

set -e

ACTION="list"
NAME=""
HOST=""
FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --action) ACTION="$2"; shift 2 ;;
        --name)   NAME="$2";   shift 2 ;;
        --host)   HOST="$2";   shift 2 ;;
        --file)   FILE="$2";   shift 2 ;;
        -h|--help)
            echo "Usage: $0 --action <action> [--name <name>]"
            echo "Basic:   list, status, start, stop, restart, rebuild, migrate, logs, remove"
            echo "Migrate: import-sqlite --name <name> --file <authme.db>"
            echo "HA:      migrate-to-replica, setup-replica, connect-replica --host <ip>, check-replica"
            exit 0
            ;;
        *) echo "[ERROR] Unknown argument: $1"; exit 1 ;;
    esac
done

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOMERS_DIR="$DEPLOY_DIR/customers"
CUSTOMERS_JSON="$DEPLOY_DIR/customers.json"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.customer.yml"

# ── Helpers ────────────────────────────────────────────────────
require_json() {
    if [[ ! -f "$CUSTOMERS_JSON" ]]; then
        echo "(no customers deployed yet)"
        exit 0
    fi
}

load_customer() {
    jq -e -r --arg n "$1" '.customers[] | select(.name == $n)' "$CUSTOMERS_JSON" 2>/dev/null || true
}

# ── LIST ──────────────────────────────────────────────────────
if [[ "$ACTION" == "list" || -z "$NAME" ]]; then
    require_json
    echo ""
    echo "  Deployed Customers"
    echo "  ───────────────────────────────────────────────────────────"
    printf "  %-20s %-35s %-8s %-8s %s\n" "NAME" "DOMAIN" "FE PORT" "BE PORT" "STATUS"
    echo "  ───────────────────────────────────────────────────────────"

    COUNT=$(jq '.customers | length' "$CUSTOMERS_JSON")
    if [[ "$COUNT" -eq 0 ]]; then
        echo "  (no customers deployed yet)"
    else
        while IFS=$'\t' read -r name domain fp bp; do
            CONTAINER="sw-${name}-frontend-1"
            STATUS=$(docker inspect "$CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "stopped")
            if [[ "$STATUS" == "running" ]]; then
                COLOR="\033[32m"
            else
                COLOR="\033[31m"
            fi
            printf "  ${COLOR}%-20s %-35s %-8s %-8s [%s]\033[0m\n" "$name" "$domain" "$fp" "$bp" "$STATUS"
        done < <(jq -r '.customers[] | [.name, .domain, (.frontend_port|tostring), (.backend_port|tostring)] | @tsv' "$CUSTOMERS_JSON")
    fi
    echo ""
    exit 0
fi

# ── Resolve customer ──────────────────────────────────────────
require_json
CUSTOMER_DATA=$(load_customer "$NAME")

if [[ -z "$CUSTOMER_DATA" ]]; then
    echo "[ERROR] Customer '$NAME' not found."
    echo "  Run: ./manage-customer.sh --action list"
    exit 1
fi

CUSTOMER_ENV="$CUSTOMERS_DIR/$NAME/.env"

if [[ -n "${SOURCE_ROOT:-}" && -d "${SOURCE_ROOT}/backend" ]]; then
    :
else
    SOURCE_ROOT="$(dirname "$DEPLOY_DIR")"
fi
export SOURCE_ROOT

if [[ -z "${HOST_SOURCE_ROOT:-}" ]]; then
    PANEL_ENV="$DEPLOY_DIR/panel.env"
    if [[ -f "$PANEL_ENV" ]]; then
        _HR=$(grep '^SOURCE_ROOT=' "$PANEL_ENV" | cut -d= -f2-)
        [[ -n "$_HR" ]] && HOST_SOURCE_ROOT="$_HR"
    fi
fi
export HOST_SOURCE_ROOT="${HOST_SOURCE_ROOT:-$SOURCE_ROOT}"
export CUSTOMER_ENV_FILE="$CUSTOMER_ENV"

# ── ACTIONS ───────────────────────────────────────────────────
case "$ACTION" in

    start)
        echo "Starting $NAME..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" start
        echo "Done."
        ;;

    stop)
        echo "Stopping $NAME..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" stop
        echo "Done."
        ;;

    restart)
        echo "Restarting $NAME..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" restart
        echo "Done."
        ;;

    rebuild)
        echo "Rebuilding and restarting $NAME..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" \
            up -d --build --no-deps backend
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" \
            up -d --build --no-deps frontend
        # Apply any new DB migrations introduced since last rebuild
        if [[ -x "$DEPLOY_DIR/apply-migrations.sh" ]]; then
            "$DEPLOY_DIR/apply-migrations.sh" --name "$NAME" || \
                echo "[WARN] Migrations failed for $NAME — re-run manually with: $0 --action migrate --name $NAME"
        fi
        echo "Done. Check logs with: $0 --action logs --name $NAME"
        ;;

    migrate)
        echo "Applying DB migrations for $NAME..."
        "$DEPLOY_DIR/apply-migrations.sh" --name "$NAME"
        ;;

    logs)
        echo "Logs for $NAME (Ctrl+C to exit):"
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" logs -f --tail=100
        ;;

    status)
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" ps
        ;;

    remove)
        echo ""
        echo "  !! WARNING !!"
        echo "  This will PERMANENTLY DELETE all data for '$NAME'"
        echo "  including the MySQL database and all customer data."
        echo ""
        read -rp "  Type the customer name to confirm removal: " CONFIRM
        if [[ "$CONFIRM" != "$NAME" ]]; then
            echo "Cancelled."
            exit 0
        fi
        echo "Removing $NAME..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" down -v
        rm -rf "$CUSTOMERS_DIR/$NAME"
        jq --arg n "$NAME" '.customers = [.customers[] | select(.name != $n)]' \
            "$CUSTOMERS_JSON" > /tmp/sw_customers_tmp.json
        mv /tmp/sw_customers_tmp.json "$CUSTOMERS_JSON"
        echo "Customer '$NAME' has been removed."
        ;;

    # ════════════════════════════════════════════════════════════
    # SQLite Migration — import authme.db into panel MySQL
    # ════════════════════════════════════════════════════════════

    import-sqlite)
        if [[ -z "$FILE" ]]; then
            echo "[ERROR] ต้องระบุ --file <path-to-authme.db>"
            echo "Usage: $0 --action import-sqlite --name $NAME --file /path/to/authme.db"
            exit 1
        fi

        if [[ ! -f "$FILE" ]]; then
            echo "[ERROR] ไม่พบไฟล์: $FILE"
            exit 1
        fi

        # ── ตรวจสอบ sqlite3 ──────────────────────────────────────
        if ! command -v sqlite3 &>/dev/null; then
            echo "[ERROR] ต้องติดตั้ง sqlite3 ก่อน:"
            echo "  sudo apt install sqlite3 -y"
            exit 1
        fi

        # ── ตรวจสอบว่าเป็น SQLite authme database ───────────────
        FILE_TYPE=$(file "$FILE" 2>/dev/null)
        if ! echo "$FILE_TYPE" | grep -qi 'sqlite'; then
            echo "[ERROR] ไฟล์นี้ไม่ใช่ SQLite database: $FILE"
            echo "  ($FILE_TYPE)"
            exit 1
        fi

        if ! sqlite3 "$FILE" "SELECT 1 FROM authme LIMIT 1;" &>/dev/null; then
            echo "[ERROR] ไม่พบ authme table ในไฟล์นี้"
            echo "  ตรวจสอบชื่อ table: sqlite3 '$FILE' '.tables'"
            exit 1
        fi

        MYSQL_PASS=$(grep '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_DB=$(grep '^MYSQL_DATABASE='   "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_CONTAINER="sw-${NAME}-mysql-1"

        SQLITE_COUNT=$(sqlite3 "$FILE" "SELECT COUNT(*) FROM authme;")
        BEFORE_COUNT=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM $MYSQL_DB.authme;" 2>/dev/null || echo "0")

        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  Import AuthMe SQLite → MySQL                                ║"
        printf "║  Customer : %-50s║\n" "$NAME"
        printf "║  File     : %-50s║\n" "$(basename "$FILE")"
        printf "║  Accounts : %-50s║\n" "$SQLITE_COUNT in file / $BEFORE_COUNT in MySQL"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""

        # ── ดึง columns จาก SQLite (รองรับ schema ต่างกัน) ──────
        SQLITE_COLS=$(sqlite3 "$FILE" "PRAGMA table_info(authme);" \
            | awk -F'|' '$2 != "id" {print $2}' | tr '\n' ',' | sed 's/,$//')

        echo "  Columns ใน SQLite: $SQLITE_COLS"
        echo ""
        echo "  กำลัง convert และ import..."

        # ── Convert SQLite → MySQL INSERT IGNORE (Python3) ───────
        # - ไม่ใช้ id (MySQL กำหนด auto-increment เอง)
        # - INSERT IGNORE: username ซ้ำ = ข้าม, ใหม่ = เพิ่ม
        # - Python3 จัดการ escaping และ NULL อย่างถูกต้อง
        SQL_DATA=$(python3 - "$FILE" <<'PYEOF'
import sqlite3, sys

conn = sqlite3.connect(sys.argv[1])
cur = conn.cursor()

cur.execute("PRAGMA table_info(authme)")
cols = [row[1] for row in cur.fetchall() if row[1] != 'id']
col_list = ','.join('`' + c + '`' for c in cols)

cur.execute("SELECT " + ','.join(cols) + " FROM authme")
for row in cur.fetchall():
    vals = []
    for v in row:
        if v is None:
            vals.append('NULL')
        elif isinstance(v, (int, float)):
            vals.append(str(v))
        else:
            vals.append("'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'")
    print("INSERT IGNORE INTO `authme` (" + col_list + ") VALUES (" + ','.join(vals) + ");")

conn.close()
PYEOF
)

        if [[ -z "$SQL_DATA" ]]; then
            echo "[ERROR] ไม่สามารถ export data จาก SQLite ได้"
            exit 1
        fi

        # ── Import เข้า MySQL (หยุด replica ชั่วคราวถ้ามี) ──────
        IS_REPLICA=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SHOW REPLICA STATUS\G" 2>/dev/null | grep -c 'Source_Host' || true)

        if [[ "$IS_REPLICA" -gt 0 ]]; then
            echo "  (หยุด replication ชั่วคราวเพื่อ import...)"
            docker exec "$MYSQL_CONTAINER" \
                mysql -u root -p"$MYSQL_PASS" -e "STOP REPLICA;" 2>/dev/null
        fi

        printf "USE \`%s\`;\n%s\n" "$MYSQL_DB" "$SQL_DATA" | \
            docker exec -i "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" 2>/dev/null

        if [[ "$IS_REPLICA" -gt 0 ]]; then
            echo "  (start replication กลับ...)"
            docker exec "$MYSQL_CONTAINER" \
                mysql -u root -p"$MYSQL_PASS" -e "START REPLICA;" 2>/dev/null
        fi

        # ── ตรวจสอบผลลัพธ์ ────────────────────────────────────────
        AFTER_COUNT=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM $MYSQL_DB.authme;" 2>/dev/null || echo "0")

        NEW_ACCOUNTS=$((AFTER_COUNT - BEFORE_COUNT))

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✓ Import สำเร็จ"
        echo "  ก่อน import  : $BEFORE_COUNT accounts"
        echo "  ใน SQLite    : $SQLITE_COUNT accounts"
        echo "  หลัง import  : $AFTER_COUNT accounts"
        echo "  เพิ่มใหม่    : $NEW_ACCOUNTS accounts"
        echo "  ซ้ำ/ข้าม     : $((SQLITE_COUNT - NEW_ACCOUNTS)) accounts (username เดิม ข้ามแล้ว)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  Password hash ทั้งหมดปลอดภัย (bcrypt — ไม่มี plaintext)"
        echo ""
        echo "  ขั้นตอนต่อไป:"
        echo "  - Option 1 (Direct): เสร็จแล้ว ลูกค้าใช้ shop ได้เลย"
        echo "  - Option 2 (HA):     รัน migrate-to-replica → setup-replica → connect-replica"
        echo ""
        ;;

    # ════════════════════════════════════════════════════════════
    # AuthMe HA — Option 2: Customer hosts MySQL as Master
    # ════════════════════════════════════════════════════════════

    migrate-to-replica)
        # Export authme data from panel MySQL for customer to import before setup-replica
        MYSQL_PASS=$(grep '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_DB=$(grep '^MYSQL_DATABASE='   "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_CONTAINER="sw-${NAME}-mysql-1"

        COUNT=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM $MYSQL_DB.authme;" 2>/dev/null || echo "0")

        if [[ "$COUNT" -eq 0 ]]; then
            echo "ไม่มีข้อมูลใน authme table — ไม่ต้อง migrate"
            echo "รัน setup-replica ได้เลย"
            exit 0
        fi

        DUMP_FILE="/home/limitrack/authme_${NAME}_backup_$(date +%Y%m%d_%H%M%S).sql"
        echo "กำลัง export authme data ($COUNT accounts) จาก panel MySQL..."
        docker exec "$MYSQL_CONTAINER" \
            mysqldump -u root -p"$MYSQL_PASS" \
            --no-tablespaces --insert-ignore --set-gtid-purged=OFF \
            "$MYSQL_DB" authme 2>/dev/null > "$DUMP_FILE"

        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  Migrate Existing Data → Customer MySQL                      ║"
        printf "║  Customer: %-51s║\n" "$NAME"
        printf "║  Accounts: %-51s║\n" "$COUNT accounts"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
        echo "  ไฟล์ dump บันทึกที่: $DUMP_FILE"
        echo "  ให้ download ไปไว้ที่ Desktop ของ Windows Server"
        echo "  (ใช้ WinSCP หรือ FileZilla)"
        echo ""
        echo "  หลัง setup database แล้ว (ขั้นตอนที่ 5 ของ setup-replica)"
        echo "  รัน PowerShell as Administrator บน Windows Server:"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Get-Content \"C:\\Users\\Administrator\\Desktop\\$(basename $DUMP_FILE)\" | mysql -usiamworld -p$MYSQL_PASS $MYSQL_DB"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  ตรวจสอบ:"
        echo "  mysql -usiamworld -p$MYSQL_PASS $MYSQL_DB -e \"SELECT COUNT(*) FROM authme;\""
        echo "  ต้องได้ $COUNT"
        echo ""
        echo "  หลัง import เสร็จ → รัน:"
        echo "  ./manage-customer.sh --action setup-replica --name $NAME"
        echo ""
        ;;

    setup-replica)
        # ── Read customer config ──────────────────────────────────
        MYSQL_PASS=$(grep '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_DB=$(grep '^MYSQL_DATABASE='   "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_USR=$(grep '^MYSQL_USER='      "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_EXP_PORT=$(grep '^MYSQL_EXPOSED_PORT=' "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_CONTAINER="sw-${NAME}-mysql-1"
        MASTER_SERVER_ID=$((MYSQL_EXP_PORT + 10000))

        # ── Get panel Tailscale IP ────────────────────────────────
        PANEL_TS_IP=$(tailscale ip --4 2>/dev/null | head -1)
        if [[ -z "$PANEL_TS_IP" ]]; then
            echo "[ERROR] ไม่พบ Tailscale IP บน panel — รัน: sudo tailscale up"
            exit 1
        fi

        # ── Recreate panel MySQL to activate GTID + relay-log ────
        echo "Applying replication config to panel MySQL for '$NAME'..."
        docker compose --project-name "sw-$NAME" --env-file "$CUSTOMER_ENV" -f "$COMPOSE_FILE" \
            up -d --no-deps mysql
        echo "Waiting for MySQL to be ready..."
        sleep 10

        # ── Get authme schema ─────────────────────────────────────
        AUTHME_SCHEMA=$(docker exec "$MYSQL_CONTAINER" \
            mysqldump -u root -p"$MYSQL_PASS" \
            --no-data --skip-add-drop-table --skip-comments --compact \
            "$MYSQL_DB" authme 2>/dev/null)

        # ── Generate replication password ─────────────────────────
        REPL_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)

        # ── Save to .env ──────────────────────────────────────────
        if grep -q '^REPL_PASSWORD=' "$CUSTOMER_ENV"; then
            sed -i "s/^REPL_PASSWORD=.*/REPL_PASSWORD=$REPL_PASS/" "$CUSTOMER_ENV"
        else
            printf "\n# MySQL Replication\nREPL_PASSWORD=%s\n" "$REPL_PASS" >> "$CUSTOMER_ENV"
        fi
        if grep -q '^PANEL_TS_IP=' "$CUSTOMER_ENV"; then
            sed -i "s/^PANEL_TS_IP=.*/PANEL_TS_IP=$PANEL_TS_IP/" "$CUSTOMER_ENV"
        else
            printf "PANEL_TS_IP=%s\n" "$PANEL_TS_IP" >> "$CUSTOMER_ENV"
        fi

        # ── Check if data migration is needed ────────────────────
        EXISTING_COUNT=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM $MYSQL_DB.authme;" 2>/dev/null || echo "0")

        # ── Print instructions ────────────────────────────────────
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  MySQL Master Setup — Windows Server 2025                    ║"
        printf "║  Customer: %-51s║\n" "$NAME"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
        echo "  Flow: Customer MySQL (Master) ──sync authme──→ Panel MySQL (Replica)"
        echo "  Panel ดับ: Minecraft login/register ทำงานปกติ 100%"
        echo "  Security: replication ผ่าน Tailscale เท่านั้น ไม่เปิด public port"
        if [[ "$EXISTING_COUNT" -gt 0 ]]; then
            echo ""
            echo "  ⚠ WARNING: มีข้อมูลเก่า $EXISTING_COUNT accounts บน Panel MySQL"
            echo "  ต้อง migrate ก่อน ให้รัน:"
            echo "  ./manage-customer.sh --action migrate-to-replica --name $NAME"
            echo "  แล้วให้ลูกค้า import SQL นั้นก่อนทำขั้นตอน 5 ด้านล่าง"
        fi
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【1】 ติดตั้ง Tailscale (ถ้ายังไม่มี)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  https://tailscale.com/download/windows"
        echo "  Login ด้วย account เดียวกับที่ใช้บน panel server"
        echo "  ตรวจสอบด้วย: tailscale ip  (ต้องขึ้นต้นด้วย 100.)"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【2】 ติดตั้ง MySQL (ถ้ายังไม่มี)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  Option A — MySQL Installer (แนะนำ):"
        echo "    https://dev.mysql.com/downloads/installer/"
        echo "    → mysql-installer-community-8.0.x.x.msi"
        echo "    → Setup Type: Server only"
        echo "    → Config Type: Server Computer"
        echo "    → ตั้ง root password (จดไว้)"
        echo "    → ติดตั้งเป็น Windows Service ชื่อ MySQL80"
        echo ""
        echo "  Option B — Chocolatey (ถ้ามี choco):"
        echo "    choco install mysql"
        echo "    (ติดตั้ง MySQL 9.x, Service ชื่อ MySQL)"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【3】 แก้ไข my.ini — ตั้งค่า Master"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  ไฟล์ my.ini:"
        echo "    MySQL 8.0: C:\\ProgramData\\MySQL\\MySQL Server 8.0\\my.ini"
        echo "    MySQL 9.x: C:\\ProgramData\\MySQL\\MySQL Server 9.0\\my.ini"
        echo "               (หรือดูใน Services → MySQL → Properties → path)"
        echo ""
        echo "  เปิดด้วย Notepad as Administrator เพิ่มใต้ [mysqld]:"
        echo ""
        echo "    server-id     = $MASTER_SERVER_ID"
        echo "    log-bin       = mysql-bin"
        echo "    binlog-format = ROW"
        echo "    bind-address  = 0.0.0.0"
        echo ""
        echo "  หมายเหตุ: MySQL 9.x มี GTID เปิดอยู่แล้ว ไม่ต้องเพิ่ม gtid-mode"
        echo ""
        echo "  Restart: Start Menu → Services → MySQL80 (หรือ MySQL) → Restart"
        echo "  ตรวจสอบ: netstat -an | findstr 3306  (ต้องเห็น 0.0.0.0:3306)"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【4】 เปิด Windows Firewall — จำกัดเฉพาะ Panel Tailscale IP"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  รัน PowerShell as Administrator:"
        echo ""
        echo "  # ลบ rule เก่าถ้ามี"
        echo "  Remove-NetFirewallRule -DisplayName 'MySQL-Panel' -ErrorAction SilentlyContinue"
        echo ""
        echo "  # เพิ่ม rule ใหม่ — อนุญาตเฉพาะ Panel Tailscale IP เท่านั้น"
        echo "  New-NetFirewallRule -DisplayName 'MySQL-Panel' \`"
        echo "    -Direction Inbound -Protocol TCP \`"
        echo "    -LocalPort 3306 -RemoteAddress '$PANEL_TS_IP' -Action Allow"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【5】 รัน SQL ใน MySQL Command Line Client"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  -- สร้าง database + user (ใช้ credentials เดิมของ shop)"
        echo "  CREATE DATABASE IF NOT EXISTS \`$MYSQL_DB\`"
        echo "    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        echo "  CREATE USER '$MYSQL_USR'@'localhost' IDENTIFIED BY '$MYSQL_PASS';"
        echo "  GRANT ALL PRIVILEGES ON \`$MYSQL_DB\`.* TO '$MYSQL_USR'@'localhost';"
        echo ""
        echo "  -- replication user — จำกัดเฉพาะ Panel Tailscale IP"
        echo "  CREATE USER 'replicator'@'$PANEL_TS_IP'"
        echo "    IDENTIFIED BY '$REPL_PASS';"
        echo "  GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'$PANEL_TS_IP';"
        echo "  FLUSH PRIVILEGES;"
        echo ""
        echo "  -- สร้าง authme table"
        echo "$AUTHME_SCHEMA"
        if [[ "$EXISTING_COUNT" -gt 0 ]]; then
            echo ""
            echo "  -- *** import ข้อมูลเก่าตรงนี้ (จาก migrate-to-replica) ***"
        fi
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【6】 แก้ไข AuthMe config.yml → ชี้มา localhost"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "    DataSource:"
        echo "      backend: MYSQL"
        echo "      caching: false"
        echo "      mySQLHost: 127.0.0.1"
        echo "      mySQLPort: '3306'"
        echo "      mySQLUseSSL: false"
        echo "      mySQLCheckServerCertificate: false"
        echo "      mySQLAllowPublicKeyRetrieval: true"
        echo "      mySQLUsername: $MYSQL_USR"
        echo "      mySQLPassword: '$MYSQL_PASS'"
        echo "      mySQLDatabase: $MYSQL_DB"
        echo "      mySQLTablename: authme"
        echo "      poolSize: 10"
        echo "      maxLifetime: 1770"
        echo "      keepaliveTime: 60000"
        echo ""
        echo "  รัน authme reload หรือ Restart Minecraft server"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  【7】 ส่ง Tailscale IP กลับมาให้เรา"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  รัน: tailscale ip"
        echo "  ส่งค่ากลับมา (ขึ้นต้นด้วย 100.)"
        echo ""
        echo "  Admin จะรัน:"
        echo "  ./manage-customer.sh --action connect-replica --name $NAME --host <tailscale-ip>"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ;;

    connect-replica)
        if [[ -z "$HOST" ]]; then
            echo "[ERROR] ต้องระบุ --host <customer-tailscale-ip>"
            echo "Usage: $0 --action connect-replica --name $NAME --host <tailscale-ip>"
            exit 1
        fi

        MYSQL_PASS=$(grep '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | cut -d= -f2-)
        REPL_PASS=$(grep '^REPL_PASSWORD='   "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_CONTAINER="sw-${NAME}-mysql-1"

        if [[ -z "$REPL_PASS" ]]; then
            echo "[ERROR] ไม่พบ REPL_PASSWORD ใน .env กรุณา run setup-replica ก่อน"
            exit 1
        fi

        echo "Connecting panel MySQL of '$NAME' as replica from $HOST:3306..."

        docker exec -i "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" 2>/dev/null <<SQL
STOP REPLICA;
RESET REPLICA ALL;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='$HOST',
  SOURCE_PORT=3306,
  SOURCE_USER='replicator',
  SOURCE_PASSWORD='$REPL_PASS',
  SOURCE_AUTO_POSITION=1,
  GET_SOURCE_PUBLIC_KEY=1;
START REPLICA;
SQL

        sleep 5
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" \
            -e "SHOW REPLICA STATUS\G" 2>/dev/null | \
            grep -E 'Replica_IO_Running|Replica_SQL_Running|Seconds_Behind_Source|Last_IO_Error|Last_SQL_Error'
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✓ Replica_IO_Running: Yes + Replica_SQL_Running: Yes = สำเร็จ"
        echo "  ✓ Seconds_Behind_Source: 0 = ข้อมูลทันกัน real-time"
        echo ""
        echo "  Panel ดับ → Minecraft login/register ปกติ"
        echo "  Panel กลับ → replication resume อัตโนมัติ"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        ;;

    check-replica)
        MYSQL_PASS=$(grep '^MYSQL_PASSWORD=' "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_DB=$(grep '^MYSQL_DATABASE='   "$CUSTOMER_ENV" | cut -d= -f2-)
        MYSQL_CONTAINER="sw-${NAME}-mysql-1"

        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Replica Status — $NAME"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        STATUS=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" \
            -e "SHOW REPLICA STATUS\G" 2>/dev/null)

        if [[ -z "$STATUS" ]]; then
            echo "  ✗ ยังไม่ได้ configure replication"
            echo "  รัน: ./manage-customer.sh --action setup-replica --name $NAME"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            exit 0
        fi

        IO=$(echo "$STATUS"  | grep 'Replica_IO_Running:'  | awk '{print $2}')
        SQL=$(echo "$STATUS" | grep 'Replica_SQL_Running:' | awk '{print $2}')
        LAG=$(echo "$STATUS" | grep 'Seconds_Behind_Source:' | awk '{print $2}')
        SRC=$(echo "$STATUS" | grep 'Source_Host:'  | awk '{print $2}')
        IO_ERR=$(echo "$STATUS"  | grep 'Last_IO_Error:'  | sed 's/.*Last_IO_Error: //')
        SQL_ERR=$(echo "$STATUS" | grep 'Last_SQL_Error:' | sed 's/.*Last_SQL_Error: //')

        COUNT=$(docker exec "$MYSQL_CONTAINER" \
            mysql -u root -p"$MYSQL_PASS" --batch --skip-column-names \
            -e "SELECT COUNT(*) FROM $MYSQL_DB.authme;" 2>/dev/null || echo "?")

        [[ "$IO"  == "Yes" ]] && IO_ICON="✓" || IO_ICON="✗"
        [[ "$SQL" == "Yes" ]] && SQL_ICON="✓" || SQL_ICON="✗"
        [[ "$LAG" == "0"  ]] && LAG_ICON="✓" || LAG_ICON="⚠"

        echo "  Source (Master) : $SRC"
        echo "  $IO_ICON  IO Thread    : $IO"
        echo "  $SQL_ICON  SQL Thread   : $SQL"
        echo "  $LAG_ICON  Lag          : ${LAG}s behind source"
        echo "  Accounts synced : $COUNT"
        [[ -n "$IO_ERR"  && "$IO_ERR"  != "" ]] && echo "  ✗ IO Error  : $IO_ERR"
        [[ -n "$SQL_ERR" && "$SQL_ERR" != "" ]] && echo "  ✗ SQL Error : $SQL_ERR"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        ;;

    *)
        echo "[ERROR] Unknown action: $ACTION"
        echo "Basic:   list, status, start, stop, restart, rebuild, migrate, logs, remove"
        echo "Migrate: import-sqlite --file <authme.db>"
        echo "HA:      migrate-to-replica, setup-replica, connect-replica --host <ip>, check-replica"
        exit 1
        ;;
esac
