# Spec: Materialien v3 – Detailseite mit Nutzen, Einsatz und Asset

- **Status:** Approved
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-03
- **Approved:** 2026-11-03
- **Baut auf:** [Materialien v1](2026-11-02-materialien.md) und [v2 Formate](2026-11-02-materialien-formate.md) (beide live)

## 1. Ziel

Heute zeigt die Übersicht lange Beschreibungen und klappt Inhalte direkt in der Karte auf. Das ist unübersichtlich, und man sieht nicht auf einen Blick, **was ein Material bringt und wann man es nutzt**.

Neu:
- Die Übersicht zeigt pro Material nur Titel, Format, Thema und **einen Satz Nutzen**. Die ganze Karte ist anklickbar.
- Ein Klick öffnet eine **eigene Seite** (`/materialien/<id>`) mit: Was es bringt, Wann man es nutzt, optional "So geht's", und darunter **das Asset selbst** (Prompt, Text, Datei, Bild oder Link).

Wie bisher gibt es **kein Backend**: Inhalte sind Dateien im Repo, die Liste ist `materials.json`.

## 2. Entscheidung: eigene Seite statt Pop-up

Empfehlung ist eine eigene Seite, aus diesen Gründen:
- **Teilbar:** Jedes Material hat einen eigenen Link, den man weitergeben oder in LinkedIn-Posts nutzen kann. Ein Pop-up hat keine Adresse.
- **Zurück-Taste funktioniert:** Der Besucher landet wieder in der Übersicht, auch mit gesetzten Filtern.
- **Platz:** Beschreibung, Einsatz, Schritte und Asset brauchen mehr Raum, als ein Pop-up auf dem Handy bietet.
- **Einfacher und robuster:** Eine Route statt Fokusfallen, Scroll-Sperre und Tastaturbedienung eines Dialogs.

Falls Sie ein Pop-up bevorzugen, wäre es nach der Freigabe ein anderes Design (Abschnitt 6 würde sich ändern).

## 3. Scope

- Übersicht `/materialien`: schlankere Karten, ganze Karte klickbar, Filter bleiben
- Detailseite `/materialien/:id`: Kopf, Info-Blöcke, Asset-Bereich, Zurück-Link
- Filter ("Thema", "Format") stehen in der Adresse (`?thema=…&format=…`), damit die Zurück-Taste sie wiederherstellt
- Neue Pflichtfelder im Eintrag: `outcome` ("Was es bringt") und `useWhen` ("Wann nutzen"); optional `steps` ("So geht's")
- Asset je Format direkt auf der Detailseite sichtbar (nicht mehr eingeklappt)
- Erweiterte Datenprüfung im Test
- Bestehenden Eintrag (Bewerbungs-Pipeline-Skill) mit den neuen Feldern füllen (Textentwurf von mir, Sie prüfen im Pull Request)
- README: neue Felder dokumentieren

## 4. Non-Goals

- Kein Pop-up/Dialog für Materialien (Bilder behalten ihre Großansicht aus v2)
- Keine "Ähnliche Materialien", Suche, Sortierung oder Bewertungen
- Kein Backend, keine Zähler, kein Tracking
- Keine servergerenderten Vorschauen für Social Media (die Seite bleibt eine Single-Page-App, geteilte Links zeigen die allgemeine Vorschau der Website)
- Keine mehrteiligen Pakete pro Eintrag (weiterhin ein Format pro Eintrag)

## 5. Annahmen

- Die Texte für `outcome`, `useWhen` und `steps` schreiben Sie, für den vorhandenen Skill liefere ich einen Entwurf
- `id` besteht nur aus Kleinbuchstaben, Ziffern und Bindestrichen (damit sie nie mit einem Dateinamen unter `/materialien/` kollidiert, Dateien haben immer einen Punkt)
- Pro Eintrag 1–4 Punkte bei `outcome` und `useWhen`, 1–8 Schritte bei `steps`, jeweils kurze Sätze (höchstens 160 Zeichen)
- `description` bleibt als kurzer Satz für die Karte, höchstens 140 Zeichen. Bisher längere Texte werden gekürzt.
- nginx liefert unbekannte Pfade bereits an die App aus (`try_files $uri /index.html`), eine Änderung in `deploy/` ist nicht nötig

## 6. Aufbau

**Übersicht (`/materialien`)**
Karte: Format-Badge und Thema, Titel, ein Satz (`description`), "Ansehen →". Keine Aufklapp-Bereiche, keine Download-Buttons in der Karte.

**Detailseite (`/materialien/:id`), von oben nach unten**

1. "← Alle Materialien" (führt mit den vorherigen Filtern zurück)
2. Badges (Thema, Format), Titel, ein Satz Zusammenfassung
3. Zwei Blöcke nebeneinander (auf dem Handy untereinander): **Was es bringt** und **Wann nutzen**, jeweils als kurze Liste
4. Optional **So geht's** als nummerierte Schritte
5. **Das Material** (hervorgehobener Bereich), je Format:

