#!/usr/bin/env bash
# Richtet das tägliche Backup ein (auf einer bereits laufenden VM):
#   sudo bash /opt/eventaggregator/deploy/install-backup.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo ausführen." >&2
  exit 1
fi

apt-get install -y sqlite3

chmod +x /opt/eventaggregator/deploy/backup.sh

# Täglich um 03:30 Uhr, Ausgabe ins Log
cat > /etc/cron.d/eventaggregator-backup <<'EOF'
30 3 * * * root /opt/eventaggregator/deploy/backup.sh >> /var/log/eventaggregator-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/eventaggregator-backup

echo "==> Testlauf"
/opt/eventaggregator/deploy/backup.sh
ls -lh /var/backups/eventaggregator
