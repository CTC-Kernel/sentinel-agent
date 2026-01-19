import { decode, JwtPayload } from 'jsonwebtoken';
import { ErrorLogger } from './errorLogger';

/**
 * SECURITY NOTE: JWT signing/verification MUST be done server-side only.
 * This client-side service only provides token decoding (without verification).
 * For token generation and verification, use Firebase Auth or Cloud Functions.
 */

interface TokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
  role: string;
}

// SECURITY: No JWT secret on client - use Firebase Auth tokens instead
const throwServerOnlyError = (methodName: string): never => {
  const error = new Error(
    `TokenService.${methodName} is not available on the client. ` +
    'Use Firebase Auth for authentication or move this logic to Cloud Functions.'
  );
  ErrorLogger.error(error.message, `TokenService.${methodName}`);
  throw error;
};

export class TokenService {
  /**
   * @deprecated Use Firebase Auth instead. Token generation must be server-side.
   * @throws Error - This method is not available on the client
   */
  static generateTokens(_userId: string, _role: string): never {
    throwServerOnlyError('generateTokens');
  }

  /**
   * @deprecated Use Firebase Auth instead. Token generation must be server-side.
   * @throws Error - This method is not available on the client
   */
  private static generateAccessToken(_userId: string, _sessionId: string, _role: string): never {
    throwServerOnlyError('generateAccessToken');
  }

  /**
   * @deprecated Use Firebase Auth instead. Token generation must be server-side.
   * @throws Error - This method is not available on the client
   */
  private static generateRefreshToken(_userId: string, _sessionId: string, _role: string): never {
    throwServerOnlyError('generateRefreshToken');
  }

  /**
   * @deprecated Use Firebase Auth instead. Token verification must be server-side.
   * @throws Error - This method is not available on the client
   */
  static verifyToken(_token: string): never {
    throwServerOnlyError('verifyToken');
  }

  /**
   * Decode token without verification
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      return decode(token) as TokenPayload;
    } catch (error) {
      ErrorLogger.warn(error instanceof Error ? error.message : String(error), 'TokenService.decodeToken');
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  }

  /**
   * @deprecated Use Firebase Auth instead. Token refresh must be server-side.
   * @throws Error - This method is not available on the client
   */
  static refreshTokens(_refreshToken: string): never {
    throwServerOnlyError('refreshTokens');
  }
}
