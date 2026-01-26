/**
 * Unit tests for useComplianceData hook
 * Tests compliance data fetching with various options
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock useFirestoreCollection
const mockUseFirestoreCollection = vi.fn();
vi.mock('../useFirestore', () => ({
    useFirestoreCollection: (...args: unknown[]) => mockUseFirestoreCollection(...args)
}));

// Mock useComplianceActions
const mockComplianceActions = {
    updating: false,
    handleStatusChange: vi.fn(),
    handleAssign: vi.fn(),
    updateControl: vi.fn()
};
vi.mock('../useComplianceActions', () => ({
    useComplianceActions: () => mockComplianceActions
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
    where: vi.fn(),
    limit: vi.fn()
}));

// Mock store
vi.mock('../../store', () => ({
    useStore: () => ({
        user: { organizationId: 'org-123', uid: 'user-1' },
        demoMode: false
    })
}));

// Mock useAuth
vi.mock('../useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'user-1', organizationId: 'org-123', role: 'admin' },
        firebaseUser: { uid: 'user-1', email: 'test@example.com', emailVerified: true },
        loading: false,
        error: null,
        profileError: null,
        claimsSynced: true,
    })
}));

import { useComplianceData } from '../useComplianceData';

describe('useComplianceData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseFirestoreCollection.mockReturnValue({
            data: [],
            loading: false,
            error: null
        });
    });

    describe('initialization', () => {
        it('fetches all collections when enabled', () => {
            renderHook(() => useComplianceData());

            // Should call useFirestoreCollection for each collection
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'risks',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'assets',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('returns empty arrays when data is null', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: null,
                loading: false,
                error: null
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.controls).toEqual([]);
            expect(result.current.risks).toEqual([]);
            expect(result.current.assets).toEqual([]);
            expect(result.current.documents).toEqual([]);
            expect(result.current.usersList).toEqual([]);
            expect(result.current.suppliers).toEqual([]);
            expect(result.current.projects).toEqual([]);
        });

        it('provides compliance actions', () => {
            const { result } = renderHook(() => useComplianceData());

            expect(result.current.handleStatusChange).toBeDefined();
            expect(result.current.handleAssign).toBeDefined();
            expect(result.current.updateControl).toBeDefined();
        });
    });

    describe('enabled parameter', () => {
        it('does not fetch when enabled is false', () => {
            renderHook(() => useComplianceData(undefined, false));

            // Should call with enabled: false
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.anything(),
                expect.objectContaining({ enabled: false })
            );
        });

        it('fetches when enabled is true (default)', () => {
            renderHook(() => useComplianceData());

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });
    });

    describe('framework filtering', () => {
        it('filters controls by framework when specified', () => {
            const mockControls = [
                { id: 'ctrl-1', code: 'A.1.1', title: 'Control 1', framework: 'ISO27001' },
                { id: 'ctrl-2', code: 'A.1.2', title: 'Control 2', framework: 'NIS2' },
                { id: 'ctrl-3', code: 'A.1.3', title: 'Control 3', framework: 'ISO27001' }
            ];

            mockUseFirestoreCollection.mockImplementation((collection) => {
                if (collection === 'controls') {
                    return { data: mockControls, loading: false, error: null };
                }
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData('ISO27001'));

            expect(result.current.filteredControls).toHaveLength(2);
            expect(result.current.filteredControls.every(c => c.framework === 'ISO27001')).toBe(true);
        });

        it('returns all controls when no framework specified', () => {
            const mockControls = [
                { id: 'ctrl-1', code: 'A.1.1', title: 'Control 1', framework: 'ISO27001' },
                { id: 'ctrl-2', code: 'A.1.2', title: 'Control 2', framework: 'NIS2' }
            ];

            mockUseFirestoreCollection.mockImplementation((collection) => {
                if (collection === 'controls') {
                    return { data: mockControls, loading: false, error: null };
                }
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.filteredControls).toHaveLength(2);
        });
    });

    describe('loading state', () => {
        it('indicates loading when controls are loading', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [],
                loading: true,
                error: null
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.loading).toBe(true);
        });

        it('indicates loading when any collection is loading', () => {
            let callCount = 0;
            mockUseFirestoreCollection.mockImplementation(() => {
                callCount++;
                // Make the second collection (risks) loading
                if (callCount === 2) {
                    return { data: [], loading: true, error: null };
                }
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.loading).toBe(true);
        });

        it('not loading when all complete', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [],
                loading: false,
                error: null
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.loading).toBe(false);
        });
    });

    describe('data mapping', () => {
        it('maps controls data correctly', () => {
            const mockControls = [
                { id: 'ctrl-1', code: 'A.1.1', title: 'Control 1', framework: 'ISO27001' },
                { id: 'ctrl-2', code: 'A.1.2', title: 'Control 2', framework: 'ISO27001' }
            ];

            mockUseFirestoreCollection.mockImplementation((collection) => {
                if (collection === 'controls') {
                    return { data: mockControls, loading: false, error: null };
                }
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.controls).toEqual(mockControls);
        });

        it('returns empty findings array', () => {
            const { result } = renderHook(() => useComplianceData());

            expect(result.current.findings).toEqual([]);
        });

        it('maps all collection data correctly', () => {
            const mockRisks = [{ id: 'risk-1', threat: 'Threat 1' }];
            const mockAssets = [{ id: 'asset-1', name: 'Asset 1' }];
            const mockDocuments = [{ id: 'doc-1', title: 'Doc 1' }];

            mockUseFirestoreCollection.mockImplementation((collection) => {
                if (collection === 'risks') return { data: mockRisks, loading: false, error: null };
                if (collection === 'assets') return { data: mockAssets, loading: false, error: null };
                if (collection === 'documents') return { data: mockDocuments, loading: false, error: null };
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.risks).toEqual(mockRisks);
            expect(result.current.assets).toEqual(mockAssets);
            expect(result.current.documents).toEqual(mockDocuments);
        });
    });

    describe('error handling', () => {
        it('reports error when any collection has error', () => {
            const mockError = new Error('Fetch failed');
            mockUseFirestoreCollection.mockImplementation((collection) => {
                if (collection === 'controls') {
                    return { data: [], loading: false, error: mockError };
                }
                return { data: [], loading: false, error: null };
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.error).toBe(mockError);
        });

        it('no error when all collections succeed', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [],
                loading: false,
                error: null
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.error).toBeNull();
        });
    });
});
