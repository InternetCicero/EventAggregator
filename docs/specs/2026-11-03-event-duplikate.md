# Spec: Duplikaterkennung für Events über mehrere Quellen

- **Status:** In Review
- **Version:** 2
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-03
- **Approved:** 2026-11-03

## 1. Ziel

Dasselbe Event steht oft bei mehreren Quellen, z. B. bei McKinsey und bei e-fellows. Bisher erkennt das System Duplikate nur **innerhalb derselben Quelle** (gleiche URL und gleicher Titel, bzw. gleicher Titel und gleiche Startzeit ohne Link). Über Quellen hinweg landen dieselben Events mehrfach in der Moderation und später mehrfach in der öffentlichen Liste.

Neu: Beim Speichern eines Events (Scraper und Formular) wird der **Titel mit allen vorhandenen Events am selben Tag verglichen**, unabhängig von der Quelle. Eindeutige Duplikate werden nicht als eigenes Event gespeichert, sondern **am vorhandenen Event als weitere Quelle vermerkt**. Unsichere Treffer werden markiert und im Admin-Bereich sichtbar gemacht.

**Neu in v2:** Gehen zwei Firmen zur selben Messe oder zum selben Event, soll das auf dem Event stehen. Die Eventkarte zeigt dann zusätzlich zur Quelle eine Zeile **"Auch bei: BCG, e-fellows"** mit Links zur jeweiligen Seite.

Wie bisher: kein KI-Einsatz, kein API-Schlüssel. Der Vergleich ist eine regelbasierte, nachvollziehbare Titelähnlichkeit.

## 2. Wie ein Duplikat erkannt wird

Zwei Events gelten nur dann als Duplikat-Kandidaten, wenn **beide** Bedingungen erfüllt sind:

1. **Gleicher Kalendertag** (Datumsteil von `start_date`, ohne Uhrzeit)
2. **Ähnliche Titel** nach Normalisierung

**Normalisierung des Titels:** Kleinbuchstaben, Umlaute und Akzente vereinfachen (ä→a, é→e), Satzzeichen und Trenner (`| – - : / × x`) entfernen, Füllwörter streichen (`mit, bei, von, der, die, das, und, the, at, with, by, and, in, im, am`), vierstellige Jahreszahlen streichen, in Wörter zerlegen. Die Reihenfolge der Wörter spielt keine Rolle (Wortmenge).

**Ähnlichkeit:** Anteil gemeinsamer Wörter an allen Wörtern beider Titel (Jaccard), Wert von 0 bis 1.

Beispiel: "McKinsey | Case Workshop 2026" und "Case Workshop mit McKinsey" ergeben dieselbe Wortmenge {mckinsey, case, workshop}, Ähnlichkeit 1,0.

**Ortsprüfung:** Haben beide Events einen Ort und unterscheiden sich die Orte (nach gleicher Normalisierung, keiner ist im anderen enthalten), ist es kein Duplikat. So werden gleichnamige Events an verschiedenen Standorten nicht verschmolzen.

**Einstufung**

| Ähnlichkeit | Einstufung | Verhalten |
|---|---|---|
| ≥ 0,9 | Duplikat | wird nicht als eigenes Event gespeichert, die Quelle wird am vorhandenen Event als "Auch bei" vermerkt (Scraper) bzw. mit Hinweis zurückgewiesen (Formular) |
| 0,6 bis unter 0,9 | Mögliches Duplikat | wird gespeichert, als "ausstehend" mit Verweis auf das ähnliche Event markiert |
| < 0,6 | kein Duplikat | wird normal gespeichert |

Verglichen wird mit Events **jedes Status** (ausstehend, freigegeben, abgelehnt) und **jeder anderen Quelle**. Events derselben Quelle werden nicht miteinander verglichen, damit mehrere Termine einer Quelle am selben Tag erhalten bleiben (für wiederholt gelesene Events gilt weiter die URL-/Titelprüfung der Quelle). Ausnahme: manuell eingereichte Events werden auch untereinander verglichen, weil sie von verschiedenen Personen stammen. Ein bereits abgelehntes Event kommt dadurch nicht über eine zweite Quelle zurück.

## 3. Scope

