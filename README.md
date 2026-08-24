# EventAggregator

Website zum Sammeln und Anzeigen von lokalen Events aus mehreren Quellen — manuell eingereicht oder automatisch von konfigurierten Websites gescrapt. Kein API-Key, keine KI beteiligt.

## Struktur

- `server/` — Node.js/Express-Backend mit SQLite (better-sqlite3), REST-API, Scraper (Cheerio, CSS-Selektoren) und Admin-Endpunkten (Basic Auth)
- `client/` — React-Frontend (Vite): öffentliche Übersicht mit Filtern, Einreichungsformular, Admin-Dashboard

## Starten

**Backend** (läuft auf http://localhost:4000):
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
In `.env` anschließend `ADMIN_USER`/`ADMIN_PASSWORD` anpassen.

**Frontend** (läuft auf http://localhost:5173, proxied `/api` zu Port 4000):
```bash
cd client
npm install
npm run dev
```

> Hinweis für Windows/`cmd.exe`: Befehle immer einzeln ausführen, keine Zeilen mit `#`-Kommentar dahinter copy-pasten — `cmd.exe` interpretiert `#` nicht als Kommentarzeichen und reicht den Rest der Zeile als zusätzliche Argumente durch, was zu einem `CACError: Unused args…` von Vite führt. In PowerShell/bash/zsh ist das kein Problem.

## Funktionen

- **Übersicht** (`/`): Events gruppiert nach Datum, filterbar nach Kategorie, Tag, Zeitraum, Volltextsuche
- **Event hinzufügen** (`/einreichen`): drei Wege, alle landen als "pending" in der Moderationswarteschlange
  - **Link**: Seite wird abgerufen, schema.org-JSON-LD (`Event`) bzw. Open-Graph-Tags werden als Vorbefüllung genutzt — Nutzer prüft/ergänzt danach im Formular
  - **Screenshot**: Bild wird per lokaler OCR (Tesseract, Deutsch+Englisch) in Text umgewandelt; der erkannte Text wird zur Übertragung ins Formular angezeigt (keine automatische Feldzuordnung, keine KI)
  - **Formular**: alles manuell eintragen (Titel, Beschreibung, Kategorie, Datum, Ort, Anmeldungslink, Tags)
- **Admin** (`/admin`, Basic Auth): Events freigeben/ablehnen/löschen, Scraper-Quellen anlegen/bearbeiten/löschen/manuell ausführen
- **Automatisches Scraping**: pro Quelle werden CSS-Selektoren definiert (Listen-Element, Titel, Datum, Ort, Link, Beschreibung); optional per Checkbox mit Headless-Browser-Rendering (Playwright) für Seiten, die Events per JavaScript nachladen. Ein Cron-Job läuft alle 6 Stunden (`server/src/index.js`) und ruft alle aktiven Quellen ab. Gescrapte Events landen ebenfalls zuerst als "pending".
- Duplikate werden über die Event-URL erkannt und übersprungen.
- Die Link-Extraktion blockiert Anfragen an lokale/private Adressen (SSRF-Schutz).

## Deployment

Anleitung für dauerhaft kostenloses Hosting auf einer Google-Cloud-`e2-micro`-VM
(Always-Free-Tier): siehe [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Eine Scraper-Quelle einrichten

Im Admin-Bereich unter "Automatische Quellen" → "+ Neue Quelle":

1. **Item-Selector**: CSS-Selektor, der jedes einzelne Event auf der Listing-Seite trifft (z. B. `.event-item`)
2. **Titel-/Datum-/Ort-/Beschreibung-/Link-Selector**: jeweils relativ zum Item-Element
3. Datum wird versucht als ISO (`YYYY-MM-DD`) oder deutsches Format (`DD.MM.YYYY`) zu erkennen; `datetime`/`content`-Attribute werden bevorzugt, falls vorhanden

Am besten die Zielseite im Browser mit den Entwicklertools inspizieren, um die passenden Selektoren zu finden.
