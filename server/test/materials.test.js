// Prüft client/src/data/materials.json gegen die Dateien in
// client/public/materialien/ (AC-10): Ein toter Eintrag würde im Browser
// nicht als 404 auffallen, weil nginx unbekannte Pfade auf index.html
// zurückfallen lässt.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '../../client/src/data/materials.json');
const FILES_DIR = path.join(__dirname, '../../client/public/materialien');
const REQUIRED = ['id', 'title', 'description', 'category', 'type', 'file'];
const TYPES = ['prompt', 'datei'];

function validateMaterials(data, filesDir) {
  const errors = [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (categories.length === 0) errors.push('categories fehlt oder ist leer');
  const seen = new Set();
  for (const [i, item] of (data.items || []).entries()) {
    const where = `items[${i}] (${item.id ?? '?'})`;
    for (const field of REQUIRED) {
      if (typeof item[field] !== 'string' || item[field].trim() === '') {
        errors.push(`${where}: Pflichtfeld "${field}" fehlt`);
      }
    }
    if (seen.has(item.id)) errors.push(`${where}: doppelte ID`);
    seen.add(item.id);
    if (item.category && !categories.includes(item.category)) {
      errors.push(`${where}: unbekannte Kategorie "${item.category}"`);
    }
    if (item.type && !TYPES.includes(item.type)) {
      errors.push(`${where}: unbekannter Typ "${item.type}"`);
    }
    if (item.type === 'prompt' && item.file && !item.file.endsWith('.md')) {
      errors.push(`${where}: Prompts müssen eine .md-Datei sein`);
    }
    if (item.file) {
      const resolved = path.resolve(filesDir, item.file);
      const inside = resolved.startsWith(path.resolve(filesDir) + path.sep);
      if (!inside) errors.push(`${where}: Dateipfad liegt außerhalb von materialien/`);
      else if (!fs.existsSync(resolved)) errors.push(`${where}: Datei "${item.file}" existiert nicht`);
    }
  }
  return errors;
}

test('AC-10: materials.json passt zu den Dateien in client/public/materialien', () => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  assert.deepEqual(validateMaterials(data, FILES_DIR), []);
});

test('AC-10: Validator erkennt fehlende Datei, doppelte ID, unbekannte Kategorie und fehlende Pflichtfelder', () => {
  const item = {
    id: 'a', title: 'T', description: 'D', category: 'Networking', type: 'prompt', file: 'gibt-es-nicht.md',
  };
  const data = {
    categories: ['Networking'],
    items: [item, { ...item, category: 'Unbekannt' }, { id: 'b', title: 'ohne Rest' }],
  };
  const errors = validateMaterials(data, FILES_DIR).join('\n');
  assert.match(errors, /existiert nicht/);
  assert.match(errors, /doppelte ID/);
  assert.match(errors, /unbekannte Kategorie/);
  assert.match(errors, /Pflichtfeld "description" fehlt/);
});

test('AC-10: Validator lässt eine vorhandene Datei durch und blockt Pfade außerhalb des Ordners', () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'materials-'));
  try {
    fs.writeFileSync(path.join(tmp, 'ok.md'), 'Text');
    const base = { title: 'T', description: 'D', category: 'Networking', type: 'prompt' };
    const good = { categories: ['Networking'], items: [{ ...base, id: 'a', file: 'ok.md' }] };
    assert.deepEqual(validateMaterials(good, tmp), []);
    const bad = { categories: ['Networking'], items: [{ ...base, id: 'a', file: '../ok.md' }] };
    assert.match(validateMaterials(bad, tmp).join('\n'), /außerhalb/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
