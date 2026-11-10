import { NextFunction, Request, Response } from 'express';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import { sendError } from '../utils/response.js';

interface MemoryRateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, MemoryRateLimitRecord>();

// Clean up stale in-memory records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetTime <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000).unref();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = options;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    // In automated testing environments, bypass unless explicitly testing rate limits
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    // Determine client identifier (IP address or fallback)
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rateLimitKey = `${keyPrefix}:${clientIp}`;

    try {
      // 1. Try Redis store if connected
      if (isRedisConnected()) {
        const redis = getRedisClient();
        if (redis) {
          const current = await redis.incr(rateLimitKey);
          if (current === 1) {
            await redis.expire(rateLimitKey, windowSeconds);
          }

          const ttl = await redis.ttl(rateLimitKey);
          res.setHeader('X-RateLimit-Limit', maxRequests);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
          res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);

          if (current > maxRequests) {
            res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);
            return sendError(
              res,
              429,
              'TOO_MANY_REQUESTS',
              `Too many requests. Please retry after ${ttl > 0 ? ttl : windowSeconds} seconds.`
            );
          }
          return next();
        }
      }

      // 2. Fallback to In-Memory Sliding Window Store
      const now = Date.now();
      let record = memoryStore.get(rateLimitKey);

      if (!record || record.resetTime <= now) {
        record = {
          count: 1,
          resetTime: now + windowMs,
        };
        memoryStore.set(rateLimitKey, record);
      } else {
        record.count += 1;
      }

      const remainingTtlSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', record.resetTime);

      if (record.count > maxRequests) {
        res.setHeader('Retry-After', remainingTtlSeconds);
        return sendError(
          res,
          429,
          'TOO_MANY_REQUESTS',
          `Too many authentication attempts. Please retry after ${remainingTtlSeconds} seconds.`
        );
      }

      return next();
    } catch {
      // Fail open if rate limiter encounters unexpected runtime errors
      return next();
    }
  };
}

/**
 * Strict limiter for authentication attempts (Login / Register)
 * Limit: 10 attempts per 15-minute window per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'rl:auth',
});
