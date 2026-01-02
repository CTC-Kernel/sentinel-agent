import CryptoJS from 'crypto-js';
import { ErrorLogger } from './errorLogger';

// Fallback key for development ONLY. 
// In production, the application will crash if VITE_ENCRYPTION_KEY is missing.
const DEV_FALLBACK_KEY = 'SENTINEL_GRC_SECURE_DEFAULT_KEY_CHANGE_ME_IN_PROD';

export class EncryptionService {
    private static getKey(): string {
        const envKey = import.meta.env.VITE_ENCRYPTION_KEY;

        if (envKey) {
            return envKey;
        }

        // CRITICAL: Fail fast in production
        if (import.meta.env.PROD) {
            throw new Error('CRITICAL SECURITY ERROR: VITE_ENCRYPTION_KEY is missing in production environment. Application halted.');
        }

        // Warn in development
        console.warn('SECURITY WARNING: Using insecure fallback encryption key. Please set VITE_ENCRYPTION_KEY in your .env file.');
        return DEV_FALLBACK_KEY;
    }

    /**
     * Encrypts a string using AES-256.
     * @param data - The plaintext string to encrypt.
     * @returns The ciphertext string (prefixed to identify encrypted data).
     */
    static encrypt(data: string): string {
        if (!data) return '';
        try {
            const ciphertext = CryptoJS.AES.encrypt(data, this.getKey()).toString();
            return `ENC::${ciphertext}`;
        } catch (error) {
            ErrorLogger.error(error, 'EncryptionService.encrypt');
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts a string using AES-256.
     * If the string is not encrypted (doesn't start with prefix), returns it as-is.
     * @param data - The ciphertext string to decrypt.
     * @returns The decrypted plaintext string.
     */
    static decrypt(data: string): string {
        if (!data) return '';

        // Backward compatibility: if not prefixed, assume it's plaintext
        if (!data.startsWith('ENC::')) {
            return data;
        }

        try {
            const ciphertext = data.replace('ENC::', '');
            const bytes = CryptoJS.AES.decrypt(ciphertext, this.getKey());
            const plaintext = bytes.toString(CryptoJS.enc.Utf8);

            if (!plaintext) {
                // Malformed or wrong key
                console.error('Decryption produced empty result');
                return '[Decryption Failed]';
            }
            return plaintext;
        } catch (error) {
            ErrorLogger.error(error, 'EncryptionService.decrypt');
            // Return placeholder so UI doesn't crash, but user knows data is secure/inaccessible
            return '[Locked Data]';
        }
    }

    /**
     * Checks if a string is encrypted.
     */
    static isEncrypted(data: string): boolean {
        return data?.startsWith('ENC::') || false;
    }
}
