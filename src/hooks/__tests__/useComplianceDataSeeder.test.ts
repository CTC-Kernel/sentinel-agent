/**
 * Unit tests for useComplianceDataSeeder hook
 * Tests compliance data seeding for various frameworks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase Firestore
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    writeBatch: () => ({
        set: mockBatchSet,
        commit: mockBatchCommit
    }),
    doc: vi.fn(() => ({ id: 'new-doc-id' })),
    serverTimestamp: () => 'server-timestamp'
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

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('@/lib/toast', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args)
    }
}));

// Mock compliance data
vi.mock('../../data/complianceData', () => ({
    ISO_SEED_CONTROLS: [
        { code: 'A.5.1', name: 'Information security policies' },
        { code: 'A.5.2', name: 'Review of policies' }
    ],
    NIS2_SEED_CONTROLS: [
        { code: 'NIS2-1', name: 'Risk management' }
    ],
    DORA_SEED_CONTROLS: [
        { code: 'DORA-1', name: 'ICT risk management' }
    ],
    GDPR_SEED_CONTROLS: [
        { code: 'GDPR-1', name: 'Data protection' }
    ],
    SOC2_SEED_CONTROLS: [
        { code: 'SOC2-1', name: 'Security' }
    ],
    HDS_SEED_CONTROLS: [],
    PCI_DSS_SEED_CONTROLS: [
        { code: 'PCI-1', name: 'Network security' }
    ],
    NIST_CSF_SEED_CONTROLS: [
        { code: 'ID.AM-1', name: 'Asset Management' }
    ],
    ISO22301_SEED_CONTROLS: [
        { code: 'BC-1', name: 'Business Continuity' }
    ]
}));

import { useComplianceDataSeeder } from '../useComplianceDataSeeder';

describe('useComplianceDataSeeder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBatchCommit.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('provides seedControls function and seeding state', () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            expect(typeof result.current.seedControls).toBe('function');
            expect(result.current.seeding).toBe(false);
        });
    });

    describe('seedControls', () => {
        it('seeds ISO27001 controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('ISO27001');
            });

            expect(mockBatchSet).toHaveBeenCalledTimes(2);
            expect(mockBatchCommit).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith(
                expect.stringContaining('ISO27001')
            );
        });

        it('seeds NIS2 controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('NIS2');
            });

            expect(mockBatchSet).toHaveBeenCalledTimes(1);
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('seeds DORA controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('DORA');
            });

            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('seeds GDPR controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('GDPR');
            });

            expect(mockBatchSet).toHaveBeenCalled();
        });

        it('seeds SOC2 controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('SOC2');
            });

            expect(mockBatchSet).toHaveBeenCalled();
        });

        it('seeds PCI_DSS controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('PCI_DSS');
            });

            expect(mockBatchSet).toHaveBeenCalled();
        });

        it('seeds NIST_CSF controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('NIST_CSF');
            });

            expect(mockBatchSet).toHaveBeenCalled();
        });

        it('seeds ISO22301 controls', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('ISO22301');
            });

            expect(mockBatchSet).toHaveBeenCalled();
        });

        it('shows error for empty seed data (HDS)', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('HDS');
            });

            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringContaining('HDS')
            );
            expect(mockBatchSet).not.toHaveBeenCalled();
        });

        it('handles unknown framework', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('UNKNOWN' as any);
            });

            expect(mockToastError).toHaveBeenCalled();
        });

        it('tracks seeding state', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            // Initially not seeding
            expect(result.current.seeding).toBe(false);

            await act(async () => {
                await result.current.seedControls('ISO27001');
            });

            // After completion, not seeding
            expect(result.current.seeding).toBe(false);
        });

        it('handles commit errors', async () => {
            mockBatchCommit.mockRejectedValue(new Error('Commit failed'));

            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('ISO27001');
            });

            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringContaining("Erreur")
            );
        });
    });

    describe('control data structure', () => {
        it('creates controls with correct framework', async () => {
            const { result } = renderHook(() => useComplianceDataSeeder());

            await act(async () => {
                await result.current.seedControls('ISO27001');
            });

            // Verify batch set was called with correct framework
            expect(mockBatchSet).toHaveBeenCalled();
            const callArgs = mockBatchSet.mock.calls[0];
            if (callArgs && callArgs[1]) {
                expect(callArgs[1].framework).toBe('ISO27001');
            }
        });
    });
});
