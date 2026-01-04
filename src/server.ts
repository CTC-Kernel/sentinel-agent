import 'dotenv/config';
import { configureApp, startServer } from './config/app';

// Configuration du port
const PORT = process.env.PORT || 3000;

// Configuration des variables d'environnement requises
const requiredEnvVars = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'NODE_ENV'
];

// Vérification des variables d'environnement requises
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  );
  process.exit(1);
}

// Configuration et démarrage du serveur
const app = configureApp();

// Démarrer le serveur
startServer(PORT, app);

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  process.exit(1);
});

// Gestion des rejets de promesse non gérés
process.on('unhandledRejection', (reason, promise) => {
  });

// Exporter l'application pour les tests
export default app;