- Duplikatprüfung in `server/src/scraper/runSource.js` und beim Einreichen über das Formular (`POST /api/events`)
- Neue Spalte `duplicate_of` an `events` (Verweis auf das ähnliche Event) und neue Tabelle `event_listings` (weitere Quellen eines Events: Quellenname, Link, Titel dort) mit Migration
- Anzeige "Auch bei: …" auf der öffentlichen Eventkarte und im Admin, `also_listed` in der API
- Einmalige Markierung bereits vorhandener Duplikate beim Start (Migration), **ohne** etwas zu löschen oder abzulehnen
- Admin-Ansicht der Events: Hinweis "Mögliches Duplikat von …" (Titel und Quelle des anderen Events), Filter "Nur mögliche Duplikate"
- Erweiterter Status eines Scraper-Laufs: Anzahl der quellenübergreifenden Duplikate und der markierten Events
- Tests, README

## 4. Non-Goals

- Keine automatische Zusammenführung zweier Events, keine automatische Freigabe oder Ablehnung markierter Events
- Kein Knopf "Zusammenführen" für markierte Events. Sie werden weiter über Freigeben/Ablehnen bearbeitet.
- "Auch bei" gilt nur für eindeutige Duplikate (ab 0,9), nicht für markierte Kandidaten und nicht für Einreichungen über das Formular
- Kein automatisches Löschen oder Ablehnen vorhandener Duplikate. Das kommt später, wenn die Erkennung sich im Betrieb als zuverlässig erwiesen hat.
- Keine unscharfe Erkennung über Tippfehler hinaus (kein Levenshtein, keine Übersetzung deutsch/englisch)
- Keine Duplikaterkennung bei Jobs und Firmen
- Keine Änderung an der bestehenden Erkennung innerhalb einer Quelle (URL und Titel bleibt als erste, schnellere Prüfung)

## 5. Annahmen

- Datumsvergleich nur auf den Tag genau. Hat ein Event kein erkennbares Datum und bekommt den Ersatzwert "jetzt" (heutiger Fall im Scraper), wird die Duplikatprüfung für dieses Event übersprungen, damit nichts fälschlich verschmilzt.
- Die Menge ist klein (einige Hundert Events), der Vergleich läuft pro neuem Event gegen die Events desselben Tages direkt in SQLite und braucht keinen Index.
- Das Formular weist eindeutige Duplikate zurück mit der Meldung, welches Event schon vorhanden ist. Mögliche Duplikate werden angenommen und im Admin markiert.
- Als Name in "Auch bei" dient der Name der Quelle, so wie er im Admin steht (z. B. "McKinsey Karriere-Events"). Wer das kürzer will, benennt die Quelle um.
- Schwellenwerte 0,9 und 0,6 sind Startwerte. Sie stehen als Konstanten an einer Stelle und lassen sich nach ersten Erfahrungen anpassen.

## 6. Akzeptanzkriterien

