import { NextFunction, Request, Response } from 'express';
import { bootstrapService } from '../services/bootstrap.service.js';
import { bootstrapAdminSchema } from '../schemas/bootstrap.schema.js';
import { sendSuccess } from '../utils/response.js';

export const bootstrapController = {
  /**
   * @route GET /api/v1/auth/bootstrap-status
   * @desc Check whether the system allows first-administrator bootstrap
   */
  async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await bootstrapService.canBootstrap();
      return sendSuccess(res, status, 'Bootstrap status retrieved');
    } catch (error) {
      next(error);
    }
  },

  /**
   * @route POST /api/v1/auth/bootstrap-admin
   * @desc Controlled one-time first administrator initialization
   */
  async bootstrapAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = bootstrapAdminSchema.parse(req.body);

      const ctx = {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };

      const adminUser = await bootstrapService.bootstrapAdmin(validatedInput, ctx);

      return sendSuccess(
        res,
        {
          admin: adminUser,
          message: 'Root administrator account bootstrapped successfully. You can now sign in.',
        },
        'Root administrator created',
        201
      );
    } catch (error) {
      next(error);
    }
  },
};
