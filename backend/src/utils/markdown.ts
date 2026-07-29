/**
 * Minimal, dependency-free Markdown renderer for News bodies.
 *
 * SECURITY MODEL (design B3): stored XSS here would be a full compromise,
 * since admins hold wallet controls. The defense is ordering, not filtering:
 *
 *   1. Escape EVERY html-significant character in the raw input first.
 *   2. Only then convert markdown syntax into a fixed set of tags.
 *
 * Because step 1 runs first, no attacker-controlled `<` ever survives into the
 * output - a pasted `<script>` or `<img onerror=…>` is inert text by the time
 * any tag is introduced. That is strictly safer than trying to blacklist
 * dangerous HTML after the fact, and it is why there is no raw-HTML
 * passthrough. Do not "improve" this by allowing raw HTML through.
 *
 * URLs get their own check: only http(s) and site-relative are emitted, so
 * `javascript:` and `data:` can never reach an href or src.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ESCAPES[c]);
}

/** http(s) or site-relative only. Everything else becomes a dead link. */
function safeUrl(url: string): string | null {
  const v = (url || '').trim();
  if (!v) return null;
  if (v.startsWith('/') && !v.startsWith('//')) return v;   // site-relative
  if (/^https?:\/\//i.test(v)) return v;
  return null;
}

/** Images must be same-origin (no SSRF, no mixed content, no tracking pixels). */
function safeImageSrc(url: string): string | null {
  const v = (url || '').trim();
  return v.startsWith('/') && !v.startsWith('//') ? v : null;
}

/** Inline spans. Input here is ALREADY html-escaped. */
function renderInline(text: string): string {
  let out = text;

  // Images before links: ![alt](src) would otherwise match the link rule.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const safe = safeImageSrc(src);
    return safe ? `<img src="${safe}" alt="${alt}" loading="lazy">` : alt;
  });

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safe = safeUrl(href);
    if (!safe) return label;
    const external = /^https?:\/\//i.test(safe);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safe}"${attrs}>${label}</a>`;
  });

  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  return out;
}

export function renderMarkdown(input: string | null): string {
  if (!input) return '';

  const escaped = escapeHtml(input).replace(/\r\n/g, '\n');
  const lines = escaped.split('\n');

  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inCode = false;
  let paragraph: string[] = [];

  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join('<br>'))}</p>`);
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      flushParagraph(); closeList();
      out.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(line); continue; }

    if (!line.trim()) { flushParagraph(); closeList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length + 1;   // # -> h2, so the page keeps one h1
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph(); closeList();
      out.push('<hr>');
      continue;
    }

    // Matches `&gt;`, not `>`: escaping runs first, so by the time block
    // parsing sees the line the marker is already an entity.
    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph(); closeList();
      out.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushParagraph();
      const want: 'ul' | 'ol' = ul ? 'ul' : 'ol';
      if (listType !== want) { closeList(); out.push(`<${want}>`); listType = want; }
      out.push(`<li>${renderInline((ul ? ul[1] : ol![1]).trim())}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  if (inCode) out.push('</code></pre>');

  return out.join('\n');
}
