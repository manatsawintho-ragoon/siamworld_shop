import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error', { message: err.message, stack: err.stack });
    }
    res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
