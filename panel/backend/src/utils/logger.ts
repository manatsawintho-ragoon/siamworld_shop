// Lightweight structured logger for the panel backend.
//
// Drop-in for console.* — same variadic signature, so existing call sites keep
// all their arguments (template strings, error objects, etc.). It adds an ISO
// timestamp + level prefix and honours LOG_LEVEL (debug|info|warn|error) so
// noisy debug lines can be silenced in production without code changes.
//
// errors always go to stderr; everything else to stdout.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? LEVELS.info;

function prefix(level: LogLevel): string {
  return `${new Date().toISOString()} ${level.toUpperCase()}`;
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (LEVELS.debug >= currentLevel) console.debug(prefix('debug'), ...args);
  },
  info: (...args: unknown[]) => {
    if (LEVELS.info >= currentLevel) console.log(prefix('info'), ...args);
  },
  warn: (...args: unknown[]) => {
    if (LEVELS.warn >= currentLevel) console.warn(prefix('warn'), ...args);
  },
  error: (...args: unknown[]) => {
    console.error(prefix('error'), ...args);
  },
};
