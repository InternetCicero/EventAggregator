# Spec: Materialien (Prompts & Vorlagen zum Download)

- **Status:** Approved
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-02
- **Approved:** 2026-11-02

## 1. Ziel

Ein neuer Reiter **Materialien** (`/materialien`) bietet Studierenden kostenlose Hilfsmittel für die Bewerbung: zum Beispiel Prompts zur CV-Optimierung, Vorlagen und Checklisten. Prompts lassen sich mit einem Klick kopieren, alle Materialien lassen sich als Datei herunterladen.

Die Inhalte erstellt und pflegt Laurenz selbst. Es gibt **kein neues Backend**: Die Materialien sind statische Dateien im Repo, die mit dem bestehenden Auto-Deploy ausgeliefert werden.

## 2. Scope

- Übersichtsseite `/materialien` mit Karten, gruppiert bzw. filterbar nach Kategorie
- Pro Material: Titel, Kurzbeschreibung, Kategorie, Typ (Prompt oder Datei)
- Typ **Prompt**: Text ist auf der Seite aufklappbar, Button "Kopieren", zusätzlich Download als `.md`
- Typ **Datei**: Download-Button (z. B. `.pdf`, `.docx`)
- Nav-Eintrag "Materialien" im Header
- Pflege über eine Liste (`materials.json`) und Dateien im Repo, ohne Admin-Oberfläche
- Test, der die Liste gegen die Dateien prüft (verhindert tote Links)
- README-Abschnitt "Materialien hinzufügen"

## 3. Non-Goals

- Kein Upload über die Admin-Oberfläche, keine Datenbanktabelle (das wäre Variante B und bekäme eine eigene Spec)
- Keine Accounts, keine Download-Zähler, kein Tracking, keine Cookies
- Keine Inhalte Dritter, keine Bewertungen oder Kommentare
- Keine KI-Funktion auf der Seite: Die Prompts sind Text zum Kopieren, die Seite ruft kein Modell auf
- Keine Suche (bei der erwarteten Menge unter 30 Materialien reicht der Kategorie-Filter)

## 4. Annahmen

- Menge: unter 30 Materialien, Dateien jeweils unter 2 MB
- Der Inhalt ist von Laurenz erstellt, die Nutzung ist kostenlos und frei
- Kategorien zum Start: CV & Anschreiben, Interview & Case, Networking, Sonstiges (in `materials.json` erweiterbar)
- Sprache der Seite: Deutsch, Sie-Anrede wie auf der übrigen Seite
- Dateien liegen unter `client/public/materialien/` und werden von Vite unverändert nach `dist/materialien/` kopiert; nginx liefert sie schon heute aus

## 5. Akzeptanzkriterien

- **AC-1:** WHEN ein Besucher `/materialien` öffnet THE SYSTEM SHALL alle Materialien aus `materials.json` als Karten mit Titel, Beschreibung, Kategorie und Typ anzeigen.
- **AC-2:** WHEN ein Besucher eine Kategorie wählt THE SYSTEM SHALL nur Materialien dieser Kategorie anzeigen, und WHEN er "Alle" wählt THE SYSTEM SHALL wieder alle anzeigen.
- **AC-3:** WHEN ein Besucher bei einem Prompt den Text aufklappt THE SYSTEM SHALL den Inhalt der zugehörigen `.md`-Datei als Text anzeigen.
- **AC-4:** WHEN ein Besucher bei einem Prompt auf "Kopieren" klickt THE SYSTEM SHALL den Prompt-Text in die Zwischenablage legen und das mit "Kopiert" bestätigen; IF die Zwischenablage nicht verfügbar ist THE SYSTEM SHALL den Text markieren und einen Hinweis zum manuellen Kopieren zeigen.
- **AC-5:** WHEN ein Besucher auf "Herunterladen" klickt THE SYSTEM SHALL die Datei mit sprechendem Dateinamen herunterladen (Attribut `download`).
- **AC-6:** WHEN `materials.json` keinen Eintrag enthält THE SYSTEM SHALL "Noch keine Materialien vorhanden" anzeigen statt einer leeren Seite.
- **AC-7:** WHEN die Seite mobil (375 px Breite) geöffnet wird THE SYSTEM SHALL ohne horizontales Scrollen darstellen.
- **AC-8:** THE SYSTEM SHALL im Header einen Eintrag "Materialien" zeigen, der `/materialien` hervorhebt, solange die Seite offen ist.
- **AC-9:** THE SYSTEM SHALL beim Aufruf von `/materialien` keine Cookies setzen und keine Anfragen an Dritte senden.
- **AC-10:** WHEN die Tests laufen THE SYSTEM SHALL fehlschlagen, wenn ein Eintrag in `materials.json` auf eine nicht vorhandene Datei zeigt, eine doppelte ID hat, eine unbekannte Kategorie nutzt oder ein Pflichtfeld (id, title, description, category, type, file) fehlt.
- **AC-11:** WHEN die Seite unter der Student-Subdomain ausgeliefert wird THE SYSTEM SHALL `/materialien` auch bei direktem Aufruf (ohne Klick von der Startseite) anzeigen und Dateien unter `/materialien/<datei>` direkt erreichbar machen.

