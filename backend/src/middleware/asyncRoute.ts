import { Request, Response, NextFunction } from 'express';

type RouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async route handler to forward errors to Express error middleware.
 * Eliminates the need for try/catch in every route.
 */
export function asyncRoute(handler: RouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
