# Spec: Duplikate im Admin zusammenführen

- **Status:** In Review
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-03
- **Approved:** 2026-11-03
- **Baut auf:** [Event-Duplikaterkennung](2026-11-03-event-duplikate.md) (live)

## 1. Ziel

Die Duplikaterkennung markiert vorhandene Events als "Mögliches Duplikat von …". Auf dem Live-System sind das aktuell 8 freigegebene Events (und evtl. weitere ausstehende), die zum Teil doppelt auf der öffentlichen Seite stehen. Bisher lässt sich ein markiertes Event nur ablehnen. Dabei geht verloren, dass die Quelle dasselbe Event ebenfalls listet.

Neu: Ein Knopf **"Zusammenführen"** im Admin-Bereich lehnt das markierte Event ab und hängt dessen Quelle samt Link am Original als **"Auch bei"** an (wie bei neu erkannten eindeutigen Duplikaten). Das geht pro Event oder gesammelt für mehrere. Zusätzlich gibt es einen Knopf **"Kein Duplikat"**, der eine Fehlmarkierung entfernt.

Wie bisher: kein Backend-Umbau, keine KI, kein neuer Dienst.

## 2. Scope

- Zeilen-Knopf "Zusammenführen" bei Events mit `duplicate_of` (Status ausstehend oder freigegeben)
- Sammelaktion "Ausgewählte zusammenführen" in der bestehenden Auswahlleiste
- Knopf "Kein Duplikat" (pro Zeile und als Sammelaktion), setzt `duplicate_of` zurück
- Neue Admin-Endpunkte `POST /api/admin/events/:id/merge` und `POST /api/admin/events/:id/not-duplicate`; die Sammelaktion läuft über den bestehenden Endpunkt `POST /api/admin/events/bulk` mit den neuen Aktionen `merge` und `not-duplicate`
- Bestätigungsdialog vor dem Zusammenführen mit Klartext, was passiert
- Meldung nach einer Sammelaktion, welche Events übersprungen wurden und warum
- Tests, README

## 3. Non-Goals

- Keine Umkehr der Richtung ("das Original in das markierte Event zusammenführen"). Das Original bleibt immer das Event, auf das `duplicate_of` zeigt.
- Kein Rückgängig-Knopf. Ein abgelehntes Event lässt sich über die Statusansicht "Abgelehnt" wieder freigeben, der bereits angelegte "Auch bei"-Eintrag am Original bleibt dann bestehen.
- Kein Löschen des zusammengeführten Events (es bleibt als abgelehnt gespeichert, siehe Abschnitt 6)
- Kein automatisches Zusammenführen. Jede Aktion löst der Admin selbst aus.
- Keine Änderung an Erkennung, Schwellenwerten oder der öffentlichen Seite
- Keine Bearbeitung der Titel oder Beschreibungen beim Zusammenführen

## 4. Annahmen

- Das zusammengeführte Event wird **abgelehnt** statt gelöscht. So bleibt es in der Datenbank, und die Duplikatprüfung über URL und Titel erkennt es beim nächsten Scraper-Lauf als schon bekannt. Würde es gelöscht, käme es beim nächsten Lauf wieder.
- Beim Zusammenführen werden auch die "Auch bei"-Einträge des markierten Events auf das Original übertragen (falls es welche hatte), außer es wäre die Quelle des Originals selbst.
- Als "Auch bei"-Eintrag wird der Quellenname, der Link und der Titel des markierten Events übernommen. Hat das markierte Event keinen Link, bleibt der Link leer und der Name erscheint ohne Verweis.
- Zeigt `duplicate_of` auf ein Event, das selbst wieder markiert ist, wird in das direkt verwiesene Event zusammengeführt (keine Kette).

## 5. Wann Zusammenführen erlaubt ist

