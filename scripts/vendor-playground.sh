#!/usr/bin/env bash
# Vendors a pinned, offline-capable build of TensorFlow Playground into
# public/playground/ for Study Mode condition C2 (Fix Round 1, C1).
#
# Upstream: https://github.com/tensorflow/playground (Apache License 2.0)
# Pinned commit and font versions below; re-run to reproduce byte-for-byte
# modulo the upstream toolchain. Modifications are listed in NOTICE.md.
#
# Usage: scripts/vendor-playground.sh [work-dir]
set -euo pipefail
COMMIT=02469bd3751764b20486015d4202b792af5362a6
ROBOTO=5.1.0
ICONS=5.1.0
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=${1:-$(mktemp -d)}
OUT="$ROOT/public/playground"

git clone --quiet https://github.com/tensorflow/playground.git "$WORK/src"
git -C "$WORK/src" checkout --quiet "$COMMIT"
(cd "$WORK/src" && npm ci --ignore-scripts --no-audit --no-fund --silent && npm run --silent build)
mkdir -p "$WORK/fonts" && (cd "$WORK/fonts" && npm pack --silent "@fontsource/roboto@$ROBOTO" "@fontsource/material-icons@$ICONS" >/dev/null \
  && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}" --strip-components 1; done)

rm -rf "$OUT" && mkdir -p "$OUT/fonts"
cp "$WORK/src/dist/"{bundle.js,bundle.css,lib.js} "$OUT/"
cp "$WORK/src/LICENSE" "$OUT/LICENSE"
for w in 300 400 500; do cp "$WORK/fonts/fontsource-roboto-$ROBOTO/files/roboto-latin-$w-normal.woff2" "$OUT/fonts/"; done
cp "$WORK/fonts/fontsource-material-icons-$ICONS/files/material-icons-latin-400-normal.woff2" "$OUT/fonts/"
cp "$WORK/fonts/fontsource-roboto-$ROBOTO/LICENSE" "$OUT/fonts/LICENSE-roboto"
cp "$WORK/fonts/fontsource-material-icons-$ICONS/LICENSE" "$OUT/fonts/LICENSE-material-icons"

# 1. Analytics replaced by a no-op: Playground calls ga() on interaction, so the global must exist.
printf '%s\n' '/* DL-VizLab: Google Analytics removed for offline, privacy-preserving use; ga() is a no-op. */' \
  'window.ga = function () {};' > "$OUT/analytics.js"

# 2. Fonts served locally instead of from fonts.googleapis.com.
cat > "$OUT/fonts.css" <<'CSS'
/* DL-VizLab: local copies of the fonts Playground loads from Google Fonts (Fontsource packages, Apache 2.0). */
@font-face { font-family: 'Roboto'; font-style: normal; font-weight: 300; font-display: swap; src: url(fonts/roboto-latin-300-normal.woff2) format('woff2'); }
@font-face { font-family: 'Roboto'; font-style: normal; font-weight: 400; font-display: swap; src: url(fonts/roboto-latin-400-normal.woff2) format('woff2'); }
@font-face { font-family: 'Roboto'; font-style: normal; font-weight: 500; font-display: swap; src: url(fonts/roboto-latin-500-normal.woff2) format('woff2'); }
@font-face { font-family: 'Material Icons'; font-style: normal; font-weight: 400; font-display: block; src: url(fonts/material-icons-latin-400-normal.woff2) format('woff2'); }
.material-icons { font-family: 'Material Icons'; font-weight: normal; font-style: normal; font-size: 24px; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; word-wrap: normal; direction: ltr; -webkit-font-feature-settings: 'liga'; font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; }
CSS
python3 - "$WORK/src/dist/index.html" "$OUT/index.html" <<'PY'
import sys
s = open(sys.argv[1]).read()
old = '<link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500|Material+Icons" rel="stylesheet" type="text/css">'
assert old in s, "Google Fonts link not found: upstream changed"
s = s.replace(old, '<link href="fonts.css" rel="stylesheet" type="text/css">')
open(sys.argv[2], "w").write(s)
PY

cat > "$OUT/NOTICE.md" <<NOTICE
# TensorFlow Playground — vendored copy

This directory contains a build of **TensorFlow Playground**, Copyright 2016 Google Inc., licensed under the Apache License, Version 2.0 (\`LICENSE\` in this directory). It is served with DL-VizLab so that study condition C2 runs offline and on a fixed version.

- Upstream: https://github.com/tensorflow/playground, commit \`$COMMIT\`
- Built with the upstream \`npm run build\` (browserify + tsify + uglify) by \`scripts/vendor-playground.sh\`.

## Modifications (Apache 2.0 §4(b))

1. \`analytics.js\` is replaced by a stub defining a no-op \`ga()\`. The original loaded Google Analytics from google-analytics.com.
2. \`index.html\` loads \`fonts.css\` instead of the Roboto and Material Icons stylesheet on fonts.googleapis.com. \`fonts/\` holds the font files from the Fontsource packages \`@fontsource/roboto@$ROBOTO\` and \`@fontsource/material-icons@$ICONS\` (Apache License 2.0; \`fonts/LICENSE-*\`).

No other file is changed. With these two changes, the page makes no network request.
NOTICE
echo "vendored TensorFlow Playground $COMMIT into public/playground"
