#!/bin/bash
# ================================================================
#  apply-migrations.sh
#  Apply pending DB migrations to a customer's MySQL container.
#
#  Tracks applied migrations via a `schema_migrations` table so the
#  runner is safe to call repeatedly. Migration .sql files are
#  themselves written to be idempotent — re-applying one is a no-op.
#
#  Usage:
#    ./apply-migrations.sh --name <customer> [--migrations-dir <path>]
#
#  Reads creds from deploy/customers/<name>/.env (MYSQL_USER, MYSQL_PASSWORD,
#  MYSQL_DATABASE).
# ================================================================

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME=""
MIGRATIONS_DIR=""
WAIT_SECS=60

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)            NAME="$2"; shift 2 ;;
        --migrations-dir)  MIGRATIONS_DIR="$2"; shift 2 ;;
        --wait)            WAIT_SECS="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,15p' "$0"
            exit 0 ;;
        *) echo "[migrate] Unknown arg: $1" >&2; exit 2 ;;
    esac
done

if [[ -z "$NAME" ]]; then
    echo "[migrate] --name is required" >&2
    exit 2
fi

# Validate name to prevent shell injection (matches new-customer.sh rules)
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$ ]]; then
    echo "[migrate] Invalid customer name: $NAME" >&2
    exit 2
fi

# Resolve the migrations dir.
if [[ -z "$MIGRATIONS_DIR" ]]; then
    # Inside the panel container /deploy and /source are separate bind mounts,
    # so migrations/ is NOT a sibling of deploy/. Prefer SOURCE_ROOT (the
    # container path to the repo root, exported by new-customer.sh /
    # manage-customer.sh) and fall back to the deploy/ sibling on a bare host.
    if [[ -n "${SOURCE_ROOT:-}" && -d "${SOURCE_ROOT}/migrations" ]]; then
        MIGRATIONS_DIR="${SOURCE_ROOT}/migrations"
    else
        MIGRATIONS_DIR="$(dirname "$DEPLOY_DIR")/migrations"
    fi
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
    echo "[migrate] Migrations dir not found: $MIGRATIONS_DIR" >&2
    exit 1
fi

ENV_FILE="$DEPLOY_DIR/customers/$NAME/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[migrate] .env not found: $ENV_FILE" >&2
    exit 1
fi

# Source the .env (use 'set -a' to export so subsequent calls see them)
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

CONTAINER="sw-$NAME-mysql-1"
DB_USER="${MYSQL_USER:-siamworld}"
DB_NAME="${MYSQL_DATABASE:-siamworld}"
DB_PASS="${MYSQL_PASSWORD:?MYSQL_PASSWORD missing in .env}"

# Check the container exists
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    echo "[migrate] Container not found: $CONTAINER" >&2
    exit 1
fi

# Wait for MySQL to accept connections
echo "[migrate] Waiting for $CONTAINER to be ready (up to ${WAIT_SECS}s)..."
ready=0
for ((i=0; i<WAIT_SECS; i++)); do
    if docker exec "$CONTAINER" mysqladmin ping -uroot -p"$DB_PASS" --silent 2>/dev/null; then
        ready=1
        break
    fi
    sleep 1
done
if [[ $ready -ne 1 ]]; then
    echo "[migrate] $CONTAINER did not become ready in ${WAIT_SECS}s" >&2
    exit 1
fi

# Helper: run a SQL statement
mysql_query() {
    docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" "$@" 2>&1 | grep -v "^mysql: \[Warning\]" || true
}
# Helper: run SQL from stdin and capture full output + exit code
mysql_pipe() {
    docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME"
}

# Ensure tracking table
mysql_query <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL

# Collect applied set
APPLIED_LIST="$(docker exec -i "$CONTAINER" mysql -N -B -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
  -e "SELECT filename FROM schema_migrations" 2>/dev/null | grep -v "^mysql: \[Warning\]" || true)"

is_applied() {
    local name="$1"
    grep -Fxq "$name" <<<"$APPLIED_LIST"
}

mark_applied() {
    local name="$1"
    docker exec -i "$CONTAINER" mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
        -e "INSERT IGNORE INTO schema_migrations (filename) VALUES ('$name')" 2>&1 \
        | grep -v "^mysql: \[Warning\]" || true
}

# Iterate migration files in lexical order
mapfile -t MIG_FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | sort)

if [[ ${#MIG_FILES[@]} -eq 0 ]]; then
    echo "[migrate] No .sql files in $MIGRATIONS_DIR"
    exit 0
fi

applied=0
skipped=0
for path in "${MIG_FILES[@]}"; do
    bn="$(basename "$path")"
    if is_applied "$bn"; then
        skipped=$((skipped+1))
        continue
    fi
    echo "[migrate] ▶ $bn"
    # Stream file into mysql, propagate failure
    if ! mysql_pipe < "$path" > /tmp/_mig_out 2>&1; then
        echo "[migrate] ✗ $bn FAILED:"
        sed 's/^/[migrate]    /' /tmp/_mig_out >&2
        rm -f /tmp/_mig_out
        exit 1
    fi
    # Show non-warning output (if any)
    if [[ -s /tmp/_mig_out ]]; then
        grep -v "^mysql: \[Warning\]" /tmp/_mig_out | sed 's/^/[migrate]    /' || true
    fi
    rm -f /tmp/_mig_out
    mark_applied "$bn"
    applied=$((applied+1))
done

echo "[migrate] $NAME: applied=$applied skipped=$skipped total=${#MIG_FILES[@]}"
