#!/usr/bin/env bash
#
# sw-gc.sh - reclaim disk left behind by discontinued shops and stale caches.
#
# The deploy pipeline used to leak two images (~640MB) per removed customer
# because `docker compose down -v` does not touch images. removeShop now cleans
# up after itself, but this reconciler is the backstop for anything that slipped
# through: a crashed deploy, a shop removed by hand, an interrupted rebuild.
#
# Usage:
#   ./sw-gc.sh            # dry run, prints what it would delete
#   ./sw-gc.sh --apply    # actually delete
#
set -uo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOMERS_JSON="$SCRIPT_DIR/customers.json"
PANEL_MYSQL="${PANEL_MYSQL_CONTAINER:-panel-mysql}"
PANEL_DB="${PANEL_DB_NAME:-siamworld_panel}"
JOURNAL_CAP="${JOURNAL_CAP:-200M}"
LOG_TRUNCATE_MB="${LOG_TRUNCATE_MB:-50}"
BUILD_CACHE_KEEP="${BUILD_CACHE_KEEP:-168h}"   # 7 days

run() { if [[ $APPLY -eq 1 ]]; then "$@"; else echo "  [dry-run] $*"; fi; }

echo "=== sw-gc $(date '+%F %T') ($([[ $APPLY -eq 1 ]] && echo APPLY || echo DRY-RUN)) ==="
df -h / | tail -1

# ---------------------------------------------------------------------------
# 1. Build the keep-list.
#
# SAFETY: the panel DB is the source of truth for which shops exist. If we
# cannot read it we have no keep-list, and an empty keep-list would mean
# "delete every shop image on the box". Refuse to continue in that case.
# Suspended shops are deliberately kept: they are paused, not gone, and the
# panel resumes them on renewal.
# ---------------------------------------------------------------------------
KEEP_FILE="$(mktemp)"
trap 'rm -f "$KEEP_FILE"' EXIT

if ! docker exec "$PANEL_MYSQL" sh -c \
    "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" $PANEL_DB -N -e 'SELECT shop_name FROM subscriptions'" \
    2>/dev/null >> "$KEEP_FILE"; then
  echo "ABORT: cannot read subscriptions from $PANEL_MYSQL. Refusing to guess."
  exit 1
fi

if [[ ! -s "$KEEP_FILE" ]]; then
  echo "ABORT: subscriptions table returned no rows. Refusing to delete everything."
  exit 1
fi

# Union in the on-disk registry and anything that currently has a container,
# so a shop mid-provision is never collected.
[[ -f "$CUSTOMERS_JSON" ]] && jq -r '.customers[].name' "$CUSTOMERS_JSON" 2>/dev/null >> "$KEEP_FILE"
docker ps -a --format '{{.Names}}' | grep '^sw-' \
  | sed 's/^sw-//; s/-\(backend\|frontend\|mysql\|redis\)-1$//' >> "$KEEP_FILE"

sort -u -o "$KEEP_FILE" "$KEEP_FILE"
echo "Keeping $(wc -l < "$KEEP_FILE") shops: $(tr '\n' ' ' < "$KEEP_FILE")"

# ---------------------------------------------------------------------------
# 2. Orphan shop images.
# ---------------------------------------------------------------------------
echo
echo "--- orphan images ---"
ORPHANS=()
for img in $(docker images --format '{{.Repository}}' | grep '^sw-' | sort -u); do
  shop="${img#sw-}"; shop="${shop%-backend}"; shop="${shop%-frontend}"
  grep -qx "$shop" "$KEEP_FILE" && continue
  # Never touch an image some container still references.
  [[ -n "$(docker ps -a --filter "ancestor=$img" -q)" ]] && continue
  ORPHANS+=("$img")
done
if [[ ${#ORPHANS[@]} -eq 0 ]]; then
  echo "  none"
else
  printf '  %s\n' "${ORPHANS[@]}"
  run docker image rm "${ORPHANS[@]}"
fi

# ---------------------------------------------------------------------------
# 3. Dangling volumes.
#
# Named shop volumes (sw-<shop>_mysql_data) only go dangling once the shop is
# removed, and by then their data is gone anyway. Anonymous volumes are dev
# leftovers. Both are skipped if they belong to a shop still in the keep-list.
# ---------------------------------------------------------------------------
echo
echo "--- dangling volumes ---"
DANGLING=()
for v in $(docker volume ls -qf dangling=true); do
  skip=0
  while read -r shop; do
    [[ "$v" == "sw-${shop}_"* ]] && { skip=1; break; }
  done < "$KEEP_FILE"
  [[ $skip -eq 1 ]] && { echo "  SKIP (live shop): $v"; continue; }
  DANGLING+=("$v")
done
if [[ ${#DANGLING[@]} -eq 0 ]]; then
  echo "  none"
else
  printf '  %s\n' "${DANGLING[@]}"
  run docker volume rm "${DANGLING[@]}"
fi

# ---------------------------------------------------------------------------
# 4. Caches and logs.
# ---------------------------------------------------------------------------
echo
echo "--- build cache older than $BUILD_CACHE_KEEP ---"
run docker builder prune -f --filter "until=$BUILD_CACHE_KEEP"

echo
# Container logs are NOT touched here on purpose.
#
# Truncating a live json.log desyncs the docker daemon's log reader: `docker
# logs` and the panel's log viewer then hang forever for that container until it
# is restarted. This script once did it and broke every container on the box.
# The cap belongs in the compose `logging:` block, which a shop picks up on its
# next recreate. Report only.
echo "--- container logs over ${LOG_TRUNCATE_MB}M (report only) ---"
BIG=$(sudo find /var/lib/docker/containers -name '*-json.log' -size +"${LOG_TRUNCATE_MB}M" 2>/dev/null | wc -l)
if [[ "$BIG" -gt 0 ]]; then
  echo "  $BIG log(s) over ${LOG_TRUNCATE_MB}M. Do NOT truncate them:"
  echo "  run 'manage-customer.sh --action recreate --name <shop>' to apply the cap."
else
  echo "  none"
fi

echo
echo "--- journal over $JOURNAL_CAP ---"
run sudo journalctl --vacuum-size="$JOURNAL_CAP"

echo
echo "--- apt cache ---"
run sudo apt-get clean

echo
echo "=== done ==="
df -h / | tail -1
[[ $APPLY -eq 0 ]] && echo "(dry run: nothing was deleted. re-run with --apply)"
exit 0
