#!/bin/sh
# Vercel build: copy only what the app serves into dist/ (no SQL, scripts or old bundle pairs).
set -e
rm -rf dist && mkdir -p dist/assets
cp index.html 404.html sw.js registerSW.js workbox-*.js manifest.webmanifest logo.svg apple-touch-icon.png dist/
cp -R icons dist/
[ -d assets/hunt-n2 ] && cp -R assets/hunt-n2 dist/assets/
N=$(sed -n 's/.*index-Dmb37nVq\([0-9][0-9]*\)\.js.*/\1/p' index.html | head -1)
# the live pair plus the two before it, for clients mid-update
for i in $N $((N-1)) $((N-2)); do
  [ -f assets/index-Dmb37nVq$i.js ] && cp assets/index-Dmb37nVq$i.js dist/assets/
  [ -f assets/index-PjvQ$i.css ] && cp assets/index-PjvQ$i.css dist/assets/
done
echo "built pair $N into dist/"
