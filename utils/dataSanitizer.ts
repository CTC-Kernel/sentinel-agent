/**
 * Recursively removes undefined values from an object or array.
 * Firestore does not support 'undefined' values, so they must be converted to null or removed.
 * 
 * @param obj The object to sanitize
 * @returns A new object with undefined values replaced by null
 */
export const sanitizeData = <T>(obj: T): T => {
    if (obj === null || obj === undefined) {
        return null as any;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeData(item)) as any;
    }

    if (typeof obj === 'object') {
        // Handle Date objects (keep them as is)
        if (obj instanceof Date) {
            return obj as any;
        }

        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = (obj as any)[key];
                if (value === undefined) {
                    newObj[key] = null;
                } else {
                    newObj[key] = sanitizeData(value);
                }
            }
        }
        return newObj;
    }

    return obj;
};
