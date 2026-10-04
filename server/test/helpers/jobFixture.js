// Gültige Stellen-Einreichung als Ausgangspunkt für Tests; einzelne Felder
// werden pro Test überschrieben.
const { dimensions } = require('../../src/db/vibe');

function fullVibe(value = 3) {
  return Object.fromEntries(dimensions.map((d) => [d.key, value]));
}

function makeJobInput(overrides = {}) {
  return {
    title: 'Praktikum Strategy',
    company_name: 'Testfirma GmbH',
    job_type: 'praktikum',
    apply_url: 'https://example.com/bewerben',
    vibe: fullVibe(),
    consent: true,
    ...overrides,
  };
}

module.exports = { fullVibe, makeJobInput };
