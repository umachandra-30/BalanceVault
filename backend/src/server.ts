import app from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initRedis } from './config/redis.js';

// Initialize Redis connection
initRedis();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 BalanceVault Core API running on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`🔗 Health check available at http://localhost:${env.PORT}/api/v1/health`);
  logger.info(`🔗 Readiness check available at http://localhost:${env.PORT}/api/v1/ready`);
});

// Graceful shutdown handling
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down HTTP server gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown if connections do not close within 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout on active connections.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection detected', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception thrown', error);
  process.exit(1);
});
