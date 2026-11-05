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
- Duplikate innerhalb einer Quelle werden über die Event-URL (und den Titel) erkannt und übersprungen.
- **Duplikate über mehrere Quellen** (Spec: [docs/specs/2026-11-03-event-duplikate.md](docs/specs/2026-11-03-event-duplikate.md)): Events gelten als dasselbe Event, wenn sie am selben Kalendertag liegen, die Orte nicht widersprechen und die normalisierten Titel (ohne Reihenfolge, Füllwörter, Jahreszahlen, Akzente) zu mindestens 90 % übereinstimmen. Dann wird kein zweites Event angelegt, sondern die Quelle am vorhandenen Event vermerkt ("Auch bei: …" auf der Eventkarte). Bei 60 bis 90 % wird das Event gespeichert und im Admin als "Mögliches Duplikat von …" markiert (Filter "Nur mögliche Duplikate"). Die Schwellen stehen in `server/src/db/duplicates.js`. Events derselben Quelle werden dabei nicht verglichen, damit mehrere Termine einer Quelle am selben Tag erhalten bleiben. Bereits vorhandene Duplikate werden beim ersten Start nur markiert, nichts wird gelöscht.
  - **Aufräumen im Admin** (Spec: [docs/specs/2026-11-03-event-zusammenfuehren.md](docs/specs/2026-11-03-event-zusammenfuehren.md)): Bei markierten Events gibt es **Zusammenführen** (das Event wird abgelehnt, seine Quelle samt Link als "Auch bei" am Original vermerkt) und **Kein Duplikat** (entfernt die Markierung). Beides auch als Sammelaktion über die Auswahlleiste, am besten mit dem Filter "Nur mögliche Duplikate". Das zusammengeführte Event bleibt als "abgelehnt" gespeichert, damit der Scraper es nicht wieder anlegt. Ein freigegebenes Event wird nur in ein freigegebenes Original zusammengeführt, ein abgelehntes Original sperrt die Aktion.
- Die Link-Extraktion blockiert Anfragen an lokale/private Adressen (SSRF-Schutz).

## Jobs & Praktika

Spezifikation: [docs/specs/2026-10-04-jobs-praktika.md](docs/specs/2026-10-04-jobs-praktika.md) (v1 umgesetzt, v2–v4 Roadmap).

- **Übersicht** (`/jobs`): filterbar nach Stellenart, Abschluss, Semester, Arbeitsmodell, Bezahlung, Sprache, Branche, Ort, „Gehalt angegeben“
- **Detailseite** (`/jobs/:id`): Eckdaten, Vibe-Regler, Antworten auf Leitfragen, Empfehlungsnotiz, Kontaktkarte, Bewerben-Button (externer Link oder `mailto:`)
- **Stelle einreichen** (`/jobs/einreichen`): optional Vorbefüllung per Link (schema.org `JobPosting`), alle 7 Vibe-Regler Pflicht, Leitfragen optional (max. 280 Zeichen), Einwilligung der genannten Personen Pflicht. Landet als „pending“
- **Admin** → Reiter „Stellen“ (freigeben/ablehnen/löschen, bearbeiten, Firma zuordnen) und „Firmen“ (Name, Website, Branche, Größe)
- **Ablauf**: täglich um 3:15 Uhr werden Stellen mit abgelaufener Bewerbungsfrist bzw. ohne Frist nach `JOB_MAX_AGE_DAYS` Tagen (Standard 90) ohne Aktualisierung auf „expired“ gesetzt
- **Datenschutz** (`/datenschutz`): Kontakt für Auskunft/Löschung consulting@laurenz-polanski.de
- **Impressum** (`/impressum`): Anbieterangaben nach § 5 DDG, im Footer jeder Seite verlinkt. Die Angaben entsprechen dem Impressum auf laurenz-polanski.de und müssen bei Änderungen an beiden Stellen angepasst werden

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

### Mehrere Seiten durchblättern

Zeigt eine Seite ihre Events auf mehreren Seiten, bei denen sich nur der Inhalt, nicht die Adresse ändert (z. B. Seitenzahlen oder "Weiter"), kann der Scraper durchklicken:

1. Häkchen "Seite lädt Events per JavaScript nach" setzen (Blättern braucht den Browser)
2. **Nächste-Seite-Selektor**: CSS-Selektor des "Weiter"-Knopfs, z. B. `[aria-label="Go to next page"]`
3. **Max. Seiten**: wie viele Seiten höchstens gelesen werden (1–50, Standard 1)

Der Lauf stoppt früher, wenn der Knopf fehlt oder gesperrt ist oder sich der Inhalt nach dem Klick nicht mehr ändert (letzte Seite). Ein Lauf hat ein Zeitbudget von 2 Minuten fürs Blättern. Bei Seiten, die nach Datum sortiert sind, begrenzt "Max. Seiten" praktisch den Zeitraum.

