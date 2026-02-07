import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import { logger } from '../utils/logger';
import { ErrorLogger } from '../services/errorLogger';

// Configuration du rate limiting pour l'API
export const apiLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, // 15 minutes
 max: 100, // Limite chaque IP à 100 requêtes par fenêtre
 standardHeaders: true,
 legacyHeaders: false,
 message: {
 error: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes'
 },
 skip: (req: Request) => {
 const ignoredPaths = ['/api/health', '/api/status'];
 return ignoredPaths.some(path => req.path.startsWith(path));
 }
});

// Configuration de la politique de sécurité du contenu (CSP) avec nonce optionnel
const getCspConfig = (nonce?: string) => ({
 directives: {
 defaultSrc: ["'self'"],
 scriptSrc: [
 "'self'",
 'https://www.googletagmanager.com',
 'https://www.google-analytics.com',
 'https://www.google.com/recaptcha/',
 'https://www.gstatic.com/recaptcha/',
 ...(nonce ? [`'nonce-${nonce}'`] : [])
 ],
 styleSrc: [
 "'self'",
 "'unsafe-inline'",
 'https://fonts.googleapis.com'
 ],
 imgSrc: [
 "'self'",
 'data:',
 'https:',
 'https://*.google-analytics.com',
 'https://www.googletagmanager.com',
 'https://www.google.com/recaptcha/',
 'https://www.gstatic.com/recaptcha/'
 ],
 fontSrc: [
 "'self'",
 'data:',
 'https:',
 'https://fonts.gstatic.com'
 ],
 connectSrc: [
 "'self'",
 'https://*.google-analytics.com',
 'https://*.firebaseio.com',
 'wss://*.firebaseio.com',
 'https://*.cloudfunctions.net'
 ],
 frameSrc: [
 "'self'",
 'https://www.google.com/recaptcha/',
 'https://recaptcha.google.com/recaptcha/'
 ],
 frameAncestors: ["'self'"],
 formAction: ["'self'"],
 baseUri: ["'self'"],
 objectSrc: ["'none'"],
 upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
 },
 reportOnly: process.env.NODE_ENV === 'development',
 reportUri: '/api/security/csp-violation'
});

// Middleware pour générer un nonce CSP par requête
const cspNonceMiddleware = (_req: Request, res: Response, next: NextFunction) => {
 try {
 res.locals.cspNonce = randomBytes(16).toString('base64');
 next();
 } catch (error) {
   ErrorLogger.error(error, 'security');
 logger.error({ err: error }, 'Erreur lors de la génération du nonce CSP');
 next(error);
 }
};

// Configuration de Helmet avec les options de sécurité
const configureHelmet = (nonce?: string) => {
 return helmet({
 contentSecurityPolicy: getCspConfig(nonce),
 hsts: {
 maxAge: 63072000, // 2 ans
 includeSubDomains: true,
 preload: true
 },
 frameguard: {
 action: 'deny'
 },
 referrerPolicy: {
 policy: 'same-origin'
 },
 xssFilter: true,
 noSniff: true,
 hidePoweredBy: true,
 dnsPrefetchControl: {
 allow: false
 }
 });
};

/**
 * Configure la sécurité de l'application Express
 */
export const configureSecurity = (app: Express) => {
 // Générer le nonce CSP avant Helmet
 app.use(cspNonceMiddleware);

 // Appliquer le rate limiting aux routes API
 app.use('/api/', apiLimiter);

 // Configuration de Helmet avec les options de sécurité et nonce dynamique
 app.use((req: Request, res: Response, next: NextFunction) => {
 const nonce = res.locals.cspNonce as string | undefined;
 return configureHelmet(nonce)(req, res, next);
 });

 // Désactiver l'en-tête X-Powered-By
 app.disable('x-powered-by');

 // Middleware pour ajouter des en-têtes de sécurité supplémentaires
 app.use((req: Request, res: Response, next: NextFunction) => {
 // Headers de sécurité supplémentaires
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('X-Frame-Options', 'DENY');
 res.setHeader('X-XSS-Protection', '1; mode=block');

 // Prévention de la mise en cache pour les API
 if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
 res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
 res.setHeader('Pragma', 'no-cache');
 res.setHeader('Expires', '0');
 res.setHeader('Surrogate-Control', 'no-store');
 }

 next();
 });

 // Protéger contre les attaques par pollution de paramètres
 app.use((req: Request, _res: Response, next: NextFunction) => {
 if (req.query && typeof req.query === 'object') {
 Object.keys(req.query).forEach((key) => {
 const value = req.query[key];
 if (typeof value === 'string') {
 req.query[key] = value.replace(/[<>{}()|\\`'"]/g, '');
 }
 });
 }
 next();
 });

 // Journalisation des accès
 app.use((req: Request, res: Response, next: NextFunction) => {
 const start = Date.now();

 res.on('finish', () => {
 const duration = Date.now() - start;
 logger.info({
 method: req.method,
 path: req.originalUrl,
 statusCode: res.statusCode,
 duration
 }, 'HTTP request completed');
 });

 next();
 });

 // Middleware pour la journalisation des violations CSP
 app.post('/api/security/csp-violation', (req: Request, res: Response) => {
 if (req.body) {
 logger.warn({ violation: req.body }, 'CSP violation reported');
 }
 res.status(204).end();
 });
};

/**
 * Configuration CORS sécurisée
 */
export const corsOptions = {
 origin: process.env.NODE_ENV === 'production'
 ? [/cyber-threat-consulting\.com$/, /sentinel-grc-a8701\.web\.app$/, /sentinel-grc-a8701\.firebaseapp\.com$/]
 : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
 allowedHeaders: ['Content-Type', 'Authorization'],
 credentials: true,
 maxAge: 600, // Durée de mise en cache des pré-vérifications CORS (en secondes)
 optionsSuccessStatus: 200 // Certains navigateurs ont des problèmes avec 204
};

/**
 * Configuration du rate limiting pour l'authentification
 */
export const authLimiter = rateLimit({
 windowMs: 15 * 60 * 1000, // 15 minutes
 max: 5, // Limiter à 5 tentatives de connexion par fenêtre
 message: {
 error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.'
 }
});
