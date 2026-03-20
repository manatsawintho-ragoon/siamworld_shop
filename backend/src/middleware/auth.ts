import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticationError, ForbiddenError } from '../utils/errors';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AuthenticationError('No token provided'));

  try {
    const decoded = jwt.verify(header.slice(7), config.jwt.secret) as JwtPayload;

    // Fetch current role from DB to ensure it's up-to-date
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?', [decoded.userId]
    );
    if (rows.length === 0) return next(new AuthenticationError('User not found'));

    req.user = { ...decoded, role: rows[0].role };
    next();
  } catch (err) {
    if (err instanceof AuthenticationError) return next(err);
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AuthenticationError());
    if (!roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}
