# Spec: Einfache Besucherstatistik ohne Cookies

- **Status:** Draft
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-03

## 1. Ziel

Der Betreiber soll im Admin-Bereich sehen, **wie viele Besucher** auf der Seite waren, **welche Seiten** angesehen wurden und **wie lange** Besucher bleiben. Die Messung braucht keine Einwilligung (kein Cookie-Banner), schickt keine Daten an Dritte und speichert keine personenbezogenen Daten.

Umsetzung im bestehenden Backend (Express + SQLite), ohne neuen Dienst und ohne KI.

## 2. Scope

- Kleines Skript im Frontend meldet Seitenaufruf und Verweildauer an das eigene Backend
- Zwei öffentliche Endpunkte zum Melden: `POST /api/stats/view` und `POST /api/stats/ping`
- Anonyme Tageskennung (Hash, täglich neu gesalzen, nie gespeichert mit IP oder User-Agent)
- Tabelle für Tageswerte pro Seite; Tabelle für einzelne Aufrufe nur so lange, wie die Verweildauer zugeordnet werden muss
- Admin-Ansicht "Statistik": Besucher, Seitenaufrufe, Top-Seiten, durchschnittliche Verweildauer, letzte 7, 30 und 90 Tage
- Bots grob herausfiltern, Admin-Aufrufe nicht mitzählen
- Neuer Abschnitt in der Datenschutzerklärung
- Tests, README

## 3. Non-Goals

- Keine Cookies, kein localStorage/sessionStorage, kein Fingerprinting
- Keine Wiedererkennung über mehrere Tage ("wiederkehrende Besucher")
- Keine Speicherung von IP-Adresse, User-Agent, Referrer-URL oder genauem Standort
- Keine Drittanbieter, kein Export, keine Weitergabe
- Keine Ereignis- oder Klick-Verfolgung (z. B. welcher Download angeklickt wurde), nur Seitenaufrufe
- Keine Auswertung nach Gerät, Browser oder Land
- Kein Opt-out-Schalter für Besucher (nicht nötig, siehe Abschnitt 4)
- Kein Dashboard-Diagramm-Framework; einfache Zahlen und Tabellen genügen

## 4. Annahmen

- **Rechtlich** (keine Rechtsberatung): Ohne Zugriff auf Informationen im Endgerät (kein Cookie, kein Storage) greift die Einwilligungspflicht nach § 25 TDDDG nicht. Die Verarbeitung stützt sich auf das berechtigte Interesse (Art. 6 Abs. 1 lit. f DSGVO) an Reichweitenmessung und Fehlererkennung. Bei Zweifeln vor Livegang juristisch prüfen lassen.
- Die IP-Adresse wird nur kurz im Arbeitsspeicher zur Berechnung des Hashs verwendet. Die ohnehin vorhandenen Server-Logs (Abschnitt "Hosting" der Datenschutzerklärung) bleiben unverändert.
- Die Tageskennung ist `SHA-256(Tagessalz + IP + User-Agent)`. Das Tagessalz ist ein zufälliger Wert, der nur im Arbeitsspeicher liegt, täglich um 0:00 Uhr (Europe/Berlin) neu erzeugt und beim Neustart des Servers verworfen wird. Damit lässt sich die Kennung nach dem Tageswechsel nicht mehr zurückrechnen oder mit anderen Tagen verknüpfen.
- Ein Server-Neustart am selben Tag erzeugt ein neues Salz. Derselbe Besucher kann dann am selben Tag zweimal gezählt werden. Das ist als geringe Ungenauigkeit akzeptiert.
- Hinter einem Reverse-Proxy muss die echte IP aus `X-Forwarded-For` gelesen werden; `trust proxy` wird dafür in der App gesetzt (Prüfung in T1).
- Der Besucherzähler ist eine Schätzung (mehrere Personen hinter derselben IP mit gleichem Browser zählen als eine).

## 5. Messung

**Seitenaufruf:** Bei jedem Seitenwechsel im React-Router (auch beim ersten Laden) sendet das Frontend `POST /api/stats/view` mit dem Pfad (z. B. `/materialien`, `/materialien/cv-vorlage-canva`). Der Server antwortet mit einer zufälligen Aufruf-ID.

**Verweildauer:** Solange die Seite sichtbar ist, sendet das Frontend alle 15 Sekunden `POST /api/stats/ping` mit der Aufruf-ID. Beim Verlassen (visibilitychange/pagehide) wird ein letzter Ping per `navigator.sendBeacon` geschickt. Die Dauer ist die Zeit zwischen erstem und letztem Ping, nur sichtbare Zeit, höchstens 30 Minuten pro Aufruf.

**Pfade:** Es zählen nur bekannte Routen der Seite. Dynamische Pfade werden auf ein Muster abgebildet (`/materialien/:id`, `/stellen/:id`), unbekannte Pfade werden verworfen. Query-Strings und Fragmente werden entfernt.

