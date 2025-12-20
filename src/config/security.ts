import { Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import securityHeaders from '../middleware/securityHeaders';

// Configuration du rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer après 15 minutes'
  }
});

// Configuration de la politique de sécurité du contenu (CSP)
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'"
    ],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
  }
};

// Configuration de Helmet avec des options personnalisées
// Utilisation de l'approche chaînée pour éviter les problèmes de typage
const configureHelmet = () => {
  return [
    helmet.contentSecurityPolicy(cspConfig),
    helmet.hsts({
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true
    }),
    helmet.frameguard({ action: 'deny' }),
    helmet.noSniff(),
    helmet.xssFilter(),
    helmet.hidePoweredBy(),
    helmet.ieNoOpen(),
    helmet.referrerPolicy({ policy: 'same-origin' })
  ];
};

/**
 * Configure la sécurité de l'application Express
 */
export const configureSecurity = (app: Express) => {
  // Appliquer Helmet avec la configuration
  configureHelmet().forEach(middleware => app.use(middleware));
  
  // Appliquer les en-têtes de sécurité personnalisés
  app.use(securityHeaders);
  
  // Limiter les requêtes pour l'API
  app.use('/api/', apiLimiter);
  
  // Désactiver l'en-tête X-Powered-By
  app.disable('x-powered-by');
  
  // Protéger contre les attaques par injection de requêtes HTTP
  app.use((req, _res, next) => {
    // Protection contre les attaques par injection de type HTTP Parameter Pollution
    if (req.query && typeof req.query === 'object') {
      // Nettoyer les paramètres de requête
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = (req.query[key] as string).replace(/[^a-zA-Z0-9_\-\s]/g, '');
        }
      }
    }
    next();
  });
  
  // Journalisation des accès
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  });
};

/**
 * Configuration CORS sécurisée
 */
export const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [/yourdomain\.com$/, /your-app\.vercel\.app$/]
    : ['http://localhost:3000', 'http://localhost:3001'],
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
