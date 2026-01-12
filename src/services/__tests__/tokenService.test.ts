/**
 * TokenService Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment first
vi.stubEnv('VITE_JWT_SECRET', 'test-jwt-secret-for-testing');

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-session-id'),
}));

vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

// Import after mocking
import { TokenService } from '../tokenService';

describe('TokenService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateTokens', () => {
        it('should generate access and refresh tokens', () => {
            const { accessToken, refreshToken, sessionId } = TokenService.generateTokens('user-1', 'admin');

            expect(accessToken).toBeTruthy();
            expect(refreshToken).toBeTruthy();
            expect(sessionId).toBe('test-session-id');
            expect(typeof accessToken).toBe('string');
            expect(typeof refreshToken).toBe('string');
        });

        it('should generate different tokens for different users', () => {
            const tokens1 = TokenService.generateTokens('user-1', 'admin');
            const tokens2 = TokenService.generateTokens('user-2', 'user');

            expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
            expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
        });
    });

    describe('verifyToken', () => {
        it('should verify a valid access token', () => {
            const { accessToken } = TokenService.generateTokens('user-1', 'admin');
            const decoded = TokenService.verifyToken(accessToken);

            expect(decoded.userId).toBe('user-1');
            expect(decoded.role).toBe('admin');
        });

        it('should throw for invalid token', () => {
            expect(() => TokenService.verifyToken('invalid-token')).toThrow('Invalid or expired token');
        });

        it('should throw for malformed token', () => {
            expect(() => TokenService.verifyToken('not.a.valid.jwt')).toThrow('Invalid or expired token');
        });
    });

    describe('decodeToken', () => {
        it('should decode a valid token without verification', () => {
            const { accessToken } = TokenService.generateTokens('user-1', 'rssi');
            const decoded = TokenService.decodeToken(accessToken);

            expect(decoded).not.toBeNull();
            expect(decoded?.userId).toBe('user-1');
            expect(decoded?.role).toBe('rssi');
        });

        it('should return null for invalid token', () => {
            const result = TokenService.decodeToken('invalid');
            expect(result).toBeNull();
        });
    });

    describe('isTokenExpired', () => {
        it('should return false for fresh token', () => {
            const { accessToken } = TokenService.generateTokens('user-1', 'admin');
            expect(TokenService.isTokenExpired(accessToken)).toBe(false);
        });

        it('should return true for token without exp', () => {
            expect(TokenService.isTokenExpired('invalid')).toBe(true);
        });
    });

    describe('refreshTokens', () => {
        it('should refresh tokens using valid refresh token', () => {
            const { refreshToken } = TokenService.generateTokens('user-1', 'admin');
            const newTokens = TokenService.refreshTokens(refreshToken);

            expect(newTokens.accessToken).toBeTruthy();
            expect(newTokens.refreshToken).toBeTruthy();
        });

        it('should throw when using access token as refresh token', () => {
            const { accessToken } = TokenService.generateTokens('user-1', 'admin');
            expect(() => TokenService.refreshTokens(accessToken)).toThrow('Invalid refresh token');
        });

        it('should throw for invalid refresh token', () => {
            expect(() => TokenService.refreshTokens('invalid-refresh-token')).toThrow('Invalid or expired token');
        });
    });
});
