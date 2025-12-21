import { isEqual, isObject } from 'lodash';

export interface DiffChange {
    field: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldValue: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newValue: any;
}

/**
 * Deep diff between two objects, useful for audit logs
 * @param object Object to compare (new state)
 * @param base Base object (old state)
 * @param ignore keys to ignore
 * @returns Array of changes
 */
export const getDiff = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    object: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    base: any,
    ignore: string[] = ['updatedAt', 'lastUpdated', 'modifiedAt']
): DiffChange[] => {

    // Quick equality check
    if (isEqual(object, base)) return [];

    const changes: DiffChange[] = [];

    const compare = (obj: any, b: any, path: string = '') => {
        // Loop through all keys in the new object
        Object.keys(obj).forEach((key) => {
            if (ignore.includes(key)) return;

            const newPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            const baseValue = b ? b[key] : undefined;

            // If object, recurse
            if (isObject(value) && isObject(baseValue) && !Array.isArray(value) && !Array.isArray(baseValue)) {
                // For now, we only deeply compare simple logic, or if we want flattened keys "risk.details.value"
                // Let's implement recursion
                compare(value, baseValue, newPath);
            } else if (!isEqual(value, baseValue)) {
                // If distinct simple values or arrays (arrays treated as value replacement for now)
                changes.push({
                    field: newPath,
                    oldValue: baseValue,
                    newValue: value
                });
            }
        });
    };

    compare(object, base);
    return changes;
};
