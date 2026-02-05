import CryptoJS from 'crypto-js';
import { ErrorLogger } from './errorLogger';

/**
 * Web Crypto API helpers for production-grade encryption.
 * Uses AES-256-GCM with PBKDF2 key derivation (600,000 iterations).
 * New data encrypted with format ENC3:: (Web Crypto).
 * Backward-compatible decryption for ENC2:: (CryptoJS PBKDF2) and ENC:: (CryptoJS legacy).
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12;   // 96 bits for AES-GCM
const KEY_LENGTH = 256;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToUint8Array(hex: string): Uint8Array {
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export class EncryptionService {
    private static getKey(): string {
        const envKey = import.meta.env.VITE_ENCRYPTION_KEY;

        if (envKey) {
            return envKey;
        }

        if (import.meta.env.PROD) {
            throw new Error('CRITICAL SECURITY ERROR: VITE_ENCRYPTION_KEY is missing in production environment. Application halted.');
        }

        throw new Error('VITE_ENCRYPTION_KEY is not set. Please add it to your .env file (e.g. VITE_ENCRYPTION_KEY=your-secret-key).');
    }

    /**
     * Encrypts a string using Web Crypto API with AES-256-GCM and PBKDF2 key derivation.
     * Output format: ENC3::<hex(salt)><hex(iv)><base64(ciphertext+authTag)>
     */
    static async encrypt(data: string): Promise<string> {
        if (!data) return '';
        try {
            const keyStr = this.getKey();
            const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
            const key = await deriveKey(keyStr, salt);

            const encoder = new TextEncoder();
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv as BufferSource },
                key,
                encoder.encode(data)
            );

            const saltHex = arrayBufferToHex(salt.buffer);
            const ivHex = arrayBufferToHex(iv.buffer);
            const ciphertextB64 = arrayBufferToBase64(encrypted);

            return `ENC3::${saltHex}${ivHex}${ciphertextB64}`;
        } catch (error) {
            ErrorLogger.error(error, 'EncryptionService.encrypt');
            throw new Error('Encryption failed');
        }
    }

    /**
     * Synchronous encryption fallback using CryptoJS (for non-async contexts).
     * Prefer async encrypt() when possible.
     * Output format: ENC2::<hex(salt)><hex(iv)><base64(ciphertext)>
     */
    static encryptSync(data: string): string {
        if (!data) return '';
        try {
            const keyStr = this.getKey();
            const salt = CryptoJS.lib.WordArray.random(128 / 8);
            const key = CryptoJS.PBKDF2(keyStr, salt, { keySize: 256 / 8, iterations: 10000 });
            const iv = CryptoJS.lib.WordArray.random(128 / 8);
            const encrypted = CryptoJS.AES.encrypt(data, key, { iv });
            return `ENC2::${salt.toString()}${iv.toString()}${encrypted.toString()}`;
        } catch (error) {
            ErrorLogger.error(error, 'EncryptionService.encryptSync');
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts a string. Supports all formats:
     * - ENC3:: (Web Crypto AES-256-GCM, PBKDF2 600k iterations)
     * - ENC2:: (CryptoJS AES-256, PBKDF2 10k iterations)
     * - ENC:: (CryptoJS AES legacy)
     * - No prefix: returns as-is (plaintext)
     */
    static async decrypt(data: string): Promise<string> {
        if (!data) return '';

        // Web Crypto format (ENC3::)
        if (data.startsWith('ENC3::')) {
            try {
                const payload = data.slice(6);
                const saltHex = payload.substring(0, SALT_LENGTH * 2);
                const ivHex = payload.substring(SALT_LENGTH * 2, SALT_LENGTH * 2 + IV_LENGTH * 2);
                const ciphertextB64 = payload.substring(SALT_LENGTH * 2 + IV_LENGTH * 2);

                const salt = hexToUint8Array(saltHex);
                const iv = hexToUint8Array(ivHex);
                const ciphertext = base64ToUint8Array(ciphertextB64);

                const key = await deriveKey(this.getKey(), salt);

                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: iv as BufferSource },
                    key,
                    ciphertext as BufferSource
                );

                const decoder = new TextDecoder();
                return decoder.decode(decrypted);
            } catch (error) {
                ErrorLogger.error(error, 'EncryptionService.decrypt.v3');
                return '[Locked Data]';
            }
        }

        // CryptoJS PBKDF2 format (ENC2::) - backward compatibility
        if (data.startsWith('ENC2::')) {
            return this.decryptLegacyV2(data);
        }

        // CryptoJS legacy format (ENC::) - backward compatibility
        if (data.startsWith('ENC::')) {
            return this.decryptLegacyV1(data);
        }

        // No prefix: assume plaintext
        return data;
    }

    /**
     * Synchronous decryption for non-async contexts.
     * Only supports legacy formats (ENC2::, ENC::) and plaintext.
     * For ENC3:: data, use async decrypt().
     */
    static decryptSync(data: string): string {
        if (!data) return '';

        if (data.startsWith('ENC3::')) {
            ErrorLogger.error(
                new Error('Cannot synchronously decrypt ENC3:: data. Use async decrypt().'),
                'EncryptionService.decryptSync'
            );
            return '[Async Decryption Required]';
        }

        if (data.startsWith('ENC2::')) {
            return this.decryptLegacyV2(data);
        }

        if (data.startsWith('ENC::')) {
            return this.decryptLegacyV1(data);
        }

        return data;
    }

    private static decryptLegacyV2(data: string): string {
        try {
            const payload = data.slice(6);
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

    private static decryptLegacyV1(data: string): string {
        try {
            const ciphertext = data.slice(5);
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

    /**
     * Checks if a string is encrypted (any format).
     */
    static isEncrypted(data: string): boolean {
        return data?.startsWith('ENC3::') || data?.startsWith('ENC2::') || data?.startsWith('ENC::') || false;
    }

    /**
     * Compute SHA-256 hash of a string using Web Crypto API.
     * Returns lowercase hex string.
     */
    static async sha256(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const buffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return arrayBufferToHex(hashBuffer);
    }

    /**
     * Compute SHA-256 hash of an ArrayBuffer using Web Crypto API.
     * Returns lowercase hex string.
     */
    static async sha256Buffer(buffer: ArrayBuffer): Promise<string> {
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return arrayBufferToHex(hashBuffer);
    }
}
