import { sign, verify, decode, JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'SENTINEL_GRC_JWT_SECRET_CHANGE_IN_PROD';
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
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Decode token without verification
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      return decode(token) as TokenPayload;
    } catch {
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
