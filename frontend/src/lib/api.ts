// Use relative path so all API calls go through the Next.js proxy (fixes external access CORS)
const API_URL = '/api';

// ── In-memory session flag ────────────────────────────────────────────────────
// Auth is now handled by httpOnly cookie 'auth_token' set by the backend.
// JS cannot read httpOnly cookies — this flag tracks login state in memory only.
// It is reset to false on page load; AuthContext re-sets it after profile fetch.
let _sessionActive = false;

// ── Stub exports — preserve signatures so existing callsites compile unchanged ─
// The `token` option in api() is accepted but ignored; auth travels via cookie.

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return _sessionActive ? '__cookie__' : null;
}

export function setToken(_token: string) {
  // Cookie is set server-side via Set-Cookie header — nothing to store client-side
  _sessionActive = true;
}

export function removeToken() {
  _sessionActive = false;
}

/** Shorthand used by callsites that pass token to api() */
export function tok(): string | undefined {
  return getToken() || undefined;
}

// ── API ───────────────────────────────────────────────────────────────────────

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string; // Accepted but ignored — auth is via cookie
  // Cache mode for the underlying fetch. Defaults to 'no-store' for writes and
  // 'default' for GETs, so the browser HTTP cache can honour the backend's
  // Cache-Control on public catalog endpoints instead of re-hitting the API on
  // every page navigation. Pass 'no-store' explicitly to force a fresh read.
  cache?: RequestCache;
}

interface ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: { field: string; message: string }[];
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  [key: string]: T | boolean | string | undefined;
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body } = options;
  // token option deliberately ignored — cookie handles auth automatically
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Writes must never be cached. GETs default to 'default' so the browser can
  // reuse a response that the backend marked cacheable (public catalog data);
  // authenticated endpoints send Cache-Control: no-store from the backend, so
  // they are never cached even under 'default'.
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const cacheMode: RequestCache = options.cache ?? (isWrite ? 'no-store' : 'default');

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // sends auth_token cookie on every request
    cache: cacheMode,
  });

  const data = await res.json();
  if (!res.ok) {
    // Prefer the detailed Thai summary (`message`) over the generic `error`
    // ("Validation failed") so callers surface *which* field is wrong.
    const err = new Error(data.message || data.error || 'Something went wrong') as ApiError;
    err.status = res.status;
    err.code = data.code; // e.g. SESSION_KICKED, SESSION_EXPIRED, AUTH_FAILED
    if (Array.isArray(data.errors)) err.fieldErrors = data.errors; // per-field validation detail
    throw err;
  }
  return data;
}
