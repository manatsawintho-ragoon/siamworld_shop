#!/usr/bin/env bash
# Extracts the route list from a Next.js build and normalises it for diffing.
#
# Next prints a tree with box-drawing characters, sizes, and a "[+N more paths]"
# elision. The elision is why we read the build manifests instead of the pretty
# output: the tree hides paths, the manifests do not.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .next/routes-manifest.json ]; then
  echo "error: .next/routes-manifest.json missing. Run 'npm run build' first." >&2
  exit 1
fi

python3 - <<'PY'
import json

routes = set()

try:
    with open('.next/prerender-manifest.json') as f:
        routes.update(json.load(f).get('routes', {}).keys())
except FileNotFoundError:
    pass

with open('.next/routes-manifest.json') as f:
    rm = json.load(f)
    for r in rm.get('staticRoutes', []):
        routes.add(r['page'])
    for r in rm.get('dynamicRoutes', []):
        routes.add(r['page'])

for r in sorted(routes):
    print(r)
PY
