#!/usr/bin/env bash
# Für spätere Updates: neue Version deployen ohne die ganze VM neu einzurichten.
#   sudo bash /opt/eventaggregator/deploy/update.sh
set -euo pipefail
APP_DIR="/opt/eventaggregator"
APP_USER="eventaggregator"

cd "$APP_DIR"
sudo -u "$APP_USER" git pull

cd "$APP_DIR/server"
sudo -u "$APP_USER" npm ci --omit=dev

cd "$APP_DIR/client"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build

systemctl restart eventaggregator
echo "Update fertig. systemctl status eventaggregator"
