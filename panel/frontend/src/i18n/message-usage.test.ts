/**
 * Two ways a translated string quietly ships untranslated, both of which reached
 * production on the credentials page:
 *
 *  1. `{t('key')}` written inside a quoted attribute or a template literal.
 *     It is plain text there, so the page printed `{t('press')}{t('createToken')}`
 *     to the reader in both languages.
 *  2. `t('key')` naming a message that was never written. next-intl renders the
 *     key itself, so the page shows `topupAuto`.
 *
 * Neither fails the build or the type checker, so they are checked here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import th from '../../messages/th.json';
import en from '../../messages/en.json';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [full];
  });
}

/**
 * Marks every index of `src` that sits inside a string or template literal.
 * Tracks quotes, escapes, comments and `${ }` nesting, so a real interpolation
 * inside a template is not counted as literal text.
 */
function literalRanges(src: string): boolean[] {
  const inside = new Array<boolean>(src.length).fill(false);
  const stack: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const cur = stack[stack.length - 1];
    if (cur === "'" || cur === '"' || cur === '`') {
      inside[i] = true;
      if (c === '\\') {
        if (i + 1 < src.length) inside[i + 1] = true;
        i += 2;
        continue;
      }
      if (c === cur) {
        inside[i] = false;
        stack.pop();
      } else if (cur === '`' && c === '$' && src[i + 1] === '{') {
        inside[i] = false;
        inside[i + 1] = false;
        stack.push('$');
        i += 2;
        continue;
      }
    } else if (c === "'" || c === '"' || c === '`') {
      stack.push(c);
    } else if (c === '{' && cur === '$') {
      stack.push('{');
    } else if (c === '}' && (cur === '$' || cur === '{')) {
      stack.pop();
    } else if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? src.length : nl;
      continue;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    i += 1;
  }
  return inside;
}

const files = sourceFiles(SRC);
const rel = (file: string) => path.relative(SRC, file);
const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('translated strings', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('never writes {t(...)} as literal text', () => {
    const offenders = files.flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      const inside = literalRanges(src);
      return [...src.matchAll(/\{t[A-Za-z]*\(\s*['"]([^'"]+)/g)]
        .filter((m) => inside[m.index!])
        .map((m) => `${rel(file)}:${lineOf(src, m.index!)} {t('${m[1]}')}`);
    });
    expect(offenders).toEqual([]);
  });

  it('only asks for messages that exist in both locales', () => {
    const thKeys = new Set(flatten(th));
    const enKeys = new Set(flatten(en));
    const offenders = files.flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      const namespaces = [
        ...src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([^']+)'/g),
      ];
      // A component that calls `t.has(...)` resolves keys deliberately and may
      // pass strings that are not messages, so its calls are not checked here.
      const guarded = new Set([...src.matchAll(/(\w+)\.has\(/g)].map((m) => m[1]));
      return namespaces.flatMap(([, variable, namespace]) => {
        if (guarded.has(variable)) return [];
        const calls = new RegExp(`\\b${variable}(?:\\.rich)?\\(\\s*'([^']+)'`, 'g');
        return [...src.matchAll(calls)].flatMap((m) => {
          const key = `${namespace}.${m[1]}`;
          const absent = [
            ...(thKeys.has(key) ? [] : ['th']),
            ...(enKeys.has(key) ? [] : ['en']),
          ];
          return absent.length ? [`${rel(file)}:${lineOf(src, m.index!)} ${key} (missing in ${absent.join()})`] : [];
        });
      });
    });
    expect(offenders).toEqual([]);
  });
});
