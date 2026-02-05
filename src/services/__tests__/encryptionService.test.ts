/**
 * EncryptionService Tests
 * Epic 14-1: Test Coverage Improvement
 * Updated for Web Crypto API (ENC3::) + backward compat (ENC2::, ENC::)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock CryptoJS for legacy format tests (encryptSync/decryptSync)
vi.mock('crypto-js', () => ({
    default: {
        AES: {
            encrypt: vi.fn((data: string, _key: unknown, _opts?: unknown) => ({
                toString: () => `encrypted_${data}`
            })),
            decrypt: vi.fn((data: string, _key: unknown, _opts?: unknown) => ({
                toString: (encoding?: unknown) => {
                    if (encoding) return data.replace('encrypted_', '');
                    return data;
                }
            }))
        },
        enc: {
            Utf8: 'utf8',
            Hex: {
                parse: vi.fn((hex: string) => ({
                    toString: () => hex
                }))
            }
        },
        lib: {
            WordArray: {
                random: vi.fn((size: number) => ({
                    toString: () => '0'.repeat(size * 2)
                }))
            }
        },
        PBKDF2: vi.fn(() => ({
            toString: () => 'mocked_key'
        }))
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

describe('EncryptionService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        (import.meta.env as Record<string, unknown>).VITE_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
        (import.meta.env as Record<string, unknown>).DEV = true;
        (import.meta.env as Record<string, unknown>).PROD = false;
    });

    describe('encrypt (async, ENC3::)', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = await EncryptionService.encrypt('');
            expect(result).toBe('');
        });

        it('should encrypt data with ENC3:: prefix', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = await EncryptionService.encrypt('test data');
            expect(result).toMatch(/^ENC3::/);
        });

        it('should produce different ciphertext for same input (random salt/iv)', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result1 = await EncryptionService.encrypt('same input');
            const result2 = await EncryptionService.encrypt('same input');
            expect(result1).not.toBe(result2);
        });
    });

    describe('decrypt (async)', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = await EncryptionService.decrypt('');
            expect(result).toBe('');
        });

        it('should return plaintext as-is if not encrypted', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = await EncryptionService.decrypt('plain text');
            expect(result).toBe('plain text');
        });

        it('should decrypt ENC2:: data using legacy CryptoJS', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const saltHex = '0'.repeat(32);
            const ivHex = '0'.repeat(32);
            const result = await EncryptionService.decrypt(`ENC2::${saltHex}${ivHex}encrypted_test data`);
            expect(result).toBe('test data');
        });
    });

    describe('encryptSync (legacy ENC2::)', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = EncryptionService.encryptSync('');
            expect(result).toBe('');
        });

        it('should encrypt data with ENC2:: prefix', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = EncryptionService.encryptSync('test data');
            expect(result).toMatch(/^ENC2::/);
        });
    });

    describe('decryptSync (legacy)', () => {
        it('should return empty string for empty input', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = EncryptionService.decryptSync('');
            expect(result).toBe('');
        });

        it('should return plaintext as-is if not encrypted', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = EncryptionService.decryptSync('plain text');
            expect(result).toBe('plain text');
        });

        it('should return error marker for ENC3:: data', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const result = EncryptionService.decryptSync('ENC3::somepayload');
            expect(result).toBe('[Async Decryption Required]');
        });
    });

    describe('round trip (async ENC3::)', () => {
        it('should encrypt and decrypt back to original', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const original = 'secret message with unicode: éàü 🔒';
            const encrypted = await EncryptionService.encrypt(original);
            expect(encrypted).toMatch(/^ENC3::/);
            const decrypted = await EncryptionService.decrypt(encrypted);
            expect(decrypted).toBe(original);
        });

        it('should handle long strings', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const original = 'x'.repeat(10000);
            const encrypted = await EncryptionService.encrypt(original);
            const decrypted = await EncryptionService.decrypt(encrypted);
            expect(decrypted).toBe(original);
        });
    });

    describe('isEncrypted', () => {
        it('should return true for ENC3:: data', async () => {
            const { EncryptionService } = await import('../encryptionService');
            expect(EncryptionService.isEncrypted('ENC3::some-data')).toBe(true);
        });

        it('should return true for ENC2:: data', async () => {
            const { EncryptionService } = await import('../encryptionService');
            expect(EncryptionService.isEncrypted('ENC2::some-data')).toBe(true);
        });

        it('should return true for ENC:: data', async () => {
            const { EncryptionService } = await import('../encryptionService');
            expect(EncryptionService.isEncrypted('ENC::some-data')).toBe(true);
        });

        it('should return false for plaintext data', async () => {
            const { EncryptionService } = await import('../encryptionService');
            expect(EncryptionService.isEncrypted('plain text')).toBe(false);
        });

        it('should return false for empty/null/undefined', async () => {
            const { EncryptionService } = await import('../encryptionService');
            expect(EncryptionService.isEncrypted('')).toBe(false);
            expect(EncryptionService.isEncrypted(null as unknown as string)).toBe(false);
            expect(EncryptionService.isEncrypted(undefined as unknown as string)).toBe(false);
        });
    });

    describe('sha256', () => {
        it('should hash a string to hex', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const hash = await EncryptionService.sha256('hello');
            // Known SHA-256 of "hello"
            expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
        });

        it('should produce consistent results', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const hash1 = await EncryptionService.sha256('test');
            const hash2 = await EncryptionService.sha256('test');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const hash1 = await EncryptionService.sha256('a');
            const hash2 = await EncryptionService.sha256('b');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('sha256Buffer', () => {
        it('should hash an ArrayBuffer to hex', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const encoder = new TextEncoder();
            const buffer = encoder.encode('hello').buffer;
            const hash = await EncryptionService.sha256Buffer(buffer);
            expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
        });

        it('should produce same hash as sha256 for same content', async () => {
            const { EncryptionService } = await import('../encryptionService');
            const text = 'some content to hash';
            const stringHash = await EncryptionService.sha256(text);
            const encoder = new TextEncoder();
            const bufferHash = await EncryptionService.sha256Buffer(encoder.encode(text).buffer);
            expect(stringHash).toBe(bufferHash);
        });
    });
});
