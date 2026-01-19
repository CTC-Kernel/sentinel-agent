import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/tokenService';
import { logger } from '../utils/logger';
import { ErrorLogger } from '../services/errorLogger';

interface TokenPayload {
  userId: string;
  sessionId: string;
  role: string;
}

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
        // Décoder le token (note: verification should be done server-side via Firebase Auth)
        const decoded = TokenService.decodeToken(token) as TokenPayload | null;

        if (!decoded) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token format'
          });
        }

        // Check if token is expired
        if (TokenService.isTokenExpired(token)) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token has expired'
          });
        }

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
      } catch (_error: unknown) {
        // Gestion des erreurs spécifiques
        ErrorLogger.warn(_error instanceof Error ? _error.message : String(_error), 'authMiddleware.validateToken');
        if (_error instanceof Error && _error.message === 'Invalid or expired token') {
          logger.warn({ err: _error }, 'Invalid or expired token');
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
          });
        }
        throw _error;
      }
    } catch (_error) {
      logger.error({ err: _error }, 'Authentication error');
      return res.status(500).json({
        error: 'Authentication Error',
        message: 'An error occurred during authentication'
      });
    }
  };
};

// Middleware pour le renouvellement de token
// Note: Token refresh should be handled via Firebase Auth on the client
// This endpoint is deprecated - use Firebase Auth refresh mechanism instead
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

    // Token refresh is not available on client-side
    // This should be handled via Firebase Auth
    logger.warn('refreshTokenMiddleware called - this is deprecated, use Firebase Auth');
    return res.status(501).json({
      error: 'Not Implemented',
      message: 'Token refresh should be handled via Firebase Auth'
    });
  } catch (_error) {
    logger.error({ err: _error }, 'Token refresh error');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token'
    });
    return;
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

    const authenticatedReq = req as AuthenticatedRequest;
    const userRole = authenticatedReq.user?.role;
    if (!userRole) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User role not found'
      });
    }
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
