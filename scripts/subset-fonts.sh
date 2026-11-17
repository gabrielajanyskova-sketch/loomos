#!/usr/bin/env bash
# Shrinks the web fonts to the characters the site uses (Czech + punctuation + a few symbols).
# Sources are the .ttf files next to them; run after adding text with unusual characters.
# Needs: pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/../assets/fonts"
U="U+0000-017F,U+0300-030F,U+2000-206F,U+20AC,U+2116,U+2122,U+2190-2193,U+2212,U+2248,U+2264-2265,U+2605-2606,U+2630,U+2713,U+2715,U+2717,U+2727,U+FF0B"
for f in cormorant-garamond cormorant-garamond-italic dm-sans lora; do
  pyftsubset "$f.ttf" --unicodes="$U" --layout-features='*' --flavor=woff2 --output-file="$f.woff2"
done
