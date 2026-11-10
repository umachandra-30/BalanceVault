import { Request, Response } from 'express';
import { sendError } from '../utils/response.js';

export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(
    res,
    404,
    'ROUTE_NOT_FOUND',
    `Cannot ${req.method} ${req.originalUrl}. This endpoint does not exist.`
  );
};
