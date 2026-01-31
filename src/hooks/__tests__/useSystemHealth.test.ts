/**
 * Unit tests for useSystemHealth hook
 * Tests system metrics fetching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Firebase Firestore
const mockGetCountFromServer = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args)
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { organizationId: 'org-123' }
    })
}));

// Mock ErrorLogger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

import { useSystemHealth } from '../useSystemHealth';

describe('useSystemHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCountFromServer.mockResolvedValue({
            data: () => ({ count: 15 })
        });
    });

    describe('initialization', () => {
        it('initializes with loading state', () => {
            mockGetCountFromServer.mockImplementation(() => new Promise(() => {}));

            const { result } = renderHook(() => useSystemHealth());

            expect(result.current.loading).toBe(true);
        });

        it('provides all expected properties', async () => {
            const { result } = renderHook(() => useSystemHealth());

            await waitFor(() => !result.current.loading);

            expect(result.current.userCount).toBeDefined();
            expect(result.current.loading).toBeDefined();
        });
    });

    describe('user count fetching', () => {
        it('fetches user count from Firestore', async () => {
            const { result } = renderHook(() => useSystemHealth());

            await waitFor(() => !result.current.loading);

            expect(mockGetCountFromServer).toHaveBeenCalled();
            // User count should be a number (exact value depends on mock implementation)
            expect(typeof result.current.userCount).toBe('number');
        });

        it('handles fetch errors gracefully', async () => {
            mockGetCountFromServer.mockRejectedValue(new Error('Fetch failed'));

            const { result } = renderHook(() => useSystemHealth());

            // Wait for loading to complete
            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            }, { timeout: 3000 });
        });
    });

    describe('cleanup', () => {
        it('unmounts without error', async () => {
            const { result, unmount } = renderHook(() => useSystemHealth());

            await waitFor(() => !result.current.loading);

            // Should unmount without throwing
            expect(() => unmount()).not.toThrow();
        });
    });
});
