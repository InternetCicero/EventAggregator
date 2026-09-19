# Deployment auf Google Cloud Free Tier (Always Free)

Ziel: eine dauerhaft kostenlose `e2-micro`-VM, auf der Backend (Node/Express +
SQLite + Playwright) und das gebaute React-Frontend zusammen über nginx laufen.

## Voraussetzungen

- Google-Konto + [Google Cloud Console](https://console.cloud.google.com/) (Kreditkarte bei Anmeldung nötig, wird im Always-Free-Rahmen nicht belastet)
- Always-Free `e2-micro` gibt es nur in diesen Regionen: `us-west1`, `us-central1`, `us-east1`

## 1. VM erstellen

In der Cloud Console → **Compute Engine → VM-Instanzen → Instanz erstellen**:

- **Region/Zone**: `us-central1` (oder `us-west1` / `us-east1`)
- **Maschinentyp**: `e2-micro` (im Always-Free-Kontingent)
- **Boot-Laufwerk**: Debian 12, Standardpersistenzspeicher **max. 30GB** (Always-Free-Limit)
- **Firewall**: Häkchen bei **"HTTP-Traffic zulassen"** und **"HTTPS-Traffic zulassen"** setzen
- Erstellen klicken

> Falls "Es ist keine Kapazität verfügbar" erscheint: andere der drei Regionen probieren.

## 2. Per SSH verbinden

In der VM-Liste bei der neuen Instanz auf **SSH** klicken (öffnet ein Browser-Terminal, kein extra Tool nötig).

## 3. Setup-Skript ausführen

```bash
curl -fsSL https://raw.githubusercontent.com/InternetCicero/EventAggregator/main/deploy/setup-vm.sh | sudo bash
```

Das Skript installiert Node.js, nginx, Chromium (für Playwright), richtet eine
2GB-Swap-Datei ein (wichtig bei nur 1GB RAM), klont das Repo nach
`/opt/eventaggregator`, baut das Frontend und startet Backend + nginx.

Dauer: ca. 5–10 Minuten.

## 4. Nacharbeiten

**Admin-Passwort ändern** (Pflicht — sonst läuft die App mit `admin`/`changeme` im Netz):
```bash
sudo nano /opt/eventaggregator/server/.env
sudo systemctl restart eventaggregator
```

**Domain/IP in nginx eintragen** (externe IP steht in der VM-Übersicht der Cloud Console):
```bash
sudo nano /etc/nginx/sites-available/eventaggregator
# server_name DEINE-DOMAIN-ODER-IP;  ->  server_name 34.12.34.56;  (oder deine Domain)
sudo nginx -t && sudo systemctl reload nginx
```

Danach ist die Seite unter `http://<externe-IP>` erreichbar.

## 5. HTTPS (optional, nur mit eigener Domain)

Eine externe IP allein reicht für TLS nicht — du brauchst einen DNS-A-Record,
der auf die IP zeigt. Dann:

```bash
sudo certbot --nginx -d deine-domain.de
```

certbot richtet automatisch HTTPS + Redirect ein und erneuert das Zertifikat
selbstständig.

## 6. Später aktualisieren

Wenn im Repo etwas Neues gepusht wurde:

```bash
sudo bash /opt/eventaggregator/deploy/update.sh
```

## 7. Tägliches Backup einrichten

Auf der VM (einmalig, nach dem ersten Setup):

```bash
sudo -u eventaggregator git -C /opt/eventaggregator pull
```

```bash
sudo bash /opt/eventaggregator/deploy/install-backup.sh
```

Das installiert `sqlite3`, legt einen Cron-Job an (täglich 03:30 Uhr) und macht direkt einen Testlauf.
Die letzten 14 Sicherungen liegen komprimiert in `/var/backups/eventaggregator/`.

Eine Sicherung auf den eigenen Mac holen (auf dem Mac ausführen):

```bash
gcloud compute scp "event-aggregator:/var/backups/eventaggregator/*.gz" ~/Downloads/ --zone=us-central1-a --project=n8n-kalender-498513
```

Wiederherstellen (auf der VM, `DATEI` durch den Dateinamen ersetzen):

```bash
sudo systemctl stop eventaggregator && sudo gunzip -c /var/backups/eventaggregator/DATEI.db.gz > /tmp/restore.db && sudo cp /tmp/restore.db /opt/eventaggregator/server/data/events.db && sudo chown eventaggregator:eventaggregator /opt/eventaggregator/server/data/events.db && sudo rm -f /opt/eventaggregator/server/data/events.db-wal /opt/eventaggregator/server/data/events.db-shm && sudo systemctl start eventaggregator
```

> Die Backups liegen auf derselben VM. Fällt die VM komplett aus, sind sie mit weg —
> ziehen Sie deshalb gelegentlich eine Kopie auf den eigenen Rechner (Befehl oben).

## 8. Automatisches Deployment per GitHub Actions

Bei jedem Push auf `main` prüft GitHub, ob das Frontend baut, verbindet sich dann per SSH mit der VM
und führt `deploy/update.sh` aus (`git pull`, Abhängigkeiten, Build, Neustart, Health-Check).
Der Workflow liegt in `.github/workflows/deploy.yml`, ein manueller Start ist unter *Actions → Deploy → Run workflow* möglich.

**Einmalige Einrichtung:**

1. Auf dem Mac ein eigenes Schlüsselpaar nur für das Deployment erzeugen (ohne Passphrase, `Enter` drücken):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/eventaggregator_deploy -C "github-actions-deploy"
```

2. Den **öffentlichen** Schlüssel anzeigen und kopieren:

```bash
cat ~/.ssh/eventaggregator_deploy.pub
```

3. Auf der VM (Browser-SSH) an die erlaubten Schlüssel des Benutzers anhängen (`SCHLUESSEL` durch die kopierte Zeile ersetzen, in einfachen Anführungszeichen lassen):

```bash
echo 'SCHLUESSEL' >> ~/.ssh/authorized_keys
```

4. Im GitHub-Repo unter *Settings → Secrets and variables → Actions → New repository secret* drei Secrets anlegen:

| Name | Wert |
|---|---|
| `VM_HOST` | externe IP der VM (oder `student.laurenz-polanski.de`) |
| `VM_USER` | der Benutzername auf der VM (der Teil vor `@` im SSH-Prompt, z. B. `laurip`) |
| `VM_SSH_KEY` | Inhalt der **privaten** Datei: `cat ~/.ssh/eventaggregator_deploy` (komplett inkl. `BEGIN`/`END`-Zeilen) |

Der private Schlüssel gehört nur in das GitHub-Secret, niemals ins Repo. Der Benutzer braucht `sudo`-Rechte ohne Passwort; das ist auf Google-Cloud-VMs für den SSH-Benutzer Standard.

## Bekannte Grenzen dieser Konfiguration

- **1GB RAM**: Chromium (Playwright) läuft, aber nicht mehrere Scrape-Läufe
  gleichzeitig — der Scraper arbeitet Quellen ohnehin sequentiell ab, das
  passt. Bei `MemoryMax=700M` im systemd-Service wird der Prozess neu
  gestartet, falls doch mal etwas ausufert (Absturzschutz statt System-OOM).
- **SQLite-Datei liegt auf der VM-Festplatte**: kein separates Backup
  automatisch eingerichtet. Empfehlung: gelegentlich
  `/opt/eventaggregator/server/data/events.db` sichern (z. B. `scp` auf den
  eigenen Rechner oder ein Cron-Job, der die Datei in einen Cloud-Storage-Bucket kopiert).
- **Kein automatisches OS-Update**: gelegentlich `sudo apt update && sudo apt upgrade` ausführen.
