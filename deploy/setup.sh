#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu 22.04 / 24.04 (or Debian 12) VPS.
# Run as root from inside the unzipped project folder:
#   DOMAIN=shop.co.ke EMAIL=you@example.com ADMIN_EMAIL=you@example.com bash deploy/setup.sh
# Safe to run again: it updates the app and keeps your data.
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, for example DOMAIN=sugarspice.co.ke}"
: "${EMAIL:?Set EMAIL (certificate expiry notices go here)}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL (the owner sign-in)}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)."; exit 1; }
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$SRC/package.json" ] || { echo "Run this from the project folder."; exit 1; }

APP=/opt/shop/app
DATA=/var/lib/shop
ENVFILE=/etc/shop.env
export DEBIAN_FRONTEND=noninteractive

echo "==> 1/8 System updates and packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg ufw fail2ban nginx certbot python3-certbot-nginx unattended-upgrades rsync cron
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "==> 2/8 Swap (helps a 1 GB server)"
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=20' > /etc/sysctl.d/99-swap.conf && sysctl -p /etc/sysctl.d/99-swap.conf >/dev/null
fi

echo "==> 3/8 Node.js 20"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 4/8 App user, files and data folder"
id shop >/dev/null 2>&1 || useradd --system --home /opt/shop --shell /usr/sbin/nologin shop
mkdir -p "$APP" "$DATA/uploads" /var/backups/shop
rsync -a --delete --exclude node_modules --exclude data --exclude .env --exclude .git "$SRC/" "$APP/"
chown -R root:root "$APP"
chown -R shop:shop "$DATA"
chmod 700 "$DATA"
( cd "$APP" && npm install --omit=dev --no-audit --no-fund )

echo "==> 5/8 Settings file ($ENVFILE)"
if [ ! -f "$ENVFILE" ]; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 16)}"
  cat > "$ENVFILE" <<ENV
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
TRUST_PROXY=1
PUBLIC_URL=https://$DOMAIN
DATA_DIR=$DATA
JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n')
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
# M-Pesa (leave empty for demo mode, see README "Going live with M-Pesa")
MPESA_ENV=
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_SECRET=$(head -c 24 /dev/urandom | base64 | tr -d '/+=\n')
ENV
  chmod 600 "$ENVFILE"
  echo "    Owner login created: $ADMIN_EMAIL / $ADMIN_PASSWORD   (change it under Admin > My account)"
else
  echo "    Keeping your existing $ENVFILE"
fi

echo "==> 6/8 Service (starts on boot, restarts if it crashes)"
cat > /etc/systemd/system/shop.service <<UNIT
[Unit]
Description=Sugar & Spice Couture shop
After=network.target

[Service]
User=shop
Group=shop
WorkingDirectory=$APP
EnvironmentFile=$ENVFILE
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA
MemoryMax=600M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now shop
systemctl restart shop
sleep 2
curl -fsS http://127.0.0.1:3000/api/store >/dev/null && echo "    App is running." || { journalctl -u shop -n 30 --no-pager; exit 1; }

echo "==> 7/8 Web server and HTTPS"
sed "s/__DOMAIN__/$DOMAIN/g" "$SRC/deploy/nginx.conf" > /etc/nginx/sites-available/shop
ln -sf /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/shop
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable
systemctl enable --now fail2ban
if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --redirect -n; then
  echo "    HTTPS is on."
else
  echo "    HTTPS could not be issued yet. Point the domain's A record at this server, wait, then run:"
  echo "    certbot --nginx -d $DOMAIN -m $EMAIL --agree-tos --redirect"
fi

echo "==> 8/8 Daily backups"
install -m 755 "$SRC/deploy/backup.sh" /usr/local/bin/shop-backup
cat > /etc/cron.d/shop-backup <<CRON
30 2 * * * root /usr/local/bin/shop-backup >> /var/log/shop-backup.log 2>&1
CRON
/usr/local/bin/shop-backup

echo
echo "Done. Open https://$DOMAIN and https://$DOMAIN/admin"
echo "Backups: /var/backups/shop (copy them off the server too, see DEPLOY-VPS.md)"
