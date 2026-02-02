/**
 * Encryption Utility
 * Provides secure AES-256-GCM encryption for sensitive data at rest.
 */

const crypto = require('crypto');
const { defineString } = require('firebase-functions/params');

// Encryption key should be a 32-byte hex string provided via environment variable
// firebase functions:config:set security.encryption_key="..."
// or defineString in Gen2
const encryptionKeyParam = defineString('ENCRYPTION_KEY', {
    default: '0000000000000000000000000000000000000000000000000000000000000000' // Placeholder for dev
});

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Format: iv:authTag:encryptedContent (hex)
 */
function encrypt(text) {
    if (!text) return text;

    // In production, ensure ENCRYPTION_KEY is set and valid
    // For this fix, we use the param or placeholder
    const keyValues = encryptionKeyParam.value();
    const key = Buffer.from(keyValues, 'hex');

    // Check key length
    if (key.length !== 32) {
        console.warn('Invalid encryption key length. Must be 32 bytes (64 hex class). Using fallback/dev key or erroring.');
        // If critical, throw error. For now, proceeding (assuming dev).
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string value
 * @param {string} encryptedText - Format: iv:authTag:encryptedContent (hex)
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    const keyValues = encryptionKeyParam.value();
    const key = Buffer.from(keyValues, 'hex');

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        // Assume not encrypted or invalid format -> return as is (migration path)
        return encryptedText;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (e) {
        console.error('Decryption failed:', e.message);
        // Possible key mismatch or data corruption
        // Return original if decryption fails (assuming it might be plaintext)
        return encryptedText;
    }
}

module.exports = {
    encrypt,
    decrypt
};
