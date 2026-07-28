/**
 * A deliberately small Markdown subset, used for blog bodies.
 *
 * This is the *only* place blog Markdown becomes HTML. The rendered string is
 * returned by the API and consumed unchanged by both the React page and the
 * crawler prerender — copying the rules into the frontend would let the two
 * drift, which has bitten this codebase before (see the SEO architecture notes
 * in CLAUDE.md).
 *
 * Safe by construction: every character is HTML-escaped *first*, then the
 * markup is built from that escaped text. Admin-typed `<script>` is inert
 * because it became `&lt;script&gt;` before any tag was produced. Nothing here
 * passes raw HTML through, so no sanitiser is needed.
 *
 * Supported: ## / ### headings, paragraphs, - and 1. lists, **bold**,
 * *italic*, [links](url), > blockquotes, --- rules, single-line breaks.
 */

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only schemes that cannot execute script. `javascript:` and `data:` URLs are
 * dropped, which is the one genuine injection route a link could offer.
 */
function safeHref(url: string): string | null {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return null;
  const ok =
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^tel:/i.test(trimmed) ||
    // Site-relative links to our own pages.
    /^\/[^/]/.test(trimmed) ||
    trimmed === '/';
  return ok ? trimmed : null;
}

/** Inline formatting, applied to already-escaped text. */
function inline(escaped: string): string {
  let out = escaped;

  // Links first, so emphasis markers inside a URL are left alone.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, url: string) => {
    // The URL arrives escaped; &amp; is correct inside an href, but the scheme
    // check needs the plain form.
    const href = safeHref(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    const external = /^https?:\/\//i.test(href) && !/sanhoti\.org/i.test(href);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(href)}"${attrs}>${label}</a>`;
  });

  // Bold before italic: ** would otherwise be consumed as two * markers.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,!?)]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,!?)]|$)/g, '$1<em>$2</em>');

  return out;
}

/** Split the source into blank-line-separated blocks, preserving order. */
function blocks(markdown: string): string[] {
  return String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);
}

/**
 * Render a Markdown blog body to HTML.
 *
 * Headings start at h2 — the page supplies the single h1, and a body that
 * emits its own h1 would give the page two competing top-level headings.
 */
export function renderMarkdown(markdown: string): string {
  const html: string[] = [];

  for (const block of blocks(markdown)) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      html.push('<hr />');
      continue;
    }

    // Heading — a whole block that is a single ### line
    const heading = block.match(/^(#{2,4})\s+(.+)$/);
    if (heading && lines.length === 1) {
      const level = Math.min(heading[1].length, 4); // ## -> h2, ### -> h3, #### -> h4
      html.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    // A lone "# Heading" is almost always meant as a section title, not a
    // second page h1 — demote it rather than silently rendering a literal "#".
    const h1 = block.match(/^#\s+(.+)$/);
    if (h1 && lines.length === 1) {
      html.push(`<h2>${inline(escapeHtml(h1[1].trim()))}</h2>`);
      continue;
    }

    // Bulleted list
    if (lines.every(l => /^[-*+]\s+/.test(l))) {
      const items = lines
        .map(l => `<li>${inline(escapeHtml(l.replace(/^[-*+]\s+/, '')))}</li>`)
        .join('');
      html.push(`<ul>${items}</ul>`);
      continue;
    }

    // Numbered list
    if (lines.every(l => /^\d+[.)]\s+/.test(l))) {
      const items = lines
        .map(l => `<li>${inline(escapeHtml(l.replace(/^\d+[.)]\s+/, '')))}</li>`)
        .join('');
      html.push(`<ol>${items}</ol>`);
      continue;
    }

    // Blockquote
    if (lines.every(l => /^>\s?/.test(l))) {
      const text = lines.map(l => l.replace(/^>\s?/, '')).join(' ');
      html.push(`<blockquote><p>${inline(escapeHtml(text))}</p></blockquote>`);
      continue;
    }

    // Paragraph — single newlines inside become <br>, matching what the admin
    // sees in the editor.
    const paragraph = lines.map(l => inline(escapeHtml(l))).join('<br />');
    html.push(`<p>${paragraph}</p>`);
  }

  return html.join('\n');
}

/**
 * Markdown reduced to readable plain text — for meta descriptions, card
 * summaries and og:description, where markup would show up as literal
 * asterisks in the search result.
 */
export function stripMarkdown(markdown: string, limit = 0): string {
  const text = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limit || text.length <= limit) return text;
  // Cut on a word boundary so the description does not end mid-word.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Rough reading time in whole minutes, minimum 1. Shown on the post header. */
export function readingTimeMinutes(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
