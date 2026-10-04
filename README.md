# Student Hub

Website (student.laurenz-polanski.de) zum Sammeln und Anzeigen von Karriere-Events und empfohlenen Stellen (Praktika, Werkstudentenjobs, Einstiegsjobs). Events werden manuell eingereicht oder automatisch von konfigurierten Websites gescrapt, Stellen werden eingereicht und moderiert. Kein API-Key, keine KI beteiligt.

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

## Jobs & Praktika

Spezifikation: [docs/specs/2026-10-04-jobs-praktika.md](docs/specs/2026-10-04-jobs-praktika.md) (v1 umgesetzt, v2–v4 Roadmap).

- **Übersicht** (`/jobs`): filterbar nach Stellenart, Abschluss, Semester, Arbeitsmodell, Bezahlung, Sprache, Branche, Ort, „Gehalt angegeben“
- **Detailseite** (`/jobs/:id`): Eckdaten, Vibe-Regler, Antworten auf Leitfragen, Empfehlungsnotiz, Kontaktkarte, Bewerben-Button (externer Link oder `mailto:`)
- **Stelle einreichen** (`/jobs/einreichen`): optional Vorbefüllung per Link (schema.org `JobPosting`), alle 7 Vibe-Regler Pflicht, Leitfragen optional (max. 280 Zeichen), Einwilligung der genannten Personen Pflicht. Landet als „pending“
- **Admin** → Reiter „Stellen“ (freigeben/ablehnen/löschen, bearbeiten, Firma zuordnen) und „Firmen“ (Name, Website, Branche, Größe)
- **Ablauf**: täglich um 3:15 Uhr werden Stellen mit abgelaufener Bewerbungsfrist bzw. ohne Frist nach `JOB_MAX_AGE_DAYS` Tagen (Standard 90) ohne Aktualisierung auf „expired“ gesetzt
- **Datenschutz** (`/datenschutz`): Kontakt für Auskunft/Löschung consulting@laurenz-polanski.de

Für ein zweites Backend parallel (z. B. mit Testdatenbank) kann der Vite-Proxy per `API_TARGET=http://localhost:4001` umgelenkt werden; die Datenbank lässt sich mit `EVENTS_DB_PATH` wählen.

## Deployment

Anleitung für dauerhaft kostenloses Hosting auf einer Google-Cloud-`e2-micro`-VM
(Always-Free-Tier): siehe [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Eine Scraper-Quelle einrichten

Im Admin-Bereich unter "Automatische Quellen" → "+ Neue Quelle":

1. **Item-Selector**: CSS-Selektor, der jedes einzelne Event auf der Listing-Seite trifft (z. B. `.event-item`)
2. **Titel-/Datum-/Ort-/Beschreibung-/Link-Selector**: jeweils relativ zum Item-Element
3. Datum wird versucht als ISO (`YYYY-MM-DD`) oder deutsches Format (`DD.MM.YYYY`) zu erkennen; `datetime`/`content`-Attribute werden bevorzugt, falls vorhanden

Am besten die Zielseite im Browser mit den Entwicklertools inspizieren, um die passenden Selektoren zu finden.
