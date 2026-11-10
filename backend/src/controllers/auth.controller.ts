import { CookieOptions, NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { sendSuccess } from '../utils/response.js';

const REFRESH_COOKIE_NAME = 'balancevault_refresh_token';

const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

export const authController = {
  /**
   * @route POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = registerSchema.parse(req.body);

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await authService.register(validatedInput, ctx);

      // Set HttpOnly refresh token cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      return sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        'User registration successful',
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = loginSchema.parse(req.body);

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const result = await authService.login(validatedInput, ctx);

      // Set HttpOnly refresh token cookie
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());

      return sendSuccess(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        'Authentication successful',
        200
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] ||
        req.body?.refreshToken;

      const result = await authService.refresh(refreshToken);

      return sendSuccess(res, result, 'Access token refreshed successfully');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (userId) {
        await authService.logout(userId, {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }

      // Clear refresh cookie
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return sendSuccess(res, { loggedOut: true }, 'Successfully logged out');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route GET /api/v1/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await authService.getMe(userId);

      return sendSuccess(res, user, 'User profile retrieved');
    } catch (error) {
      next(error);
    }
  },
};
