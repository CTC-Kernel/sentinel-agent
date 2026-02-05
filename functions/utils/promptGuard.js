/**
 * Prompt Guard - Detects and prevents prompt injection attacks
 * Provides input validation and sanitization for AI prompts
 */

const { logger } = require('firebase-functions');

// Maximum allowed lengths for different input types
const MAX_LENGTHS = {
    systemPrompt: 5000,
    userMessage: 20000,
    evidence: 10000,
};

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
    // Direct instruction override
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)/i,
    /override\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)/i,

    // Role-play attacks
    /you\s+are\s+now\s+(a|an|the)\s+/i,
    /pretend\s+(you\s+are|to\s+be)\s+/i,
    /act\s+as\s+(a|an|if)\s+/i,
    /role[\s-]?play\s+as\s+/i,
    /switch\s+to\s+.+\s+mode/i,

    // System prompt extraction
    /reveal\s+(your|the)\s+(system\s+)?prompt/i,
    /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
    /what\s+(are|is)\s+your\s+(system\s+)?(instructions?|prompt|rules?)/i,
    /print\s+(your|the)\s+(system\s+)?(instructions?|prompt)/i,
    /output\s+(your|the)\s+(system\s+)?(instructions?|prompt)/i,

    // Delimiter injection
    /```\s*system/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /<\|system\|>/i,
    /<<SYS>>/i,

    // Jailbreak keywords
    /DAN\s*mode/i,
    /do\s+anything\s+now/i,
    /jailbreak/i,
    /bypass\s+(your\s+)?(safety|restrictions?|filters?|rules?)/i,
    /no\s+restrictions?\s+mode/i,
    /developer\s+mode\s+(enabled|on|activated)/i,
    /sudo\s+mode/i,

    // Encoded injection attempts
    /base64\s*decode/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
];

/**
 * Check text for prompt injection patterns
 * @param {string} text - Text to check
 * @param {string} fieldName - Name of the field being checked (for logging)
 * @returns {{ safe: boolean, matched?: string }} Result of the check
 */
function detectInjection(text, fieldName = 'input') {
    if (!text || typeof text !== 'string') {
        return { safe: true };
    }

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            logger.warn('Prompt injection detected', {
                field: fieldName,
                pattern: pattern.source,
                textPreview: text.substring(0, 100),
            });
            return { safe: false, matched: pattern.source };
        }
    }

    return { safe: true };
}

/**
 * Validate and sanitize text input for AI calls
 * @param {string} text - Text to validate
 * @param {string} fieldName - Name of the field
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ valid: boolean, sanitized?: string, error?: string }}
 */
function validateAIInput(text, fieldName = 'input', maxLength = MAX_LENGTHS.userMessage) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: `${fieldName} must be a non-empty string` };
    }

    // Length check
    if (text.length > maxLength) {
        return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` };
    }

    // Injection check
    const injectionResult = detectInjection(text, fieldName);
    if (!injectionResult.safe) {
        return { valid: false, error: `${fieldName} contains disallowed content` };
    }

    // Sanitize: remove null bytes, excessive whitespace
    const sanitized = text
        .replace(/\0/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    return { valid: true, sanitized };
}

/**
 * Sanitize evidence/raw data before passing to AI
 * Strips potentially dangerous content while preserving useful information
 * @param {*} evidence - Evidence data (string or object)
 * @param {number} maxLength - Maximum output length
 * @returns {string|null} Sanitized evidence string
 */
function sanitizeEvidence(evidence, maxLength = MAX_LENGTHS.evidence) {
    if (!evidence) return null;

    let text;
    if (typeof evidence === 'string') {
        text = evidence;
    } else if (typeof evidence === 'object') {
        try {
            text = JSON.stringify(evidence);
        } catch {
            return null;
        }
    } else {
        return String(evidence);
    }

    // Truncate to max length
    if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '... [truncated]';
    }

    // Remove potential prompt injections from evidence
    // More lenient than user input - just strip delimiter patterns
    text = text
        .replace(/\0/g, '')
        .replace(/```\s*system/gi, '[redacted]')
        .replace(/\[SYSTEM\]/gi, '[redacted]')
        .replace(/\[INST\]/gi, '[redacted]')
        .replace(/<\|system\|>/gi, '[redacted]')
        .replace(/<<SYS>>/gi, '[redacted]');

    return text;
}

/**
 * Validate Gemini AI output before returning to clients
 * @param {string} text - AI output text
 * @param {number} maxLength - Maximum allowed output length
 * @returns {{ valid: boolean, text: string, truncated: boolean }}
 */
function validateAIOutput(text, maxLength = 50000) {
    if (!text || typeof text !== 'string') {
        return { valid: false, text: '', truncated: false };
    }

    let truncated = false;
    let output = text;

    // Enforce maximum output length
    if (output.length > maxLength) {
        output = output.substring(0, maxLength) + '\n\n[Response truncated due to length]';
        truncated = true;
        logger.warn('AI output truncated', { originalLength: text.length, maxLength });
    }

    // Strip any HTML script tags from output
    output = output.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[script removed]');

    return { valid: true, text: output, truncated };
}

module.exports = {
    detectInjection,
    validateAIInput,
    sanitizeEvidence,
    validateAIOutput,
    MAX_LENGTHS,
};
