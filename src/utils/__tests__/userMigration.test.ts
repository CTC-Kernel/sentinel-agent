/**
 * Unit tests for userMigration.ts
 * Tests user migration utility function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args)
}));

vi.mock('firebase/app', () => ({
    getApp: vi.fn(() => ({}))
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

import { fixAllUsers } from '../userMigration';
import { ErrorLogger } from '../../services/errorLogger';

describe('fixAllUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns success result when cloud function succeeds', async () => {
        const mockResult = {
            success: true,
            results: {
                total: 10,
                fixed: 5,
                alreadyOk: 5,
                errors: []
            }
        };

        mockHttpsCallable.mockReturnValue(async () => ({ data: mockResult }));

        const result = await fixAllUsers();

        expect(result.success).toBe(true);
        expect(result.results).toEqual(mockResult.results);
    });

    it('returns success with partial errors', async () => {
        const mockResult = {
            success: true,
            results: {
                total: 10,
                fixed: 8,
                alreadyOk: 1,
                errors: [{ userId: 'user-1', error: 'Some error' }]
            }
        };

        mockHttpsCallable.mockReturnValue(async () => ({ data: mockResult }));

        const result = await fixAllUsers();

        expect(result.success).toBe(true);
        expect(result.results?.errors).toHaveLength(1);
    });

    it('handles cloud function error', async () => {
        const error = new Error('Cloud function failed');
        mockHttpsCallable.mockReturnValue(async () => {
            throw error;
        });

        const result = await fixAllUsers();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Cloud function failed');
        expect(ErrorLogger.error).toHaveBeenCalledWith(error, 'UserMigration.fixAllUsers');
    });

    it('handles non-Error exceptions', async () => {
        mockHttpsCallable.mockReturnValue(async () => {
            throw 'String error';
        });

        const result = await fixAllUsers();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
    });

    it('calls httpsCallable with correct function name', async () => {
        mockHttpsCallable.mockReturnValue(async () => ({ data: { success: true } }));

        await fixAllUsers();

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'fixAllUsers');
    });

    it('returns success false on function failure response', async () => {
        const mockResult = {
            success: false,
            error: 'Insufficient permissions'
        };

        mockHttpsCallable.mockReturnValue(async () => ({ data: mockResult }));

        const result = await fixAllUsers();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient permissions');
    });
});
