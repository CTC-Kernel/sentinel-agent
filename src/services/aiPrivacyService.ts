
export interface AISettings {
    enabled?: boolean;
    consentGiven?: boolean;
    dataSanitization?: boolean;
}

export const aiPrivacyService = {
    /**
     * Sanitizes data by removing PII and sensitive fields.
     * @param data The data to sanitize
     * @returns Sanitized data safe for AI processing
     */
    sanitizeInput: <T>(data: T): T => {
        if (!data) return data;
        const json = JSON.stringify(data);

        // Basic PII Redaction Regex
        // Emails
        let sanitized = json.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

        // Phone numbers (Generic international)
        sanitized = sanitized.replace(/(\+|00)[1-9][0-9 \-\(\)\.]{7,32}/g, '[PHONE_REDACTED]');

        // Names (simple heuristic: look for "name": "Value") - risky, better to strip specific fields in object traversal

        return JSON.parse(sanitized);
    },

    /**
     * Traverses object and redacts specific sensitive keys
     */
    anonymizeData: (data: any): any => {
        if (Array.isArray(data)) {
            return data.map(item => aiPrivacyService.anonymizeData(item));
        }
        if (typeof data === 'object' && data !== null) {
            const newData: any = {};
            for (const key in data) {
                // Fields to anonymize
                if (['owner', 'contactEmail', 'contactName', 'email', 'phone', 'displayName'].includes(key)) {
                    newData[key] = '[REDACTED]';
                } else if (['name', 'title', 'description'].includes(key) && typeof data[key] === 'string') {
                    // We might want to keep generic names but redact specific identifiers if possible
                    // For now, let's keep names as they are business context, unless strict mode is on.
                    // But roadmap says "Noms d'actifs". 
                    // Let's implement a 'strict' mode later.
                    newData[key] = data[key];
                } else {
                    newData[key] = aiPrivacyService.anonymizeData(data[key]);
                }
            }
            return newData;
        }
        return data;
    }
};
