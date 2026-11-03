import { Link } from 'react-router-dom';

const CONTACT = 'consulting@laurenz-polanski.de';

export default function Datenschutz() {
  return (
    <article className="legal-page">
      <h1>Datenschutz</h1>
      <p>
        Student Hub ist ein privates, nicht-kommerzielles Projekt. Es gibt keine Nutzerkonten, kein Tracking und keine
        Auswertung durch KI.
      </p>

      <h2>Verantwortlich und Kontakt für Auskunft und Löschung</h2>
      <p>
        Laurenz Polanski (Anschrift siehe <Link to="/impressum">Impressum</Link>). Fragen zum Datenschutz, Auskunft über gespeicherte Daten oder Löschung: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <h2>Welche Daten werden gespeichert?</h2>
      <h3>Events</h3>
      <p>
        Öffentlich zugängliche Veranstaltungsinfos (Titel, Datum, Ort, Link) sowie bei Einreichungen optional der Name der
        einreichenden Person.
      </p>
      <h3>Stellen (Jobs & Praktika)</h3>
      <ul>
        <li>Angaben zur Stelle (Firma, Beschreibung, Rahmenbedingungen, Vibe-Einschätzung, Antworten auf Leitfragen).</li>
        <li>
          Optional: Name und Empfehlungstext der empfehlenden Person sowie Name, Rolle und E-Mail-Adresse einer
          Ansprechperson. Die E-Mail-Adresse wird nur mit ausdrücklicher Einwilligung gespeichert und angezeigt.
        </li>
        <li>Optional: Name der einreichenden Person. Er dient nur der Moderation und wird nicht öffentlich angezeigt.</li>
      </ul>
      <p>
        Wer eine Stelle einreicht, bestätigt, dass die genannten Personen mit der Veröffentlichung einverstanden sind
        (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung kann jederzeit per E-Mail an die oben genannte Adresse widerrufen
        werden, die Angaben werden dann entfernt.
      </p>

      <h2>Besucherstatistik</h2>
      <p>
        Zur Reichweitenmessung zählen wir Seitenaufrufe und die Verweildauer, ganz ohne Cookies, ohne Speicherung im
        Browser und ohne Dienste von Drittanbietern. Die Messung läuft auf unserem eigenen Server.
      </p>
      <ul>
        <li>
          Gespeichert werden der aufgerufene Seitenbereich (z. B. „Materialien“), das Datum und die Verweildauer. Nicht
          gespeichert werden IP-Adresse, Browserkennung, Herkunftsseite oder Standort.
        </li>
        <li>
          Um einen Besucher am selben Tag nur einmal zu zählen, wird aus IP-Adresse und Browserangaben kurzzeitig ein
          Kennwert berechnet. Er nutzt einen zufälligen Schlüssel, der nur im Arbeitsspeicher liegt und täglich
          wechselt. Ab dem nächsten Tag lässt sich der Kennwert deshalb keiner Person mehr zuordnen und nicht mit
          anderen Tagen verknüpfen.
        </li>
        <li>
          Einzelne Aufrufe werden nach spätestens zwei Tagen zu Tageswerten zusammengefasst, die Kennwerte werden dabei
          gelöscht. Die Tageswerte löschen wir nach etwa 13 Monaten.
        </li>
        <li>
          Wenn Ihr Browser „Do Not Track“ oder „Global Privacy Control“ sendet, wird nichts gemessen. Der Admin-Bereich
          wird nicht gemessen.
        </li>
      </ul>
      <p>
        Rechtsgrundlage ist unser berechtigtes Interesse an einer bedarfsgerechten Gestaltung und Weiterentwicklung der
        Seite (Art. 6 Abs. 1 lit. f DSGVO). Da keine Informationen auf Ihrem Gerät gespeichert oder ausgelesen werden,
        ist keine Einwilligung nötig.
      </p>

      <h2>Speicherdauer</h2>
      <p>
        Stellen werden nach Ablauf der Bewerbungsfrist bzw. spätestens 90 Tage nach der letzten Aktualisierung nicht mehr
        angezeigt. Auf Anfrage werden sie vollständig gelöscht.
      </p>

      <h2>Hosting</h2>
      <p>
        Die Website wird auf einem Server von Google Cloud betrieben. Beim Aufruf werden technisch notwendige Daten
        (z. B. IP-Adresse) in Server-Logs verarbeitet. Die Schriftart wird von diesem Server selbst ausgeliefert, es werden keine Schriften von Drittanbietern geladen.
      </p>
    </article>
  );
}
