import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  // Intercept the finish event to log HTTP status and duration
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const logPayload = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      ip,
    };

    if (statusCode >= 500) {
      logger.error(`[HTTP] ${method} ${originalUrl} -> ${statusCode} (${duration}ms)`, logPayload);
    } else if (statusCode >= 400) {
      logger.warn(`[HTTP] ${method} ${originalUrl} -> ${statusCode} (${duration}ms)`, logPayload);
    } else {
      logger.info(`[HTTP] ${method} ${originalUrl} -> ${statusCode} (${duration}ms)`, logPayload);
    }
  });

  next();
};

