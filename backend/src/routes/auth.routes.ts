import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/schemas';
import { auditService } from '../services/audit.service';
import { authenticate } from '../middleware/auth';
import { passwordResetService, ResetError } from '../services/password-reset.service';
import { userService } from '../services/user.service';
import { AuthenticationError, SessionKickedError, SessionExpiredError } from '../utils/errors';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24h — matches JWT expiry
  path: '/',
};

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, user } = await authService.login(req.body.username, req.body.password);
    auditService.log({ userId: user.userId, username: user.username, role: user.role, actionType: 'user_login', description: 'เข้าสู่ระบบ' });
    res.cookie('auth_token', token, COOKIE_OPTS).json({ success: true, message: 'Login successful', user });
  } catch (err) { next(err); }
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, user } = await authService.register(req.body.username, req.body.password, req.body.email);
    res.cookie('auth_token', token, COOKIE_OPTS).json({ success: true, message: 'สมัครสมาชิกสำเร็จ', user });
  } catch (err) { next(err); }
});

/**
 * "Who am I, if anyone" — the call every page makes on load.
 *
 * Runs exactly the same checks as `authenticate`, but a visitor who is simply
 * not logged in is a 200 with `user: null` rather than a 401. The session lives
 * in an httpOnly cookie, so the browser cannot know whether to ask; it always
 * asked, and every anonymous page load logged a failed request to the console.
 * Lighthouse counts those under errors-in-console.
 *
 * SESSION_KICKED still has to reach the client (it drives the "logged in
 * elsewhere" notice), so it comes back as a code on the 200 instead of a status.
 * Anything unexpected is passed to the error handler untouched.
 */
router.get('/session', (req: Request, res: Response, next: NextFunction) => {
  authenticate(req, res, (err?: unknown) => {
    if (!err) {
      userService
        .getProfile(req.user!.userId)
        .then(profile => res.json({ success: true, user: profile }))
        .catch(next);
      return;
    }
    if (err instanceof SessionKickedError) {
      res.json({ success: true, user: null, code: 'SESSION_KICKED' });
      return;
    }
    if (err instanceof AuthenticationError || err instanceof SessionExpiredError) {
      res.json({ success: true, user: null });
      return;
    }
    next(err);
  });
});

// Authenticated logout — invalidates the server-side session so the JWT cannot be reused
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.userId);
    res.clearCookie('auth_token', { path: '/' }).json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
});

// Always returns 200 so attackers can't probe which emails are registered.
router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use req.ip (derived from the configured 'trust proxy' setting) rather than
    // reading X-Forwarded-For directly — the raw header is client-spoofable and
    // would let an attacker rotate it to bypass the per-IP reset throttle.
    const ip = req.ip || req.socket.remoteAddress || undefined;
    await passwordResetService.requestReset(req.body.email, ip);
    res.json({ success: true, message: 'หากอีเมลถูกต้อง ระบบจะส่งรหัส OTP ให้ภายในไม่กี่นาที' });
  } catch (err) { next(err); }
});

router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await passwordResetService.verifyAndReset(req.body.email, req.body.otp, req.body.newPassword);
    res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
  } catch (err) {
    if (err instanceof ResetError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

export default router;
