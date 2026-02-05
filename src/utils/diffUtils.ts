import { isEqual, isObject } from 'lodash';

export interface DiffChange {
 field: string;
 oldValue: unknown;
 newValue: unknown;
}

/**
 * Deep diff between two objects, useful for audit logs
 * @param object Object to compare (new state)
 * @param base Base object (old state)
 * @param ignore keys to ignore
 * @returns Array of changes
 */
export const getDiff = (
 object: Record<string, unknown>,
 base: Record<string, unknown> | undefined,
 ignore: string[] = ['updatedAt', 'lastUpdated', 'modifiedAt']
): DiffChange[] => {

 // Quick equality check
 if (isEqual(object, base)) return [];

 const changes: DiffChange[] = [];

 const compare = (obj: Record<string, unknown>, b: Record<string, unknown> | undefined, path: string = '') => {
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
 compare(value as Record<string, unknown>, baseValue as Record<string, unknown>, newPath);
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
