import { logger } from '../utils/logger';
import { Router } from 'express';
import passport from 'passport';
import https from 'https';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { asyncRoute } from '../middleware/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { type JwtPayload } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { validateSession, createOAuthExchangeCode, consumeOAuthExchangeCode } from '../services/session.service';
import { turnstileService } from '../services/turnstile.service';
import { ValidationError, AuthError } from '../utils/errors';
import { config } from '../config';

const router = Router();

// Strict per-IP limiter for brute-force-attractive endpoints. Turnstile gates these at
// the application layer; this is the network-layer fallback. 20 attempts / 15min is
// generous for a legitimate user mistyping but stops password-spray.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again in 15 minutes.' },
});

const PANEL_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24h — matches JWT expiry
  path: '/',
};

// Configure Passport Strategies
if (config.google.clientId && config.google.clientSecret) {
  passport.use(new GoogleStrategy({
    clientID: config.google.clientId,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackUrl,
    scope: ['profile', 'email']
  }, (accessToken, refreshToken, profile, done) => {
    done(null, profile as any);
  }));
}

if (config.facebook.appId && config.facebook.appSecret) {
  passport.use(new FacebookStrategy({
    clientID: config.facebook.appId,
    clientSecret: config.facebook.appSecret,
    callbackURL: config.facebook.callbackUrl,
    profileFields: ['id', 'displayName', 'emails', 'photos']
  }, (accessToken, refreshToken, profile, done) => {
    done(null, profile as any);
  }));
}

// Google Login
router.get('/google', passport.authenticate('google', { session: false }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${config.urls.frontend}/?error=auth_failed` }), asyncRoute(async (req, res) => {
  const profile = req.user as any;
  const email = profile.emails?.[0]?.value;
  const displayName = profile.displayName || profile.name?.givenName || 'Google User';
  const avatarUrl = profile.photos?.[0]?.value;

  if (!email) return res.redirect(`${config.urls.frontend}/?error=no_email`);

  const result = await authService.handleSocialLogin(email, profile.id, 'google', displayName, avatarUrl, req.ip);
  // Store the JWT under a short-lived opaque code so it never lands in URLs/logs.
  const code = await createOAuthExchangeCode(result.token);
  res.redirect(`${config.urls.frontend}/?code=${encodeURIComponent(code)}`);
}));

// Facebook Login - Initial redirect
router.get('/facebook', passport.authenticate('facebook', { session: false, scope: ['email'] }));

// Custom Facebook Callback to bypass library connection issues
router.get('/facebook/callback', asyncRoute(async (req, res) => {
  const { code, error, error_description } = req.query;
  
  if (error || !code) {
    logger.error('Facebook Auth Error:', error, error_description);
    return res.redirect(`${config.urls.frontend}/?error=auth_failed`);
  }

  try {
    // Helper function for manual HTTPS GET requests
    const fetchJson = (url: string): Promise<any> => new Promise((resolve, reject) => {
      const options = {
        timeout: 15000,
        family: 4, // Force IPv4 — avoids happy-eyeballs AggregateError when IPv6 is unreachable
        headers: { 'Accept': 'application/json' }
      };
      https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Failed to parse Facebook response')); }
        });
      }).on('error', reject).on('timeout', () => reject(new Error('Facebook connection timeout')));
    });

    // 1. Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${config.facebook.appId}&client_secret=${config.facebook.appSecret}&redirect_uri=${encodeURIComponent(config.facebook.callbackUrl)}&code=${code}`;
    const tokenData = await fetchJson(tokenUrl);

    if (!tokenData || tokenData.error) {
      throw new Error(tokenData?.error?.message || 'Token exchange failed');
    }
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const profileUrl = `https://graph.facebook.com/v21.0/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`;
    const profile = await fetchJson(profileUrl);

    if (!profile || profile.error) {
      throw new Error(profile?.error?.message || 'Profile fetch failed');
    }

    const email = profile.email || `${profile.id}@facebook.com`;
    const displayName = profile.name || 'Facebook User';
    const avatarUrl = profile.picture?.data?.url;

    const result = await authService.handleSocialLogin(email, profile.id, 'facebook', displayName, avatarUrl, req.ip);
    const exchangeCode = await createOAuthExchangeCode(result.token);
    res.redirect(`${config.urls.frontend}/?code=${encodeURIComponent(exchangeCode)}`);
  } catch (err: any) {
    logger.error('Facebook OAuth Manual Error:', err?.message || err);
    res.redirect(`${config.urls.frontend}/?error=auth_failed`);
  }
}));

