/**
 * Date Utility Functions
 * Shared date parsing and formatting utilities
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Parse various date formats into a Date object
 * Handles: Date objects, ISO strings, Firestore Timestamps
 */
export function parseDate(dateValue: unknown): Date | null {
    if (!dateValue) return null;

    if (dateValue instanceof Date) return dateValue;

    if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Handle Firestore Timestamp
    if (typeof dateValue === 'object' && 'toDate' in dateValue) {
        return (dateValue as Timestamp).toDate();
    }

    if (typeof dateValue === 'object' && 'seconds' in dateValue) {
        return new Date((dateValue as { seconds: number }).seconds * 1000);
    }

    return null;
}

/**
 * Format a date value to ISO date string (YYYY-MM-DD)
 */
export function formatDateISO(dateValue: unknown): string | null {
    const date = parseDate(dateValue);
    return date ? date.toISOString().split('T')[0] : null;
}

/**
 * Check if a date is within a given number of days from now
 */
export function isWithinDays(dateValue: unknown, days: number): boolean {
    const date = parseDate(dateValue);
    if (!date) return false;

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return date > now && date <= futureDate;
}

/**
 * Check if a date is expired (in the past)
 */
export function isExpired(dateValue: unknown): boolean {
    const date = parseDate(dateValue);
    if (!date) return false;
    return date < new Date();
}

/**
 * Get the number of days between a date and now
 * Returns negative if date is in the past
 */
export function daysFromNow(dateValue: unknown): number | null {
    const date = parseDate(dateValue);
    if (!date) return null;

    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
