# Spec: Statistik-Dashboard lesbar und aussagekräftig machen

- **Status:** In Review (Phase 1 umgesetzt)
- **Version:** 1
- **Autor:** Laurenz Polanski (mit Claude)
- **Erstellt:** 2026-11-16
- **Approved:** 2026-11-16
- **Baut auf:** `2026-11-03-site-analytics.md` (Erfassung bleibt wie dort beschlossen: keine Cookies, keine IP/User-Agent-Speicherung)

## 1. Problem

Das Dashboard unter Admin → Statistik hat heute drei Karten, ein Balkendiagramm und eine Seitentabelle. Konkret fehlt:

1. **Besucher pro Tag sind nicht ablesbar.** Das Diagramm hat weder Achsen noch Beschriftung und zeigt nur die Aufrufe. Die Besucherzahl pro Tag steckt in einem Tooltip, den man per Maus-Hover öffnen muss (am Handy gar nicht).
2. **Die Hauptzahl ist missverständlich.** Die Karte "Besucher (Summe der Tage)" addiert die Tagesbesucher. Wer an drei Tagen kommt, zählt dreimal. Das ist ehrlich erklärt, aber nicht das, was man mit "Besucher" meint.
3. **Kein Bezug.** Man sieht nie, ob 40 Besucher viel oder wenig sind: kein Vergleich mit der Vorperiode, kein Durchschnitt pro Tag, keine Markierung von Wochenenden, und der heutige, noch unvollständige Tag sieht aus wie ein schwacher Tag.
4. **Keine Aussage über Verhalten.** Nur eine durchschnittliche Verweildauer (Ausreißer verzerren sie stark), keine Aufrufe pro Besucher, keine Seitengruppen (Events, Jobs, Materialien), keine Tageszeit.
5. **Keine Rückschau über 90 Tage hinaus**, obwohl die Tageswerte rund 13 Monate gespeichert werden.

## 2. Ziel

Auf einen Blick beantworten: *Wie viele Menschen waren heute, gestern und im Zeitraum da, wie entwickelt sich das, was schauen sie an und wie lange bleiben sie?* Alles ohne neue Datenschutz-Einschränkungen in Phase 1 und 2.

## 3. Was Phase für Phase passiert

### Phase 1: Darstellung (nur Auswertung, keine neue Datenerfassung, keine Migration)

Funktioniert sofort mit den vorhandenen Daten, auch rückwirkend.

- **Tageswerte lesbar:** Diagramm mit Y-Achse, Datumsbeschriftung (Wochentag + Tag) und **Zahlenwerten**. Zwei Reihen: Besucher (kräftig) und Aufrufe (hell). Bei bis zu 14 Tagen stehen die Besucherzahlen direkt über den Balken, bei längeren Zeiträumen gruppiert nach Woche. Zusätzlich eine **Tabelle "Pro Tag"** (aufklappbar) mit Datum, Besuchern, Aufrufen, Aufrufen je Besucher, Ø Verweildauer. Sie ersetzt den Hover-Tooltip und funktioniert auch mobil.
- **Heute eigens markiert:** Der laufende Tag ist gestrichelt und mit "läuft noch" beschriftet und fließt nicht in Durchschnitt und Vergleich ein.
- **Wochenenden** sind im Diagramm leicht schattiert.
- **Kennzahlen-Karten neu:**
  - *Besucher heute* und *gestern*
  - *Ø Besucher pro Tag* (ohne heute)
  - *Spitzentag* (Datum + Wert)
  - *Besucher im Zeitraum (Summe der Tage)* bleibt, mit klarer Zusatzzeile "Mehrfachbesuche an verschiedenen Tagen zählen mehrfach"
  - *Aufrufe pro Besucher*
  - *Verweildauer*
  - Jede Karte zeigt die **Veränderung zur Vorperiode** (z. B. "+18 % zu den 7 Tagen davor"), farblich neutral (Pfeil plus Prozent, kein Rot/Grün-Urteil).
- **Seitengruppen:** Statt nur einzelner Pfade eine Gruppierung *Events* (`/`), *Stellen* (`/jobs`, `/jobs/:id`), *Materialien* (`/materialien`, `/materialien/:id`), *Einreichen*, *Rechtliches*. Darunter bleibt die Pfadtabelle, Detailseiten werden zu "Stelle", "Material" zusammengefasst, mit Liste der Top 10 Einzelseiten.
- **Wochentagsmuster:** Durchschnittliche Besucher pro Wochentag (aus den Tageswerten berechnet).
- **Zeitraum:** *Heute*, 7, 30, 90 Tage, **12 Monate** (monatlich zusammengefasst) und ein **eigener Zeitraum** (von/bis).
- **Export:** Button "Als CSV" für die Tageswerte (Datum, Besucher, Aufrufe, Verweildauer), nur im Admin und nur Aggregate.
- **Layout:** Karten und Tabellen brechen mobil sauber um, Zahlen werden im deutschen Format (Tausenderpunkt, Komma) gezeigt.