Funktioniert auch, wenn der "Weiter"-Knopf ein normaler Link ist und die ganze Seite neu lädt (z. B. WU Wien: `.md-paging__arrow--next`).

### Quellen ohne Link je Event

Öffnen sich die Details per JavaScript und gibt es keine eigene Adresse pro Event (z. B. WU Wien), den Link-Selektor leer lassen. Duplikate werden dann über Titel + Startzeit erkannt, als Event-Link dient die Listen-URL.

Beispiel Hackathon Hub: Listen-URL `https://hackathonhub.eu/events`, Item `a.block.group`, Nächste-Seite-Selektor `[aria-label="Go to next page"]`, Max. Seiten `50` liest alle rund 400 Events (34 Seiten, ca. 45 Sekunden).

## Materialien hinzufügen

Der Reiter **Materialien** (`/materialien`) braucht kein Backend. Spezifikationen: [v1](docs/specs/2026-11-02-materialien.md), [Formate](docs/specs/2026-11-02-materialien-formate.md), [Detailseite](docs/specs/2026-11-03-materialien-detailseite.md). Die Übersicht filtert nach **Thema** (`category`) und **Format** (`type`), jedes Material hat eine eigene Seite unter `/materialien/<id>`.

1. Datei (außer bei Links) in `client/public/materialien/` ablegen. Der Dateiname ist zugleich der Download-Name, also einen sprechenden wählen (z. B. `cv-optimierung-prompt.md`).
2. In `client/src/data/materials.json` unter `items` einen Eintrag ergänzen. Immer nötig: `id` (eindeutig, nur `a-z`, `0-9`, `-`), `title`, `description` (ein Satz für die Karte, höchstens 140 Zeichen), `outcome` (Liste, 1–4 Kurzsätze: Was es bringt), `useWhen` (Liste, 1–4 Kurzsätze: Wann nutzen), `category` (aus `categories`), `type`. Optional: `steps` (Liste, 1–8 Kurzsätze: So geht's). Jeder Listeneintrag hat höchstens 160 Zeichen. Je Format zusätzlich:

| `type` | Zusätzlich | Datei |
|---|---|---|
| `prompt` | `file` | `.md`, wird aufklappbar angezeigt, mit Kopieren-Button |
| `text` | `file` | `.md`, wird formatiert angezeigt (Überschriften, Listen, Fettdruck, Links). Rohes HTML und Bilder im Markdown werden nicht ausgeführt bzw. geladen. |
| `datei` | `file` | `pdf`, `docx`, `doc`, `xlsx`, `pptx`, `txt`, `csv`, `zip` |
| `bild` | `file`, `alt` (Alt-Text) | `png`, `jpg`, `jpeg`, `webp`, höchstens 800 KB |
| `link` | `url` (muss mit `https://` beginnen) | keine Datei |

3. `cd server && npm test` prüft Pflichtfelder, Dateiendungen, Bildgröße, Links und dass jede Datei existiert; `cd client && npm test` prüft die Markdown-Aufbereitung.
4. Committen und nach `main` pushen, der Auto-Deploy liefert die Seite aus.

## Besucherstatistik

Einfache Zählung ohne Cookies und ohne IP-Speicherung (Spec `docs/specs/2026-11-03-site-analytics.md`).

- Das Frontend meldet pro Seitenwechsel `POST /api/stats/view` und, solange die Seite sichtbar ist, alle 15 Sekunden `POST /api/stats/ping`. `Do Not Track`/`Global Privacy Control` schalten die Messung ab, ebenso Bots und `/admin`.
- Der Server speichert nur Tag, Seitenmuster (z. B. `/materialien/:id`) und einen Tageshash (Salz nur im Arbeitsspeicher, täglich neu). Einzelaufrufe werden täglich um 3:30 Uhr nach 2 Tagen zu Tageswerten (`stats_daily`) verdichtet, Tageswerte nach 395 Tagen gelöscht.
- Auswertung im Admin-Bereich unter „Statistik“ (7, 30, 90 Tage). „Besucher“ ist die Summe der Tagesbesucher.
- Hinter nginx gilt `trust proxy` für `127.0.0.1`, damit die echte IP aus `X-Forwarded-For` für den Tageshash genutzt wird.

## Tests und Pipeline

- `server`: `npm test` (Unit- und API-Tests), `npm run lint`
- `client`: `npm test`, `npm run lint`, `npm run build`
- `e2e`: Browser-Tests mit Playwright (Chromium, Handy 375 px und Desktop 1280 px). Sie starten ein Testbackend mit temporärer Datenbank und absichtlich extremen Texten (200 Zeichen ohne Leerzeichen, 300 Zeichen lange URL) und prüfen, dass nichts über den Rand läuft und keine Konsolenfehler auftreten.

```bash
cd e2e
npm ci
npx playwright install chromium   # einmalig
npm test
```

Bei einem Fehlschlag im CI lädt der Job Screenshots und Trace als Artefakt "ui-test-ergebnisse" hoch.
