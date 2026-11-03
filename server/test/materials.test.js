// Prüft client/src/data/materials.json gegen die Dateien in
// client/public/materialien/ (AC-10 der v1-Spec, AC-14 der Formate-Spec): Ein toter Eintrag würde im Browser
// nicht als 404 auffallen, weil nginx unbekannte Pfade auf index.html
// zurückfallen lässt.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILE = path.join(__dirname, '../../client/src/data/materials.json');
const FILES_DIR = path.join(__dirname, '../../client/public/materialien');
const BASE_FIELDS = ['id', 'title', 'description', 'category', 'type'];
const TYPES = ['prompt', 'text', 'datei', 'bild', 'link'];
const FILE_EXT = {
  prompt: ['md'],
  text: ['md'],
  datei: ['pdf', 'docx', 'doc', 'xlsx', 'pptx', 'txt', 'csv', 'zip'],
  bild: ['png', 'jpg', 'jpeg', 'webp'],
};
const MAX_IMAGE_BYTES = 800 * 1024;

function validateMaterials(data, filesDir) {
  const errors = [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (categories.length === 0) errors.push('categories fehlt oder ist leer');
  const seen = new Set();
  const missing = (item, field) => typeof item[field] !== 'string' || item[field].trim() === '';

  for (const [i, item] of (data.items || []).entries()) {
    const where = `items[${i}] (${item.id ?? '?'})`;
    for (const field of BASE_FIELDS) {
      if (missing(item, field)) errors.push(`${where}: Pflichtfeld "${field}" fehlt`);
    }
    if (seen.has(item.id)) errors.push(`${where}: doppelte ID`);
    seen.add(item.id);
    if (item.category && !categories.includes(item.category)) {
      errors.push(`${where}: unbekannte Kategorie "${item.category}"`);
    }
    if (item.type && !TYPES.includes(item.type)) {
      errors.push(`${where}: unbekannter Typ "${item.type}"`);
      continue;
    }

    if (item.type === 'link') {
      if (item.file) errors.push(`${where}: Typ "link" darf kein "file" haben`);
      if (missing(item, 'url')) errors.push(`${where}: Pflichtfeld "url" fehlt`);
      else if (!/^https:\/\/[^\s]+$/.test(item.url)) errors.push(`${where}: "url" muss mit https:// beginnen`);
      continue;
    }

    if (item.type === 'bild' && missing(item, 'alt')) errors.push(`${where}: Pflichtfeld "alt" fehlt`);
    if (missing(item, 'file')) {
      if (item.type) errors.push(`${where}: Pflichtfeld "file" fehlt`);
      continue;
    }
    const ext = path.extname(item.file).slice(1).toLowerCase();
    if (item.type && !FILE_EXT[item.type].includes(ext)) {
      errors.push(`${where}: Endung ".${ext}" ist für Typ "${item.type}" nicht erlaubt (${FILE_EXT[item.type].join(', ')})`);
    }
    const resolved = path.resolve(filesDir, item.file);
    const inside = resolved.startsWith(path.resolve(filesDir) + path.sep);
    if (!inside) errors.push(`${where}: Dateipfad liegt außerhalb von materialien/`);
    else if (!fs.existsSync(resolved)) errors.push(`${where}: Datei "${item.file}" existiert nicht`);
    else if (item.type === 'bild' && fs.statSync(resolved).size > MAX_IMAGE_BYTES) {
      errors.push(`${where}: Bild ist größer als 800 KB`);
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

test('AC-14: Validator prüft die Regeln der neuen Formate', () => {
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'materials-'));
  try {
    fs.writeFileSync(path.join(tmp, 'ok.png'), Buffer.alloc(10));
    fs.writeFileSync(path.join(tmp, 'gross.png'), Buffer.alloc(801 * 1024));
    fs.writeFileSync(path.join(tmp, 'text.md'), 'x');
    fs.writeFileSync(path.join(tmp, 'tool.exe'), 'x');
    fs.writeFileSync(path.join(tmp, 'logo.svg'), 'x');
    const base = { description: 'D', category: 'Networking' };
    const good = {
      categories: ['Networking'],
      items: [
        { ...base, id: 'a', title: 'T', type: 'bild', file: 'ok.png', alt: 'Beschreibung' },
        { ...base, id: 'b', title: 'T', type: 'text', file: 'text.md' },
        { ...base, id: 'c', title: 'T', type: 'link', url: 'https://example.com/x' },
      ],
    };
    assert.deepEqual(validateMaterials(good, tmp), []);

    const bad = (item) => validateMaterials({ categories: ['Networking'], items: [{ ...base, title: 'T', id: 'x', ...item }] }, tmp).join('\n');
    assert.match(bad({ type: 'bild', file: 'ok.png' }), /Pflichtfeld "alt" fehlt/);
    assert.match(bad({ type: 'bild', file: 'gross.png', alt: 'a' }), /größer als 800 KB/);
    assert.match(bad({ type: 'bild', file: 'logo.svg', alt: 'a' }), /nicht erlaubt/);
    assert.match(bad({ type: 'datei', file: 'tool.exe' }), /nicht erlaubt/);
    assert.match(bad({ type: 'text', file: 'ok.png' }), /nicht erlaubt/);
    assert.match(bad({ type: 'link' }), /Pflichtfeld "url" fehlt/);
    assert.match(bad({ type: 'link', url: 'http://example.com' }), /https:\/\//);
    assert.match(bad({ type: 'link', url: 'javascript:alert(1)' }), /https:\/\//);
    assert.match(bad({ type: 'link', url: 'https://example.com', file: 'text.md' }), /kein "file"/);
    assert.match(bad({ type: 'text' }), /Pflichtfeld "file" fehlt/);
    assert.match(bad({ type: 'video', file: 'x.mp4' }), /unbekannter Typ/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
