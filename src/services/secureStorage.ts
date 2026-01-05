import { ErrorLogger } from '../services/errorLogger';

/**
 * Secure Storage Service
 * Provides encrypted localStorage for sensitive data
 */
export class SecureStorage {
    private static readonly PREFIX = 'sentinel_secure_';

    /**
     * Simple encryption for localStorage (obfuscation layer)
     * Note: This is basic obfuscation, not military-grade encryption
     */
    private static obfuscate(data: string): string {
        try {
            return btoa(unescape(encodeURIComponent(data)));
        } catch (error) {
            ErrorLogger.error('Failed to obfuscate data', 'SecureStorage.obfuscate', {
                metadata: { error }
            });
            return data;
        }
    }

    /**
     * Simple de-obfuscation for localStorage
     */
    private static deobfuscate(data: string): string {
        try {
            return decodeURIComponent(escape(atob(data)));
        } catch (error) {
            ErrorLogger.error('Failed to deobfuscate data', 'SecureStorage.deobfuscate', {
                metadata: { error }
            });
            return data;
        }
    }

    /**
     * Store sensitive data securely
     */
    static setSecureItem(key: string, value: any): void {
        try {
            const keyWithPrefix = this.PREFIX + key;
            const serialized = JSON.stringify(value);
            const obfuscated = this.obfuscate(serialized);
            localStorage.setItem(keyWithPrefix, obfuscated);
        } catch (error) {
            ErrorLogger.error('Failed to store secure item', 'SecureStorage.setSecureItem', {
                metadata: { key, error }
            });
        }
    }

    /**
     * Retrieve sensitive data securely
     */
    static getSecureItem<T>(key: string, defaultValue?: T): T | null {
        try {
            const keyWithPrefix = this.PREFIX + key;
            const obfuscated = localStorage.getItem(keyWithPrefix);
            if (!obfuscated) return defaultValue || null;

            const serialized = this.deobfuscate(obfuscated);
            return JSON.parse(serialized) as T;
        } catch (error) {
            ErrorLogger.error('Failed to retrieve secure item', 'SecureStorage.getSecureItem', {
                metadata: { key, error }
            });
            return defaultValue || null;
        }
    }

    /**
     * Remove sensitive data securely
     */
    static removeSecureItem(key: string): void {
        try {
            const keyWithPrefix = this.PREFIX + key;
            localStorage.removeItem(keyWithPrefix);
        } catch (error) {
            ErrorLogger.error('Failed to remove secure item', 'SecureStorage.removeSecureItem', {
                metadata: { key, error }
            });
        }
    }

    /**
     * Clear all secure storage
     */
    static clearSecureStorage(): void {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            ErrorLogger.error('Failed to clear secure storage', 'SecureStorage.clearSecureStorage', {
                metadata: { error }
            });
        }
    }

    /**
     * Check if localStorage is available and has quota
     */
    static isStorageAvailable(): boolean {
        try {
            const testKey = '__sentinel_storage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            ErrorLogger.warn('localStorage not available', 'SecureStorage.isStorageAvailable', {
                metadata: { error }
            });
            return false;
        }
    }

    /**
     * Get localStorage usage statistics
     */
    static getStorageStats(): { used: number; available: number; percentage: number } {
        try {
            let used = 0;
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                used += localStorage[key].length;
            });

            // Typical localStorage limit is 5-10MB
            const available = 5 * 1024 * 1024; // 5MB
            const percentage = (used / available) * 100;

            return { used, available, percentage };
        } catch (error) {
            ErrorLogger.error('Failed to get storage stats', 'SecureStorage.getStorageStats', {
                metadata: { error }
            });
            return { used: 0, available: 0, percentage: 0 };
        }
    }
}
