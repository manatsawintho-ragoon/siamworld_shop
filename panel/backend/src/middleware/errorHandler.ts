import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: Record<string, string> = { error: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.statusCode).json(body);
  }
  logger.error('[Unhandled]', err);
  return res.status(500).json({ error: 'Internal server error' });
}
