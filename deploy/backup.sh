#!/usr/bin/env bash
# Sichert die SQLite-Datenbank konsistent (auch bei laufendem Server, WAL-Modus)
# und behält die letzten 14 Sicherungen. Wird täglich per cron aufgerufen.
set -euo pipefail

DB="/opt/eventaggregator/server/data/events.db"
BACKUP_DIR="/var/backups/eventaggregator"
KEEP=14

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
TARGET="$BACKUP_DIR/events_$STAMP.db"

# .backup nutzt die SQLite-Backup-API: konsistent, auch während Schreibzugriffen
sqlite3 "$DB" ".backup '$TARGET'"
gzip -f "$TARGET"

# Alte Sicherungen entfernen (nur die $KEEP neuesten behalten)
ls -1t "$BACKUP_DIR"/events_*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "Backup erstellt: $TARGET.gz"
