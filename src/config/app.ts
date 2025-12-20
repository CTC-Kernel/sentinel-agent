import express, { Express } from 'express';
import cors from 'cors';
import { configureSecurity, corsOptions } from './security';
import { authenticate } from '../middleware/authMiddleware';

/**
 * Configure l'application Express avec les middlewares nécessaires
 */
export const configureApp = (): Express => {
  const app = express();

  // Middleware de base
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  
  // Configuration CORS
  app.use(cors(corsOptions));
  
  // Configuration de la sécurité
  configureSecurity(app);

  // Routes publiques
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Middleware d'authentification pour les routes protégées
  app.use('/api', authenticate());

  // Gestion des erreurs 404
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `La ressource demandée (${req.originalUrl}) n'existe pas.`
    });
  });

  // Gestion des erreurs globales
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Erreur non gérée :', err);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Une erreur inattendue est survenue.'
    });
  });

  return app;
};

/**
 * Démarre le serveur Express
 */
export const startServer = (port: number | string, app: Express): void => {
  const server = app.listen(port, () => {
    console.log(`🚀 Serveur démarré sur le port ${port}`);
    console.log(`🛡️  Environnement: ${process.env.NODE_ENV || 'development'}`);
  });

  // Gestion des erreurs non capturées
  process.on('unhandledRejection', (reason: Error) => {
    console.error('Unhandled Rejection at:', reason.stack || reason);
    // Fermeture propre du serveur
    server.close(() => {
      process.exit(1);
    });
  });

  // Gestion des signaux d'arrêt
  const shutdown = (signal: string) => {
    console.log(`${signal} reçu. Arrêt du serveur...`);
    server.close(() => {
      console.log('Serveur arrêté.');
      process.exit(0);
    });
  };

  // Écoute des signaux d'arrêt
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
