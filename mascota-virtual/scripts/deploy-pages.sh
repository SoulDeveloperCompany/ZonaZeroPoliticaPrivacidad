#!/usr/bin/env bash
# Publica el juego en GitHub Pages (rama gh-pages) como un único index.html.
#   bash scripts/deploy-pages.sh
# Quedará en https://souldevelopercompany.github.io/ZonaZeroPoliticaPrivacidad/
# También sube public-pages/ (p. ej. .../privacidad.html, la política de Patitas para Play Store)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run artifact >/dev/null
OUT=$(mktemp -d)
python3 - "$OUT" <<'PY'
import sys, pathlib
out = pathlib.Path(sys.argv[1])
page = pathlib.Path('artifact/patitas.html').read_text(encoding='utf8')
head = '''<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#ffb26b">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐾</text></svg>">
'''
title_end = page.index('</title>') + len('</title>')
html = head + page[:title_end] + '</head><body>' + page[title_end:] + '</body></html>'
(out / 'index.html').write_text(html, encoding='utf8')
(out / '.nojekyll').write_text('')
PY
cp public-pages/* "$OUT"/   # privacidad.html, etc.
cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "Publicar Patitas en GitHub Pages"
git push -q -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
echo "Publicado en la rama gh-pages"
