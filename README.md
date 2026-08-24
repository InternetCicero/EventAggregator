# EventAggregator

Website zum Sammeln und Anzeigen von lokalen Events aus mehreren Quellen — manuell eingereicht oder automatisch von konfigurierten Websites gescrapt. Kein API-Key, keine KI beteiligt.

## Struktur

- `server/` — Node.js/Express-Backend mit SQLite (better-sqlite3), REST-API, Scraper (Cheerio, CSS-Selektoren) und Admin-Endpunkten (Basic Auth)
- `client/` — React-Frontend (Vite): öffentliche Übersicht mit Filtern, Einreichungsformular, Admin-Dashboard

## Starten

**Backend:**
```bash
cd server
cp .env.example .env   # ADMIN_USER/ADMIN_PASSWORD anpassen
npm install
npm run dev             # läuft auf http://localhost:4000
```

**Frontend:**
```bash
cd client
npm install
npm run dev              # läuft auf http://localhost:5173, proxied /api zu Port 4000
```

## Funktionen

- **Übersicht** (`/`): Events gruppiert nach Datum, filterbar nach Kategorie, Tag, Zeitraum, Volltextsuche
- **Event einreichen** (`/einreichen`): offenes Formular, landet als "pending" in der Moderationswarteschlange
- **Admin** (`/admin`, Basic Auth): Events freigeben/ablehnen/löschen, Scraper-Quellen anlegen/bearbeiten/löschen/manuell ausführen
- **Automatisches Scraping**: pro Quelle werden CSS-Selektoren definiert (Listen-Element, Titel, Datum, Ort, Link, Beschreibung); ein Cron-Job läuft alle 6 Stunden (`server/src/index.js`) und ruft alle aktiven Quellen ab. Gescrapte Events landen ebenfalls zuerst als "pending".
- Duplikate werden über die Event-URL erkannt und übersprungen.

## Eine Scraper-Quelle einrichten

Im Admin-Bereich unter "Automatische Quellen" → "+ Neue Quelle":

1. **Item-Selector**: CSS-Selektor, der jedes einzelne Event auf der Listing-Seite trifft (z. B. `.event-item`)
2. **Titel-/Datum-/Ort-/Beschreibung-/Link-Selector**: jeweils relativ zum Item-Element
3. Datum wird versucht als ISO (`YYYY-MM-DD`) oder deutsches Format (`DD.MM.YYYY`) zu erkennen; `datetime`/`content`-Attribute werden bevorzugt, falls vorhanden

Am besten die Zielseite im Browser mit den Entwicklertools inspizieren, um die passenden Selektoren zu finden.
