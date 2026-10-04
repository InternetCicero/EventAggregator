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
        Laurenz Polanski. Fragen zum Datenschutz, Auskunft über gespeicherte Daten oder Löschung: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
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

      <h2>Speicherdauer</h2>
      <p>
        Stellen werden nach Ablauf der Bewerbungsfrist bzw. spätestens 90 Tage nach der letzten Aktualisierung nicht mehr
        angezeigt. Auf Anfrage werden sie vollständig gelöscht.
      </p>

      <h2>Hosting</h2>
      <p>
        Die Website wird auf einem Server von Google Cloud betrieben. Beim Aufruf werden technisch notwendige Daten
        (z. B. IP-Adresse) in Server-Logs verarbeitet. Schriftarten werden von Google Fonts geladen.
      </p>
    </article>
  );
}