### Phase 2: neue Tagesaggregate (kleine Migration v8, kein Datenschutz-Unterschied)

Es werden weiter nur Zähler pro Tag gespeichert, nie etwas, das eine Person oder ein Gerät identifiziert. Die Werte gibt es erst ab dem Ausrollen (nicht rückwirkend); im Dashboard erscheint bis dahin "ab TT.MM. verfügbar".

- **Verweildauer-Verteilung** statt nur Mittelwert: Anteile der Aufrufe mit unter 10 s, 10 bis 60 s, 1 bis 5 min, über 5 min. Zeigt, ob viele nur kurz vorbeischauen.
- **Einzelaufruf-Besucher:** Zahl der Besucher pro Tag, die nur eine Seite aufgerufen haben (Näherung für Absprungrate).
- **Tageszeit:** Aufrufe pro Stunde (Europe/Berlin), aggregiert pro Tag. Zeigt, wann Studierende die Seite nutzen.
- **Gerätetyp grob:** *Handy / Tablet / Desktop*. Der Server leitet die Klasse beim Eintreffen aus dem User-Agent ab und speichert **nur die Klasse**, nicht den User-Agent. Der Tageshash bleibt unverändert.

### Phase 3: nur nach Ihrer Entscheidung (berührt die Datenschutzerklärung)

Diese beiden Punkte waren in der ersten Spec ausdrücklich ausgeschlossen. Sie sind für einen Aggregator aber die aussagekräftigsten Zahlen:

- **A: Klicks nach außen:** Wie oft wird "Zur Anmeldung" bei einem Event, "Bewerben" bei einer Stelle oder ein Material-Download angeklickt (Zähler pro Tag und Ziel-Seite, keine Person). Damit sieht man, welche Events wirklich Interesse wecken, nicht nur Aufrufe.
- **B: Herkunft nur als Domain:** Woher kommen Besucher (z. B. `linkedin.com`, `google.com`, direkt)? Gespeichert würde nur die Domain, nie die volle URL, ohne Pfad und Query-String. Alternativ lässt sich die Herkunft über UTM-Parameter in selbst gesetzten Links (z. B. `?ref=linkedin`) messen, ganz ohne den Referrer zu lesen.

Beides würde den Abschnitt "Besucherstatistik" in der Datenschutzerklärung ergänzen. Rechtlich bleibt es nach meiner Einschätzung im Rahmen (keine Geräteinformationen, kein Personenbezug), aber, wie bei der ersten Spec, keine Rechtsberatung.

## 4. Non-Goals

- Keine Wiedererkennung von Besuchern über mehrere Tage (bleibt bewusst unmöglich, daher auch **kein** echter "Besucher im Zeitraum"-Wert und keine Neu-/Wiederkehrende-Auswertung)
- Kein Fingerprinting, keine Cookies, kein Browser-Speicher
- Keine Daten an Dritte, kein externer Analysedienst
- Keine Echtzeit-Anzeige "gerade online"
- Kein Länder- oder Städte-Tracking
- Kein neues Diagramm-Framework; das Diagramm wird mit SVG/CSS im bestehenden Stil gebaut (keine neue Abhängigkeit)

## 5. Akzeptanzkriterien

