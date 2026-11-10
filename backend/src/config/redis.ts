import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function initRedis(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          // Stop retrying after 3 attempts to prevent log spam in local dev
          return null;
        }
        return Math.min(times * 500, 2000);
      },
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    client.on('connect', () => {
      isRedisAvailable = true;
      logger.info('✅ Successfully connected to Redis instance for rate limiting & cache.');
    });

    client.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn(`⚠️ Redis connection notice: ${err.message}. (Will use resilient in-memory fallback for rate limiting if Redis is unavailable).`);
    });

    // Attempt non-blocking connection
    client.connect().catch((err) => {
      isRedisAvailable = false;
      logger.warn(`⚠️ Redis is currently offline at ${env.REDIS_URL}. Details: ${err.message}`);
      logger.info('💡 Windows Redis setup tips: Install Memurai (native Windows Redis compatible) or run Redis inside WSL2 (wsl sudo service redis-server start).');
    });

    redisClient = client;
    return redisClient;
  } catch (error) {
    logger.warn('Failed to initialize Redis client. Operating in memory-fallback mode.', error);
    return null;
  }
}

export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}

export function isRedisConnected(): boolean {
  return isRedisAvailable;
}

