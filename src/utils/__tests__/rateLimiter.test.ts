/**
 * Rate Limiter Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
 checkRateLimit,
 checkOperationLimit,
 withRateLimit,
 RateLimitError,
 clearRateLimit,
 clearAllRateLimits,
 getRateLimitStatus,
 cleanupExpiredLimits,
 DebouncedRateLimiter,
 RATE_LIMITS
} from '../rateLimiter';

describe('Rate Limiter', () => {
 beforeEach(() => {
 clearAllRateLimits();
 vi.useFakeTimers();
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 describe('RATE_LIMITS', () => {
 it('should have correct API limit', () => {
 expect(RATE_LIMITS.api.maxRequests).toBe(100);
 expect(RATE_LIMITS.api.windowMs).toBe(60000);
 });

 it('should have correct AI limit', () => {
 expect(RATE_LIMITS.ai.maxRequests).toBe(10);
 expect(RATE_LIMITS.ai.windowMs).toBe(60000);
 });

 it('should have correct auth limit', () => {
 expect(RATE_LIMITS.auth.maxRequests).toBe(5);
 expect(RATE_LIMITS.auth.windowMs).toBe(300000);
 });
 });

 describe('checkRateLimit', () => {
 const config = { maxRequests: 3, windowMs: 60000 };

 it('should allow first request', () => {
 const result = checkRateLimit('test-key', config);

 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(2);
 });

 it('should decrement remaining with each request', () => {
 checkRateLimit('test-key', config);
 const result = checkRateLimit('test-key', config);

 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(1);
 });

 it('should block after max requests reached', () => {
 checkRateLimit('test-key', config);
 checkRateLimit('test-key', config);
 checkRateLimit('test-key', config);
 const result = checkRateLimit('test-key', config);

 expect(result.allowed).toBe(false);
 expect(result.remaining).toBe(0);
 });

 it('should reset after window expires', () => {
 checkRateLimit('test-key', config);
 checkRateLimit('test-key', config);
 checkRateLimit('test-key', config);

 // Move time forward past window
 vi.advanceTimersByTime(61000);

 const result = checkRateLimit('test-key', config);

 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(2);
 });

 it('should support key prefix', () => {
 const configWithPrefix = { ...config, keyPrefix: 'prefix' };

 const result1 = checkRateLimit('key', config);
 const result2 = checkRateLimit('key', configWithPrefix);

 // Both should be first request (different keys)
 expect(result1.remaining).toBe(2);
 expect(result2.remaining).toBe(2);
 });

 it('should return correct resetIn time', () => {
 const result = checkRateLimit('test-key', config);

 expect(result.resetIn).toBe(60000);
 });
 });

 describe('checkOperationLimit', () => {
 it('should apply correct limits for api operations', () => {
 const result = checkOperationLimit('api', 'user-1');

 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(99);
 });

 it('should apply correct limits for ai operations', () => {
 const result = checkOperationLimit('ai', 'user-1');

 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(9);
 });

 it('should track limits separately per user', () => {
 checkOperationLimit('ai', 'user-1');
 checkOperationLimit('ai', 'user-1');

 const result1 = checkOperationLimit('ai', 'user-1');
 const result2 = checkOperationLimit('ai', 'user-2');

 expect(result1.remaining).toBe(7);
 expect(result2.remaining).toBe(9);
 });
 });

 describe('RateLimitError', () => {
 it('should create error with message and resetIn', () => {
 const error = new RateLimitError('Too many requests', 30000);

 expect(error.message).toBe('Too many requests');
 expect(error.resetIn).toBe(30000);
 expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
 expect(error.name).toBe('RateLimitError');
 });
 });

 describe('clearRateLimit', () => {
 it('should clear specific rate limit', () => {
 checkRateLimit('key-1', { maxRequests: 3, windowMs: 60000 });
 checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 clearRateLimit('key-1');

 // key-1 should be reset
 const result1 = checkRateLimit('key-1', { maxRequests: 3, windowMs: 60000 });
 // key-2 should still be tracked
 const result2 = checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 expect(result1.remaining).toBe(2);
 expect(result2.remaining).toBe(1);
 });
 });

 describe('clearAllRateLimits', () => {
 it('should clear all rate limits', () => {
 checkRateLimit('key-1', { maxRequests: 3, windowMs: 60000 });
 checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 clearAllRateLimits();

 const result1 = checkRateLimit('key-1', { maxRequests: 3, windowMs: 60000 });
 const result2 = checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 expect(result1.remaining).toBe(2);
 expect(result2.remaining).toBe(2);
 });
 });

 describe('getRateLimitStatus', () => {
 it('should return null for non-existent limit', () => {
 const status = getRateLimitStatus('api', 'unknown-user');
 expect(status).toBeNull();
 });

 it('should return status for existing limit', () => {
 checkOperationLimit('api', 'user-1');
 checkOperationLimit('api', 'user-1');

 const status = getRateLimitStatus('api', 'user-1');

 expect(status).not.toBeNull();
 expect(status!.count).toBe(2);
 expect(status!.maxRequests).toBe(100);
 });

 it('should return null for expired limit', () => {
 checkOperationLimit('api', 'user-1');

 vi.advanceTimersByTime(61000);

 const status = getRateLimitStatus('api', 'user-1');
 expect(status).toBeNull();
 });
 });

 describe('cleanupExpiredLimits', () => {
 it('should remove expired entries', () => {
 checkRateLimit('key-1', { maxRequests: 3, windowMs: 30000 });
 checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 vi.advanceTimersByTime(40000);

 cleanupExpiredLimits();

 // key-1 should be cleaned up (expired)
 // key-2 should still exist (not expired)
 const result1 = checkRateLimit('key-1', { maxRequests: 3, windowMs: 30000 });
 const result2 = checkRateLimit('key-2', { maxRequests: 3, windowMs: 60000 });

 expect(result1.remaining).toBe(2); // Reset
 expect(result2.remaining).toBe(1); // Still tracked
 });
 });

 describe('withRateLimit', () => {
 it('should allow function execution when under limit', async () => {
 const fn = vi.fn().mockResolvedValue('success');
 const getUserId = () => 'user-1';

 const wrapped = withRateLimit('api', getUserId)(fn);
 const result = await wrapped();

 expect(fn).toHaveBeenCalled();
 expect(result).toBe('success');
 });

 it('should throw RateLimitError when limit exceeded', async () => {
 const fn = vi.fn().mockResolvedValue('success');
 const getUserId = () => 'user-1';
 const config = { maxRequests: 2, windowMs: 60000 };

 // Exhaust limit manually
 checkRateLimit('op:api:user-1', config);
 checkRateLimit('op:api:user-1', config);
 checkRateLimit('op:api:user-1', config);

 // This should work because withRateLimit uses checkOperationLimit
 // Let's test with a lower limit type
 const wrapped = withRateLimit('auth', getUserId)(fn);

 // Exhaust auth limit (5 requests)
 for (let i = 0; i < 5; i++) {
 await wrapped();
 }

 await expect(wrapped()).rejects.toThrow(RateLimitError);
 });

 it('should allow execution without tracking when no userId', async () => {
 const fn = vi.fn().mockResolvedValue('success');
 const getUserId = () => undefined;

 const wrapped = withRateLimit('api', getUserId)(fn);

 // Should work even without userId
 const result = await wrapped();

 expect(fn).toHaveBeenCalled();
 expect(result).toBe('success');
 });
 });

 describe('DebouncedRateLimiter', () => {
 it('should execute function after debounce delay', async () => {
 const limiter = new DebouncedRateLimiter('search', 'user-1', 100);
 const fn = vi.fn().mockResolvedValue('result');

 const promise = limiter.execute(fn);

 // Function not called yet
 expect(fn).not.toHaveBeenCalled();

 // Advance past debounce
 vi.advanceTimersByTime(100);

 const result = await promise;

 expect(fn).toHaveBeenCalled();
 expect(result).toBe('result');
 });

 it('should cancel previous execution on new call', async () => {
 const limiter = new DebouncedRateLimiter('search', 'user-1', 100);
 const fn1 = vi.fn().mockResolvedValue('first');
 const fn2 = vi.fn().mockResolvedValue('second');

 limiter.execute(fn1);

 vi.advanceTimersByTime(50);

 const promise = limiter.execute(fn2);

 vi.advanceTimersByTime(100);

 await promise;

 expect(fn1).not.toHaveBeenCalled();
 expect(fn2).toHaveBeenCalled();
 });

 it('should cancel pending execution', () => {
 const limiter = new DebouncedRateLimiter('search', 'user-1', 100);
 const fn = vi.fn().mockResolvedValue('result');

 limiter.execute(fn);
 limiter.cancel();

 vi.advanceTimersByTime(200);

 expect(fn).not.toHaveBeenCalled();
 });
 });
});
