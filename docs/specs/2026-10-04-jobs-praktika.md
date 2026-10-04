# Spec: Jobs & Praktika (Empfehlungsnetzwerk)

- **Status:** Implemented (lokal)
- **Version:** 4
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-10-04
- **Approved:** 2026-10-04

## 1. Ziel

Die Event-Website wird um Praktika und Einstiegsjobs erweitert. Zielgruppe sind aktive
Studierende und Young Professionals aus dem eigenen Umfeld sowie Recruiter/Manager,
die schnell vorselektierte Leute suchen.

Das Alleinstellungsmerkmal ist **nicht** eine weitere Filterliste, sondern:

1. **Vertrauen statt Algorithmus:** Stellen kommen über Laurenz, über verifizierte
   Firmenmitarbeitende oder über Members, die sie empfehlen. Später können Members
   auch Bewerber empfehlen. Die Vorselektion passiert über Empfehlungen.
2. **„Vibe“ in Graustufen:** strukturierte Schieberegler und kurze Leitfragen statt
   Marketingtext.
3. **Brücke zu Events (ab v2):** Bei einer Stelle sieht man, auf welchen (gescrapten) Events
   die Firma vertreten ist und wer von der Firma dort ist.

Leitplanken (gelten für alle Versionen):

- **Kostenlos und ohne KI.** Kein LLM, kein API-Key. Matching ist regelbasiert und
  erklärbar. Damit bleibt das System nach Einschätzung außerhalb der Hochrisiko-Pflichten
  des EU AI Acts (vor v3 noch einmal prüfen).
- **Datensparsam (DSGVO):** Personenbezogene Daten nur mit Einwilligung, löschbar, EU-Hosting
  (bestehende GCP-VM, Region prüfen).
- **AGG-konform:** keine Alters- und Geschlechtsfelder, keine Formulierungen wie „junges Team“.

## 2. Versionsübersicht

| Version | Name | Kern | Accounts nötig? |
|---|---|---|---|
| **v1** | Kuratierte Stellenbörse | Stellen einreichen + moderieren, Filter, Vibe-Regler, Leitfragen, Empfehlungsnotiz, Kontaktkarte | Nein (wie heute bei Events) |
| **v2** | Empfehlungsnetzwerk | Login per Magic Link, Rollen, Firmen-Verifizierung über E-Mail-Domain, Bewerber-Empfehlung mit Einwilligung, Firma ↔ Events, „Ich bin dort“ bei Events, Merkliste | Ja |
| **v3** | Matching ohne KI | Bewerberprofil mit denselben Reglern, regelbasierter Fit mit Begründung, „Für dich“-Seite, Recruiter-Pool (Opt-in), LinkedIn-CSV nur im Browser, Prompt für eigene KI (nur Selbstreflexion) | Ja |
| **v4** | Ausbau & Nachhaltigkeit | Automatische Job-Quellen (JobPosting JSON-LD), Firmendaten, Erfahrungsberichte ehemaliger Praktikanten, Finanzierung (Spenden / ggf. Recruiter-Zugang) | Ja |

Detailliert spezifiziert und zur Freigabe vorgesehen ist **nur v1**. v2–v4 sind als
Roadmap beschrieben und bekommen jeweils eine eigene Spec, bevor sie gebaut werden.

---

## 3. v1 – Kuratierte Stellenbörse

### 3.1 Scope

- Öffentliche Stellenübersicht `/jobs` mit Filtern
- Stellen-Detailseite `/jobs/:id`
- Einreichungsformular `/jobs/einreichen` (anonym wie bei Events, landet als `pending`)
- Vorbefüllung per Link: schema.org `JobPosting` (JSON-LD) wird ausgelesen,
  analog zu `extractFromUrl` für Events
- Firmen als eigene Entität (Name, Website, Branche, Größe)
- Vibe-Schieberegler (7 Dimensionen, Skala 1–5, **Pflicht**)
- Leitfragen (5 Fragen, je max. 280 Zeichen, optional)
- Empfehlungsnotiz „Warum ich das empfehle“ (Name + max. 400 Zeichen)
- Kontaktkarte (Name, Rolle, „entscheidet mit: ja/nein“, optional E-Mail mit Einwilligung)
- Admin: Stellen freigeben/ablehnen/bearbeiten/löschen (inkl. Mehrfachauswahl), Firmen pflegen
- Automatisches Ablaufen von Stellen

