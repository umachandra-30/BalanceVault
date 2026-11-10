/**
 * Logger utility with sensitive field redacting.
 * Ensures passwords, bearer tokens, API secrets, and connection strings
 * are never dumped to stdout or log files.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmPassword',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
  'cookie',
  'cvv',
  'creditCardNumber',
  'database_url',
]);

export function sanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redact Bearer tokens in headers
    if (data.toLowerCase().startsWith('bearer ')) {
      return 'Bearer [REDACTED]';
    }
    // Redact credentials in connection strings (e.g. postgresql://user:pass@host)
    if (data.includes('://') && data.includes('@')) {
      return data.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1[REDACTED]$3');
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitize(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

export const logger = {
  info: (message: string, context?: unknown) => {
    const timestamp = new Date().toISOString();
    if (context) {
      console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(sanitize(context)));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },
  warn: (message: string, context?: unknown) => {
    const timestamp = new Date().toISOString();
    if (context) {
      console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(sanitize(context)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },
  error: (message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    if (error instanceof Error) {
      console.error(`[${timestamp}] [ERROR] ${message}: ${error.message}\n${error.stack || ''}`);
    } else if (error) {
      console.error(`[${timestamp}] [ERROR] ${message}`, JSON.stringify(sanitize(error)));
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`);
    }
  },
  debug: (message: string, context?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      if (context) {
        console.debug(`[${timestamp}] [DEBUG] ${message}`, JSON.stringify(sanitize(context)));
      } else {
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
      }
    }
  },
};
