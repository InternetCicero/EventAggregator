# Spec: UI-Tests im Browser und professionellere CI/CD-Pipeline

- **Status:** In Review
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-05
- **Approved:** 2026-11-05

## 1. Ziel

Layout-Fehler wie der Überlauf der Admin-Quellentabelle durch eine lange URL (Fix in #16) sollen **vor dem Merge** auffallen, nicht erst live. Dafür kommt ein Browser-Testjob ins CI. Zusätzlich wird die Pipeline aufgeräumt: Deploy hängt am CI, prüft nach dem Ausrollen die Live-Seite und die Abhängigkeiten werden automatisch überwacht.

## 2. Scope

**Teil A: UI-Tests (Playwright)**
- Neues Verzeichnis `e2e/` mit eigenem `package.json` (Playwright Test, Chromium)
- Testserver: Backend mit temporärer SQLite-Datei und festen Testdaten, Frontend über den Vite-Dev-Server (hat den `/api`-Proxy bereits)
- Testdaten mit absichtlich extremen Texten: Titel mit 200 Zeichen ohne Leerzeichen, URL mit 300 Zeichen, sehr langer Veranstalter- und Ortsname
- Tests auf zwei Viewports: Mobil (375 × 812) und Desktop (1280 × 800)
- Eigener CI-Job `UI-Tests`; bei Fehlschlag werden Screenshots und Trace als Artefakt hochgeladen

**Teil B: Pipeline**
- `deploy.yml` startet erst, wenn das CI für denselben Commit grün ist (`workflow_run`), statt alles ein zweites Mal zu testen
- Healthcheck nach dem Deploy gegen die öffentliche Adresse (`/api/health` und Startseite liefern 200)
- Dependabot für npm (server, client, e2e) und GitHub Actions, monatlich, gebündelt
- `npm audit --audit-level=high` im CI als Warnung (blockiert nicht)
- Lint für den Server (oxlint wie im Client), im CI
- Node-Version zentral in einer Datei (`.nvmrc`), von allen Jobs genutzt

## 3. Non-Goals

- Keine Screenshot-Vergleiche (Pixel-Diffs), zu wartungsintensiv
- Keine Tests gegen die Live-Seite im CI (nur der Healthcheck nach dem Deploy)
- Kein automatisches Rollback; bei fehlgeschlagenem Healthcheck wird der Lauf rot und Sie werden per GitHub benachrichtigt
- Kein Coverage-Bericht, keine Testumgebung (Staging) auf der VM
- Kein Wechsel des Deploy-Weges (bleibt SSH + `update.sh`)
- Der Branch-Schutz für `main` ist **nicht** Teil dieser Spec (GitHub-Einstellung, wird nach Ihrer Freigabe separat gesetzt)

## 4. Annahmen

- Der Server liefert das Frontend nicht selbst aus (nginx tut das). Darum läuft das Frontend im Test über Vite mit Proxy auf das Testbackend.
- Admin-Zugang im Test über die Standard-Zugangsdaten aus `server/.env.example`, nur für die flüchtige Testdatenbank.
- CI-Laufzeit steigt um ca. 1 bis 2 Minuten (Chromium-Download wird gecacht).
- `workflow_run` führt den Deploy im Kontext von `main` aus; PR-Läufe lösen keinen Deploy aus.

## 5. Akzeptanzkriterien

**UI-Tests**
- AC-1: Auf `/`, `/jobs`, `/materialien`, `/datenschutz`, `/impressum` gilt in beiden Viewports `document.documentElement.scrollWidth <= window.innerWidth` (kein horizontaler Seitenüberlauf).
- AC-2: Mit den Extremtexten (Testdaten) laufen Event-, Job- und Material-Karten sowie die Detailseiten nicht über ihren Container hinaus (`scrollWidth <= clientWidth` je Karte, Titel und Link).
- AC-3: Im Admin-Bereich bleibt die Quellentabelle mit 300-Zeichen-URL innerhalb ihres Containers; das war der Fehler aus #16 und der Test schlägt ohne den damaligen Fix nachweislich fehl.
- AC-4: Alle Admin-Reiter (Events, Quellen, Jobs, Statistik) lassen sich öffnen, ohne dass Konsolenfehler auftreten oder die Seite überläuft.
- AC-5: Jede getestete Seite erzeugt keine Konsolenfehler (`console.error`) und keine fehlgeschlagenen Netzwerkanfragen außer erwarteten.
- AC-6: Die Navigation (Veranstaltungen, Jobs, Materialien) ist mobil erreichbar und überlappt keine Inhalte.
- AC-7: Ein absichtlich eingebauter Layoutfehler (z. B. `overflow-wrap` entfernt) lässt den Job rot werden (einmalig lokal nachgewiesen, in der PR-Beschreibung dokumentiert).

**Pipeline**
- AC-8: Ein Push auf `main` deployt erst, wenn der CI-Lauf desselben Commits erfolgreich war; schlägt das CI fehl, wird nicht deployt.
- AC-9: Nach dem Deploy prüft ein Schritt `https://student.laurenz-polanski.de/api/health` und `/` mit bis zu 5 Wiederholungen; ohne 200 wird der Lauf rot.
- AC-10: Dependabot-PRs werden monatlich erzeugt (npm in `server`, `client`, `e2e`; GitHub Actions), jeweils gebündelt nach Verzeichnis.
- AC-11: `npm audit` läuft im CI und meldet High/Critical als Warnung, ohne den Lauf scheitern zu lassen.
- AC-12: `npm run lint` im Server läuft im CI und ist beim Merge dieser Spec grün (vorhandene Funde werden dabei bereinigt oder gezielt konfiguriert).
- AC-13: Alle Jobs nutzen die Node-Version aus `.nvmrc`.
- AC-14: Bestehende Tests (Server 195, Client 11) laufen unverändert weiter und bleiben grün.

## 6. Design

**Struktur**
- `e2e/package.json`, `e2e/playwright.config.js` (zwei Projekte `mobile` und `desktop`, `webServer` startet Backend und Vite)
- `e2e/global-setup.js` bzw. `server/scripts/seed-e2e.js`: legt Testdaten in einer temporären DB an (`EVENTS_DB_PATH` auf Datei im Temp-Verzeichnis)
- `e2e/tests/layout.spec.js` (AC-1, AC-2, AC-6), `e2e/tests/admin.spec.js` (AC-3, AC-4), gemeinsame Hilfe `e2e/tests/helpers.js` mit `expectNoOverflow(locator)` und Konsolen-Wächter (AC-5)
- Backend im Test auf eigenem Port (z. B. 4100), Vite mit `API_TARGET` darauf

**CI (`.github/workflows/ci.yml`)**
- Neuer Job `ui-tests`: Checkout, Node aus `.nvmrc`, `npm ci` in `server`, `client`, `e2e`, `npx playwright install --with-deps chromium` (Cache für `~/.cache/ms-playwright`), `npx playwright test`, bei Fehler `actions/upload-artifact` für `e2e/test-results`
- Neuer Schritt `npm run lint` im Server-Job, `npm audit` (mit `continue-on-error`) in beiden Install-Jobs

**Deploy (`.github/workflows/deploy.yml`)**
- Trigger `workflow_run` auf Workflow „CI", nur `branches: [main]`, nur `conclusion == success`; `workflow_dispatch` bleibt für manuelles Ausrollen (dann ohne CI-Bedingung, mit eigenem Hinweis im Log)
- Doppelte Test-Jobs entfallen; der Deploy checkt exakt `github.event.workflow_run.head_sha` aus
- Neuer Schritt „Live prüfen" nach `update.sh`, mit `curl --retry 5 --retry-delay 5 --fail`

**Sonstiges**
- `.github/dependabot.yml`, `.nvmrc` (Wert 22), `server/package.json` Skript `lint` mit `oxlint` als Dev-Dependency

## 7. Aufgaben

- [x] T1: `.nvmrc`, Server-Lint (`oxlint`), Funde bereinigen, Lint-Schritt im CI (AC-12, AC-13)
- [x] T2: `e2e/`-Grundgerüst, Testserver mit Seed-Daten inklusive Extremtexten, Playwright-Konfiguration mit zwei Viewports (Voraussetzung für AC-1 bis AC-6)
- [x] T3: Layout-Tests für öffentliche Seiten und Detailseiten, Konsolen-Wächter (AC-1, AC-2, AC-5, AC-6)
- [x] T4: Admin-Tests inklusive Quellentabelle mit langer URL; Gegenprobe ohne den Fix aus #16 (AC-3, AC-4, AC-7)
- [x] T5: CI-Job `ui-tests` mit Browser-Cache und Artefakt-Upload; `npm audit` als Warnung (AC-11)
- [ ] T6: `deploy.yml` auf `workflow_run` umbauen, Healthcheck nach dem Deploy (AC-8, AC-9)
- [ ] T7: `dependabot.yml` (AC-10), README-Abschnitt „Tests und Pipeline"
- [ ] T8: Nach dem Merge: erster Deploy über den neuen Weg beobachten, Dependabot-Lauf abwarten (AC-8 bis AC-10, live)

Reihenfolge: T1 bis T5 in einem PR (Teil A), T6 bis T7 in einem zweiten PR (Teil B), damit ein Pipeline-Fehler nicht die Tests blockiert.

## 8. Testplan

| Aufgabe | Prüfung |
|---|---|
| T1 | `npm run lint` im Server lokal und im CI grün |
| T2/T3 | `npx playwright test` lokal, beide Projekte grün |
| T4 | lokal: Fix aus #16 temporär entfernen, Test muss rot werden (AC-7), danach zurück |
| T5 | PR-Lauf im CI grün; ein absichtlich roter Testlauf lädt Screenshots hoch (einmalig prüfen) |
| T6 | Testlauf über `workflow_dispatch` und einen echten Merge; roter CI-Lauf verhindert Deploy (mit Testbranch prüfen) |
| T7 | Dependabot-Konfiguration von GitHub validiert (Reiter „Insights → Dependency graph") |
| T8 | live nach dem Deploy |

## 9. Risiken

- **Flaky UI-Tests:** Wartezeiten nur über Playwright-Auto-Waiting und `expect`, keine festen Pausen.
- **CI-Dauer:** Browser-Cache und ein einziger Browser (Chromium) halten sie klein.
- **`workflow_run`-Eigenheit:** Der Deploy-Lauf erscheint nicht am PR, sondern separat unter „Actions". Das wird in der README erklärt.
- **Dependabot-Flut:** Monatlich, gebündelt, Limit offener PRs auf 3.

## 10. Offene Fragen für das Review

1. **Dependabot-Takt:** monatlich, gebündelt (entschieden bei der Freigabe).
2. **Server-Lint:** Falls `oxlint` im Server viele Altlasten findet, sollen diese in diesem PR bereinigt werden (Vorschlag) oder zunächst nur als Warnung laufen?
3. **Manuelles Deploy** (`workflow_dispatch`) soll ohne CI-Bedingung möglich bleiben (Vorschlag), z. B. für ein erneutes Ausrollen. Einverstanden?

## 11. Änderungsprotokoll

- v1 (2026-11-05): Erstentwurf.
- v1.1 (2026-11-05): Freigegeben, alle drei Vorschläge übernommen, Dependabot monatlich statt wöchentlich. T1 bis T5 umgesetzt. Die neuen Tests fanden echte Überläufe (Event- und Stellenkarten, Stellen-Detailseite, Admin-Leisten am Handy), die im selben PR per CSS behoben wurden.
