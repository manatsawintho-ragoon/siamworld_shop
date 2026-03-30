#!/bin/bash
# ================================================================
#  SiamWorld Shop — Customer Management Script
#  Ubuntu / Linux Server
#
#  Usage:
#    ./manage-customer.sh --action list
#    ./manage-customer.sh --action status  --name <name>
#    ./manage-customer.sh --action start   --name <name>
#    ./manage-customer.sh --action stop    --name <name>
#    ./manage-customer.sh --action restart --name <name>
#    ./manage-customer.sh --action logs    --name <name>
#    ./manage-customer.sh --action remove  --name <name>   # WARNING: deletes all data
# ================================================================

set -e

ACTION="list"
NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --action) ACTION="$2"; shift 2 ;;
        --name)   NAME="$2";   shift 2 ;;
        -h|--help)
            echo "Usage: $0 --action <action> [--name <name>]"
            echo "Actions: list, status, start, stop, restart, logs, remove"
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
                COLOR="\033[32m"  # green
            else
                COLOR="\033[31m"  # red
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
export SOURCE_ROOT="$(dirname "$DEPLOY_DIR")"
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

    *)
        echo "[ERROR] Unknown action: $ACTION"
        echo "Valid actions: list, status, start, stop, restart, logs, remove"
        exit 1
        ;;
esac
