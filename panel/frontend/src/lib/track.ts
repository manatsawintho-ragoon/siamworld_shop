// Lightweight behavioural tracker for the panel. Batches page-view / feature-click
// events and flushes them to the backend via navigator.sendBeacon (cookie-authenticated,
// same-origin, fire-and-forget). Server validates + drops anything out of scope, so this
// stays deliberately dumb. No-ops during SSR.

type TrackEvent = { type: 'page_view' | 'feature_click'; value: string };

const ENDPOINT = '/api/activity';
const BATCH_SIZE = 10;     // flush once this many events queue up
const FLUSH_DELAY = 4000;  // ...or after this idle period

let queue: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function send(events: TrackEvent[]) {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch { /* fall through to fetch */ }
  // Fallback: keepalive fetch so it survives a page unload too.
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    keepalive: true,
    body,
  }).catch(() => { /* telemetry is best-effort */ });
}

export function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  send(batch);
}

function bindUnloadFlush() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  // pagehide covers tab close / nav; visibilitychange covers tab-switch / mobile background.
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

function enqueue(ev: TrackEvent) {
  if (typeof window === 'undefined') return;
  bindUnloadFlush();
  queue.push(ev);
  if (queue.length >= BATCH_SIZE) { flush(); return; }
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, FLUSH_DELAY);
}

export function trackPageView(path: string) {
  enqueue({ type: 'page_view', value: path });
}

export function trackFeature(key: string) {
  enqueue({ type: 'feature_click', value: key });
}
