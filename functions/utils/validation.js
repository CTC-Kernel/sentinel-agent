const { HttpsError } = require("firebase-functions/v2/https");
const { z } = require("zod");

/**
 * Validates request data against a Zod schema.
 * @param {z.ZodSchema} schema 
 * @param {any} data 
 * @returns {any} Validated data
 */
const validate = (schema, data) => {
    try {
        return schema.parse(data);
    } catch (error) {
        // Format Zod errors into a readable string
        const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new HttpsError('invalid-argument', `Validation Error: ${message}`);
    }
};

module.exports = { validate, z };
