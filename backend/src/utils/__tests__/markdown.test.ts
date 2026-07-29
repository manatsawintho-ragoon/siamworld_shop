import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  describe('formatting', () => {
    it('renders headings starting at h2 so the page keeps one h1', () => {
      expect(renderMarkdown('# Title')).toContain('<h2>Title</h2>');
      expect(renderMarkdown('## Sub')).toContain('<h3>Sub</h3>');
    });

    it('renders bold, italic and inline code', () => {
      expect(renderMarkdown('**b**')).toContain('<strong>b</strong>');
      expect(renderMarkdown('*i*')).toContain('<em>i</em>');
      expect(renderMarkdown('`c`')).toContain('<code>c</code>');
    });

    it('renders both list kinds', () => {
      expect(renderMarkdown('- a\n- b')).toContain('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
      expect(renderMarkdown('1. a\n2. b')).toContain('<ol>');
    });

    it('renders paragraphs, quotes and rules', () => {
      expect(renderMarkdown('hello')).toBe('<p>hello</p>');
      expect(renderMarkdown('> quoted')).toContain('<blockquote>quoted</blockquote>');
      expect(renderMarkdown('---')).toContain('<hr>');
    });

    it('renders fenced code blocks without interpreting their contents', () => {
      const out = renderMarkdown('```\n**not bold**\n```');
      expect(out).toContain('<pre><code>');
      expect(out).not.toContain('<strong>');
    });
  });

  describe('stored XSS is structurally impossible', () => {
    // The renderer escapes every html-significant character BEFORE introducing
    // any tag, so no attacker-controlled '<' can survive into the output.
    it.each([
      ['a script tag', '<script>alert(1)</script>'],
      ['an img onerror', '<img src=x onerror=alert(1)>'],
      ['an iframe', '<iframe src="//evil.test"></iframe>'],
      ['an svg handler', '<svg onload=alert(1)>'],
      ['a style block', '<style>body{display:none}</style>'],
      ['an unclosed tag', '<div'],
    ])('neutralises %s', (_label, payload) => {
      const out = renderMarkdown(payload);

      // The invariant is that no ELEMENT is created. Escaped text may still
      // contain the characters "onerror" - as in `&lt;img src=x onerror=...&gt;`
      // - and that is inert, so asserting on the substring alone would be
      // testing the wrong thing. What must never appear is an unescaped tag.
      expect(out).not.toMatch(/<(script|iframe|svg|img|style|div)\b/i);
      expect(out).toContain('&lt;');
    });

    it('escapes html even inside markdown constructs', () => {
      expect(renderMarkdown('**<script>x</script>**')).not.toContain('<script');
      expect(renderMarkdown('- <script>x</script>')).not.toContain('<script');
    });
  });

  describe('url safety', () => {
    it('keeps http(s) and site-relative links', () => {
      expect(renderMarkdown('[x](https://a.test)')).toContain('href="https://a.test"');
      expect(renderMarkdown('[x](/shop)')).toContain('href="/shop"');
    });

    it('adds noopener to external links only', () => {
      expect(renderMarkdown('[x](https://a.test)')).toContain('rel="noopener noreferrer"');
      expect(renderMarkdown('[x](/shop)')).not.toContain('rel=');
    });

    it.each([
      ['javascript', '[x](javascript:alert(1))'],
      ['data', '[x](data:text/html,<script>alert(1)</script>)'],
      ['vbscript', '[x](vbscript:msgbox)'],
    ])('drops the href for a %s url, keeping the label as text', (_l, md) => {
      const out = renderMarkdown(md);
      expect(out).not.toContain('href=');
      expect(out).toContain('x');
    });

    it('allows only same-origin images', () => {
      expect(renderMarkdown('![a](/uploads/x.png)')).toContain('<img src="/uploads/x.png"');
      // Remote images are dropped to their alt text: no SSRF, no tracking
      // pixel, no mixed content.
      expect(renderMarkdown('![a](https://evil.test/x.png)')).not.toContain('<img');
    });
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown('')).toBe('');
  });
});