## 6. Design

**Neue Dateien**

- `client/src/pages/Materialien.jsx`: Seite mit Kategorie-Filter, Karten, Aufklappen, Kopieren
- `client/src/data/materials.json`: Liste der Materialien, Felder `id`, `title`, `description`, `category`, `type` (`prompt` | `datei`), `file` (Dateiname unter `materialien/`)
- `client/public/materialien/`: Inhalte, zum Start leer (Inhalte liefert Laurenz)
- `server/test/materials.test.js`: validiert `materials.json` gegen `client/public/materialien/` (AC-10)

**Geänderte Dateien**

- `client/src/App.jsx`: Route `/materialien`, `NavLink` "Materialien" im Header
- `client/src/App.css`: Styles für Karten und Filter, bestehende Design-Tokens (Navy/Off-White/Kupfer) wiederverwenden
- `README.md`: Abschnitt "Materialien hinzufügen" (Datei ablegen, Eintrag ergänzen, committen, Auto-Deploy)

**Verhalten im Detail**

- Prompt-Text wird erst beim Aufklappen per `fetch('/materialien/<file>')` geladen (kein Bundle-Aufblähen). Da nginx bei unbekannten Pfaden auf `index.html` zurückfällt, prüft die Seite den Content-Type und zeigt bei HTML-Antwort "Material konnte nicht geladen werden". Der Test aus AC-10 soll diesen Fall ohnehin verhindern.
- Kopieren über `navigator.clipboard.writeText`, Fallback: Textbereich markieren.
- Es ist kein Backend-Code und keine DB-Migration nötig, `deploy/` bleibt unverändert.

**Rechtliches**

- Kurzer Hinweis auf der Seite: Die Materialien sind Hilfestellungen ohne Erfolgsgarantie; bei Eingabe persönlicher Daten in KI-Tools sind Nutzer selbst verantwortlich (Prompts enthalten Platzhalter statt echter Daten). Der Satz wird mit freigegeben, siehe offene Fragen.

## 7. Aufgaben

- [x] T1: `materials.json` und Verzeichnis `client/public/materialien/` mit leerer Liste anlegen (AC-1, AC-3, AC-6)
- [x] T2: `server/test/materials.test.js` schreiben (AC-10)
- [x] T3: `Materialien.jsx` mit Liste, Kategorie-Filter, Leerzustand (AC-1, AC-2, AC-6)
- [x] T4: Aufklappen, Kopieren mit Fallback, Download-Button (AC-3, AC-4, AC-5)
- [x] T5: Route und Nav-Eintrag in `App.jsx`, Styles in `App.css`, mobile Ansicht prüfen (AC-7, AC-8)
- [x] T6: README ergänzen, lokal `npm test`, `npm run build`, `npm run lint` (AC-9)
- [ ] T7: Nach dem Deploy live prüfen: direkter Aufruf von `/materialien` und einer Datei (AC-11)

## 8. Testplan

| AC | Prüfung |
|---|---|
| AC-1, AC-2, AC-6 | manuell im Browser (lokal), Leerzustand mit leerer Liste |
| AC-3, AC-4, AC-5 | manuell im Browser: Aufklappen, Kopieren (Einfügen prüfen), Download |
| AC-7 | Browser-Emulation 375 px |
| AC-8 | manuell: Nav-Eintrag aktiv |
| AC-9 | Netzwerk-Tab: keine Fremdanfragen, keine Cookies |
| AC-10 | automatisiert, `server/test/materials.test.js` (läuft in CI) |
| AC-11 | nach Deploy per `curl -I` auf `/materialien` und `/materialien/<datei>` |

Das Frontend hat bisher keine Testumgebung, deshalb wird die Oberfläche manuell geprüft und nur die Datenintegrität automatisiert getestet. Ein Frontend-Testframework ist bewusst nicht Teil dieses Features.

## 9. Entscheidungen (aus dem Review)

1. Keine Platzhalter-Prompts; es wird nur das Gerüst gebaut, Laurenz liefert die Inhalte. Zum Start zeigt die Seite den Leerzustand (AC-6).
2. Haftungshinweis aus Abschnitt 6 ist freigegeben.
3. Nav-Eintrag zwischen "Stelle einreichen" und "Admin".

## 10. Änderungsprotokoll

- v1 (2026-11-02): Erster Entwurf; am selben Tag freigegeben, Entscheidungen in Abschnitt 9 eingetragen
