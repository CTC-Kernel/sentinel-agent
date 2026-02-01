/**
 * Recursively removes undefined values from an object or array.
 * Firestore does not support 'undefined' values, so they must be converted to null or removed.
 * 
 * @param obj The object to sanitize
 * @returns A new object with undefined values replaced by null
 */
const MAX_SANITIZE_DEPTH = 50;

export const sanitizeData = <T>(obj: T, depth: number = 0): T => {
    if (obj === null || obj === undefined) {
        return null as T;
    }

    if (depth >= MAX_SANITIZE_DEPTH) {
        return null as T;
    }

    if (typeof obj === 'number' && Number.isNaN(obj)) {
        return null as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeData(item, depth + 1)) as T;
    }

    if (typeof obj === 'object') {
        if (obj instanceof Date) {
            return obj as T;
        }

        const newObj: Record<string, unknown> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = (obj as Record<string, unknown>)[key];
                if (value === undefined) {
                    newObj[key] = null;
                } else {
                    newObj[key] = sanitizeData(value, depth + 1);
                }
            }
        }
        return newObj as unknown as T;
    }

    return obj;
};
