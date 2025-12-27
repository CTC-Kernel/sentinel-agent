import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/tokenService';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    sessionId: string;
  };
}

export const authenticate = (requiredRole?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Récupérer le token depuis le header Authorization
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No token provided or invalid token format'
        });
      }

      const token = authHeader.split(' ')[1];

      try {
        // Vérifier et décoder le token
        const decoded = TokenService.verifyToken(token);

        // Vérifier les rôles si nécessaire
        if (requiredRole && decoded.role !== requiredRole) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions'
          });
        }

        // Ajouter les informations utilisateur à la requête
        (req as AuthenticatedRequest).user = {
          id: decoded.userId,
          role: decoded.role,
          sessionId: decoded.sessionId
        };

        next();
      } catch (error: unknown) {
        // Gestion des erreurs spécifiques
        if (error instanceof Error && error.message === 'Invalid or expired token') {
          logger.warn({ err: error }, 'Invalid or expired token');
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      logger.error({ err: error }, 'Authentication error');
      return res.status(500).json({
        error: 'Authentication Error',
        message: 'An error occurred during authentication'
      });
    }
  };
};

// Middleware pour le renouvellement de token
export const refreshTokenMiddleware = async (
  req: Request,
  res: Response
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    const tokens = TokenService.refreshTokens(refreshToken);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900 // 15 minutes en secondes
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    logger.error({ err: error }, 'Token refresh error');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token'
    });
    return; // Ajout d'un return pour éviter l'appel à next()
  }
};

// Middleware pour le contrôle d'accès basé sur les rôles
export const checkRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as AuthenticatedRequest).user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const userRole = (req as AuthenticatedRequest).user!.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions for this action'
      });
    }

    next();
  };
};
