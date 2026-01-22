/**
 * Security Headers Middleware
 * Configure les headers de sécurité HTTP pour l'application
 *
 * À utiliser avec Vite (vite.config.ts) ou un serveur Express
 */

export interface SecurityHeadersConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrame: boolean;
  enableXContentType: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
}

/**
 * Génère les headers de sécurité
 */
export function getSecurityHeaders(config: Partial<SecurityHeadersConfig> = {}): Record<string, string> {
  const {
    enableCSP = true,
    enableHSTS = true,
    enableXFrame = true,
    enableXContentType = true,
    enableReferrerPolicy = true,
    enablePermissionsPolicy = true
  } = config;

  const headers: Record<string, string> = {};

  // Content Security Policy (CSP)
  if (enableCSP) {
    // SECURITY: Production CSP is more restrictive - no unsafe-eval
    const isProduction = process.env.NODE_ENV === 'production';

    const cspDirectives = [
      "default-src 'self'",
      // Scripts: PRODUCTION removes unsafe-eval for security
      // DEV allows unsafe-eval for Vite HMR hot reloading
      isProduction
        ? "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com https://browser.sentry-cdn.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.google.com https://apis.google.com https://browser.sentry-cdn.com",
      // Styles: Autoriser inline styles pour Tailwind et autres
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: Autoriser uniquement HTTPS (Firebase Storage, avatars externes, etc.)
      // SECURITY: http: removed to prevent MITM attacks on images
      "img-src 'self' data: blob: https:",
      // Fonts: Google Fonts et locales
      "font-src 'self' data: https://fonts.gstatic.com",
      // Connect: Firebase, APIs externes
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.sentry.io wss://*.firebaseio.com https://api.stripe.com https://api.sendgrid.com https://n8n.cyber-threat-consulting.com",
      // Media: Firebase Storage
      "media-src 'self' blob: https://*.googleapis.com",
      // Objects: Bloquer Flash/Java
      "object-src 'none'",
      // Base URI: Limiter à self
      "base-uri 'self'",
      // Form actions: Limiter à self et Stripe
      "form-action 'self' https://checkout.stripe.com",
      // Frame ancestors: Empêcher l'embedding (clickjacking)
      "frame-ancestors 'none'",
      // Frames: Autoriser Google (reCAPTCHA, etc.)
      "frame-src 'self' https://www.google.com https://www.gstatic.com https://recaptcha.net https://www.recaptcha.net https://checkout.stripe.com",
      // Worker: Autoriser les service workers
      "worker-src 'self' blob:",
      // Manifest: PWA manifest
      "manifest-src 'self'",
      // Upgrade insecure requests (force HTTPS)
      "upgrade-insecure-requests"
    ];

    headers['Content-Security-Policy'] = cspDirectives.join('; ');
  }

  // HTTP Strict Transport Security (HSTS)
  // Force HTTPS pendant 2 ans, includeSubDomains, preload
  if (enableHSTS) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  // X-Frame-Options: Empêcher le clickjacking
  if (enableXFrame) {
    headers['X-Frame-Options'] = 'DENY';
  }

  // X-Content-Type-Options: Empêcher le MIME sniffing
  if (enableXContentType) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // Referrer-Policy: Limiter les informations de referrer
  if (enableReferrerPolicy) {
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }

  // Permissions-Policy (anciennement Feature-Policy)
  // Désactiver les APIs sensibles
  if (enablePermissionsPolicy) {
    const permissions = [
      'camera=()',           // Pas de caméra
      'microphone=()',       // Pas de micro
      'geolocation=(self)',  // Géolocalisation uniquement pour self
      'payment=(self)',      // Payment API uniquement pour self (Stripe)
      'usb=()',              // Pas d'USB
      'magnetometer=()',     // Pas de magnétomètre
      'gyroscope=()',        // Pas de gyroscope
      'accelerometer=()',    // Pas d'accéléromètre
      'interest-cohort=()'   // Bloquer FLoC (Google privacy)
    ];
    headers['Permissions-Policy'] = permissions.join(', ');
  }

  // X-XSS-Protection: Protection XSS legacy (pour vieux navigateurs)
  headers['X-XSS-Protection'] = '1; mode=block';

  // X-Permitted-Cross-Domain-Policies: Bloquer Flash/PDF cross-domain
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';

  return headers;
}

/**
 * Configure les headers pour Vite dev server
 */
export function configureViteSecurityHeaders() {
  return {
    name: 'security-headers',
    configureServer(server: { middlewares: { use: (arg0: (req: unknown, res: { setHeader: (arg0: string, arg1: string) => void; }, next: () => void) => void) => void; }; }) {
      server.middlewares.use((_req, res, next) => {
        const headers = getSecurityHeaders({
          enableCSP: true,
          enableHSTS: false, // Pas de HSTS en dev (localhost)
          enableXFrame: true,
          enableXContentType: true,
          enableReferrerPolicy: true,
          enablePermissionsPolicy: true
        });

        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        next();
      });
    }
  };
}

/**
 * Headers de sécurité pour Firebase Hosting (firebase.json)
 * À copier dans firebase.json sous "hosting" > "headers"
 */
export const firebaseHostingHeaders = [
  {
    "source": "**",
    "headers": [
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.google.com https://apis.google.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.sentry.io wss://*.firebaseio.com https://api.stripe.com https://api.sendgrid.com; media-src 'self' blob: https://*.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; frame-src 'self' https://www.google.com https://www.gstatic.com https://recaptcha.net https://www.recaptcha.net https://checkout.stripe.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests"
      },
      {
        "key": "Strict-Transport-Security",
        "value": "max-age=63072000; includeSubDomains; preload"
      },
      {
        "key": "X-Frame-Options",
        "value": "DENY"
      },
      {
        "key": "X-Content-Type-Options",
        "value": "nosniff"
      },
      {
        "key": "Referrer-Policy",
        "value": "strict-origin-when-cross-origin"
      },
      {
        "key": "Permissions-Policy",
        "value": "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()"
      },
      {
        "key": "X-XSS-Protection",
        "value": "1; mode=block"
      },
      {
        "key": "X-Permitted-Cross-Domain-Policies",
        "value": "none"
      }
    ]
  },
  {
    "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  },
  {
    "source": "**/*.@(js|css|woff|woff2|ttf|eot)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "public, max-age=31536000, immutable"
      }
    ]
  }
];

/**
 * Configuration Nginx (pour déploiement sur serveur propre)
 */
export const nginxSecurityConfig = `
# Security Headers
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.google.com https://apis.google.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.sentry.io wss://*.firebaseio.com https://api.stripe.com https://api.sendgrid.com; media-src 'self' blob: https://*.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; frame-src 'self' https://www.google.com https://www.gstatic.com https://recaptcha.net https://www.recaptcha.net https://checkout.stripe.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Permitted-Cross-Domain-Policies "none" always;

# Disable server tokens
server_tokens off;

# SSL Configuration (if using custom SSL)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
`;
