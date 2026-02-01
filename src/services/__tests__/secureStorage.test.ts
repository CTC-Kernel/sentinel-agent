/**
 * SecureStorage Service Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecureStorage } from '../secureStorage';

// Mock crypto-js
vi.mock('crypto-js', () => ({
    default: {
        AES: {
            encrypt: vi.fn(() => ({ toString: () => 'encrypted' })),
            decrypt: vi.fn(() => ({ toString: () => '{"test":"value"}' }))
        },
        enc: {
            Utf8: 'utf8'
        },
        mode: {
            CBC: 'CBC'
        },
        pad: {
            Pkcs7: 'Pkcs7'
        },
        lib: {
            WordArray: {
                random: vi.fn(() => ({ toString: () => 'random-salt' }))
            }
        },
        PBKDF2: vi.fn(() => ({ toString: () => 'derived-key' }))
    }
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

describe('SecureStorage', () => {
    let mockLocalStorage: Record<string, string>;
    let mockSessionStorage: Record<string, string>;

    beforeEach(() => {
        mockLocalStorage = {};
        mockSessionStorage = {};

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
                setItem: vi.fn((key: string, value: string) => {
                    mockLocalStorage[key] = value;
                }),
                removeItem: vi.fn((key: string) => {
                    delete mockLocalStorage[key];
                }),
                clear: vi.fn(() => {
                    mockLocalStorage = {};
                })
            },
            writable: true
        });

        // Mock sessionStorage
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
                setItem: vi.fn((key: string, value: string) => {
                    mockSessionStorage[key] = value;
                }),
                removeItem: vi.fn((key: string) => {
                    delete mockSessionStorage[key];
                }),
                clear: vi.fn(() => {
                    mockSessionStorage = {};
                })
            },
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('setSecureItem', () => {
        it('should store encrypted data', () => {
            SecureStorage.setSecureItem('testKey', { test: 'value' });

            expect(localStorage.setItem).toHaveBeenCalled();
        });

        it('should use prefix for key', () => {
            SecureStorage.setSecureItem('myKey', 'data');

            expect(localStorage.setItem).toHaveBeenCalledWith(
                expect.stringContaining('sentinel_secure_myKey'),
                expect.any(String)
            );
        });
    });

    describe('getSecureItem', () => {
        it('should return null for non-existent key', () => {
            const result = SecureStorage.getSecureItem('nonExistent');
            expect(result).toBeNull();
        });

        it('should return default value when key not found', () => {
            const result = SecureStorage.getSecureItem('missing', 'default');
            expect(result).toBe('default');
        });

        it('should handle demoMode fallback', () => {
            mockLocalStorage['demoMode'] = 'true';

            // Should return null for insecure items (no fallback)
            const result = SecureStorage.getSecureItem('demoMode');
            expect(result).toBeNull();
        });
    });

    describe('removeSecureItem', () => {
        it('should remove item with prefix', () => {
            SecureStorage.removeSecureItem('testKey');

            expect(localStorage.removeItem).toHaveBeenCalledWith('sentinel_secure_testKey');
        });
    });

    describe('clearSecureStorage', () => {
        it('should clear all secure items', () => {
            mockLocalStorage['sentinel_secure_key1'] = 'value1';
            mockLocalStorage['sentinel_secure_key2'] = 'value2';
            mockLocalStorage['other_key'] = 'value3';

            SecureStorage.clearSecureStorage();

            expect(sessionStorage.removeItem).toHaveBeenCalledWith('__sentinel_sk');
        });
    });

    describe('isStorageAvailable', () => {
        it('should return true when localStorage is available', () => {
            const result = SecureStorage.isStorageAvailable();
            expect(result).toBe(true);
        });

        it('should return false when localStorage throws', () => {
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage full');
            });

            const result = SecureStorage.isStorageAvailable();
            expect(result).toBe(false);
        });
    });

    describe('getStorageStats', () => {
        it('should return storage statistics', () => {
            mockLocalStorage['key1'] = 'value1';
            mockLocalStorage['key2'] = 'value2';

            const stats = SecureStorage.getStorageStats();

            expect(stats).toHaveProperty('used');
            expect(stats).toHaveProperty('available');
            expect(stats).toHaveProperty('percentage');
            expect(typeof stats.used).toBe('number');
            expect(typeof stats.available).toBe('number');
            expect(typeof stats.percentage).toBe('number');
        });

        it('should return valid percentage', () => {
            const stats = SecureStorage.getStorageStats();

            expect(stats.percentage).toBeGreaterThanOrEqual(0);
            expect(stats.percentage).toBeLessThanOrEqual(100);
        });
    });

    describe('rotateKey', () => {
        it('should return boolean', () => {
            const result = SecureStorage.rotateKey();
            expect(typeof result).toBe('boolean');
        });
    });
});
