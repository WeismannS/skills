#!/usr/bin/env bash
# Scaffold a recorded UI demo:  new-demo.sh <demo-dir>
#   <demo-dir>/record/  take.ts, flow.ts, explore.ts; installs Playwright + tsx and the bundled Chromium
#   <demo-dir>/video/   Remotion project (kit.tsx, Demo.tsx); node_modules hard-linked from a
#                       sibling demo that has every dependency at the same Remotion version
#                       (saves a long install), else npm install
# Put demos outside the app's repo, e.g. ~/demos/<name>, so the repo stays clean.
set -euo pipefail
[ $# -eq 1 ] || { echo "usage: $0 <demo-dir>" >&2; exit 2; }
SKILL="$(cd "$(dirname "$0")/.." && pwd)"

missing=()
for c in node npm; do command -v "$c" >/dev/null || missing+=("$c"); done
[ ${#missing[@]} -eq 0 ] || { echo "needs ${missing[*]} on PATH (Node 18 or newer)" >&2; exit 1; }
for c in ffmpeg ffprobe python3; do
  command -v "$c" >/dev/null || echo "warning: $c is not on PATH; the take encode and the check scripts need it" >&2
done

DEST="$(mkdir -p "$1" && cd "$1" && pwd)"
for d in record video; do
  [ ! -e "$DEST/$d" ] || { echo "$DEST/$d already exists; not overwriting" >&2; exit 1; }
done

# --- record/: Playwright, tsx and the browser -------------------------------------------------
cp -r "$SKILL/assets/record" "$DEST/record"
(cd "$DEST/record" && npm install --silent --no-audit --no-fund)
# Downloads Chromium once into Playwright's shared cache; a no-op when it is already there.
(cd "$DEST/record" && npx playwright install chromium)

# --- video/: Remotion ------------------------------------------------------------------------
cp -r "$SKILL/assets/video" "$DEST/video"
# Every dependency name, and the Remotion version, from the template's package.json.
deps="$(node -e 'const p=require(process.argv[1]);console.log(Object.keys({...p.dependencies,...p.devDependencies}).join(" "))' "$DEST/video/package.json")"
want="$(node -p 'require(process.argv[1]).dependencies.remotion' "$DEST/video/package.json")"
for nm in "$(dirname "$DEST")"/*/video/node_modules; do
  [ -f "$nm/remotion/package.json" ] || continue
  [ "$nm" != "$DEST/video/node_modules" ] || continue
  [ "$(node -p 'require(process.argv[1]).version' "$nm/remotion/package.json")" = "$want" ] || continue
  ok=1
  for dep in $deps; do [ -e "$nm/$dep/package.json" ] || { ok=0; break; }; done
  [ $ok -eq 1 ] || continue
  # Hard links need GNU cp and the same filesystem; on failure fall through to npm install.
  if cp -al "$nm" "$DEST/video/node_modules" 2>/dev/null; then
    # Webpack's cache lives here and is written during renders; it must not be shared.
    rm -rf "$DEST/video/node_modules/.cache"
    echo "linked Remotion $want from $nm"
    break
  fi
  rm -rf "$DEST/video/node_modules"
done
if [ ! -d "$DEST/video/node_modules" ]; then
  echo "installing Remotion $want into video/ (a minute or two)"
  (cd "$DEST/video" && npm install --silent --no-audit --no-fund)
fi

echo "ready: $DEST"
echo "  look:   cd $DEST/record && npx tsx explore.ts <url> [selector ...]"
echo "  record: write $DEST/record/flow.ts, start the app, then: cd $DEST/record && npx tsx flow.ts"
echo "  cut:    edit $DEST/video/src/Demo.tsx, then: cd $DEST/video && npm run render"
