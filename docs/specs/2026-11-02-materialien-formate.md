# Spec: Materialien v2 – Formate (Text, Bild, Link) und Format-Filter

- **Status:** Approved
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-02
- **Approved:** 2026-11-02
- **Baut auf:** [2026-11-02-materialien.md](2026-11-02-materialien.md) (v1, live)

## 1. Ziel

Die Materialien-Seite kann bisher nur `prompt` (kopierbarer Text) und `datei` (Download). Neu kommen **Texte zum Lesen**, **Bilder** und **externe Links** dazu. Die Seite wird nach zwei Achsen gegliedert, die sich kombinieren lassen:

- **Thema** (`category`): wofür brauche ich es? (bleibt wie in v1)
- **Format** (`type`): was ist es? (neu als Filter)

Wie in v1 gibt es **kein Backend**: Inhalte sind Dateien im Repo, die Liste ist `materials.json`.

## 2. Scope

- Neue Formate `text`, `bild`, `link`; `prompt` und `datei` bleiben unverändert gültig
- Zweite Filterreihe "Format" neben der Reihe "Thema", beide kombinierbar
- `text`: Markdown-Datei, formatiert dargestellt (Überschriften, Listen, Fettdruck, Links)
- `bild`: Vorschau in der Karte, Klick öffnet eine Großansicht, Download-Link
- `link`: Button zu einer externen Seite, Zielhost sichtbar
- Erweiterte Datenprüfung im Test (pro Format andere Pflichtfelder, Dateiendungen, Bildgröße, nur `https`-Links)
- README: Abschnitt "Materialien hinzufügen" um die neuen Formate ergänzen

## 3. Non-Goals

- Kein Eintrag mit mehreren Teilen ("Paket" mit Text, Datei und Bild). Ein Eintrag hat genau ein Format. Eine Liste "Weiterführend" oder eine Detailseite pro Material bekommt bei Bedarf eine eigene Spec.
- Keine Einbettung externer Inhalte (YouTube, iframes, Widgets): Das würde Daten an Dritte senden und die Datenschutzerklärung ändern.
- Keine SVG-Bilder (können Skripte enthalten), nur `png`, `jpg`, `jpeg`, `webp`
- Kein Admin-Upload, keine Datenbank, keine Zähler oder Tracking (wie v1)
- Keine Bildbearbeitung oder automatische Verkleinerung. Bilder werden fertig abgelegt.

## 4. Annahmen

- Inhalte stammen ausschließlich von Laurenz und werden per Commit eingestellt. Deshalb gilt Markdown als vertrauenswürdig; rohes HTML in Markdown wird trotzdem nicht ausgeführt, sondern als Text angezeigt.
- Menge weiter unter 50 Materialien
- Datei-Endungen für `datei`: `pdf`, `docx`, `doc`, `xlsx`, `pptx`, `txt`, `csv`, `zip`
- Bilder pro Datei maximal 800 KB
- Das Markdown wird mit der Bibliothek `marked` gerendert, die erst beim ersten Aufklappen eines Textes nachgeladen wird (kein größeres Hauptbundle)

## 5. Datenmodell (`materials.json`)

Gemeinsame Pflichtfelder wie v1: `id`, `title`, `description`, `category`, `type`. Dazu je Format:

| `type` | Zusätzliche Pflichtfelder | Datei-Regel |
|---|---|---|
| `prompt` | `file` | `.md` |
| `text` | `file` | `.md` |
| `datei` | `file` | Endung aus der Liste in Abschnitt 4 |
| `bild` | `file`, `alt` | `png`, `jpg`, `jpeg`, `webp`, höchstens 800 KB |
| `link` | `url` | kein `file`; `url` beginnt mit `https://` |

## 6. Akzeptanzkriterien

