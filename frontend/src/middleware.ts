import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store (resets on server restart — fine for Next.js edge)
// For multi-instance deployment, replace with Redis
const store = new Map<string, { count: number; resetAt: number }>();

interface LimitRule {
  windowMs: number;
  max: number;
  message: string;
}

const RULES: Record<string, LimitRule> = {
  '/api/auth/login':    { windowMs: 15 * 60 * 1000, max: 20,  message: 'Too many login attempts. Please wait 15 minutes.' },
  '/api/auth/register': { windowMs: 15 * 60 * 1000, max: 10,  message: 'Too many register attempts. Please wait 15 minutes.' },
  '/api/payment':       { windowMs: 10 * 60 * 1000, max: 30,  message: 'Too many payment requests. Please slow down.' },
  '/api/user/redeem-code':   { windowMs: 10 * 60 * 1000, max: 10, message: 'Too many redeem attempts. Please wait 10 minutes.' },
  '/api/payment/slip/verify': { windowMs: 10 * 60 * 1000, max: 15, message: 'Too many slip submissions. Please wait 10 minutes.' },
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

function checkLimit(key: string, rule: LimitRule): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs });
    return true; // allowed
  }

  entry.count++;
  if (entry.count > rule.max) return false; // blocked
  return true; // allowed
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Find matching rule (exact match first, then prefix)
  const rule =
    RULES[path] ||
    Object.entries(RULES).find(([prefix]) => path.startsWith(prefix))?.[1];

  if (rule) {
    const ip = getClientIp(req);
    const key = `${ip}:${path}`;
    const allowed = checkLimit(key, rule);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ success: false, error: rule.message }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/payment/:path*', '/api/user/redeem-code', '/api/payment/slip/verify'],
};
