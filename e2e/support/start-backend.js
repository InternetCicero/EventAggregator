// Startet das echte Backend auf einer frischen, temporären Datenbank mit
// Testdaten (inklusive absichtlich extremer Texte). Nur für die UI-Tests.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-db-'));
process.env.EVENTS_DB_PATH = path.join(dir, 'events.db');
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'e2e-test';

const { seed } = require('./seed');
const app = require('../../server/src/app');

seed();
const port = process.env.E2E_API_PORT || 4100;
app.listen(port, () => console.log(`E2E-Backend auf Port ${port}`));
