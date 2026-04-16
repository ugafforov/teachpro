/**
 * Structured logging service
 * Provides different log levels and can be extended for remote logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warn and error
    if (!this.isDevelopment) {
      return level === 'warn' || level === 'error';
    }
    return true;
  }

  private formatEntry(level: LogLevel, context: string, message: string, data?: unknown): LogEntry {
    return {
      level,
      context,
      message,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const prefix = `[${entry.level.toUpperCase()}] [${entry.context}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data || '');
        break;
      case 'info':
        console.info(message, entry.data || '');
        break;
      case 'warn':
        console.warn(message, entry.data || '');
        break;
      case 'error':
        console.error(message, entry.data || '');
        break;
    }
  }

  debug(context: string, message: string, data?: unknown): void {
    const entry = this.formatEntry('debug', context, message, data);
    this.output(entry);
  }

  info(context: string, message: string, data?: unknown): void {
    const entry = this.formatEntry('info', context, message, data);
    this.output(entry);
  }

  warn(context: string, message: string, data?: unknown): void {
    const entry = this.formatEntry('warn', context, message, data);
    this.output(entry);
  }

  error(context: string, message: string, data?: unknown): void {
    const entry = this.formatEntry('error', context, message, data);
    this.output(entry);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience functions
export const logDebug = (context: string, message: string, data?: unknown): void => {
  logger.debug(context, message, data);
};

export const logInfo = (context: string, message: string, data?: unknown): void => {
  logger.info(context, message, data);
};

export const logWarn = (context: string, message: string, data?: unknown): void => {
  logger.warn(context, message, data);
};

export const logError = (context: string, message: string, data?: unknown): void => {
  logger.error(context, message, data);
};
