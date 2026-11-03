import { Marked } from 'marked';

// Markdown aus den Materialien-Dateien -> HTML. Die Inhalte kommen aus dem
// Repo, trotzdem wird nichts Rohes durchgelassen:
// - HTML im Markdown wird als sichtbarer Text ausgegeben, nicht als Markup
// - Links nur mit http(s) oder mailto, sonst bleibt nur der Linktext
// - Bilder werden nicht geladen (würde Anfragen an Dritte auslösen), es
//   erscheint nur der Alt-Text
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeHref(href) {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      if (!isSafeHref(href)) return inner;
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    },
    image({ text }) {
      return escapeHtml(text);
    },
  },
});

export function renderMarkdown(source) {
  return marked.parse(source, { async: false });
}
