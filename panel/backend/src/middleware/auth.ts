import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError, AuthError, ForbiddenError, SessionKickedError, SessionExpiredError } from '../utils/errors';
import { pool } from '../database/connection';
import { RowDataPacket } from 'mysql2';
import { validateSession, touchSession } from '../services/session.service';

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'customer' | 'admin';
  jti: string; // session ID — must match Redis panel_session:{userId}
}

// Separate our custom user from Passport's user to avoid TS conflicts
declare global {
  namespace Express {
    interface User extends JwtPayload {}
    interface Request {
      user?: User;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  // 1. httpOnly cookie (primary — not readable by JS)
  let rawToken: string | undefined;
  const cookieMatch = (req.headers.cookie || '').match(/(?:^|;\s*)panel_auth=([^;]+)/);
  if (cookieMatch) rawToken = decodeURIComponent(cookieMatch[1]);

  // 2. Authorization header (fallback — for direct API clients / backward compat)
  if (!rawToken) {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) rawToken = header.slice(7);
  }

  if (!rawToken) return next(new AuthError());
  try {
    const decoded = jwt.verify(rawToken, config.jwtSecret) as JwtPayload;

    // Reject tokens that pre-date session enforcement (no jti)
    if (!decoded.jti) return next(new AuthError('Token invalid — please log in again'));

    // Verify user still exists in DB (catches deleted/disabled accounts)
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT role FROM panel_users WHERE id = ?', [decoded.userId]
    );
    if (rows.length === 0) return next(new AuthError('Token invalid or expired'));

    // Single-session + inactivity check
    const status = await validateSession(decoded.userId, decoded.jti);
    if (status === 'kicked')      return next(new SessionKickedError());
    if (status === 'expired')     return next(new SessionExpiredError());
    if (status === 'unavailable') return next(new AppError(503, 'ระบบเซสชันไม่พร้อมใช้งาน กรุณาลองใหม่อีกครู่', 'SESSION_BACKEND_DOWN'));

    // Refresh the 40-min inactivity window (debounced; never blocks the request)
    touchSession(decoded.userId).catch(() => {});

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: rows[0].role,
      jti: decoded.jti,
    } as Express.User;

    next();
  } catch (err) {
    if (err instanceof AuthError || err instanceof SessionKickedError || err instanceof SessionExpiredError) {
      return next(err);
    }
    next(new AuthError('Token invalid or expired'));
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user?.role !== 'admin') return next(new ForbiddenError('Admin only'));
    next();
  });
}
