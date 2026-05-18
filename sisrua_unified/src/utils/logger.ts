type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 100;
  private activeTraces: Record<string, number> = {};

  private createEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: this.sanitizeData(data),
    };
  }

  private sanitizeData(data: unknown): unknown {
    if (!data) return data;
    
    // Handle Error objects
    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message,
            stack: data.stack
        };
    }

    if (typeof data !== 'object') return data;

    // Deep clone and sanitize sensitive keys
    const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'credentials'];
    const sanitized = JSON.parse(JSON.stringify(data));

    const walk = (obj: any) => {
      for (const key in obj) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          walk(obj[key]);
        }
      }
    };

    walk(sanitized);
    return sanitized;
  }

  private addToHistory(entry: LogEntry) {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  private log(level: LogLevel, categoryOrMessage: string, messageOrData?: any, data?: any) {
    let category: string;
    let message: string;
    let finalData: any;

    if (data !== undefined) {
      category = categoryOrMessage;
      message = messageOrData;
      finalData = data;
    } else if (typeof messageOrData === 'string') {
      category = categoryOrMessage;
      message = messageOrData;
      finalData = undefined;
    } else {
      category = 'General';
      message = categoryOrMessage;
      finalData = messageOrData;
    }

    const entry = this.createEntry(level, category, message, finalData);
    this.addToHistory(entry);

    if (this.isDevelopment) {
      const style = this.getConsoleStyle(level);
      console.log(`%c[${entry.timestamp}] [${category}] ${message}`, style, entry.data ?? '');
    }

    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      this.sendToBackend(entry);
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #888; font-size: 0.9em;',
      info: 'color: #2563eb; font-weight: bold;',
      warn: 'color: #ea580c; font-weight: bold;',
      error: 'color: #dc2626; font-weight: bold;',
    };
    return styles[level];
  }

  private async sendToBackend(entry: LogEntry) {
    try {
      // Mocked
    } catch {
      // Silent fail
    }
  }

  debug(categoryOrMessage: string, messageOrData?: any, data?: any) {
    this.log('debug', categoryOrMessage, messageOrData, data);
  }

  info(categoryOrMessage: string, messageOrData?: any, data?: any) {
    this.log('info', categoryOrMessage, messageOrData, data);
  }

  warn(categoryOrMessage: string, messageOrData?: any, data?: any) {
    this.log('warn', categoryOrMessage, messageOrData, data);
  }

  error(categoryOrMessage: string, messageOrData?: any, data?: any) {
    this.log('error', categoryOrMessage, messageOrData, data);
  }

  startTrace(name: string): string {
    const id = `${name}_${Date.now()}`;
    this.activeTraces[id] = Date.now();
    this.debug('Trace', `Started trace: ${name}`, { id });
    return id;
  }

  endTrace(id: string): number {
    const start = this.activeTraces[id];
    if (!start) return 0;
    const duration = Date.now() - start;
    delete this.activeTraces[id];
    this.debug('Trace', `Ended trace: ${id.split('_')[0]}`, { durationMs: duration });
    return duration;
  }

  getLogs() {
    return [...this.logHistory];
  }

  getLogsByLevel(level: LogLevel) {
    return this.logHistory.filter(l => l.level === level);
  }

  clearLogs() {
    this.logHistory = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }
}

const loggerInstance = new Logger();
export { loggerInstance as logger };
export default loggerInstance;
export type { LogEntry, LogLevel };
export const _testUtils = {
  isDevelopment: () => import.meta.env.DEV === true,
};