### 3.2 Non-Goals (v1)

- Keine Nutzer-Accounts, kein Login außer dem bestehenden Admin-Login (Basic Auth)
- Kein Bewerben über die Plattform: der Bewerben-Button führt zum externen Link oder zu einer `mailto:`-Adresse
- Kein CV-Upload, keine Bewerberprofile, kein Matching
- Keine LinkedIn-Integration
- Keine Verknüpfung Firma ↔ Events (verschoben nach v2)
- Kein Scraping von Jobbörsen, keine automatischen Job-Quellen (erst v4)
- Keine KI, keine Bezahlfunktionen
- Keine Firmendaten wie Umsatz und Mitarbeitendenzahl aus externen Quellen

### 3.3 Datenmodell

Neue Tabellen in `server/src/db/index.js` (`CREATE TABLE IF NOT EXISTS`, kein Eingriff in bestehende Tabellen):

```sql
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  website TEXT,
  sector TEXT,                      -- aus fester Liste (sectors.js)
  size_bucket TEXT,                 -- '1-50' | '51-250' | '251-1000' | '1000+' | NULL
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,       -- Freitext bei Einreichung; Admin ordnet company_id zu
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT NOT NULL,           -- siehe jobTypes.js
  degree_level TEXT,                -- 'bachelor' | 'master' | 'beides' | 'egal'
  min_semester INTEGER,             -- ab welchem Fachsemester (optional)
  location TEXT,
  work_mode TEXT,                   -- 'onsite' | 'hybrid' | 'remote' (wie formats.js)
  start_date TEXT,                  -- YYYY-MM-DD oder NULL = flexibel
  duration_months INTEGER,          -- NULL = unbefristet / unbekannt
  paid TEXT NOT NULL DEFAULT 'unknown',  -- 'yes' | 'no' | 'unknown'
  salary_min INTEGER,               -- EUR/Monat brutto, optional
  salary_max INTEGER,
  languages TEXT DEFAULT '',        -- kommagetrennt, z. B. "de,en"
  apply_url TEXT,
  apply_email TEXT,
  deadline TEXT,                    -- YYYY-MM-DD, optional
  vibe TEXT,                        -- JSON {dimensionKey: 1..5}, nur bekannte Keys
  answers TEXT,                     -- JSON {questionKey: "≤280 Zeichen"}
  referrer_name TEXT,
  referrer_note TEXT,               -- ≤400 Zeichen
  contact_name TEXT,
  contact_role TEXT,
  contact_decides INTEGER,          -- 1 | 0 | NULL
  contact_email TEXT,               -- nur wenn contact_consent = 1
  contact_consent INTEGER NOT NULL DEFAULT 0,
  source_kind TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'company' | 'member'
  status TEXT NOT NULL DEFAULT 'pending',      -- 'pending' | 'approved' | 'rejected' | 'expired'
  submitter_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Feste Listen als Module (Muster wie `categories.js` / `formats.js`):

- `server/src/db/jobTypes.js`: Praktikum, Pflichtpraktikum, Werkstudent, Abschlussarbeit,
  Traineeship, Berufseinstieg, Förderprogramm/Stipendium, Schülerpraktikum
- `server/src/db/sectors.js`: Consulting, Banking & Finance, Wirtschaftsprüfung, Tech,
  Industrie, Start-up/VC, Öffentlicher Sektor, Sonstiges
- `server/src/db/vibe.js`: Dimensionen und Leitfragen (siehe 3.4)

`vibe` und `answers` werden als JSON-Text gespeichert. Für v1 reicht das, weil nicht danach
gefiltert wird. In v3 wird es für das Matching in JS ausgewertet.

### 3.4 Vibe-Dimensionen und Leitfragen

Schieberegler, Skala 1–5. **Alle 7 Regler sind Pflicht.** Im Formular starten sie ungesetzt (kein vorausgewählter Mittelwert),
damit niemand aus Bequemlichkeit überall „3“ stehen lässt:

| Key | 1 ← | → 5 |
|---|---|---|
| `structure` | Klare Prozesse, Konzernstruktur | Startup, vieles im Aufbau |
| `guidance` | Enge Betreuung | Eigenverantwortung ab Tag 1 |
| `language` | Deutsch im Alltag | Englisch im Alltag |
| `location` | Fester Arbeitsplatz im Büro | Vollständig remote |
| `intensity` | Planbare Arbeitszeiten | Intensive Phasen, viel Einsatz |
| `teams` | Teams nach Funktion getrennt | Interdisziplinär gemischt |
| `social` | Feierabend ist Feierabend | Viele Team-Events und After-Work |

Leitfragen (jeweils optional, max. 280 Zeichen):

| Key | Frage |
|---|---|
| `week2` | Was macht man konkret in Woche 2? |
| `last_project` | Was war das letzte Projekt, das ein Praktikant/Junior präsentiert hat? |
| `not_for` | Für wen ist diese Stelle **nichts**? |
| `retention` | Wie viele der letzten Praktikanten wurden übernommen? |
| `process` | Wie läuft der Bewerbungsprozess ab und wie lange dauert er? |

Fakten-Chips werden aus den Feldern abgeleitet und nicht separat gespeichert:
„Bezahlt“, „Gehalt angegeben“, „Englisch möglich“, „Remote möglich“,
„Ansprechpartner entscheidet mit“, „Empfohlen von …“.

### 3.5 API

Neu: `server/src/routes/jobs.js`, eingehängt unter `/api/jobs` in `server/src/index.js`.

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/jobs/meta` | jobTypes, sectors, vibe-Dimensionen, Leitfragen, Sprachen |
| GET | `/api/jobs` | freigegebene Stellen, Filter: `job_type`, `degree_level`, `semester`, `work_mode`, `paid`, `language`, `sector`, `location`, `salary_given`, `search` |
| GET | `/api/jobs/:id` | Detail inkl. Firma |
| POST | `/api/jobs` | Einreichung → `pending` |
| POST | `/api/jobs/extract-link` | JobPosting-JSON-LD auslesen (gleicher SSRF-Schutz wie bei Events) |

