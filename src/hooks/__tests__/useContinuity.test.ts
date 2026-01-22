/**
 * Unit tests for useContinuity hook
 * Tests business continuity CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
// const mockWriteBatch = vi.fn(); // Removed unused variable
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    writeBatch: () => ({
        set: mockBatchSet,
        update: mockBatchUpdate,
        commit: mockBatchCommit
    }),
    serverTimestamp: () => 'server-timestamp'
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock store
const mockAddToast = vi.fn();
const mockT = vi.fn((key: string, params?: Record<string, unknown>) => {
    if (params?.count) return `${params.count} processes imported`;
    return key;
});

vi.mock('../../store', () => ({
    useStore: () => ({
        user: { organizationId: 'org-123', displayName: 'Test User', email: 'test@example.com', uid: 'user-1' },
        addToast: mockAddToast,
        t: mockT
    })
}));

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        handleErrorWithToast: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock logger
vi.mock('../../services/logger', () => ({
    logAction: vi.fn()
}));

// Mock ImportService
vi.mock('../../services/ImportService', () => ({
    ImportService: {
        parseCSV: vi.fn((content: string) => {
            if (content === 'empty') return [];
            return [
                { Nom: 'Process 1', Description: 'Desc 1', Responsable: 'Owner 1', Priorite: 'High', RTO: '2h', RPO: '30m' },
                { Nom: 'Process 2', Description: 'Desc 2' }
            ];
        })
    }
}));

// Mock data sanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: (data: unknown) => data
}));

// Mock permissions - allow all operations in tests
vi.mock('../../utils/permissions', () => ({
    hasPermission: vi.fn().mockReturnValue(true)
}));

import { useContinuity } from '../useContinuity';

describe('useContinuity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAddDoc.mockResolvedValue({ id: 'new-id' });
        mockUpdateDoc.mockResolvedValue(undefined);
        mockDeleteDoc.mockResolvedValue(undefined);
        mockBatchCommit.mockResolvedValue(undefined);
    });

    describe('initialization', () => {
        it('provides all expected functions', () => {
            const { result } = renderHook(() => useContinuity());

            expect(typeof result.current.addProcess).toBe('function');
            expect(typeof result.current.updateProcess).toBe('function');
            expect(typeof result.current.deleteProcess).toBe('function');
            expect(typeof result.current.addDrill).toBe('function');
            expect(typeof result.current.updateDrill).toBe('function');
            expect(typeof result.current.deleteDrill).toBe('function');
            expect(typeof result.current.importProcesses).toBe('function');
            expect(typeof result.current.addTlptCampaign).toBe('function');
            expect(typeof result.current.updateTlptCampaign).toBe('function');
            expect(typeof result.current.deleteTlptCampaign).toBe('function');
            expect(typeof result.current.addRecoveryPlan).toBe('function');
            expect(typeof result.current.updateRecoveryPlan).toBe('function');
            expect(typeof result.current.deleteRecoveryPlan).toBe('function');
            expect(result.current.loading).toBe(false);
        });
    });

    describe('addProcess', () => {
        it('adds process to Firestore', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.addProcess({
                    name: 'Test Process',
                    description: 'Test Description',
                    owner: 'Test Owner',
                    priority: 'Élevée',
                    rto: '4h',
                    rpo: '1h'
                });
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastCreated', 'success');
        });

        it('returns created process with ID', async () => {
            mockAddDoc.mockResolvedValue({ id: 'process-123' });

            const { result } = renderHook(() => useContinuity());

            let created: unknown;
            await act(async () => {
                created = await result.current.addProcess({
                    name: 'New Process',
                    description: '',
                    owner: '',
                    priority: 'Moyenne',
                    rto: '4h',
                    rpo: '1h'
                });
            });

            expect((created as { id: string }).id).toBe('process-123');
        });

        it('handles errors', async () => {
            mockAddDoc.mockRejectedValue(new Error('Create failed'));

            const { result } = renderHook(() => useContinuity());

            await expect(
                act(async () => {
                    await result.current.addProcess({
                        name: 'Test',
                        description: '',
                        owner: '',
                        priority: 'Faible',
                        rto: '4h',
                        rpo: '1h'
                    });
                })
            ).rejects.toThrow();
        });
    });

    describe('updateProcess', () => {
        it('updates process in Firestore', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.updateProcess('process-1', { name: 'Updated Name' });
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastUpdated', 'success');
        });

        it('handles errors', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            const { result } = renderHook(() => useContinuity());

            await expect(
                act(async () => {
                    await result.current.updateProcess('process-1', { name: 'Test' });
                })
            ).rejects.toThrow();
        });
    });

    describe('deleteProcess', () => {
        it('deletes process from Firestore', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.deleteProcess('process-1');
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastDeleted', 'success');
        });

        it('handles errors', async () => {
            mockDeleteDoc.mockRejectedValue(new Error('Delete failed'));

            const { result } = renderHook(() => useContinuity());

            await expect(
                act(async () => {
                    await result.current.deleteProcess('process-1');
                })
            ).rejects.toThrow();
        });
    });

    describe('addDrill', () => {
        it('creates drill and updates process lastTestDate', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.addDrill({
                    processId: 'process-1',
                    date: new Date().toISOString(),
                    type: 'Tabletop',
                    result: 'Succès'
                });
            });

            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchUpdate).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastDrill', 'success');
        });

        it('creates drill without process update when no processId', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.addDrill({
                    type: 'Simulation',
                    date: new Date().toISOString(),
                    result: 'Succès partiel'
                });
            });

            expect(mockBatchSet).toHaveBeenCalled();
            expect(mockBatchCommit).toHaveBeenCalled();
        });
    });

    describe('updateDrill', () => {
        it('updates drill in Firestore', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.updateDrill('drill-1', { result: 'Échec' });
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastDrillUpdated', 'success');
        });
    });

    describe('deleteDrill', () => {
        it('deletes drill from Firestore', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.deleteDrill('drill-1');
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('continuity.toastDrillDeleted', 'success');
        });
    });

    describe('importProcesses', () => {
        it('imports processes from CSV', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.importProcesses('valid csv content');
            });

            expect(mockBatchSet).toHaveBeenCalledTimes(2);
            expect(mockBatchCommit).toHaveBeenCalled();
        });

        it('handles empty CSV', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.importProcesses('empty');
            });

            expect(mockAddToast).toHaveBeenCalledWith("Fichier vide ou invalide", "error");
        });
    });

    describe('TLPT campaigns', () => {
        it('adds TLPT campaign', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.addTlptCampaign({
                    name: 'TLPT Campaign 2024',
                    status: 'Planned'
                });
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Campagne TLPT créée", 'success');
        });

        it('updates TLPT campaign', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.updateTlptCampaign('campaign-1', { status: 'In Progress' });
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Campagne mise à jour", 'success');
        });

        it('deletes TLPT campaign', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.deleteTlptCampaign('campaign-1');
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Campagne supprimée", 'success');
        });
    });

    describe('Recovery plans', () => {
        it('adds recovery plan', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.addRecoveryPlan({
                    title: 'PRA 2024',
                    description: 'Recovery Plan',
                    status: 'Draft',
                    type: 'Business Process',
                    rto: '4h',
                    rpo: '1h',
                    ownerId: 'user-1'
                });
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Plan de reprise créé", 'success');
        });

        it('updates recovery plan', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.updateRecoveryPlan('plan-1', { status: 'Active' });
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Plan de reprise mis à jour", 'success');
        });

        it('deletes recovery plan', async () => {
            const { result } = renderHook(() => useContinuity());

            await act(async () => {
                await result.current.deleteRecoveryPlan('plan-1');
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith("Plan de reprise supprimé", 'success');
        });
    });
});