| Format | Darstellung im Bereich "Das Material" |
|---|---|
| `prompt` | Prompt-Text sichtbar, Button "Kopieren", Download als `.md` |
| `text` | Text vollständig formatiert, Download als `.md` |
| `datei` | Karte mit Dateiname und Endung, großer Button "Herunterladen" |
| `bild` | Bild groß, mit Alt-Text, Download |
| `link` | Button "Öffnen" mit Zielhost |

## 7. Datenmodell (`materials.json`)

Neu zu den bisherigen Feldern (`id`, `title`, `description`, `category`, `type`, `file`/`url`, `alt`):

| Feld | Pflicht | Inhalt |
|---|---|---|
| `outcome` | ja | Liste mit 1–4 Kurzsätzen, "Was es bringt" |
| `useWhen` | ja | Liste mit 1–4 Kurzsätzen, "Wann nutzen" |
| `steps` | nein | Liste mit 1–8 Kurzsätzen, "So geht's" |

Beispiel (Entwurf für den vorhandenen Skill):

```json
{
  "id": "bewerbungs-pipeline-skill",
  "title": "Skill für Bewerbungen",
  "description": "Eigener Claude-Skill, der Stellen analysiert, deinen CV passend macht und dich aufs Interview vorbereitet.",
  "outcome": ["Stellenanalyse mit Must-haves und Red Flags", "CV-Matching nur mit belegbaren Fakten", "Anschreiben-Entwurf und Interview-Training"],
  "useWhen": ["Du bewirbst dich auf mehrere Stellen und willst den CV jeweils schnell anpassen", "Du willst für ein Gespräch gezielt Fragen üben"],
  "steps": ["ZIP entpacken", "Platzhalter {{…}} in SKILL.md durch deine Angaben ersetzen", "Als Skill in Claude hochladen", "Stellenlink einfügen und starten"],
  "category": "CV & Anschreiben",
  "type": "datei",
  "file": "bewerbungs-pipeline-skill.zip"
}
```

## 8. Akzeptanzkriterien

- **AC-1:** WHEN ein Besucher `/materialien` öffnet THE SYSTEM SHALL pro Material eine Karte mit Format-Badge, Thema, Titel und dem Satz aus `description` zeigen, und die gesamte Karte SHALL zur Detailseite führen.
- **AC-2:** THE SYSTEM SHALL in der Übersicht keine Aufklapp-Bereiche, Kopieren- oder Download-Buttons mehr anzeigen.
- **AC-3:** WHEN ein Besucher `/materialien/<id>` öffnet (per Klick oder direkt per Adresse) THE SYSTEM SHALL Titel, Badges, Zusammenfassung, "Was es bringt" und "Wann nutzen" anzeigen.
- **AC-4:** WHEN ein Eintrag `steps` hat THE SYSTEM SHALL "So geht's" als nummerierte Liste zeigen, sonst den Block weglassen.
- **AC-5:** WHEN das Material ein Prompt ist THE SYSTEM SHALL den Text sofort sichtbar zeigen, mit Kopieren-Button (Fallback wie in v2) und Download.
- **AC-6:** WHEN das Material ein Text ist THE SYSTEM SHALL ihn vollständig formatiert zeigen (Regeln zu HTML und Links aus v2 gelten unverändert) und den Download anbieten.
- **AC-7:** WHEN das Material eine Datei ist THE SYSTEM SHALL Dateiname, Endung und einen Button "Herunterladen" zeigen.
- **AC-8:** WHEN das Material ein Bild ist THE SYSTEM SHALL es mit Alt-Text groß zeigen (mit Großansicht wie in v2) und den Download anbieten.
- **AC-9:** WHEN das Material ein Link ist THE SYSTEM SHALL einen Button "Öffnen" mit Zielhost zeigen, der in neuem Tab mit `rel="noopener noreferrer"` öffnet.
- **AC-10:** WHEN eine unbekannte `id` aufgerufen wird THE SYSTEM SHALL "Material nicht gefunden" und einen Link zur Übersicht zeigen.
- **AC-11:** WHEN ein Besucher Filter setzt, eine Detailseite öffnet und "← Alle Materialien" oder die Zurück-Taste nutzt THE SYSTEM SHALL die Übersicht mit denselben Filtern anzeigen; die Filter SHALL in der Adresse als `?thema=…&format=…` stehen und beim direkten Aufruf einer solchen Adresse angewendet werden.
- **AC-12:** THE SYSTEM SHALL den Seitentitel der Detailseite auf den Materialtitel setzen (z. B. "Skill für Bewerbungen – Student Hub").
- **AC-13:** WHEN die Tests laufen THE SYSTEM SHALL fehlschlagen, wenn ein Eintrag `outcome` oder `useWhen` nicht als Liste mit 1–4 nicht leeren Sätzen (je höchstens 160 Zeichen) hat, `steps` vorhanden aber ungültig ist (1–8 Sätze), `description` länger als 140 Zeichen ist oder die `id` Zeichen außerhalb von `a-z`, `0-9` und `-` enthält (zusätzlich zu den bisherigen Regeln).
- **AC-14:** WHEN `/materialien/<id>` direkt unter der Student-Subdomain aufgerufen wird THE SYSTEM SHALL die Detailseite anzeigen (kein 404), und Dateien unter `/materialien/<datei>` SHALL weiter direkt erreichbar sein.
- **AC-15:** THE SYSTEM SHALL auf Übersicht und Detailseite keine Cookies setzen und keine Anfragen an Dritte senden (außer dem Öffnen eines Links durch den Besucher).
- **AC-16:** WHEN die Seiten mobil (375 px) geöffnet werden THE SYSTEM SHALL ohne horizontales Scrollen darstellen; die Info-Blöcke SHALL untereinander stehen.