Admin-Endpunkte in `server/src/routes/admin.js` (bestehende Basic Auth):

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/admin/jobs?status=` | Liste nach Status |
| PUT | `/api/admin/jobs/:id` | bearbeiten (inkl. `company_id`-Zuordnung, `source_kind`) |
| POST | `/api/admin/jobs/bulk` | `{ids, action: approve\|reject\|delete}` |
| GET/POST/PUT/DELETE | `/api/admin/companies[/:id]` | Firmen pflegen |

Neu: `server/src/db/jobsRepo.js`, `server/src/db/companiesRepo.js`.
`extractFromUrl.js` bekommt eine zweite Funktion `extractJobFromUrl`, die `assertPublicUrl`
und das JSON-LD-Parsing wiederverwendet und nach `@type: JobPosting` sucht.

### 3.6 Ablauf von Stellen

Im bestehenden Cron in `server/src/index.js` läuft einmal täglich ein Job, der
`approved`-Stellen auf `expired` setzt, wenn

- `deadline < heute` ist, oder
- keine `deadline` gesetzt ist und die Stelle seit `JOB_MAX_AGE_DAYS` Tagen (Default 90, per `.env`) nicht aktualisiert wurde.

### 3.7 Frontend

- `client/src/App.jsx`: Navigation um „Jobs & Praktika“ (`/jobs`) und „Stelle einreichen“ (`/jobs/einreichen`) erweitern
- `client/src/pages/JobList.jsx`: Filterleiste + Karten (Muster wie `EventList.jsx`)
- `client/src/pages/JobDetail.jsx`: Kopf (Titel, Firma, Fakten-Chips), Beschreibung,
  Vibe-Regler (nur Anzeige), Leitfragen-Antworten, Empfehlungsnotiz, Kontaktkarte,
  Bewerben-Button
- `client/src/pages/SubmitJob.jsx`: Link-Vorbefüllung + Formular in Abschnitten
  (Basis → Rahmen → Vibe → Leitfragen → Empfehlung/Kontakt), Zeichenzähler,
  Pflicht-Checkbox Einwilligung, Hinweis auf AGG-konforme Formulierung
- `client/src/components/JobCard.jsx`, `client/src/components/VibeSliders.jsx` (Eingabe + Anzeige)
- `client/src/pages/AdminDashboard.jsx`: neuer Reiter „Stellen“ (Liste, Mehrfachauswahl, Bearbeiten) und „Firmen“
- `client/src/api.js`: neue Funktionen für die Endpunkte

### 3.8 Datenschutz in v1

- Personenbezogene Felder: `submitter_name`, `referrer_name`, `contact_name`, `contact_role`, `contact_email`
- Das Formular verlangt die Bestätigung „Die genannten Personen sind mit der Veröffentlichung einverstanden“
- `contact_email` wird nur gespeichert und angezeigt, wenn zusätzlich `contact_consent = 1` gesetzt ist
- Löschung auf Zuruf: Der Admin kann eine Stelle löschen oder die Personenfelder leeren. Kontakt für Löschanfragen: **consulting@laurenz-polanski.de**
- Eine Seite `/datenschutz` (Link im Footer und am Einwilligungs-Häkchen) erklärt, welche Daten bei Stellen gespeichert werden, wofür und wie man sie löschen lässt

### 3.9 Akzeptanzkriterien (v1)

**Einreichen & Moderation**

- **AC-1** WHEN eine Stelle über `POST /api/jobs` mit `title`, `company_name`, `job_type` und `apply_url` oder `apply_email` eingereicht wird, THE SYSTEM SHALL sie mit `status = 'pending'` speichern und `201` zurückgeben.
- **AC-2** WHEN `title`, `company_name` oder `job_type` fehlt, `job_type` nicht in `jobTypes.js` steht oder weder `apply_url` noch `apply_email` gesetzt ist, THE SYSTEM SHALL mit `400` und einer deutschen Fehlermeldung antworten.
- **AC-3** WHEN eine Stelle eingereicht oder vom Admin bearbeitet wird und `vibe` nicht für **alle** in `vibe.js` definierten Dimensionen eine ganze Zahl von 1–5 enthält, THE SYSTEM SHALL mit `400` antworten und die fehlenden Dimensionen nennen. Unbekannte Keys werden verworfen. Im Formular ist „Einreichen“ deaktiviert, solange ein Regler ungesetzt ist.
- **AC-4** WHEN eine Leitfragen-Antwort länger als 280 Zeichen oder `referrer_note` länger als 400 Zeichen ist, THE SYSTEM SHALL mit `400` antworten.
- **AC-5** WHEN `contact_email` gesetzt ist, `contact_consent` aber nicht `true`, THE SYSTEM SHALL `contact_email` nicht speichern.
- **AC-6** WHEN die Einwilligungs-Checkbox im Formular nicht gesetzt ist, THE SYSTEM SHALL das Absenden im Client verhindern und `POST /api/jobs` ohne `consent: true` mit `400` ablehnen.
- **AC-7** WHEN `salary_min > salary_max` ist, THE SYSTEM SHALL mit `400` antworten.
- **AC-8** WHEN der Admin über `POST /api/admin/jobs/bulk` approve/reject/delete für eine ID-Liste ausführt, THE SYSTEM SHALL alle IDs in einer Transaktion verarbeiten und die Anzahl betroffener Zeilen zurückgeben.
- **AC-9** WHEN eine Anfrage an `/api/admin/jobs*` oder `/api/admin/companies*` ohne gültige Basic Auth kommt, THE SYSTEM SHALL mit `401` antworten.

**Anzeigen & Filtern**

- **AC-10** WHEN `GET /api/jobs` aufgerufen wird, THE SYSTEM SHALL nur Stellen mit `status = 'approved'` liefern, sortiert nach `created_at` absteigend.
- **AC-11** WHEN die Filter `job_type`, `degree_level`, `work_mode`, `paid`, `language` oder `sector` gesetzt sind, THE SYSTEM SHALL nur Stellen liefern, die allen gesetzten Filtern entsprechen. Für `degree_level` gilt: `beides` und `egal` passen zu `bachelor` und `master`.
- **AC-12** WHEN `semester=N` gesetzt ist, THE SYSTEM SHALL Stellen mit `min_semester IS NULL` oder `min_semester <= N` liefern.
- **AC-13** WHEN `salary_given=1` gesetzt ist, THE SYSTEM SHALL nur Stellen mit `salary_min` oder `salary_max` liefern.
- **AC-14** WHEN `GET /api/jobs/:id` für eine nicht freigegebene oder nicht existierende Stelle aufgerufen wird, THE SYSTEM SHALL `404` liefern.
- **AC-15** WHEN die Detailseite angezeigt wird, THE SYSTEM SHALL `contact_email` nur ausgeben, wenn `contact_consent = 1` ist.
- **AC-21** WHEN eine beliebige Seite angezeigt wird, THE SYSTEM SHALL im Footer einen Link auf `/datenschutz` zeigen. Diese Seite nennt consulting@laurenz-polanski.de als Kontakt für Auskunft und Löschung.
- **AC-22** WHEN eine beliebige Seite angezeigt wird, THE SYSTEM SHALL im Header und im Browser-Tab den Namen „Student Hub“ zeigen. „Laurenz Event Verteiler“ kommt in der Oberfläche nicht mehr vor.

**Link-Vorbefüllung**

- **AC-16** WHEN `POST /api/jobs/extract-link` eine Seite mit JSON-LD `@type: JobPosting` erhält, THE SYSTEM SHALL `title`, `description` (als reiner Text), `company_name` (`hiringOrganization.name`), `location` (`jobLocation`), `deadline` (`validThrough`) und, falls vorhanden, Gehalt (`baseSalary`) zurückgeben.
- **AC-17** WHEN die URL auf eine private oder lokale Adresse zeigt, THE SYSTEM SHALL die Anfrage wie bei Events ablehnen.

**Ablauf**

- **AC-18** WHEN der tägliche Ablauf-Job läuft, THE SYSTEM SHALL freigegebene Stellen mit `deadline < heute` auf `expired` setzen.
- **AC-19** WHEN eine freigegebene Stelle ohne `deadline` seit mehr als `JOB_MAX_AGE_DAYS` Tagen nicht aktualisiert wurde, THE SYSTEM SHALL sie auf `expired` setzen.

**Nicht-Regression**

- **AC-20** WHEN v1 ausgerollt wird, THE SYSTEM SHALL alle bestehenden Event-Endpunkte und -Tests unverändert bestehen lassen. Die bestehende `events.db` wird ohne Datenverlust um die neuen Tabellen erweitert.

### 3.10 Testplan (v1)

Tests mit `node --test` im bestehenden Stil (`EVENTS_DB_PATH=:memory:`), Dateien unter `server/test/`:

| Datei | deckt ab |
|---|---|
| `jobs-repo.test.js` | AC-1, AC-3, AC-5, AC-8, AC-10, AC-11, AC-12, AC-13 |
| `jobs-validation.test.js` | AC-2, AC-3, AC-4, AC-6, AC-7 (Validierungsfunktion als reine Funktion testbar) |
| `jobs-routes.test.js` | AC-9, AC-14, AC-15 (Express-App im Test starten, `fetch` gegen Port 0) |
| `extract-job.test.js` | AC-16, AC-17 (HTML-Fixture statt echtem Netzwerk, SSRF über bestehenden Guard) |
| `jobs-expiry.test.js` | AC-18, AC-19 |
| bestehende Tests + `migration.test.js` erweitert | AC-20 |

Frontend: `npm run build` und `npm run lint` müssen grün sein (wie in CI). Dazu ein manueller
Durchlauf im Browser: Einreichen (inkl. gesperrtem Button bei fehlendem Regler, AC-3) → Admin freigeben → Liste/Filter → Detail → Footer-Link Datenschutz (AC-21).

### 3.11 Tasks (v1)

- [x] T1 `jobTypes.js`, `sectors.js`, `vibe.js` anlegen (AC-2, AC-3)
- [x] T2 Tabellen `companies`, `jobs` in `db/index.js`, Migrationstest erweitern (AC-20)
- [x] T3 `jobsRepo.js` mit create/list/get/update/bulk/expire (AC-1, AC-8, AC-10–13, AC-18, AC-19)
- [x] T4 Validierungsmodul `jobs/validateJob.js` (AC-2–AC-7)
- [x] T5 `companiesRepo.js` (CRUD für Firmen, AC-9)
- [x] T6 `routes/jobs.js` + Einbindung in `index.js` (AC-1, AC-2, AC-10–15)
- [x] T7 Admin-Endpunkte für Jobs/Firmen in `routes/admin.js` (AC-8, AC-9)
- [x] T8 `extractJobFromUrl` (AC-16, AC-17)
- [x] T9 Ablauf-Job im Cron (AC-18, AC-19)
- [x] T10 Frontend: `JobList`, `JobCard`, Filter (AC-10–13)
- [x] T11 Frontend: `JobDetail`, `VibeSliders` Anzeige, Kontaktkarte (AC-15)
- [x] T12 Frontend: `SubmitJob` mit Link-Vorbefüllung, Zeichenzählern, Einwilligung (AC-6, AC-16)
- [x] T13 Frontend: Admin-Reiter Stellen & Firmen (AC-8)
- [x] T14 Seite `/datenschutz` + Footer-Link (AC-21)
- [x] T15 README um Jobs-Bereich ergänzen
- [x] T16 Umbenennung in „Student Hub“: Header, Footer, `<title>` in `client/index.html`, README-Überschrift (AC-22)

### 3.12 Annahmen (v1)

- A1 Die Stellen kommen anfangs von Laurenz und einem kleinen Kreis. Moderation durch einen Admin reicht.
- A2 Gehalt wird als Monatsbrutto in EUR erfasst (passt für Praktika). Bei Jahresgehältern rechnet man um oder lässt das Feld leer.
- A3 Die Zuordnung Stelle → Firma macht der Admin bei der Freigabe. Bei der Einreichung ist der Firmenname Freitext.
- A4 Die Website wird in v1 in **„Student Hub“** umbenannt (nur Anzeigename). Die Domain bleibt student.laurenz-polanski.de.

---

## 4. v2 – Empfehlungsnetzwerk (Roadmap)

**Ziel:** Members und Firmen bekommen eine Identität, damit Empfehlungen Gewicht haben.

- **Login per Magic Link** (E-Mail mit Einmal-Link, keine Passwörter). Braucht einen kostenlosen
  SMTP-Versand (z. B. Brevo/Mailjet Free-Tier, Anbieter offen)
- **Rollen:** `member`, `company`, `admin`. Den Admin-Login per Basic Auth ablösen oder parallel behalten
- **Firmen-Verifizierung:** Wer eine E-Mail-Adresse mit der Firmendomain bestätigt, wird
  „verifizierte Person von Firma X“. Deren Stellen bekommen `source_kind = 'company'` und ein Badge
- **Stellen bearbeiten:** Einreichende können ihre eigenen Stellen nach dem Login bearbeiten und verlängern
- **Bewerber-Empfehlung mit Einwilligung:** Ein Member erzeugt einen Einladungslink für eine Stelle.
  Die eingeladene Person legt selbst ein Kurzprofil an und stimmt zu. Erst dann sieht der
  Ansprechpartner „Empfohlen von Member Y“. Ohne Zustimmung werden keine Daten der Person gespeichert
- **Firma ↔ Events (aus v1 verschoben):** Firmen bekommen Aliasse (z. B. „PwC, PricewaterhouseCoopers“).
  Auf der Stellenseite erscheint der Block „Diese Firma auf kommenden Events (automatisch erkannt)“:
  bis zu 5 freigegebene, zukünftige Events, deren Titel oder Beschreibung den Namen oder einen Alias
  **als ganzes Wort** enthält (damit „EY“ nicht in „Keynote“ gefunden wird). Optional kann der Admin
  Events einer Firma auch fest zuordnen
- **„Ich bin dort“ bei Events:** Members und Ansprechpartner markieren ihre Teilnahme. Auf der
  Stellenseite steht dann „Lisa (Firma X) ist am 14.11. auf Event Y“, nur für eingeloggte Nutzer sichtbar
- **Merkliste** für Stellen und Events
- **Self-Service-Löschung:** Konto und alle Daten selbst löschen (Art. 17 DSGVO)
- **Datenschutzerklärung und Impressum** aktualisieren (Pflicht, sobald Accounts existieren)

Wichtigste offene Punkte für die v2-Spec: Mail-Anbieter, Session-Handling, Missbrauchsschutz
(Rate-Limits), wer Members freischaltet (offen oder auf Einladung).

## 5. v3 – Matching ohne KI (Roadmap)

**Ziel:** Bewerber finden passende Stellen. Recruiter finden vorselektierte Leute, ohne Blackbox.

- **Bewerberprofil:** Abschluss, Semester/Abschlussjahr, Verfügbarkeit (ab/bis), gewünschte
  Stellenarten, Standorte (1. und 2. Wahl), Sprachen, Skills (feste Tag-Liste + Freitext),
  Anzahl und Bereiche bisheriger Praktika, dazu dieselben 7 Vibe-Regler als Wunschwerte
- **Regelbasierter Fit:**
  - harte Kriterien (Abschluss, Semester, Verfügbarkeit, Sprache) als „passt / passt nicht“
  - weiche Kriterien: Abstand der Vibe-Regler (`5 − |Wunsch − Stelle|` pro Dimension, Mittelwert)
    und Überschneidung der Skills
  - Ausgabe als **Begründung** („passt in 4 von 5 Kriterien; Abweichung: Englisch im Alltag“),
    nicht nur als Prozentzahl
- **„Für dich“-Seite:** Stellen nach Fit sortiert, mit Begründung
- **Recruiter-Pool (Opt-in):** Bewerber geben ihr Profil aktiv frei. Recruiter sehen eine nach Fit
  sortierte Liste, die Auswahl trifft immer ein Mensch (Art. 22 DSGVO). Kein automatisches Aussortieren
- **CV:** optionaler PDF-Upload nur zum Weiterleiten an Ansprechpartner, ohne Auswertung durch das System
- **LinkedIn-Kontakte:** Der Nutzer lädt `Connections.csv` aus seinem LinkedIn-Datenexport hoch.
  Die Datei wird **ausschließlich im Browser** ausgewertet, an den Server geht höchstens
  `{firma: anzahl}`, keine Namen. Anzeige: „3 deiner Kontakte arbeiten bei Firma X“
- **Prompt für die eigene KI:** ein kopierbarer Prompt (CV + Stellenbeschreibung → Stärken/Lücken)
  für die eigene Reflexion. Das Ergebnis wird **nicht** hochgeladen und ist **kein** Filterkriterium

Vor v3 prüfen: Fällt das regelbasierte Matching wirklich nicht unter „KI-System“ nach dem AI Act?
Kurze rechtliche Einschätzung einholen, z. B. über die Hochschul-Rechtsberatung.

## 6. v4 – Ausbau & Nachhaltigkeit (Roadmap)

- **Automatische Job-Quellen:** analog zu den Event-Quellen, aber über JobPosting-JSON-LD auf
  Karriereseiten von Firmen (keine Jobbörsen scrapen). Gescrapte Stellen landen als `pending`
- **Firmendaten:** Größe, Branche und Standorte/Länder manuell oder aus offenen Quellen pflegen,
  dazu Filter wie „Firma ist in Land X tätig“
- **Kuratierte Tags statt Rankings:** z. B. „Big 4“, „MBB“, „Next 10“ als redaktionelle Tags
- **Erfahrungsberichte** ehemaliger Praktikanten (eingeloggt, moderiert, gleiche Leitfragen)
- **Finanzierung:** zunächst ein Spenden-Link. Falls nötig, später ein kostenpflichtiger
  Recruiter-Zugang zum Pool. Für Studierende bleibt alles gratis
- **Gehaltstransparenz:** Badge und Filter ausbauen, sobald die deutsche Umsetzung der
  EU-Entgelttransparenzrichtlinie steht

## 7. Offene Fragen

Keine offenen Fragen.

Geklärt: Name „Student Hub“ (Domain bleibt student.laurenz-polanski.de) · Bewerben nur extern (Link/`mailto:`) · Ablauf nach 90 Tagen ohne Deadline · Vibe-Regler Pflicht, Leitfragen optional · Datenschutz-Kontakt consulting@laurenz-polanski.de

## 8. Changelog

| Version | Datum | Änderung |
|---|---|---|
| 1 | 2026-10-04 | Erster Entwurf: v1 detailliert, v2–v4 als Roadmap |
| 4 | 2026-10-04 | Name „Student Hub“ festgelegt (AC-22, T16), keine offenen Fragen mehr |
| 3 | 2026-10-04 | Vibe-Regler Pflicht (AC-3 verschärft), Leitfragen optional; Datenschutzseite mit consulting@laurenz-polanski.de (AC-21, T14); offene Fragen 1–3 und 5 geklärt |
| 2 | 2026-10-04 | Verknüpfung Firma ↔ Events aus v1 entfernt und nach v2 verschoben (vorher AC-16/17, Abschnitt 3.6). ACs neu nummeriert: AC-16 bis AC-20 |
