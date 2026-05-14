import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncRoute = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
