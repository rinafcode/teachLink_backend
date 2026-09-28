import { randomBytes, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Session, SessionData } from 'express-session';

export const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_SESSION_KEY = 'csrfToken';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

type CsrfSessionRequest = Request & {
  session?: Session & Partial<SessionData> & { [CSRF_SESSION_KEY]?: string };
};

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function csrfMiddleware(req: CsrfSessionRequest, res: Response, next: NextFunction): void {
  // Preflight and health-check pass through unconditionally
  if (req.method === 'OPTIONS') {
    return next();
  }

  // JWT-authenticated requests carry their own credential; no session cookie
  // is involved so CSRF is not applicable for them.
  if (req.headers['authorization']) {
    return next();
  }

  if (!req.session) {
    return next();
  }

  if (!STATE_CHANGING_METHODS.has(req.method)) {
    if (!req.session[CSRF_SESSION_KEY]) {
      req.session[CSRF_SESSION_KEY] = generateToken();
    }
    res.setHeader(CSRF_TOKEN_HEADER, req.session[CSRF_SESSION_KEY]);
    return next();
  }

  const sessionToken = req.session[CSRF_SESSION_KEY];
  const requestToken = req.headers[CSRF_TOKEN_HEADER] as string | undefined;

  if (!sessionToken || !requestToken || !tokensEqual(sessionToken, requestToken)) {
    res.status(403).json({ message: 'Invalid or missing CSRF token', error: 'Forbidden' });
    return;
  }

  // Rotate after use to prevent replay
  req.session[CSRF_SESSION_KEY] = generateToken();
  res.setHeader(CSRF_TOKEN_HEADER, req.session[CSRF_SESSION_KEY]);
  next();
}
