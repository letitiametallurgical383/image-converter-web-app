export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: number;
  error?: Error;
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;
  private handlers: Array<(entry: LogEntry) => void> = [];

  constructor() {
    /* v8 ignore next 3 */
    if (import.meta.env.DEV) {
      this.minLevel = LogLevel.DEBUG;
    }
  }

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.handlers.push(handler);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      error,
    };

    if (this.handlers.length === 0) {
      this.defaultHandler(entry);
    } else {
      for (const handler of this.handlers) {
        try {
          handler(entry);
        } catch (e) {
          console.error("Logger handler failed:", e);
        }
      }
    }
  }

  private defaultHandler(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${levelName}]`;

    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${entry.message}${contextStr}`, entry.error);
        break;
      case LogLevel.INFO:
        console.info(`${prefix} ${entry.message}${contextStr}`, entry.error);
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${entry.message}${contextStr}`, entry.error);
        break;
      case LogLevel.ERROR:
        console.error(`${prefix} ${entry.message}${contextStr}`, entry.error);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}

export const logger = new Logger();