## 9. Design

**Geänderte Dateien**
- `client/src/pages/Materialien.jsx`: Übersicht mit klickbaren Karten, Filter in der Adresse (`useSearchParams`)
- `client/src/pages/MaterialDetail.jsx` (neu): Detailseite, enthält die bisherigen Bausteine für Prompt, Text, Bild, Link aus `Materialien.jsx`
- `client/src/App.jsx`: Route `/materialien/:id`
- `client/src/App.css`: Styles für Karten, Info-Blöcke, hervorgehobenen Asset-Bereich
- `client/src/data/materials.json`: neue Felder, Eintrag des Skills angepasst
- `server/test/materials.test.js`: Validator um AC-13 erweitert
- `README.md`: neue Felder in der Tabelle "Materialien hinzufügen"

**Verhalten im Detail**
- Die Prompt-/Text-Ladelogik (Abruf der `.md`, HTML-Rückfall als Fehler, Markdown erst bei Bedarf geladen) wird aus der Übersicht in die Detailseite verlagert. Dort wird sofort geladen, nicht erst beim Aufklappen.
- Der Link "← Alle Materialien" führt über `navigate(-1)`, wenn der Besucher aus der Übersicht kam, sonst zu `/materialien`. So bleiben Filter und Scrollposition erhalten.
- Kein Backend, keine Änderung in `deploy/`.

## 10. Aufgaben

- [ ] T1: Datenmodell und Validator erweitern, Tests schreiben (AC-13)
- [ ] T2: Detailseite mit Kopf, Info-Blöcken, Zurück-Link, "nicht gefunden", Seitentitel (AC-3, AC-4, AC-10, AC-12)
- [ ] T3: Asset-Bereich je Format (AC-5, AC-6, AC-7, AC-8, AC-9)
- [ ] T4: Übersicht mit klickbaren Karten und Filtern in der Adresse (AC-1, AC-2, AC-11)
- [ ] T5: Route, Styles, mobile Ansicht (AC-15, AC-16)
- [ ] T6: Eintrag des Skills mit neuen Feldern füllen, README ergänzen
- [ ] T7: Nach dem Deploy live prüfen: Direktaufruf der Detailseite, Zurück-Verhalten, Dateien (AC-14)

## 11. Testplan

| AC | Prüfung |
|---|---|
| AC-1, AC-2, AC-3, AC-4 | manuell mit temporären Testeinträgen aller 5 Formate (danach entfernt) |
| AC-5, AC-6, AC-7, AC-8, AC-9 | manuell im Browser: Kopieren, formatierter Text, Download, Bild-Großansicht, Link-Attribute |
| AC-10 | manuell: `/materialien/gibt-es-nicht` |
| AC-11 | manuell: Filter setzen, Detailseite öffnen, Zurück; Adresse mit Filtern direkt aufrufen |
| AC-12 | manuell: Tab-Titel |
| AC-13 | automatisiert, `server/test/materials.test.js` (CI) |
| AC-14 | nach Deploy per `curl` auf `/materialien/<id>` und `/materialien/<datei>` |
| AC-15 | Netzwerk-Tab: nur eigener Server, keine Cookies |
| AC-16 | Browser-Emulation 375 px |

## 12. Entscheidungen (aus dem Review)

1. Eigene Seite statt Pop-up ist freigegeben.
2. Keine Schnellaktionen (Kopieren, Download) in der Übersicht; sie gibt es auf der Detailseite. Mit der Freigabe bestätigt.
3. Der Skill-Eintrag heißt "Skill für Bewerbungen".

## 13. Änderungsprotokoll

- v1 (2026-11-03): Erster Entwurf; am selben Tag freigegeben, Entscheidungen in Abschnitt 12
