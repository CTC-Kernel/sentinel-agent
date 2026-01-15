/**
 * Unit tests for useComplianceData hook
 * Tests compliance data fetching with various options
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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

import { useComplianceData } from '../useComplianceData';

describe('useComplianceData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseFirestoreCollection.mockReturnValue({
            data: [],
            loading: false
        });
    });

    describe('initialization', () => {
        it('fetches controls by default', () => {
            renderHook(() => useComplianceData());

            // First call should be for controls (core data)
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('returns empty arrays for unfetched collections', () => {
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

    describe('optional collections', () => {
        it('fetches risks when fetchRisks is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchRisks: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'risks',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('fetches assets when fetchAssets is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchAssets: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'assets',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('fetches documents when fetchDocuments is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchDocuments: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'documents',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('fetches users when fetchUsers is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchUsers: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'users',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('fetches suppliers when fetchSuppliers is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchSuppliers: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'suppliers',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('fetches projects when fetchProjects is true', () => {
            renderHook(() => useComplianceData(undefined, { fetchProjects: true }));

            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'projects',
                expect.anything(),
                expect.objectContaining({ enabled: true })
            );
        });

        it('does not fetch optional collections by default', () => {
            renderHook(() => useComplianceData());

            // Risks should not be enabled
            const risksCalls = mockUseFirestoreCollection.mock.calls.filter(
                ([collection, , options]) => collection === 'risks' && options?.enabled === true
            );
            expect(risksCalls.length).toBe(0);
        });
    });

    describe('framework filtering', () => {
        it('filters controls by framework', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [
                    { id: 'ctrl-1', code: 'A.1.1', framework: 'ISO27001' },
                    { id: 'ctrl-2', code: 'N.1.1', framework: 'NIS2' },
                    { id: 'ctrl-3', code: 'A.1.2', framework: 'ISO27001' }
                ],
                loading: false
            });

            const { result } = renderHook(() => useComplianceData('ISO27001'));

            // Should filter to only ISO27001 controls
            expect(result.current.filteredControls.length).toBe(2);
        });

        it('returns all controls when no framework specified', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [
                    { id: 'ctrl-1', framework: 'ISO27001' },
                    { id: 'ctrl-2', framework: 'NIS2' }
                ],
                loading: false
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.filteredControls.length).toBe(2);
        });
    });

    describe('loading state', () => {
        it('indicates loading when controls are loading', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [],
                loading: true
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.loading).toBe(true);
        });

        it('indicates loading when any enabled collection is loading', () => {
            mockUseFirestoreCollection
                .mockReturnValueOnce({ data: [], loading: false }) // controls
                .mockReturnValueOnce({ data: [], loading: true })  // risks
                .mockReturnValueOnce({ data: [], loading: false }) // assets
                .mockReturnValueOnce({ data: [], loading: false }) // documents
                .mockReturnValueOnce({ data: [], loading: false }) // users
                .mockReturnValueOnce({ data: [], loading: false }) // suppliers
                .mockReturnValueOnce({ data: [], loading: false }); // projects

            const { result } = renderHook(() =>
                useComplianceData(undefined, { fetchRisks: true })
            );

            expect(result.current.loading).toBe(true);
        });

        it('not loading when all complete', () => {
            mockUseFirestoreCollection.mockReturnValue({
                data: [],
                loading: false
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

            mockUseFirestoreCollection.mockReturnValue({
                data: mockControls,
                loading: false
            });

            const { result } = renderHook(() => useComplianceData());

            expect(result.current.controls).toEqual(mockControls);
        });

        it('returns empty findings array', () => {
            const { result } = renderHook(() => useComplianceData());

            expect(result.current.findings).toEqual([]);
        });
    });

    describe('multiple options', () => {
        it('fetches multiple collections when requested', () => {
            renderHook(() =>
                useComplianceData(undefined, {
                    fetchRisks: true,
                    fetchAssets: true,
                    fetchDocuments: true
                })
            );

            // Should make calls for controls, risks, assets, documents
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'controls',
                expect.anything(),
                expect.anything()
            );
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'risks',
                expect.anything(),
                expect.anything()
            );
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'assets',
                expect.anything(),
                expect.anything()
            );
            expect(mockUseFirestoreCollection).toHaveBeenCalledWith(
                'documents',
                expect.anything(),
                expect.anything()
            );
        });
    });
});
