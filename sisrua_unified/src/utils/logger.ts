/**
 * Logger com sanitização de dados sensíveis e stack traces (Item 22).
 * Em produção: stack traces são suprimidos, dados sensíveis removidos.
 * Em desenvolvimento: logs completos com stack traces.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
  stackTrace?: string; // Só em desenvolvimento
}

// Check if we're in development mode
const isDevelopment = () => {
  try {
    const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
    return env.DEV === true || !env.MODE || env.MODE === 'development';
  } catch {
    return true; // Default to development if we can't determine
  }
};

/**
 * Sanitizar dados para produção.
 * Remove: stack traces, paths do sistema, tokens, IPs internos.
 * Item 22: Nunca expor stack traces em produção.
 */
function sanitizeDataForProduction(data: unknown): unknown {
  if (!data) return data;
  
  if (typeof data === 'string') {
    // Remover paths do sistema
    let sanitized = data.replace(/\/([a-z_-]+)+\/[a-z0-9_.-]+\.[a-z]+/gi, '[PATH]');
    // Remover IPs internos
    sanitized = sanitized.replace(/\b(?:10|172|192\.168)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
    // Remover tokens comuns
    sanitized = sanitized.replace(/(?:token|api[_-]?key|secret|password)[=:]\S+/gi, '[REDACTED]');
    return sanitized;
  }
  
  if (data instanceof Error) {
    const errorObj: { [key: string]: unknown } = {
      name: data.name,
      message: data.message,
    };
    
    // Em desenvolvimento: incluir stack trace
    if (isDevelopment()) {
      errorObj.stack = data.stack;
    }
    // Em produção: apenas a mensagem de erro
    
    return errorObj;
  }
  
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, val] of Object.entries(obj)) {
      // Pular campos sensíveis
      if (/password|token|secret|api[_-]?key|credential/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeDataForProduction(val);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

export const __testables__ = {
  sanitizeDataForProduction,
};

class Logger {
  private static logs: LogEntry[] = [];
  private static maxLogs = 100;

  private static log(level: LogLevel, message: string, data?: unknown) {
    const dataToLog = isDevelopment() ? data : sanitizeDataForProduction(data);
    const stackTrace = isDevelopment() ? new Error().stack : undefined;
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data: dataToLog,
      stackTrace,
    };

    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in development only
    if (isDevelopment()) {
      const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]`;
      const logFn = level === 'error' ? console.error : 
                    level === 'warn' ? console.warn : 
                    console.log;
      
      if (data !== undefined) {
        logFn(prefix, message, data);
      } else {
        logFn(prefix, message);
      }
    } else {
      // Em produção: log mínimo com dados sanitizados
      if (level === 'error' || level === 'warn') {
        const logFn = level === 'error' ? console.error : console.warn;
        logFn(`[${level.toUpperCase()}] ${message}`, dataToLog);
      }
    }
  }

  static info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  static warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  static error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  static debug(message: string, data?: unknown) {
    if (isDevelopment()) {
      this.log('debug', message, data);
    }
  }

  static getLogs(): readonly LogEntry[] {
    return [...this.logs];
  }

  static clearLogs() {
    this.logs = [];
  }

  static getLogsByLevel(level: LogLevel): readonly LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export default Logger;
