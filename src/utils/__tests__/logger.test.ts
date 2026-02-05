/**
 * Unit tests for logger.ts
 * Tests pino logger configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
 const originalEnv = process.env.NODE_ENV;

 beforeEach(() => {
 vi.resetModules();
 });

 afterEach(() => {
 process.env.NODE_ENV = originalEnv;
 });

 it('exports a logger instance', async () => {
 const { logger } = await import('../logger');
 expect(logger).toBeDefined();
 expect(typeof logger.info).toBe('function');
 expect(typeof logger.error).toBe('function');
 expect(typeof logger.warn).toBe('function');
 expect(typeof logger.debug).toBe('function');
 });

 it('logger has standard pino methods', async () => {
 const { logger } = await import('../logger');

 expect(typeof logger.trace).toBe('function');
 expect(typeof logger.debug).toBe('function');
 expect(typeof logger.info).toBe('function');
 expect(typeof logger.warn).toBe('function');
 expect(typeof logger.error).toBe('function');
 expect(typeof logger.fatal).toBe('function');
 });

 it('can log info messages', async () => {
 const { logger } = await import('../logger');

 // Should not throw
 expect(() => logger.info('Test info message')).not.toThrow();
 expect(() => logger.info({ data: 'test' }, 'Test with object')).not.toThrow();
 });

 it('can log error messages', async () => {
 const { logger } = await import('../logger');

 expect(() => logger.error('Test error message')).not.toThrow();
 expect(() => logger.error(new Error('Test error'), 'Error occurred')).not.toThrow();
 });

 it('can log warning messages', async () => {
 const { logger } = await import('../logger');

 expect(() => logger.warn('Test warning message')).not.toThrow();
 });

 it('can log debug messages', async () => {
 const { logger } = await import('../logger');

 expect(() => logger.debug('Test debug message')).not.toThrow();
 });

 it('can create child loggers', async () => {
 const { logger } = await import('../logger');

 const childLogger = logger.child({ module: 'test-module' });
 expect(childLogger).toBeDefined();
 expect(typeof childLogger.info).toBe('function');
 });

 it('supports structured logging', async () => {
 const { logger } = await import('../logger');

 expect(() => logger.info({
 action: 'test',
 userId: 'user-123',
 metadata: { key: 'value' }
 }, 'Structured log test')).not.toThrow();
 });

 it('exports Logger type', async () => {
 const loggerModule = await import('../logger');
 expect(loggerModule).toHaveProperty('logger');
 });
});
