#!/usr/bin/env bash
# Run the datetime pure-module checks.
#
#   frontend/scripts/datetime.check.sh
#
# The frontend has no test runner (no `test` script in package.json), so the
# pure modules are verified by assertions run under Node's type stripping.
#
# The app's own imports are extensionless because webpack resolves them; Node's
# ESM loader does not. Rather than contort the source for the checker's benefit,
# this stages the modules into a temp dir with explicit .ts extensions and runs
# there. Nothing under src/ changes.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/../src/components/admin/datetime"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

cp "$src/thaiDate.ts" "$stage/thaiDate.ts"
sed "s|from './thaiDate'|from './thaiDate.ts'|" "$src/constraints.ts" > "$stage/constraints.ts"
sed -e "s|from \".*thaiDate.ts\"|from './thaiDate.ts'|" \
    -e "s|from \".*constraints.ts\"|from './constraints.ts'|" \
    "$here/datetime.check.ts" > "$stage/check.ts"

node --experimental-strip-types "$stage/check.ts" 2>&1 \
  | grep -v "ExperimentalWarning\|Use \`node --trace"
