import { DRAFT_STATUS } from './draftSchema';

/**
 * Check if an entity status indicates draft mode.
 * Handles various status conventions used in the codebase.
 *
 * @param status - The status value to check
 * @returns True if the status represents a draft
 */
export function isDraftStatus(status: string | undefined | null): boolean {
    if (!status) return false;

    // Use DRAFT_STATUS values to stay synchronized with draftSchema.ts
    // Also include lowercase variants for case-insensitive matching
    const draftValues = [
        ...Object.values(DRAFT_STATUS),
        ...Object.values(DRAFT_STATUS).map((v) => v.toLowerCase()),
    ];

    return draftValues.includes(status);
}
