import CryptoJS from 'crypto-js';
import { ErrorLogger } from './errorLogger';

export class EncryptionService {
    private static getKey(): string {
        const envKey = import.meta.env.VITE_ENCRYPTION_KEY;

        if (envKey) {
            return envKey;
        }

        // CRITICAL: Fail fast in all environments if key is missing
        if (import.meta.env.PROD) {
            throw new Error('CRITICAL SECURITY ERROR: VITE_ENCRYPTION_KEY is missing in production environment. Application halted.');
        }

        throw new Error('VITE_ENCRYPTION_KEY is not set. Please add it to your .env file (e.g. VITE_ENCRYPTION_KEY=your-secret-key).');
    }

    /**
     * Encrypts a string using AES-256 with PBKDF2 key derivation.
     * Uses a random salt and IV for each encryption operation.
     * Output format: ENC2::<hex(salt)><hex(iv)><base64(ciphertext)>
     * @param data - The plaintext string to encrypt.
     * @returns The ciphertext string (prefixed to identify encrypted data).
     */
    static encrypt(data: string): string {
        if (!data) return '';
        try {
            const keyStr = this.getKey();
            const salt = CryptoJS.lib.WordArray.random(128 / 8);
            const key = CryptoJS.PBKDF2(keyStr, salt, { keySize: 256 / 8, iterations: 10000 });
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const encrypted = CryptoJS.AES.encrypt(data, key, { iv });
            return `ENC2::${salt.toString()}${iv.toString()}${encrypted.toString()}`;
        } catch (error) {
            ErrorLogger.error(error, 'EncryptionService.encrypt');
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts a string using AES-256 with PBKDF2 key derivation.
     * Supports both new format (ENC2::) and legacy format (ENC::) for backwards compatibility.
     * If the string is not encrypted (no prefix), returns it as-is.
     * @param data - The ciphertext string to decrypt.
     * @returns The decrypted plaintext string.
     */
    static decrypt(data: string): string {
        if (!data) return '';

        // New PBKDF2 format
        if (data.startsWith('ENC2::')) {
            try {
                const payload = data.slice(6); // Remove 'ENC2::' prefix
                const salt = CryptoJS.enc.Hex.parse(payload.substring(0, 32));
                const iv = CryptoJS.enc.Hex.parse(payload.substring(32, 64));
                const ciphertext = payload.substring(64);
                const key = CryptoJS.PBKDF2(this.getKey(), salt, { keySize: 256 / 8, iterations: 10000 });
                const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv });
                const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

                if (!plaintext) {
                    return '[Decryption Failed]';
                }
                return plaintext;
            } catch (error) {
                ErrorLogger.error(error, 'EncryptionService.decrypt.v2');
                return '[Locked Data]';
            }
        }

        // Legacy format backwards compatibility
        if (data.startsWith('ENC::')) {
            try {
                const ciphertext = data.slice(5); // Remove 'ENC::' prefix
                const bytes = CryptoJS.AES.decrypt(ciphertext, this.getKey());
                const plaintext = bytes.toString(CryptoJS.enc.Utf8);

                if (!plaintext) {
                    return '[Decryption Failed]';
                }
                return plaintext;
            } catch (error) {
                ErrorLogger.error(error, 'EncryptionService.decrypt.legacy');
                return '[Locked Data]';
            }
        }

        // No prefix: assume plaintext
        return data;
    }

    /**
     * Checks if a string is encrypted (either new or legacy format).
     */
    static isEncrypted(data: string): boolean {
        return data?.startsWith('ENC2::') || data?.startsWith('ENC::') || false;
    }
}
