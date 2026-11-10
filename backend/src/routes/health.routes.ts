import { Request, Response, Router } from 'express';
import { isRedisConnected } from '../config/redis.js';
import { sendSuccess } from '../utils/response.js';

export const healthRouter = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Liveness check for container orchestration and load balancers
 * @access  Public
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  return sendSuccess(
    res,
    {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'BalanceVault Core API',
      version: '1.0.0',
    },
    'Service is alive'
  );
});

/**
 * @route   GET /api/v1/ready
 * @desc    Readiness check reporting system readiness, memory metrics, Redis status, and runtime
 * @access  Public
 */
healthRouter.get('/ready', (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  return sendSuccess(
    res,
    {
      status: 'READY',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      services: {
        redis: isRedisConnected() ? 'CONNECTED' : 'DISCONNECTED_OR_FALLBACK',
      },
      memory: {
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
    },
    'Service is ready to handle traffic'
  );
});
