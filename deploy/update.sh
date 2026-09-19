#!/usr/bin/env bash
# Für spätere Updates: neue Version deployen ohne die ganze VM neu einzurichten.
#   sudo bash /opt/eventaggregator/deploy/update.sh
# Wird auch von der GitHub Action (.github/workflows/deploy.yml) aufgerufen.
set -euo pipefail
APP_DIR="/opt/eventaggregator"
APP_USER="eventaggregator"

cd "$APP_DIR"
sudo -u "$APP_USER" git pull --ff-only

cd "$APP_DIR/server"
sudo -u "$APP_USER" npm ci --omit=dev

cd "$APP_DIR/client"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build

systemctl restart eventaggregator

# Kurz warten und prüfen, ob das Backend wieder antwortet
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    echo "Update fertig, Backend antwortet."
    exit 0
  fi
  sleep 2
done
echo "FEHLER: Backend antwortet nach dem Update nicht. Logs: journalctl -u eventaggregator -n 50" >&2
exit 1
