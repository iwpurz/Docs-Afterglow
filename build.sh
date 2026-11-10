#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
v=$(python3 -c "import json;print(json.load(open('src/manifest.json'))['version'])")
mkdir -p dist
rm -f "dist/docs-afterglow-$v.xpi"
(
  cd src
  zip -q -r -X "../dist/docs-afterglow-$v.xpi" manifest.json *.js icons popup options studio
)
echo "dist/docs-afterglow-$v.xpi"