// Frontend reads this on mount to decide whether to render the Turnstile widget and which
// site key to use. No auth required — site key is public by Cloudflare's design.
router.get('/config', asyncRoute(async (_req, res) => {
  const captcha = await turnstileService.getPublicConfig();
  res.json({ captcha });
}));

router.post('/register', loginLimiter, asyncRoute(async (req, res) => {
  const { email, password, displayName, phone, captchaToken, acceptedTerms, termsVersion } = req.body;
  if (!email || !password || !displayName) throw new ValidationError('กรุณากรอกข้อมูลให้ครบ');
  if (!acceptedTerms) throw new ValidationError('กรุณายอมรับข้อกำหนดและนโยบายก่อนสมัครสมาชิก');
  // Verify CAPTCHA BEFORE creating any DB rows so failed-bot attempts don't bloat panel_users.
  await turnstileService.verify(captchaToken, req.ip);
  const result = await authService.register(
    email.trim().toLowerCase(), password, displayName.trim(), phone?.trim(), req.ip,
    { acceptedTerms: true, termsVersion: typeof termsVersion === 'string' ? termsVersion : undefined },
  );
  res.cookie('panel_auth', result.token, PANEL_COOKIE_OPTS)
     .status(201).json({ success: true, user: result.user });
}));

router.post('/login', loginLimiter, asyncRoute(async (req, res) => {
  const { email, password, captchaToken } = req.body;
  if (!email || !password) throw new ValidationError('กรุณากรอกอีเมลและรหัสผ่าน');
  await turnstileService.verify(captchaToken, req.ip);
  const result = await authService.login(email.trim().toLowerCase(), password);
  res.cookie('panel_auth', result.token, PANEL_COOKIE_OPTS)
     .json({ success: true, user: result.user });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const profile = await authService.getProfile(req.user!.userId);
  res.json(profile);
}));

router.put('/me', requireAuth, asyncRoute(async (req, res) => {
  const { displayName, phone } = req.body;
  await authService.updateProfile(req.user!.userId, { displayName, phone });
  res.json({ success: true });
}));

router.put('/me/password', requireAuth, asyncRoute(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) throw new ValidationError('กรุณากรอกข้อมูลให้ครบ');
  await authService.changePassword(req.user!.userId, oldPassword, newPassword);
  res.json({ success: true });
}));

// Authenticated logout — invalidates the server-side session so the JWT cannot be reused
router.post('/logout', requireAuth, asyncRoute(async (req, res) => {
  await authService.logout(req.user!.userId);
  res.clearCookie('panel_auth', { path: '/' })
     .json({ success: true, message: 'Logged out' });
}));

// Exchange a one-time OAuth code (preferred) or legacy URL JWT for an httpOnly cookie session.
// The code variant keeps the JWT out of Referer headers, NPM/Cloudflare logs, and browser history.
router.post('/exchange', asyncRoute(async (req, res) => {
  const { code, token: legacyToken } = req.body as { code?: string; token?: string };

  // Prefer the one-time code; fall back to the legacy JWT-in-body shape during rollout.
  let token: string | null = null;
  if (typeof code === 'string' && code.length > 0) {
    token = await consumeOAuthExchangeCode(code);
    if (!token) throw new AuthError('Code expired or already used');
  } else if (typeof legacyToken === 'string' && legacyToken.length > 0) {
    token = legacyToken;
  } else {
    throw new ValidationError('Missing exchange code');
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
  } catch {
    throw new AuthError('Invalid or expired token');
  }

  if (!decoded.jti) throw new AuthError('Token invalid');

  // Verify session still exists in Redis (not kicked/expired)
  const status = await validateSession(decoded.userId, decoded.jti);
  if (status === 'kicked' || status === 'expired') throw new AuthError('Session no longer valid');
  if (status === 'unavailable') throw new AuthError('Session backend unavailable, please retry');

  // Fetch fresh profile
  const profile = await authService.getProfile(decoded.userId);

  res.cookie('panel_auth', token, PANEL_COOKIE_OPTS)
     .json({ success: true, user: profile });
}));

export default router;