| Lage | Verhalten |
|---|---|
| Event hat kein `duplicate_of` | nicht möglich, Hinweis "Nicht als Duplikat markiert" |
| Original existiert nicht mehr | nicht möglich, Hinweis, `duplicate_of` wird zurückgesetzt |
| Original ist **abgelehnt** | nicht möglich, Hinweis "Das Original ist abgelehnt" |
| Markiertes Event ist **freigegeben**, Original aber nicht freigegeben | nicht möglich, Hinweis "Original zuerst freigeben", sonst würde das Event aus der öffentlichen Liste verschwinden |
| Markiertes Event ist abgelehnt | Knopf wird nicht angezeigt |
| sonst | Zusammenführen |

Bei Sammelaktionen werden nicht erlaubte Events übersprungen und mit Grund gemeldet, die übrigen werden zusammengeführt.

## 6. Ablauf beim Zusammenführen (eine Transaktion)

1. Quelle, Link und Titel des markierten Events als "Auch bei" am Original anlegen (ignoriert die Quelle des Originals und schon vermerkte Quellen)
2. "Auch bei"-Einträge des markierten Events auf das Original übertragen (gleiche Regeln)
3. Markiertes Event auf Status "abgelehnt" setzen, `duplicate_of` bleibt als Spur stehen
4. Schlägt ein Schritt fehl, wird nichts übernommen

## 7. Akzeptanzkriterien

- **AC-1:** WHEN der Admin bei einem markierten Event (ausstehend oder freigegeben) "Zusammenführen" bestätigt THE SYSTEM SHALL dessen Quelle, Link und Titel am Original als "Auch bei" speichern und das markierte Event auf "abgelehnt" setzen.
- **AC-2:** WHEN das Original danach öffentlich angezeigt wird THE SYSTEM SHALL in der Zeile "Auch bei" die Quelle des zusammengeführten Events mit dem gespeicherten Link nennen.
- **AC-3:** WHEN das markierte Event selbst "Auch bei"-Einträge hatte THE SYSTEM SHALL sie auf das Original übertragen, ohne die Quelle des Originals oder bereits vorhandene Quellen doppelt anzulegen.
- **AC-4:** WHEN die Quelle des markierten Events bereits als "Auch bei" am Original steht oder die Quelle des Originals ist THE SYSTEM SHALL keinen weiteren Eintrag anlegen und das Zusammenführen trotzdem abschließen (Event wird abgelehnt).
- **AC-5:** WHEN ein Event kein `duplicate_of` hat, das Original abgelehnt ist, oder das markierte Event freigegeben und das Original nicht freigegeben ist THE SYSTEM SHALL das Zusammenführen mit HTTP 409 und einem verständlichen Grund ablehnen und nichts ändern.
- **AC-6:** WHEN das Original nicht mehr existiert THE SYSTEM SHALL `duplicate_of` des Events zurücksetzen und mit HTTP 409 und passendem Hinweis antworten.
- **AC-7:** WHEN ein Schritt des Zusammenführens fehlschlägt THE SYSTEM SHALL keine der Änderungen speichern.
- **AC-8:** WHEN der Admin "Kein Duplikat" wählt THE SYSTEM SHALL `duplicate_of` zurücksetzen, ohne Status oder "Auch bei"-Einträge zu ändern; das Event erscheint danach nicht mehr unter "Nur mögliche Duplikate".
- **AC-9:** WHEN der Admin mehrere Events auswählt und "Ausgewählte zusammenführen" bestätigt THE SYSTEM SHALL jedes erlaubte Event zusammenführen und eine Zusammenfassung zeigen ("N zusammengeführt, M übersprungen" mit Titel und Grund der übersprungenen).
- **AC-10:** WHEN eine Sammelaktion Events enthält, die nicht erlaubt sind THE SYSTEM SHALL diese überspringen und die übrigen trotzdem zusammenführen.
- **AC-11:** THE SYSTEM SHALL den Knopf "Zusammenführen" und "Kein Duplikat" nur bei Events mit `duplicate_of` anzeigen und nicht bei abgelehnten Events.
- **AC-12:** WHEN der Admin "Zusammenführen" anklickt THE SYSTEM SHALL vor der Aktion einen Bestätigungsdialog mit Titel und Quelle des markierten Events und des Originals zeigen.
- **AC-13:** WHEN ein zusammengeführtes Event beim nächsten Scraper-Lauf wieder gelesen wird THE SYSTEM SHALL es als bereits bekannt überspringen und kein neues Event anlegen.
- **AC-14:** THE SYSTEM SHALL die Endpunkte nur mit Admin-Anmeldung zugänglich machen (wie alle Admin-Endpunkte).

