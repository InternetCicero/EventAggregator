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