**Phase 1**
- AC-1: Für jeden Tag des gewählten Zeitraums sind Besucher und Aufrufe **ohne Hover** ablesbar (Beschriftung am Balken bei bis zu 14 Tagen, sonst Tabelle "Pro Tag").
- AC-2: Das Diagramm hat Achsenbeschriftung, Wochenenden sind erkennbar, der heutige Tag ist als "läuft noch" markiert und fließt nicht in Ø und Vergleich ein.
- AC-3: Karten *heute*, *gestern*, *Ø pro Tag*, *Spitzentag*, *Aufrufe pro Besucher* zeigen korrekte Werte (gegen eine Testdatenbank mit bekannten Zahlen geprüft).
- AC-4: Jede Karte mit Vorperiode zeigt Prozentveränderung; ist die Vorperiode leer oder zu kurz, steht "kein Vergleich" statt einer Zahl oder Division durch null.
- AC-5: Die Seitengruppen summieren sich auf die Gesamtzahl der Aufrufe (Test).
- AC-6: Zeiträume *Heute*, 7, 30, 90 Tage, 12 Monate und eigener Zeitraum liefern jeweils die erwartete Zahl an Zeilen/Balken. Ein eigener Zeitraum ist auf höchstens 400 Tage und auf bereits vorhandene Daten begrenzt.
- AC-7: CSV-Export enthält je Tag genau die Werte der Tabelle und ist nur mit Admin-Zugang abrufbar (401 ohne).
- AC-8: Keine neue Datenerfassung, keine Migration; Server-Tests für die erweiterte `getSummary`-Antwort laufen mit bekannten Zählerständen.
- AC-9: **UI-Tests (Playwright, mobil + Desktop):** Der Reiter *Statistik* läuft mit Testdaten (ein Tag mit sehr hohen Zahlen, 90 Tage, leere Datenbank) weder über den Rand noch mit Konsolenfehlern; leerer Zustand zeigt "Noch keine Daten".

**Phase 2**
- AC-10: Migration v8 ist rein additiv (neue Spalten/Tabelle), bestehende Daten bleiben unverändert, Migrationstest vorhanden.
- AC-11: Gerätetyp, Stunde und Einzelaufruf-Besucher werden gezählt, ohne dass User-Agent oder IP irgendwo gespeichert werden (Test prüft das Datenbankschema und die Zeilen).
- AC-12: Fehlende Altdaten werden als "ab TT.MM. verfügbar" angezeigt, nie als 0 ausgegeben.

**Phase 3 (nur bei Freigabe)**
- AC-13: Klick-Zähler enthalten nur Zielseite und Tageszähler; Datenschutzerklärung ist angepasst.
- AC-14: Herkunft speichert höchstens die Domain (keine Pfade, keine Query-Strings).

## 6. Design (Skizze)

**Backend**
- `statsRepo.getSummary(days)` liefert zusätzlich: `perDay[].avgSeconds`, `previous` (gleiche Struktur für die Vorperiode), `groups`, `weekday`, `today` getrennt von den abgeschlossenen Tagen. Neue Parameter `from`/`to` für den eigenen Zeitraum, `granularity` (`day` | `week` | `month`) für 12 Monate.
- `GET /api/admin/stats?days=…` bleibt rückwärtskompatibel; neu `from`, `to`; `GET /api/admin/stats.csv`.
- Phase 2: Migration v8 (`stats_daily` um Spalten für Dauer-Buckets und Einzelaufruf-Besucher, neue Tabelle `stats_hourly(day, hour, views)` und `stats_device(day, device, views)`); `recordView` leitet Stunde und Gerätetyp ab; die Verdichtung (Nachtlauf) schreibt sie in die Tagestabellen.

**Frontend**
- `StatsAdmin.jsx` wird in kleine Komponenten zerlegt: `StatsCards`, `StatsChart` (SVG), `StatsDayTable`, `StatsGroups`, `RangePicker`. Reine Rechenfunktionen (Prozentveränderung, Wochentag, Gruppierung) kommen in `client/src/lib/statsMath.js` mit eigenen Node-Tests.
- Farben und Schriftgrößen aus den bestehenden CSS-Variablen; Zahlen mit `Intl.NumberFormat('de-DE')`.

**Skizze (Phase 1, Desktop)**

```
Besucherstatistik          [Heute] [7 Tage] [30 Tage] [90 Tage] [12 Monate] [Zeitraum…]  [CSV]

 Heute   Gestern   Ø/Tag   Spitzentag     Aufrufe/Besucher   Verweildauer
  23       41      35       58 (Mi 11.11.)    2,4              1 Min 12 s
 −       +8 %*     +18 %*    –                 +0,2             −6 s       (* zur Vorperiode)

 Besucher (kräftig) und Aufrufe (hell) pro Tag
  60 |      ▇
  40 |  ▇   ▇  ▇        ▇   ▇  ▇ ┆
  20 |  ▇ ▇ ▇  ▇ ▇  ░░  ▇   ▇  ▇ ┆ (heute, läuft noch)
     Mo Di Mi Do Fr Sa So Mo Di Mi
  ▸ Pro Tag als Tabelle anzeigen

 Wo schauen sie hin?   Events 62 %  | Stellen 21 % | Materialien 14 % | Sonstiges 3 %
 Wochentage            Mo ▇▇▇  Di ▇▇▇▇  Mi ▇▇▇▇▇ …
 Top-Seiten            Tabelle wie bisher
```