- **AC-1:** WHEN der Scraper ein Event findet, dessen Titel (normalisiert) mit dem eines vorhandenen Events am selben Tag eine Ähnlichkeit von mindestens 0,9 hat, THE SYSTEM SHALL es nicht als eigenes Event speichern und als Duplikat zählen, unabhängig von Quelle und Status des vorhandenen Events.
- **AC-2:** WHEN die Ähnlichkeit zwischen 0,6 und unter 0,9 liegt THE SYSTEM SHALL das Event als "ausstehend" speichern und `duplicate_of` auf das ähnlichste vorhandene Event setzen.
- **AC-3:** WHEN die Titel dieselben Wörter in anderer Reihenfolge oder mit Füllwörtern, Satzzeichen, Jahreszahlen oder Akzenten anders enthalten THE SYSTEM SHALL sie als gleich behandeln (Beispiel: "McKinsey | Case Workshop 2026" und "Case Workshop mit McKinsey").
- **AC-4:** WHEN die Startdaten auf verschiedene Kalendertage fallen THE SYSTEM SHALL das Event nicht als Duplikat behandeln, auch bei identischem Titel.
- **AC-5:** WHEN beide Events einen Ort haben und die Orte sich unterscheiden THE SYSTEM SHALL das Event nicht als Duplikat behandeln.
- **AC-6:** WHEN ein Event kein erkennbares Datum hat THE SYSTEM SHALL die quellenübergreifende Prüfung für dieses Event überspringen.
- **AC-7:** WHEN ein Event über das Formular eingereicht wird und ein eindeutiges Duplikat vorhanden ist THE SYSTEM SHALL die Einreichung mit HTTP 409 und dem Titel und der Quelle des vorhandenen Events zurückweisen.
- **AC-8:** WHEN ein Event über das Formular eingereicht wird und nur ein mögliches Duplikat vorhanden ist THE SYSTEM SHALL es speichern und wie in AC-2 markieren.
- **AC-9:** WHEN der Admin die Eventliste öffnet THE SYSTEM SHALL bei markierten Events "Mögliches Duplikat von „<Titel>" (<Quelle>)" anzeigen und einen Filter "Nur mögliche Duplikate" anbieten.
- **AC-10:** WHEN der Server mit einer Datenbank startet, die noch nicht migriert ist THE SYSTEM SHALL bereits vorhandene Duplikat-Kandidaten gemäß Abschnitt 2 markieren (jeweils das später angelegte Event verweist auf das früher angelegte) und dabei keine Events löschen, ablehnen oder ändern außer `duplicate_of`.
- **AC-11:** WHEN ein Scraper-Lauf endet THE SYSTEM SHALL im Status zusätzlich die Zahl der quellenübergreifenden Duplikate und der markierten Events ausweisen (Beispiel: `ok: 12 neu, 4 Duplikate (3 quellenübergreifend), 2 markiert, 0 Fehler`).
- **AC-12:** WHEN dasselbe Event zweimal von derselben Quelle gelesen wird THE SYSTEM SHALL sich wie bisher verhalten (Duplikat über URL und Titel, ohne dass `duplicate_of` gesetzt wird).
- **AC-13:** WHEN ein markiertes Event vom Admin freigegeben oder abgelehnt wird THE SYSTEM SHALL den Status ändern wie bei jedem anderen Event; die Markierung verhindert nichts.
- **AC-14:** WHEN ein eindeutiges Duplikat (AC-1) aus einer anderen Quelle als der des vorhandenen Events kommt THE SYSTEM SHALL am vorhandenen Event einen Eintrag "Auch bei" mit Quellenname, Link (falls vorhanden) und dem dortigen Titel speichern.
- **AC-15:** WHEN dieselbe Quelle für dasselbe Event schon vermerkt ist oder die Quelle die des vorhandenen Events selbst ist THE SYSTEM SHALL keinen weiteren Eintrag anlegen (auch nicht bei wiederholten Läufen).
- **AC-16:** WHEN die öffentliche Eventkarte ein Event mit Einträgen "Auch bei" zeigt THE SYSTEM SHALL unter der Quelle eine Zeile "Auch bei: <Quelle>, <Quelle>" anzeigen, wobei jeder Name auf den gespeicherten Link verweist (neuer Tab, `rel="noopener noreferrer"`), und bei Events ohne solche Einträge SHALL die Zeile entfallen.
- **AC-17:** WHEN die API Events ausliefert (`GET /api/events`, `GET /api/events/:id`, Admin-Liste) THE SYSTEM SHALL pro Event ein Feld `also_listed` mit der Liste der weiteren Quellen (leer, wenn keine) mitgeben.
- **AC-18:** WHEN Events ohne Einträge "Auch bei" existieren (alle bisherigen) THE SYSTEM SHALL sie unverändert anzeigen.

## 7. Design

**Neue Dateien**
- `server/src/db/duplicates.js`: `normalizeTitle(title)`, `titleSimilarity(a, b)`, `classifyDuplicate(candidate, existing)`, Konstanten `STRONG = 0.9`, `WEAK = 0.6`, Füllwortliste; `findDuplicate(event)` fragt Events desselben Tages ab und liefert `{ level: 'duplicate' | 'possible', event }` oder `null`
- `server/test/duplicates.test.js`: Unit- und Integrationstests

**Geänderte Dateien**
- `server/src/db/index.js`: Migration v6, `ALTER TABLE events ADD COLUMN duplicate_of INTEGER`, neue Tabelle `event_listings` (`id`, `event_id` mit Löschweitergabe, `source`, `url`, `title`, `created_at`, eindeutig je `event_id` + `source`), einmalige Markierung der vorhandenen Events (ohne Einträge in `event_listings`)
- `server/src/db/eventsRepo.js`: `createEvent` akzeptiert `duplicate_of`; `addListing(eventId, {source, url, title})` (ignoriert Eigenquelle und bereits vermerkte Quellen), `attachListings` für `also_listed` in `listEvents`/`getEvent`; Admin-Liste liefert `duplicate_of_title` und `duplicate_of_source` (Join); Filter `onlyDuplicates`
- `server/src/scraper/runSource.js`: Prüfung vor dem Speichern, Zähler `crossSource` und `flagged`, erweiterter Status
- `server/src/routes/events.js`: Prüfung im `POST /`
- `server/src/routes/admin.js`: Query-Parameter `duplicates=1` für `GET /events`
- `client/src/pages/AdminDashboard.jsx`: Hinweis in der Titelzelle, Filter-Checkbox, "Auch bei" in der Quellen-Spalte
- `client/src/components/EventCard.jsx` und `client/src/App.css`: Zeile "Auch bei: …"
- `client/src/lib` oder `api.js`: Parameter für den Filter
- `README.md`: Abschnitt "Duplikate"

