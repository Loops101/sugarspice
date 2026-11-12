#!/usr/bin/env bash
# Daily backup of the shop data (orders, products, users, uploaded photos). Keeps 14 days.
set -euo pipefail
DATA=/var/lib/shop
OUT=/var/backups/shop
mkdir -p "$OUT"
STAMP=$(date +%Y-%m-%d_%H%M)
# db.json is written atomically, so copying it is always a consistent snapshot
tar -czf "$OUT/shop-$STAMP.tar.gz" -C "$DATA" --exclude='*.tmp' .
chmod 600 "$OUT"/shop-*.tar.gz
find "$OUT" -name 'shop-*.tar.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: shop-$STAMP.tar.gz ($(du -h "$OUT/shop-$STAMP.tar.gz" | cut -f1))"