- **AC-1:** WHEN ein Besucher `/materialien` öffnet THE SYSTEM SHALL zwei Filterreihen "Thema" und "Format" anzeigen, jeweils mit "Alle" als Standard.
- **AC-2:** WHEN ein Besucher ein Thema und ein Format wählt THE SYSTEM SHALL nur Materialien zeigen, die beide Bedingungen erfüllen; IF kein Material passt THE SYSTEM SHALL "Keine Materialien für diese Auswahl" anzeigen.
- **AC-3:** THE SYSTEM SHALL in der Format-Reihe nur Formate anbieten, die mindestens ein Material haben.
- **AC-4:** WHEN ein Besucher bei einem `text` auf "Lesen" klickt THE SYSTEM SHALL den Inhalt der `.md`-Datei mit Überschriften, Absätzen, Listen, Fettdruck und Links formatiert anzeigen.
- **AC-5:** WHEN die `.md`-Datei eines Textes rohes HTML (z. B. `<script>` oder `<img onerror=…>`) enthält THE SYSTEM SHALL dieses als sichtbaren Text darstellen und nicht ausführen.
- **AC-6:** WHEN ein Text einen Link auf ein anderes Schema als `https`, `http` oder `mailto` enthält (z. B. `javascript:`) THE SYSTEM SHALL ihn nicht als Link ausgeben.
- **AC-7:** WHEN ein Besucher bei einem `text` auf "Herunterladen" klickt THE SYSTEM SHALL die `.md`-Datei herunterladen.
- **AC-8:** WHEN ein `bild` angezeigt wird THE SYSTEM SHALL eine Vorschau mit dem Alt-Text aus dem Eintrag zeigen, die erst beim Scrollen geladen wird (`loading="lazy"`) und das Layout nicht verschiebt (feste Höhe der Vorschau).
- **AC-9:** WHEN ein Besucher auf die Bildvorschau klickt THE SYSTEM SHALL das Bild in einer Großansicht öffnen, die sich mit Esc, Klick außerhalb und einem Schließen-Button schließen lässt.
- **AC-10:** WHEN ein Besucher bei einem `bild` auf "Herunterladen" klickt THE SYSTEM SHALL die Bilddatei herunterladen.
- **AC-11:** WHEN ein `link` angezeigt wird THE SYSTEM SHALL einen Button "Öffnen" mit dem Zielhost (z. B. "example.com") zeigen, der in einem neuen Tab mit `rel="noopener noreferrer"` öffnet.
- **AC-12:** THE SYSTEM SHALL bei jedem Format ein Badge mit dem Formatnamen zeigen ("Prompt", "Text", "Datei", "Bild", "Link").
- **AC-13:** WHEN bestehende Einträge im Format `prompt` oder `datei` vorhanden sind THE SYSTEM SHALL sie unverändert wie in v1 darstellen (Aufklappen, Kopieren, Download).
- **AC-14:** WHEN die Tests laufen THE SYSTEM SHALL fehlschlagen, wenn ein Eintrag die Regeln aus Abschnitt 5 verletzt: fehlendes Pflichtfeld je Format, unerlaubte Dateiendung, Bild über 800 KB, fehlender Alt-Text, `url` ohne `https://`, `link` mit `file` oder Datei, die nicht existiert (zusätzlich zu den v1-Regeln).
- **AC-15:** THE SYSTEM SHALL beim Aufruf von `/materialien` keine Cookies setzen und keine Anfragen an Dritte senden. Ausnahme ist nur das Öffnen eines Links durch den Besucher.
- **AC-16:** WHEN die Seite mobil (375 px) geöffnet wird THE SYSTEM SHALL ohne horizontales Scrollen darstellen, auch mit Großansicht und gerenderten Texten.

## 7. Design

**Geänderte Dateien**

- `client/src/pages/Materialien.jsx`: Format-Filter, Karten je Format; Texte mit `marked` (dynamischer Import), Bild-Großansicht über das native `<dialog>`-Element, Link-Karte
- `client/src/data/materials.json`: keine Struktur-Änderung außer den neuen Feldern `url` und `alt`; Liste bleibt zunächst leer
- `client/src/App.css`: Styles für Format-Reihe, Bildvorschau (feste Höhe, `object-fit: cover`), Großansicht, gerenderten Text (`.material-text`)
- `client/package.json`: neue Abhängigkeit `marked`
- `server/test/materials.test.js`: Validator um die Regeln aus Abschnitt 5 erweitert, plus Tests mit absichtlich fehlerhaften Einträgen
- `README.md`: neue Formate mit je einem Beispiel-Eintrag