**Ablauf beim Speichern eines Events**
1. Bisherige Prüfung innerhalb der Quelle (URL + Titel bzw. Titel + Start), unverändert
2. Hat das Event ein erkennbares Datum: Events mit gleichem Tag laden, Orte vergleichen, Ähnlichkeit berechnen, das ähnlichste Event bestimmen
3. Ähnlichkeit ≥ 0,9: nicht als Event speichern, stattdessen `addListing` am vorhandenen Event (Quelle, Link, Titel). 0,6 bis unter 0,9: speichern mit `duplicate_of`. Sonst: speichern.

**Rechtliches/Datenschutz:** keine neuen personenbezogenen Daten.

## 8. Aufgaben

- [x] T1: `duplicates.js` mit Normalisierung, Ähnlichkeit, Ortsprüfung und Einstufung; Unit-Tests (AC-1 bis AC-6)
- [x] T2: Migration v6 mit Spalte `duplicate_of` und einmaliger Markierung; Migrationstest (AC-10)
- [x] T3: Einbau im Scraper inkl. Status und Zählern; Tests (AC-1, AC-2, AC-11, AC-12)
- [x] T3a: Tabelle `event_listings`, `addListing`, `also_listed` in den API-Antworten; Tests (AC-14, AC-15, AC-17, AC-18)
- [x] T4: Einbau im Formular-Endpunkt; Tests (AC-7, AC-8)
- [x] T5: Admin-API und Admin-Oberfläche mit Hinweis und Filter (AC-9, AC-13)
- [x] T5a: Zeile "Auch bei" auf der Eventkarte und im Admin (AC-16)
- [x] T6: README, manuelle Prüfung der Oberfläche, Probelauf mit echten Quellen gegen eine lokale Test-DB (Realitätscheck, keine Änderung an Live-Daten)
- [ ] T7: Nach dem Deploy: Migration auf der Live-Datenbank prüfen (Zahl der markierten Events nennen, nichts gelöscht) (AC-10)

## 9. Testplan

| AC | Prüfung |
|---|---|
| AC-1, AC-3, AC-4, AC-5, AC-6 | automatisiert, `server/test/duplicates.test.js` (Normalisierung, Ähnlichkeit, Tag, Ort, ohne Datum) |
| AC-1, AC-2, AC-11, AC-12 | automatisiert mit zwei Quellen (z. B. "McKinsey" und "e-fellows") über `runSource` mit ausgetauschtem `fetchPages` |
| AC-7, AC-8 | automatisiert über den Router (409, Speichern mit Markierung) |
| AC-10 | automatisiert, Migrationstest mit vorbereiteter Alt-Datenbank |
| AC-14, AC-15, AC-17, AC-18 | automatisiert, zwei Quellen über `runSource`, wiederholter Lauf, Abruf über Router und Repo |
| AC-9, AC-13, AC-16 | manuell im Admin-Bereich und auf der öffentlichen Seite (Eventkarte mit zwei "Auch bei"-Quellen, Handy-Ansicht) |
| Realitätscheck | lokaler Lauf der bestehenden Quellen gegen eine leere Test-DB, Ausgabe der erkannten und markierten Fälle zur Sichtung |

## 10. Entscheidungen (aus dem Review)

1. Eindeutige Duplikate werden automatisch verworfen. Zusätzlich soll auf dem Event stehen, bei welchen weiteren Firmen/Quellen es ebenfalls gelistet ist ("Auch bei: …", siehe Abschnitt 1, AC-14 bis AC-17).
2. Vergleich tagesgenau.
3. Vorhandene Duplikate werden zunächst nur markiert. Automatisches Löschen oder Ablehnen kommt später, wenn die Erkennung zuverlässig funktioniert (Non-Goal in dieser Spec).

## 11. Änderungsprotokoll

- v1 (2026-11-03): Erster Entwurf
- v2.1 (2026-11-03, Klarstellung bei der Umsetzung): Events derselben Quelle werden nicht verglichen (Ausnahme manuelle Einreichungen), siehe Abschnitt 2. Begründung: mehrere Termine einer Quelle am selben Tag (z. B. zwei Infoabende) sollen nicht als Duplikat gelten; entspricht AC-12 und AC-15.
- v2 (2026-11-03, freigegeben): Entscheidungen aus dem Review eingearbeitet. Neu: Eintrag "Auch bei" statt Verlust des Links bei verworfenen Duplikaten (Tabelle `event_listings`, AC-14 bis AC-18, Anzeige auf der Eventkarte), Non-Goals angepasst.
