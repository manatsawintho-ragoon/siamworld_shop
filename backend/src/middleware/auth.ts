import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticationError, ForbiddenError, SessionKickedError, SessionExpiredError } from '../utils/errors';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { validateSession, touchSession } from '../services/session.service';

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  jti: string; // session ID — must match Redis session:{userId}
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  // 1. httpOnly cookie (primary — not readable by JS)
  let rawToken: string | undefined;
  const cookieMatch = (req.headers.cookie || '').match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (cookieMatch) rawToken = decodeURIComponent(cookieMatch[1]);

  // 2. Authorization header (fallback — for direct API clients / backward compat)
  if (!rawToken) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) rawToken = header.slice(7);
  }

  if (!rawToken) return next(new AuthenticationError('No token provided'));

  try {
    const decoded = jwt.verify(rawToken, config.jwt.secret) as JwtPayload;

    // Reject tokens that pre-date session enforcement (no jti)
    if (!decoded.jti) return next(new AuthenticationError('Token invalid, please log in again'));

    // Fetch current role from DB to ensure it's up-to-date
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?', [decoded.userId]
    );
    if (rows.length === 0) return next(new AuthenticationError('User not found'));

    // Single-session + inactivity check
    const status = await validateSession(decoded.userId, decoded.jti);
    if (status === 'kicked')  return next(new SessionKickedError());
    if (status === 'expired') return next(new SessionExpiredError());

    // Refresh the 40-min inactivity window (fire-and-forget — never blocks the request)
    touchSession(decoded.userId).catch(() => {});

    req.user = { ...decoded, role: rows[0].role };
    next();
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof SessionKickedError || err instanceof SessionExpiredError) {
      return next(err);
    }
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