**Nicht gezählt:** Anfragen mit Bot-User-Agent (einfache Liste: `bot`, `crawl`, `spider`, `headless`, `curl` u. Ä.), Aufrufe unter `/admin`, Besucher mit gesetztem "Do Not Track" bzw. Global Privacy Control.

## 6. Datenmodell

Neue Tabellen, Migration über `PRAGMA user_version` (v7):

| Tabelle | Spalten | Zweck |
|---|---|---|
| `stats_views` | `id` (zufällig), `day` (YYYY-MM-DD), `path`, `visitor` (Tageshash), `started_at`, `last_ping_at`, `seconds` | Einzelaufruf, nur kurz gehalten |
| `stats_daily` | `day`, `path`, `views`, `visitors`, `total_seconds`, `timed_views`, Primärschlüssel `(day, path)` | verdichtete Tageswerte, dauerhaft |

Täglich um 3:30 Uhr werden `stats_views` älter als **2 Tage** zu `stats_daily` verdichtet und gelöscht. `visitors` pro Seite und `visitors` pro Tag insgesamt werden dabei berechnet; die Tagesgesamtzahl liegt in einer Zeile mit `path = '*'`. Der Tageshash steht danach nirgends mehr. `stats_daily` älter als **13 Monate** wird gelöscht.

## 7. Akzeptanzkriterien

- **AC-1:** WHEN eine Seite der Website aufgerufen wird THE SYSTEM SHALL einen Seitenaufruf mit Tag, normalisiertem Pfad und Tageskennung speichern, ohne Cookie und ohne Zugriff auf den Speicher des Browsers.
- **AC-2:** THE SYSTEM SHALL weder IP-Adresse noch User-Agent oder Referrer in der Datenbank speichern.
- **AC-3:** WHEN der Tag wechselt THE SYSTEM SHALL ein neues Tagessalz verwenden, sodass dieselbe Person an zwei Tagen zwei verschiedene Kennungen hat.
- **AC-4:** WHEN dieselbe Tageskennung am selben Tag mehrere Seiten aufruft THE SYSTEM SHALL sie in der Tagesgesamtzahl der Besucher nur einmal zählen.
- **AC-5:** WHILE die Seite sichtbar ist THE SYSTEM SHALL alle 15 Sekunden einen Ping senden und die Verweildauer aus den Pings berechnen, höchstens 30 Minuten pro Aufruf.
- **AC-6:** WHEN die Seite in einem Hintergrund-Tab liegt THE SYSTEM SHALL keine Pings senden, sodass die Dauer nur sichtbare Zeit enthält.
- **AC-7:** WHEN ein Pfad unbekannt ist, zum Admin-Bereich gehört oder ein Bot-User-Agent anfragt THE SYSTEM SHALL nichts speichern und trotzdem mit Status 204 antworten.
- **AC-8:** WHEN der Browser "Do Not Track" oder Global Privacy Control sendet THE SYSTEM SHALL weder Skript-Meldungen senden noch serverseitig speichern.
- **AC-9:** WHEN ein Ping zu einer unbekannten oder zu alten Aufruf-ID kommt THE SYSTEM SHALL ihn ignorieren (Status 204).
- **AC-10:** THE SYSTEM SHALL Query-Strings und Fragmente aus Pfaden entfernen und dynamische Pfade auf Muster abbilden.
- **AC-11:** WHEN die Verdichtung läuft THE SYSTEM SHALL Aufrufe älter als 2 Tage in `stats_daily` zusammenfassen und die Einzelzeilen samt Tageskennung löschen.
- **AC-12:** WHEN der Admin die Statistik öffnet THE SYSTEM SHALL für 7, 30 oder 90 Tage anzeigen: Besucher gesamt, Seitenaufrufe gesamt, durchschnittliche Verweildauer, Aufrufe und Besucher pro Tag, Top-Seiten mit Aufrufen und durchschnittlicher Dauer.
- **AC-13:** THE SYSTEM SHALL den Statistik-Endpunkt für die Anzeige nur mit Admin-Anmeldung zugänglich machen (wie alle Admin-Endpunkte).
- **AC-14:** THE SYSTEM SHALL die Melde-Endpunkte pro Tageskennung begrenzen (Rate-Limit, z. B. 120 Anfragen pro Minute), damit niemand die Statistik mit Masseneinsendungen verfälscht oder die Datenbank füllt.
- **AC-15:** WHEN das Melden fehlschlägt (Netzwerk, Serverfehler) THE SYSTEM SHALL die Nutzung der Seite nicht beeinträchtigen und keine Fehlermeldung zeigen.
- **AC-16:** THE SYSTEM SHALL die Datenschutzerklärung um einen Abschnitt zur Besucherstatistik ergänzen (was gezählt wird, was nicht, Rechtsgrundlage, Speicherdauer, Hinweis auf "Do Not Track").
- **AC-17:** WHEN Daten verdichtet oder gelöscht werden THE SYSTEM SHALL nur `stats_*`-Tabellen berühren und keine Events, Stellen oder Quellen.