**Verhalten im Detail**

- Markdown: `marked` wird so konfiguriert, dass HTML-Tokens als Text ausgegeben werden (nicht als Markup). Links werden nach dem Rendern auf erlaubte Schemas geprüft und mit `target="_blank"` und `rel="noopener noreferrer"` versehen. Ausgabe über `dangerouslySetInnerHTML` erst nach dieser Bereinigung.
- Bild: Vorschau `max-height: 220px`, Großansicht per `dialog.showModal()` (Esc und Fokus-Rückgabe sind nativ). Alt-Text stammt aus dem Eintrag, die Großansicht bekommt denselben.
- Link: Zielhost über `new URL(url).hostname`, ohne `www.`.
- Format-Filter wird aus den vorhandenen Einträgen abgeleitet (AC-3), Reihenfolge fest: Prompt, Text, Datei, Bild, Link.
- Kein Backend, keine Änderung in `deploy/`.

**Rechtliches**

- Externe Links fallen unter "Haftung für Links" im bestehenden Impressum. Die Datenschutzerklärung bleibt unverändert, weil nichts eingebettet und nichts geladen wird, bevor ein Besucher einen Link anklickt.
- Bilder und Dateien nur mit eigenen oder lizenzierten Inhalten; das liegt in Ihrer Verantwortung als Herausgeber.

## 8. Aufgaben

- [x] T1: `marked` installieren, Markdown-Rendering mit HTML-Escaping und Link-Bereinigung als eigene Funktion (AC-4, AC-5, AC-6)
- [x] T2: Format-Filter und kombinierte Filterlogik mit Leerzustand (AC-1, AC-2, AC-3)
- [x] T3: Karten für `text` (Lesen, Download) und `link` (Host, Button) (AC-4, AC-7, AC-11, AC-12)
- [x] T4: Karte für `bild` mit Vorschau, Großansicht, Download (AC-8, AC-9, AC-10)
- [x] T5: Bestehende Formate `prompt`/`datei` unverändert prüfen, Badges (AC-12, AC-13)
- [x] T6: Validator und Tests in `server/test/materials.test.js` erweitern (AC-14)
- [x] T7: README, Styles, mobile und Netzwerkprüfung (AC-15, AC-16)
- [ ] T8: Nach dem Deploy live prüfen: Texte, Bild, Link, Direktaufruf von Dateien

## 9. Testplan

| AC | Prüfung |
|---|---|
| AC-1, AC-2, AC-3 | manuell mit temporären Testeinträgen aller 5 Formate, danach entfernt |
| AC-4, AC-7 | manuell: Beispiel-Markdown mit Überschrift, Liste, Fettdruck, Link |
| AC-5, AC-6 | manuell mit präpariertem Markdown (`<script>`, `<img onerror>`, `[x](javascript:alert(1))`); zusätzlich Unit-Test der Render-Funktion, falls sie als reine Funktion ausgelagert ist (kann in `server/test` per `import()` geprüft werden) |
| AC-8, AC-9, AC-10 | manuell: lazy Loading im Netzwerk-Tab, Großansicht mit Esc und Außenklick, Download |
| AC-11 | manuell: Zielhost, neuer Tab, `rel`-Attribut im DOM |
| AC-12, AC-13 | manuell: Badges, v1-Einträge unverändert |
| AC-14 | automatisiert, `server/test/materials.test.js` (CI) |
| AC-15 | Netzwerk-Tab: keine Fremdanfragen, keine Cookies |
| AC-16 | Browser-Emulation 375 px |

## 10. Entscheidungen (aus dem Review)

1. Badge-Namen "Prompt", "Text", "Datei", "Bild", "Link" sind freigegeben.
2. Bildgrenze 800 KB ist freigegeben.
3. Dateiendungen für `datei` bleiben wie in Abschnitt 4 (keine Ergänzung gewünscht); die Liste steht im Test und lässt sich bei Bedarf erweitern.

## 11. Änderungsprotokoll

- v1 (2026-11-02): Erster Entwurf; am selben Tag freigegeben, Entscheidungen in Abschnitt 10
