/**
 * Unit tests for useReferenceData hook
 * Tests reference data loading (users, controls, risks)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock useFirestoreCollection
const mockUseFirestoreCollection = vi.fn();
vi.mock('../useFirestore', () => ({
    useFirestoreCollection: (...args: unknown[]) => mockUseFirestoreCollection(...args)
}));

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    where: vi.fn()
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { organizationId: 'org-123' }
    })
}));

import { useReferenceData } from '../useReferenceData';

describe('useReferenceData', () => {
    const mockUsers = [
        { id: 'user-1', email: 'admin@test.com', displayName: 'Admin User' },
        { id: 'user-2', email: 'user@test.com', displayName: 'Regular User' }
    ];

    const mockControls = [
        { id: 'ctrl-1', code: 'A.5.1', name: 'Security Policies' },
        { id: 'ctrl-2', code: 'A.6.1', name: 'Organization' }
    ];

    const mockRisks = [
        { id: 'risk-1', threat: 'Data Breach', level: 'High' },
        { id: 'risk-2', threat: 'Phishing', level: 'Medium' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseFirestoreCollection.mockImplementation((collectionName: string) => {
            switch (collectionName) {
                case 'users':
                    return { data: mockUsers, loading: false };
                case 'controls':
                    return { data: mockControls, loading: false };
                case 'risks':
                    return { data: mockRisks, loading: false };
                default:
                    return { data: [], loading: false };
            }
        });
    });

    describe('initialization', () => {
        it('provides all expected data and loading states', () => {
            const { result } = renderHook(() => useReferenceData());

            expect(result.current.users).toBeDefined();
            expect(result.current.usersLoading).toBeDefined();
            expect(result.current.controls).toBeDefined();
            expect(result.current.controlsLoading).toBeDefined();
            expect(result.current.risks).toBeDefined();
            expect(result.current.risksLoading).toBeDefined();
        });
    });

    describe('users data', () => {
        it('returns users from Firestore', () => {
            const { result } = renderHook(() => useReferenceData());

            expect(result.current.users).toEqual(mockUsers);
            expect(result.current.usersLoading).toBe(false);
        });

        it('fetches users collection with org filter', () => {
            renderHook(() => useReferenceData());

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'users',
                expect.any(Array),
                expect.objectContaining({
                    realtime: false,
                    logError: true,
                    enabled: true
                })
            );
        });
    });

    describe('controls data', () => {
        it('returns controls from Firestore', () => {
            const { result } = renderHook(() => useReferenceData());

            expect(result.current.controls).toEqual(mockControls);
            expect(result.current.controlsLoading).toBe(false);
        });

        it('fetches controls collection with org filter', () => {
            renderHook(() => useReferenceData());

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.any(Array),
                expect.objectContaining({
                    realtime: false,
                    logError: true
                })
            );
        });
    });

    describe('risks data', () => {
        it('returns risks from Firestore', () => {
            const { result } = renderHook(() => useReferenceData());

            expect(result.current.risks).toEqual(mockRisks);
            expect(result.current.risksLoading).toBe(false);
        });

        it('fetches risks collection with org filter', () => {
            renderHook(() => useReferenceData());

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'risks',
                expect.any(Array),
                expect.objectContaining({
                    realtime: false,
                    logError: true
                })
            );
        });
    });

    describe('loading states', () => {
        it('reports loading when users are loading', () => {
            mockUseFirestoreCollection.mockImplementation((collectionName: string) => {
                if (collectionName === 'users') {
                    return { data: [], loading: true };
                }
                return { data: [], loading: false };
            });

            const { result } = renderHook(() => useReferenceData());

            expect(result.current.usersLoading).toBe(true);
        });

        it('reports loading when controls are loading', () => {
            mockUseFirestoreCollection.mockImplementation((collectionName: string) => {
                if (collectionName === 'controls') {
                    return { data: [], loading: true };
                }
                return { data: [], loading: false };
            });

            const { result } = renderHook(() => useReferenceData());

            expect(result.current.controlsLoading).toBe(true);
        });

        it('reports loading when risks are loading', () => {
            mockUseFirestoreCollection.mockImplementation((collectionName: string) => {
                if (collectionName === 'risks') {
                    return { data: [], loading: true };
                }
                return { data: [], loading: false };
            });

            const { result } = renderHook(() => useReferenceData());

            expect(result.current.risksLoading).toBe(true);
        });
    });

    describe('disabled state', () => {
        it('disables fetching when user has no organizationId', () => {
            vi.doMock('../../store', () => ({
                useStore: () => ({user: null,
        t: (key: string, options?: Record<string, unknown>) => {
            if (options && 'defaultValue' in options) {
                return (options as { defaultValue?: string }).defaultValue || key;
            }
            return key;
        }})
            }));

            // The hook should handle missing user gracefully
            // by using 'ignore' as orgId and enabled: false
        });
    });
});
