/**
 * Every `api.*` call must target a path under `/api`.
 *
 * The axios client uses `baseURL: ''`, so a call written as `/admin/storage`
 * resolves against the panel's own origin and is served by the Next.js **page**
 * of that name. The response is HTTP 200 with `text/html`, so axios resolves
 * happily and `res.data.data` is `undefined`.
 *
 * That failure is silent and, worse, looks like real data. `/admin/traffic`
 * rendered its "no traffic collected yet" empty state across a fleet that had
 * 206k requests recorded, because `/admin/traffic/overview` matched its own
 * `[shopName]` route. The storage page shipped the same mistake.
 *
 * Neither tsc nor `next build` can see it: both spellings are valid strings.
 * So it is checked here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [full];
  });
}

/** Matches a literal first argument: api.get('/x'), api.post(`/x/${y}`), ... */
const CALL_RE = /\bapi\.(get|post|put|patch|delete)\(\s*(['"`])(\/[^'"`]*)\2/g;

/** exec loop rather than matchAll: the build target predates iterator downleveling. */
function calls(src: string): { method: string; url: string }[] {
  const out: { method: string; url: string }[] = [];
  const re = new RegExp(CALL_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push({ method: m[1], url: m[3] });
  return out;
}

describe('api call paths', () => {
  it('always start with /api', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      for (const c of calls(readFileSync(file, 'utf8'))) {
        if (!c.url.startsWith('/api/') && c.url !== '/api') {
          offenders.push(`${path.relative(SRC, file)}: api.${c.method}('${c.url}')`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('detects the mistake it exists to prevent', () => {
    // Guards the matcher itself: a scan that silently matches nothing would pass
    // forever while the bug walks straight past it.
    expect(calls("const r = await api.get('/admin/storage');")).toEqual([
      { method: 'get', url: '/admin/storage' },
    ]);
  });

  it('reads a template literal through to the end, prefix included', () => {
    // The captured url keeps the interpolation markers verbatim. Only the
    // leading `/api/` is being asserted on, so that is harmless, but the shape
    // is pinned here so nobody later assumes the url is a clean path.
    expect(calls('await api.post(`/api/admin/traffic/${shop}?days=7`)')).toEqual([
      { method: 'post', url: '/api/admin/traffic/${shop}?days=7' },
    ]);
  });
});
