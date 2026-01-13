/**
 * EncryptionService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CryptoJS
vi.mock('crypto-js', () => ({
    default: {
        AES: {
            encrypt: vi.fn((data: string) => ({
                toString: () => `encrypted_${data}`
            })),
            decrypt: vi.fn((data: string) => ({
                toString: (encoding: unknown) => data.replace('encrypted_', '')
            }))
        },
        enc: {
            Utf8: 'utf8'
        }
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock import.meta.env
const originalEnv = import.meta.env;

describe('EncryptionService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        // Reset env
        import.meta.env.VITE_ENCRYPTION_KEY = 'test-encryption-key';
        import.meta.env.DEV = true;
        import.meta.env.PROD = false;
    });

    describe('encrypt', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const result = EncryptionService.encrypt('');
            expect(result).toBe('');
        });

        it('should encrypt data with ENC:: prefix', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const result = EncryptionService.encrypt('test data');
            expect(result).toMatch(/^ENC::/);
        });

        it('should produce encrypted output', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const result = EncryptionService.encrypt('sensitive data');
            expect(result).not.toBe('sensitive data');
            expect(result.startsWith('ENC::')).toBe(true);
        });
    });

    describe('decrypt', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const result = EncryptionService.decrypt('');
            expect(result).toBe('');
        });

        it('should return plaintext as-is if not encrypted', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const result = EncryptionService.decrypt('plain text');
            expect(result).toBe('plain text');
        });

        it('should decrypt encrypted data', async () => {
            const { EncryptionService } = await import('../encryptionService');

            // The mock just removes the encrypted_ prefix
            const result = EncryptionService.decrypt('ENC::encrypted_test data');
            expect(result).toBe('test data');
        });
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted data', async () => {
            const { EncryptionService } = await import('../encryptionService');

            expect(EncryptionService.isEncrypted('ENC::some-encrypted-data')).toBe(true);
        });

        it('should return false for plaintext data', async () => {
            const { EncryptionService } = await import('../encryptionService');

            expect(EncryptionService.isEncrypted('plain text')).toBe(false);
        });

        it('should return false for empty string', async () => {
            const { EncryptionService } = await import('../encryptionService');

            expect(EncryptionService.isEncrypted('')).toBe(false);
        });

        it('should return false for null/undefined', async () => {
            const { EncryptionService } = await import('../encryptionService');

            expect(EncryptionService.isEncrypted(null as unknown as string)).toBe(false);
            expect(EncryptionService.isEncrypted(undefined as unknown as string)).toBe(false);
        });
    });

    describe('round trip', () => {
        it('should encrypt and decrypt back to original', async () => {
            const { EncryptionService } = await import('../encryptionService');

            const original = 'secret message';
            const encrypted = EncryptionService.encrypt(original);
            const decrypted = EncryptionService.decrypt(encrypted);

            expect(decrypted).toBe(original);
        });
    });
});
