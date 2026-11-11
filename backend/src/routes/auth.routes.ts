import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { bootstrapController } from '../controllers/bootstrap.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

export const authRouter = Router();

// Controlled First Administrator Bootstrap routes
authRouter.get('/bootstrap-status', bootstrapController.getStatus);
authRouter.post('/bootstrap-admin', authRateLimiter, bootstrapController.bootstrapAdmin);

// Public routes (Rate limited to mitigate credential stuffing & brute-force)
authRouter.post('/register', authRateLimiter, authController.register);
authRouter.post('/login', authRateLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);

// Protected routes (Require valid authentication)
authRouter.post('/logout', authenticate, authController.logout);
authRouter.get('/me', authenticate, authController.getMe);

