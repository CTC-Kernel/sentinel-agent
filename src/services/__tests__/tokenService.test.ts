/**
 * TokenService Tests
 * Story 13-4: Test Coverage Improvement
 *
 * NOTE: Token generation and verification methods are now server-only.
 * These tests verify the client-side methods (decodeToken, isTokenExpired) work correctly
 * and that server-only methods throw appropriate errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

 describe('generateTokens (server-only)', () => {
 it('should throw error indicating method is not available on client', () => {
 expect(() => TokenService.generateTokens('user-1', 'admin')).toThrow(
 'TokenService.generateTokens is not available on the client'
 );
 });
 });

 describe('verifyToken (server-only)', () => {
 it('should throw error indicating method is not available on client', () => {
 expect(() => TokenService.verifyToken('some-token')).toThrow(
 'TokenService.verifyToken is not available on the client'
 );
 });
 });

 describe('decodeToken', () => {
 it('should return null for invalid token', () => {
 const result = TokenService.decodeToken('invalid');
 expect(result).toBeNull();
 });

 it('should return null for malformed JWT', () => {
 const result = TokenService.decodeToken('not.a.valid.jwt.format');
 expect(result).toBeNull();
 });

 it('should decode a valid JWT without verification', () => {
 // Create a valid JWT structure (header.payload.signature)
 // This is a test JWT with payload: { userId: 'user-1', role: 'admin', sessionId: 'test-session', exp: future_timestamp }
 const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
 const payload = btoa(JSON.stringify({
 userId: 'user-1',
 role: 'admin',
 sessionId: 'test-session',
 exp: Math.floor(Date.now() / 1000) + 3600
 }));
 const signature = 'test-signature';
 const testJwt = `${header}.${payload}.${signature}`;

 const decoded = TokenService.decodeToken(testJwt);

 expect(decoded).not.toBeNull();
 expect(decoded?.userId).toBe('user-1');
 expect(decoded?.role).toBe('admin');
 });
 });

 describe('isTokenExpired', () => {
 it('should return true for invalid token', () => {
 expect(TokenService.isTokenExpired('invalid')).toBe(true);
 });

 it('should return true for token without exp claim', () => {
 const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
 const payload = btoa(JSON.stringify({ userId: 'user-1' })); // No exp
 const testJwt = `${header}.${payload}.signature`;

 expect(TokenService.isTokenExpired(testJwt)).toBe(true);
 });

 it('should return false for token with future exp', () => {
 const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
 const payload = btoa(JSON.stringify({
 userId: 'user-1',
 exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour in future
 }));
 const testJwt = `${header}.${payload}.signature`;

 expect(TokenService.isTokenExpired(testJwt)).toBe(false);
 });

 it('should return true for expired token', () => {
 const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
 const payload = btoa(JSON.stringify({
 userId: 'user-1',
 exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour in past
 }));
 const testJwt = `${header}.${payload}.signature`;

 expect(TokenService.isTokenExpired(testJwt)).toBe(true);
 });
 });

 describe('refreshTokens (server-only)', () => {
 it('should throw error indicating method is not available on client', () => {
 expect(() => TokenService.refreshTokens('some-refresh-token')).toThrow(
 'TokenService.refreshTokens is not available on the client'
 );
 });
 });
});
