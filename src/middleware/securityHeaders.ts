import { Request, Response, NextFunction } from 'express';

const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // En-têtes de sécurité de base
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS - Strict-Transport-Security
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  const csp = [
    "default-src 'self';",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: https:;",
    "font-src 'self';",
    "connect-src 'self' https:;",
    "frame-ancestors 'none';",
    "form-action 'self';",
    "base-uri 'self';",
    "object-src 'none';"
  ].join(' ');

  res.setHeader('Content-Security-Policy', csp);
  
  next();
};

export default securityHeaders;
