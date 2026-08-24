#!/usr/bin/env bash
# Einmaliges Setup auf einer frischen Debian/Ubuntu-VM (getestet für GCP
# e2-micro, Debian 12 "bookworm"). Als root oder mit sudo ausführen:
#
#   curl -fsSL https://raw.githubusercontent.com/<dein-github-user>/EventAggregator/main/deploy/setup-vm.sh | sudo bash
#
# oder nach dem Klonen lokal:
#
#   sudo bash deploy/setup-vm.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/InternetCicero/EventAggregator.git}"
APP_DIR="/opt/eventaggregator"
APP_USER="eventaggregator"

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root/sudo ausführen." >&2
  exit 1
fi

echo "==> Swap-Datei anlegen (e2-micro hat nur 1GB RAM, Chromium braucht Puffer)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Pakete installieren"
apt-get update -y
apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

echo "==> Node.js 22 installieren"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> App-User anlegen"
id -u "$APP_USER" &>/dev/null || useradd -m -s /usr/sbin/nologin "$APP_USER"

echo "==> Repository klonen/aktualisieren"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> Backend-Abhängigkeiten installieren"
cd "$APP_DIR/server"
sudo -u "$APP_USER" npm ci --omit=dev

echo "==> Playwright-Chromium + Systemabhängigkeiten installieren"
npx playwright install-deps chromium
sudo -u "$APP_USER" npx playwright install chromium

if [ ! -f "$APP_DIR/server/.env" ]; then
  echo "==> .env aus Vorlage anlegen — BITTE ADMIN_PASSWORD DANACH ÄNDERN"
  sudo -u "$APP_USER" cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
fi

echo "==> Frontend bauen"
cd "$APP_DIR/client"
npm ci
npm run build

echo "==> Verzeichnisrechte setzen"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo "==> systemd-Service einrichten"
cp "$APP_DIR/deploy/eventaggregator.service" /etc/systemd/system/eventaggregator.service
systemctl daemon-reload
systemctl enable --now eventaggregator

echo "==> nginx einrichten"
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/eventaggregator
ln -sf /etc/nginx/sites-available/eventaggregator /etc/nginx/sites-enabled/eventaggregator
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "==> Fertig."
echo "1. server_name in /etc/nginx/sites-available/eventaggregator auf deine Domain/IP setzen, dann: nginx -t && systemctl reload nginx"
echo "2. Admin-Passwort in $APP_DIR/server/.env ändern, dann: systemctl restart eventaggregator"
echo "3. Für HTTPS mit eigener Domain: certbot --nginx -d deine-domain.de"
echo "4. Status prüfen: systemctl status eventaggregator"
