#!/bin/sh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$ROOT/public/gasolina/guia-comer-segun-tu-wod.pdf"
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
  --no-pdf-header-footer --print-to-pdf="$OUT" \
  "file://$ROOT/scripts/gasolina/guia-source.html" >/tmp/gasolina-pdf-build.log 2>&1
printf 'Guide PDF: %s\n' "$OUT"
