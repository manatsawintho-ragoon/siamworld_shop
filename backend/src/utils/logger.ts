type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 1;

class Logger {
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LEVELS[level] < currentLevel) return;
    const entry = { timestamp: new Date().toISOString(), level, message, ...meta };
    const out = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(out + '\n');
    else process.stdout.write(out + '\n');
  }
  debug(msg: string, meta?: Record<string, unknown>) { this.log('debug', msg, meta); }
  info(msg: string, meta?: Record<string, unknown>) { this.log('info', msg, meta); }
  warn(msg: string, meta?: Record<string, unknown>) { this.log('warn', msg, meta); }
  error(msg: string, meta?: Record<string, unknown>) { this.log('error', msg, meta); }
}

export const logger = new Logger();
