// Stichwort-basierte Einordnung von Titel -> Kategorie und Ort -> Format.
// Bewusst ohne KI/externe API: feste, nachvollziehbare Regeln. Dient sowohl
// dem Scraper (pro gefundenem Event) als auch der einmaligen Migration
// bestehender Events auf die neue Kategorie-Liste (siehe db/index.js).
//
// Die meisten Stichwörter werden ohne \b-Wortgrenzen gesucht (einfache
// Groß-/Kleinschreibungs-unabhängige Teilstring-Suche): Deutsch bildet
// Komposita ohne Leerzeichen ("Cocktailworkshop", "Steuerberaterexamen")
// und flektiert Adjektive ("virtuelles"), wodurch \b…\b an genau den Stellen
// scheitert, an denen die Wörter in echten Titeln auftauchen. Nur sehr kurze,
// mehrdeutige Kürzel (vc, ey, bcg) bekommen \b, damit sie nicht versehentlich
// als Teil eines anderen Wortes zünden.
//
// Reihenfolge der Regeln ist Priorität: die erste passende Regel gewinnt.
// Eine Quelle kann z.B. "Consulting" als Standard-Kategorie haben, aber ein
// einzelner Titel wie "Afterwork with HHL" wird trotzdem als "Networking"
// erkannt, weil das Format-Stichwort im Titel Vorrang vor der Branche hat.
const CATEGORY_RULES = [
  {
    category: 'Hackathon',
    pattern: /hackathon|buildathon|hacklab|hack[- ]?night|hack[- ]?sprint/i,
  },
  {
    category: 'Workshop & Case Study',
    pattern: /case[- ]?stud|case[- ]?interview|probe-?case|crack the case|workshop|bootcamp/i,
  },
  {
    category: 'Networking',
    pattern: /afterwork|after-work|networking|netzwerkabend|netzwerktreffen|netzwerk|stammtisch|meet[- ]?up|mixer|cocktail|dinner/i,
  },
  {
    category: 'Start-up & Venture Capital',
    pattern: /start-?up|venture capital|\bvc\b|accelerator|incubator|pitch|spinlab|gründer/i,
  },
  {
    category: 'Banking & Finance',
    pattern: /bank|finance|finanz|steuerberater|wirtschaftsprüfung|investment banking|asset management|private equity|\baudit\b|aktuar/i,
  },
  {
    category: 'Messen & Karrieretage',
    pattern: /messe|jobmesse|firmenkontaktmesse|karrieretag|career\s*(?:day|fair)/i,
  },
  {
    category: 'Consulting',
    pattern: /consulting|berat|mckinsey|\bbcg\b|\bbain\b|deloitte|\bpwc\b|\bkpmg\b|\bey\b|strategy&|strategyand|roland berger|oliver wyman|capgemini|\bzeb\b/i,
  },
];

function classifyCategory(title, fallbackCategory) {
  const rule = CATEGORY_RULES.find((r) => r.pattern.test(title));
  return rule ? rule.category : fallbackCategory;
}

const ONLINE_PATTERN = /online|virtuell|virtual|webinar|zoom|webcast|remote|digital/i;

function inferFormat(location) {
  if (!location) return null;
  return ONLINE_PATTERN.test(location) ? 'online' : 'onsite';
}

module.exports = { classifyCategory, inferFormat, CATEGORY_RULES };
