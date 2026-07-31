/**
 * Pure parsing helpers for NGINX Proxy Manager access logs.
 *
 * NPM writes one access log per proxy host, and we run one proxy host per shop,
 * so these logs are the cheapest complete record of what each customer site is
 * actually serving. The format is NPM's own `proxy` log_format, defined in
 * /etc/nginx/conf.d/include/log-proxy.conf:
 *
 *   [$time_local] $upstream_cache_status $upstream_status $status - $request_method
 *   $scheme $host "$request_uri" [Client $remote_addr] [Length $body_bytes_sent]
 *   [Gzip $gzip_ratio] [Sent-to $server] "$http_user_agent" "$http_referer"
 *
 * Everything here is deliberately I/O-free: the risky part of this feature is a
 * regex against a format we do not own, and pure functions make that part cheap
 * to test exhaustively against real captured lines.
 */

export interface ParsedRequest {
  ts: Date;
  status: number;
  method: string;
  host: string;
  /** Raw $request_uri, query string still attached. Call normalizePath before storing. */
  uri: string;
  /** $body_bytes_sent: response body only. Excludes headers and all inbound bytes. */
  bytesSent: number;
  userAgent: string;
  referer: string | null;
}

/**
 * Note the fourth capture is $status, not $upstream_status. They are usually equal,
 * but when a client aborts, nginx logs `- - 499` and only $status is meaningful.
 * $body_bytes_sent tolerates "-" defensively even though nginx always writes a number.
 */
const LINE_RE =
  /^\[([^\]]+)\] (\S+) (\S+) (\d{3}) - (\S+) (\S+) (\S+) "([^"]*)" \[Client ([^\]]*)\] \[Length (\d+|-)\] \[Gzip ([^\]]*)\] \[Sent-to ([^\]]*)\] "([^"]*)" "([^"]*)"$/;

const TIME_RE = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** `31/Jul/2026:17:53:30 +0000` -> Date, or null if the shape is not what we expect. */
function parseTimeLocal(s: string): Date | null {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  const offsetMin = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
  const utcMs =
    Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) -
    offsetMin * 60_000;
  return Number.isNaN(utcMs) ? null : new Date(utcMs);
}

/** Returns null for anything that is not a well-formed proxy log line, never throws. */
export function parseProxyLine(line: string): ParsedRequest | null {
  if (!line) return null;
  const m = LINE_RE.exec(line.trimEnd());
  if (!m) return null;

  const ts = parseTimeLocal(m[1]);
  if (!ts) return null;

  const referer = m[14] && m[14] !== '-' ? m[14] : null;

  return {
    ts,
    status: Number(m[4]),
    method: m[5],
    host: m[7].toLowerCase(),
    uri: m[8],
    bytesSent: m[10] === '-' ? 0 : Number(m[10]),
    userAgent: m[13],
    referer,
  };
}

const UUID_SEG = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEXISH_SEG = /^[0-9a-fA-F]{16,}$/;
const NUMERIC_SEG = /^\d+$/;

/** Longest value we will store; keeps the VARCHAR(255) column safe from pathological URIs. */
const MAX_PATH = 255;

/**
 * Reduce a request URI to a low-cardinality label.
 *
 * Without this, one shop generates thousands of distinct rows a day: every
 * `/_next/image?url=...` variant and every hashed chunk filename is unique.
 * Query strings go, numeric and uuid segments collapse to `:id`, and the hashed
 * static subtree collapses wholesale, because per-chunk volume tells an operator
 * nothing that the aggregate does not.
 */
export function normalizePath(uri: string): string {
  let p = (uri || '').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '') || '/';

  if (p === '/_next/static' || p.startsWith('/_next/static/')) return '/_next/static/*';

  p = p
    .split('/')
    .map(seg => {
      if (!seg) return seg;
      if (NUMERIC_SEG.test(seg) || UUID_SEG.test(seg) || HEXISH_SEG.test(seg)) return ':id';
      return seg;
    })
    .join('/');

  if (p.length > MAX_PATH) p = p.slice(0, MAX_PATH);
  return p || '/';
}

/**
 * Substrings that mark a non-human client. Kept narrow on purpose: a false
 * positive here silently understates a customer's real audience, which is worse
 * than missing an obscure crawler. Anything matching is counted as a bot but is
 * still counted as traffic, because it is still origin load.
 */
const BOT_MARKERS = [
  'bot', 'crawl', 'spider', 'slurp', 'scrape', 'archiver',
  'curl', 'wget', 'python-requests', 'go-http-client', 'okhttp', 'java/', 'libwww',
  'headless', 'phantomjs', 'puppeteer', 'playwright', 'lighthouse',
  'facebookexternalhit', 'whatsapp', 'telegram', 'discord', 'slackbot',
  'bingpreview', 'pingdom', 'uptimerobot', 'statuscake',
];

/** An empty or "-" user agent counts as a bot: no real browser omits it. */
export function isBotUA(ua: string): boolean {
  if (!ua || ua === '-') return true;
  const s = ua.toLowerCase();
  return BOT_MARKERS.some(m => s.includes(m));
}

export const REFERER_DIRECT = '(เข้าตรง)';
export const REFERER_INTERNAL = '(ภายในเว็บ)';
export const REFERER_UNKNOWN = '(อื่นๆ)';

/**
 * Reduce a referer to the host that sent the visitor, folding self-referers into
 * one bucket. In-site navigation is the overwhelming majority of referers and
 * would otherwise bury the handful of rows that answer the actual question:
 * where does this shop's traffic come from?
 */
export function refererLabel(referer: string | null, selfHost: string): string {
  if (!referer || referer === '-') return REFERER_DIRECT;
  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return REFERER_UNKNOWN;
  }
  if (!host) return REFERER_UNKNOWN;
  if (host === selfHost.toLowerCase()) return REFERER_INTERNAL;
  return host.slice(0, MAX_PATH);
}

/**
 * Asia/Bangkok is a fixed UTC+7: Thailand has never observed DST, so this offset
 * is unambiguous for every past and future instant.
 *
 * Buckets are stored in Bangkok wall-clock rather than UTC so the frontend can
 * render them verbatim. This codebase has repeatedly been bitten by UTC/local
 * drift when a stored instant had to be converted for display; storing what the
 * operator will read removes that whole class of bug from this feature.
 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokParts(d: Date) {
  const s = new Date(d.getTime() + BANGKOK_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())}`,
    hour: p(s.getUTCHours()),
  };
}

/** MySQL DATETIME, truncated to the hour, in Bangkok wall-clock. */
export function bucketHour(d: Date): string {
  const { date, hour } = bangkokParts(d);
  return `${date} ${hour}:00:00`;
}

/** MySQL DATE, in Bangkok wall-clock. */
export function bucketDay(d: Date): string {
  return bangkokParts(d).date;
}