## 8. Design

**Neue Dateien**
- `server/src/db/statsRepo.js`: Tagessalz, Hash, `recordView`, `recordPing`, `compactOldViews`, `getSummary(days)`
- `server/src/routes/stats.js`: `POST /view`, `POST /ping` (öffentlich); Pfad-Normalisierung und Bot-Erkennung in einem Modul `server/src/stats/path.js`
- `client/src/lib/stats.js`: Hook `useTracking()` im Router (sendet View/Pings, beachtet DNT/GPC und `document.visibilityState`)
- `server/test/stats.test.js`, `server/test/stats-migration.test.js`

**Geänderte Dateien**
- `server/src/db/index.js`: Tabellen und Migration v7 (`CURRENT_SCHEMA_VERSION = 7`)
- `server/src/app.js`: `/api/stats` einbinden, `trust proxy` setzen (T1 prüft Proxy-Aufbau)
- `server/src/index.js`: Cron `30 3 * * *` für die Verdichtung
- `server/src/routes/admin.js`: `GET /api/admin/stats?days=7|30|90`
- `client/src/App.jsx`: Hook einbinden; Admin-Route zeigt neuen Reiter
- `client/src/pages/AdminDashboard.jsx` (oder neue `AdminStats.jsx`): Reiter "Statistik" mit Kennzahlen und Tabelle
- `client/src/pages/Datenschutz.jsx`: neuer Abschnitt
- `README.md`: Abschnitt "Besucherstatistik"

**Antworten:** Melde-Endpunkte antworten mit 204 (View: 200 mit `{ id }`), ohne Details, damit nichts über Filterentscheidungen verraten wird.

## 9. Aufgaben

- [ ] T1: Reverse-Proxy und echte Client-IP klären (`trust proxy`), Pfad-Normalisierung und Bot-Erkennung mit Tests (AC-7, AC-10)
- [ ] T2: Datenmodell, Migration v7, `statsRepo` mit Tests für Hash, Tageswechsel, Besucherzählung, Dauer und Verdichtung (AC-1 bis AC-5, AC-9, AC-11, AC-17)
- [ ] T3: Melde-Endpunkte inklusive Rate-Limit und DNT/GPC mit Tests (AC-2, AC-7 bis AC-9, AC-14)
- [ ] T4: Frontend-Hook mit Sichtbarkeitslogik, Beacon und stillem Fehlerverhalten (AC-5, AC-6, AC-8, AC-15)
- [ ] T5: Admin-Endpunkt und Reiter "Statistik" mit Tests für Zugriffsschutz (AC-12, AC-13)
- [ ] T6: Datenschutzerklärung, README, manuelle Prüfung mit lokaler Demo-Datenbank (AC-16)
- [ ] T7: Nach dem Deploy: einige Seiten aufrufen, Zahlen im Admin gegenprüfen, Datenbank auf fehlende IP/User-Agent prüfen

## 10. Testplan

| AC | Prüfung |
|---|---|
| AC-1 bis AC-5, AC-9, AC-11, AC-17 | automatisiert gegen `statsRepo` (`EVENTS_DB_PATH=':memory:'`, Uhrzeit injizierbar) |
| AC-2 | automatisiert: Spalten der Tabellen enthalten kein IP-/UA-Feld; Stichprobe der gespeicherten Zeilen |
| AC-7, AC-8, AC-10, AC-13, AC-14 | automatisiert über den Router |
| AC-5, AC-6, AC-15 | automatisiert für die reine Logik (Intervalle, Sichtbarkeit), manuell im Browser |
| AC-12, AC-16 | manuell mit lokaler Demo-Datenbank |
| T7 | live nach dem Deploy |

## 11. Offene Fragen für das Review

1. **Aufbewahrung:** 13 Monate für verdichtete Tageswerte und 2 Tage für Einzelaufrufe, einverstanden? (Kürzer geht, die Zahlen werden dann weniger lang vergleichbar.)
2. **Do Not Track / Global Privacy Control:** respektieren (wie vorgeschlagen) oder ignorieren? Respektieren ist datensparsamer, senkt aber die Zahlen leicht.
3. **Referrer:** Soll später gezählt werden, woher Besucher kommen (nur Domain, z. B. "linkedin.com")? Das ist nicht Teil dieser Spec, ließe sich aber ergänzen.

## 12. Änderungsprotokoll

- v1 (2026-11-03): Erster Entwurf
