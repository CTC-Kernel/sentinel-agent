import { sign, verify, decode, JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { ErrorLogger } from './errorLogger';

interface TokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
  role: string;
}

// JWT_SECRET must be set in environment variables for production security
const getJwtSecret = (): string => {
  const secret = import.meta.env.VITE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    // In development/demo mode, use a default secret with warning
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
      ErrorLogger.warn('JWT_SECRET not configured. Using default for development only.', 'TokenService.getJwtSecret');
      return 'SENTINEL_DEV_JWT_SECRET_NOT_FOR_PRODUCTION';
    }
    throw new Error('JWT_SECRET must be configured in production environment');
  }
  return secret;
};

const JWT_SECRET = getJwtSecret();
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export class TokenService {
  /**
   * Generate access and refresh tokens
   */
  static generateTokens(userId: string, role: string) {
    const sessionId = uuidv4();
    const accessToken = this.generateAccessToken(userId, sessionId, role);
    const refreshToken = this.generateRefreshToken(userId, sessionId, role);

    return { accessToken, refreshToken, sessionId };
  }

  /**
   * Generate access token with short expiry
   */
  private static generateAccessToken(userId: string, sessionId: string, role: string) {
    return sign(
      { userId, sessionId, role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate refresh token with longer expiry
   */
  private static generateRefreshToken(userId: string, sessionId: string, role: string) {
    return sign(
      { userId, sessionId, role, isRefreshToken: true },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }

  /**
   * Verify and decode a token
   */
  static verifyToken(token: string): TokenPayload {
    try {
      return verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      ErrorLogger.warn(error instanceof Error ? error.message : String(error), 'TokenService.verifyToken');
      throw new Error('Invalid or expired token');
    }
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
   * Refresh access token using refresh token
   */
  static refreshTokens(refreshToken: string) {
    const decoded = this.verifyToken(refreshToken);

    if (decoded.isRefreshToken) {
      return this.generateTokens(decoded.userId, decoded.role);
    }

    throw new Error('Invalid refresh token');
  }
}
