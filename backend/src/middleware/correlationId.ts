import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId =
    typeof headerId === 'string' && headerId.trim() ? headerId.trim() : crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

