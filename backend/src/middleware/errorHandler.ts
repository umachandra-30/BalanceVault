import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError, sendError } from '../utils/response.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  // Handle known operational application errors
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(
      res,
      422,
      'VALIDATION_ERROR',
      'The submitted payload failed validation checks',
      formattedErrors
    );
  }

  // Handle Express JSON body parsing errors (malformed JSON)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    return sendError(res, 400, 'MALFORMED_JSON', 'Malformed JSON in request payload');
  }

  // Log unknown/unexpected internal server errors
  logger.error(`Unhandled internal error on ${req.method} ${req.originalUrl}`, err);

  const isProduction = process.env.NODE_ENV === 'production';
  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    isProduction ? 'An unexpected server error occurred' : (err.message || 'Internal server error'),
    isProduction ? undefined : { stack: err.stack }
  );
};
