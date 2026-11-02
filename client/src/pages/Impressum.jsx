// Anbieterangaben stimmen mit dem Impressum auf laurenz-polanski.de überein.
// Bei Änderungen (Anschrift, Kontakt) beide Seiten anpassen.
const CONTACT = 'consulting@laurenz-polanski.de';

export default function Impressum() {
  return (
    <article className="legal-page">
      <h1>Impressum</h1>
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>

      <h2>Diensteanbieter</h2>
      <p>
        Laurenz Polanski
        <br />
        Einzelunternehmen
        <br />
        Maxim-Gorki-Straße 84
        <br />
        09599 Freiberg
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        <br />
        LinkedIn:{' '}
        <a href="https://www.linkedin.com/in/laurenz-polanski-535494284" target="_blank" rel="noopener noreferrer">
          linkedin.com/in/laurenz-polanski
        </a>
      </p>

      <h2>Umsatzsteuer</h2>
      <p>Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer erhoben (Kleinunternehmerregelung).</p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Laurenz Polanski, Maxim-Gorki-Straße 84, 09599 Freiberg</p>

      <h2>Herkunft der Inhalte</h2>
      <p>
        Die Events und Stellen auf Student Hub stammen aus Einsendungen von Nutzerinnen und Nutzern sowie aus öffentlich
        zugänglichen Seiten der jeweiligen Veranstalter und Arbeitgeber, die automatisch ausgelesen werden. Alle Einträge
        werden vor der Veröffentlichung gesichtet, auf inhaltliche Richtigkeit werden sie nicht im Einzelnen geprüft.
        Maßgeblich sind immer die Angaben des Veranstalters bzw. Arbeitgebers über den jeweils verlinkten Originalauftritt.
      </p>
      <p>
        Wer eine Rechtsverletzung oder einen fehlerhaften Eintrag bemerkt, schreibt bitte an{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Betroffene Einträge werden umgehend geprüft und bei Bedarf entfernt.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen
        Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte
        oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
        Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
        allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
        Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden
        wir diese Inhalte umgehend entfernen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter (Veranstalter, Arbeitgeber, Anmeldeseiten), auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für
        die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die
        verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte
        waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten
        ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
        Rechtsverletzungen werden wir derartige Links umgehend entfernen.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
        Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des
        Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Logos und Marken
        Dritter gehören den jeweiligen Inhabern.
      </p>
    </article>
  );
}
