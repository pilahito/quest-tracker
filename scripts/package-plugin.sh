#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PLUGIN_DIR="$ROOT_DIR/.tmp-questtracker-package"

rm -rf "$PLUGIN_DIR"
mkdir -p "$DIST_DIR" "$PLUGIN_DIR/questTracker"

cp "$ROOT_DIR/src/index.tsx" "$PLUGIN_DIR/questTracker/index.tsx"
cp "$ROOT_DIR/src/quests.ts" "$PLUGIN_DIR/questTracker/quests.ts"
cp "$ROOT_DIR/src/i18n.ts" "$PLUGIN_DIR/questTracker/i18n.ts"
cp "$ROOT_DIR/LICENSE" "$PLUGIN_DIR/LICENSE"
cp "$ROOT_DIR/README.md" "$PLUGIN_DIR/README.md"

if command -v zip >/dev/null 2>&1; then
  (cd "$PLUGIN_DIR" && zip -r "$DIST_DIR/quest-tracker.zip" .)
else
  python3 - <<'PY'
import os, zipfile
root = os.environ['ROOT_DIR'] + '/.tmp-questtracker-package'
out = os.environ['ROOT_DIR'] + '/dist/quest-tracker.zip'
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root)
            zf.write(full, rel)
PY
fi

rm -rf "$PLUGIN_DIR"

echo "Package created at: $DIST_DIR/quest-tracker.zip"