## 7. Aufgaben

- [x] T1: `statsMath.js` (Vorperiode, Prozentveränderung, Wochentag, Gruppierung) mit Tests
- [x] T2: Backend: `getSummary` erweitern (`previous`, `today`, `groups`, `weekday`, `from/to`, Granularität) und CSV-Route mit Tests (AC-3 bis AC-8)
- [x] T3: Frontend: Diagramm mit Achsen und Werten, Tagestabelle, neue Karten, Zeitraum-Auswahl (AC-1, AC-2, AC-6)
- [x] T4: Seitengruppen, Wochentagsmuster, CSV-Button (AC-5, AC-7)
- [x] T5: e2e: Stats-Testdaten in `e2e/support/seed.js` (hohe Zahlen, 90 Tage, leere Variante) und UI-Tests für den Reiter (AC-9)
- [ ] T6: Phase 2: Migration v8, Erfassung von Stunde, Gerätetyp, Einzelaufruf-Besucher, Verweildauer-Buckets, Anzeige mit "ab TT.MM." (AC-10 bis AC-12)
- [ ] T7: Datenschutzerklärung und README anpassen (Phase 2: Gerätetyp als grobe Klasse, kein User-Agent gespeichert)
- [ ] T8: Phase 3 nur nach Freigabe (AC-13, AC-14)
- [ ] T9: Nach dem Deploy: Zahlen mit den bekannten Besucherzahlen vergleichen

Vorschlag für die PRs: **PR 1 = T1 bis T5 (Phase 1)**, PR 2 = T6/T7 (Phase 2), PR 3 = T8 falls gewünscht.

## 8. Testplan

| Aufgabe | Prüfung |
|---|---|
| T1, T2 | Server-/Node-Tests mit festen Zählerständen, Vorperiode leer, Tageswechsel, Sommerzeit |
| T3, T4 | Client-Tests für Rechenfunktionen, Sichtprüfung lokal mit Demo-Datenbank |
| T5 | Playwright mobil + Desktop, Überlauf und Konsolenfehler |
| T6 | Migrations- und Schematest, Test "kein User-Agent/IP in Tabellen" |
| T9 | live, Abgleich mit Schätzung |

## 9. Risiken

- **Kleine Zahlen:** Bei wenigen Besuchern schwanken Prozentwerte stark. Darum zeigt das Dashboard unter 10 Besuchern in der Vorperiode "kein Vergleich" statt eines Prozentwerts.
- **Neustart-Ungenauigkeit:** Neues Tagessalz nach Serverneustart kann einen Besucher am selben Tag doppelt zählen (aus der Ursprungsspec bekannt). Jedes Deploy ist ein Neustart; bei vielen Deploys an einem Tag liegt die Besucherzahl leicht zu hoch. Im Dashboard weiterhin als Schätzung gekennzeichnet.
- **Gerätetyp aus User-Agent** ist grob; unbekannte Agenten landen in "Sonstige".

## 10. Offene Fragen für das Review

1. **Phase 1 zuerst, Phase 2 danach** (entschieden bei der Freigabe).
2. **Phase 3 A (Klicks auf Anmelden/Bewerben/Download):** gewünscht? Das wäre der aussagekräftigste Wert pro Event.
3. **Phase 3 B (Herkunft):** gewünscht, und wenn ja als Domain-Erfassung oder lieber über eigene `?ref=`-Links (ohne den Referrer zu lesen)?
4. **Gerätetyp** (Handy/Tablet/Desktop) in Phase 2: aufnehmen?
5. **Zeitraum 12 Monate und eigener Zeitraum:** reicht Ihnen "Monate" als Granularität, oder brauchen Sie Wochen?

## 11. Änderungsprotokoll

- v1 (2026-11-16): Erstes Konzept.
- v1.1 (2026-11-16): Freigegeben, Phase 1 zuerst, alle Vorschläge übernommen (Phase 2 danach inkl. Gerätetyp, Granularität Monate; Phase 3 nicht jetzt). Umsetzung Phase 1 (T1 bis T5): Der Zeitraum "Heute" entfällt, weil die Karten "Besucher heute" und "gestern" das abdecken und ohne Stundenwerte ein Einzeltag nur ein Balken wäre. Eigener Zeitraum ist auf 400 Tage begrenzt (nicht auf vorhandene Daten gekürzt); länger als 120 Tage wird monatlich dargestellt.