## 8. Design

**Geänderte Dateien**
- `server/src/db/eventsRepo.js`: `mergeEvent(id)` (Transaktion, Ergebnis `{ ok: true, into }` oder `{ error: <Code> }`) und `clearDuplicate(id)`; Hilfsfunktion zum Übertragen der Einträge aus `event_listings`
- `server/src/routes/admin.js`: `POST /events/:id/merge`, `POST /events/:id/not-duplicate`; `POST /events/bulk` kennt `merge` und `not-duplicate` und liefert zusätzlich `skipped: [{ id, title, reason }]`
- `client/src/api.js`: `mergeEvent`, `notDuplicate`, `bulkAction` liefert die Zusammenfassung
- `client/src/pages/AdminDashboard.jsx`: Knöpfe in der Zeile, zwei Sammelaktionen in der Auswahlleiste, Bestätigungsdialog, Ergebnismeldung
- `README.md`: Abschnitt "Duplikate" um das Zusammenführen ergänzen
- `server/test/duplicates-merge.test.js` (neu)

**Keine** neue Tabelle und keine neue Spalte: `event_listings` und `duplicate_of` aus der Duplikaterkennung reichen aus.

**Fehlercodes** (für die Meldungen): `not_marked`, `original_missing`, `original_rejected`, `original_not_approved`. Die Texte stehen an einer Stelle im Server.

## 9. Aufgaben

- [x] T1: `mergeEvent` und `clearDuplicate` im Repository mit Tests für alle Fälle aus Abschnitt 5 und die Transaktion (AC-1, AC-3 bis AC-8)
- [x] T2: Admin-Endpunkte und Sammelaktionen mit Tests, auch Zugriffsschutz und Scraper-Wiederholung (AC-9, AC-10, AC-13, AC-14)
- [x] T3: Admin-Oberfläche: Zeilenknöpfe, Sammelaktionen, Bestätigungsdialog, Zusammenfassung (AC-9, AC-11, AC-12)
- [x] T4: README, manuelle Prüfung der Oberfläche mit lokaler Demo-Datenbank (Eventkarte zeigt "Auch bei" nach dem Zusammenführen) (AC-2)
- [ ] T5: Nach dem Deploy: Test an einem echten Fall mit dem Admin (Sie führen aus, ich prüfe danach die öffentliche Seite)

## 10. Testplan

| AC | Prüfung |
|---|---|
| AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | automatisiert, `server/test/duplicates-merge.test.js` gegen das Repository |
| AC-9, AC-10, AC-13, AC-14 | automatisiert über den Router (Sammelaktion mit gemischten Fällen, Aufruf ohne Anmeldung, zweiter Scraper-Lauf über `runSource`) |
| AC-2, AC-11, AC-12 | manuell mit lokaler Demo-Datenbank (Eventkarte, Knopf-Sichtbarkeit, Dialog) |
| T5 | live mit einem echten Paar, öffentliche Seite danach prüfen |

## 11. Entscheidungen (aus dem Review)

1. Zusammenführen lehnt das Event ab (kein Löschen), damit der Scraper es nicht wieder hereinholt.
2. Der Knopf "Kein Duplikat" ist dabei.
3. Ein freigegebenes Event wird nur in ein freigegebenes Original zusammengeführt.

## 12. Änderungsprotokoll

- v1 (2026-11-03): Erster Entwurf; am selben Tag freigegeben, Entscheidungen in Abschnitt 11
