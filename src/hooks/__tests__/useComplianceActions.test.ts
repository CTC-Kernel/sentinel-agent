/**
 * Unit tests for useComplianceActions hook
 * Tests compliance control CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock Firebase Firestore
const mockUpdateDoc = vi.fn();
const mockAddDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    collection: vi.fn(),
    arrayUnion: vi.fn((val) => ({ _arrayUnion: val })),
    arrayRemove: vi.fn((val) => ({ _arrayRemove: val })),
    serverTimestamp: () => 'server-timestamp'
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock logger
vi.mock('../../services/logger', () => ({
    logAction: vi.fn()
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

vi.mock('@/lib/toast', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        error: (...args: unknown[]) => mockToastError(...args),
        info: (...args: unknown[]) => mockToastInfo(...args)
    }
}));

// Mock data sanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: (data: unknown) => data
}));

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock controlSchema
vi.mock('../../schemas/controlSchema', () => ({
    controlSchema: {
        partial: () => ({
            safeParse: vi.fn().mockReturnValue({ success: true })
        })
    }
}));

import { useComplianceActions } from '../useComplianceActions';
import { Control, Framework, UserProfile as User } from '../../types';

describe('useComplianceActions', () => {
    const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-1'
    };

    const mockControl: Control = {
        id: 'ctrl-1',
        code: 'A.1.1',
        title: 'Test Control',
        description: 'Description',
        status: 'Non commencé',
        framework: 'ISO27001',
        organizationId: 'org-1',
        applicability: 'Applicable',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdateDoc.mockResolvedValue(undefined);
        mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
    });

    describe('initialization', () => {
        it('initializes with updating false', () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            expect(result.current.updating).toBe(false);
        });

        it('provides all expected functions', () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            expect(typeof result.current.handleStatusChange).toBe('function');
            expect(typeof result.current.handleAssign).toBe('function');
            expect(typeof result.current.handleLinkAsset).toBe('function');
            expect(typeof result.current.handleUnlinkAsset).toBe('function');
            expect(typeof result.current.handleLinkSupplier).toBe('function');
            expect(typeof result.current.handleUnlinkSupplier).toBe('function');
            expect(typeof result.current.handleLinkProject).toBe('function');
            expect(typeof result.current.handleUnlinkProject).toBe('function');
            expect(typeof result.current.handleLinkDocument).toBe('function');
            expect(typeof result.current.handleUnlinkDocument).toBe('function');
            expect(typeof result.current.updateJustification).toBe('function');
            expect(typeof result.current.handleApplicabilityChange).toBe('function');
            expect(typeof result.current.handleMapFramework).toBe('function');
            expect(typeof result.current.handleUnmapFramework).toBe('function');
            expect(typeof result.current.createRisk).toBe('function');
            expect(typeof result.current.createAudit).toBe('function');
            expect(typeof result.current.updateControl).toBe('function');
        });
    });

    describe('updateControl', () => {
        it('updates control in Firestore', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.updateControl('ctrl-1', { status: 'Conforme' }, 'Updated');
            });

            expect(success).toBe(true);
            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Updated');
        });

        it('handles update errors', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.updateControl('ctrl-1', { status: 'Conforme' });
            });

            expect(success).toBe(false);
            expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la mise à jour');
        });

        it('sets updating state during operation', async () => {
            let resolveUpdate: () => void;
            mockUpdateDoc.mockImplementation(() =>
                new Promise(resolve => {
                    resolveUpdate = () => resolve(undefined);
                })
            );

            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            const updatePromise = act(async () => {
                await result.current.updateControl('ctrl-1', { status: 'Conforme' });
            });

            resolveUpdate!();
            await updatePromise;

            expect(result.current.updating).toBe(false);
        });
    });

    describe('handleStatusChange', () => {
        it('updates control status', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleStatusChange(mockControl, 'Conforme');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Statut mis à jour');
        });
    });

    describe('handleAssign', () => {
        it('assigns user to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleAssign(mockControl, 'user-456');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Responsable assigné');
        });
    });

    describe('handleLinkAsset', () => {
        it('links asset to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleLinkAsset(mockControl, 'asset-123');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Actif lié');
        });
    });

    describe('handleUnlinkAsset', () => {
        it('unlinks asset from control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleUnlinkAsset(mockControl, 'asset-123');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Lien supprimé');
        });
    });

    describe('handleLinkSupplier', () => {
        it('links supplier to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleLinkSupplier(mockControl, 'supplier-123');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Fournisseur lié');
        });
    });

    describe('handleLinkProject', () => {
        it('links project to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleLinkProject(mockControl, 'proj-123');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Projet lié');
        });
    });

    describe('handleLinkDocument', () => {
        it('links document to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleLinkDocument(mockControl, 'doc-123');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Document lié');
        });
    });

    describe('updateJustification', () => {
        it('updates control justification', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.updateJustification(mockControl, 'This control is not applicable');
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Justification enregistrée');
        });
    });

    describe('handleApplicabilityChange', () => {
        it('marks control as applicable', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleApplicabilityChange(
                    { ...mockControl, status: 'Non applicable' },
                    true
                );
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Contrôle marqué comme Applicable');
        });

        it('marks control as non-applicable', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleApplicabilityChange(mockControl, false);
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Contrôle marqué comme Non applicable');
        });
    });

    describe('handleMapFramework', () => {
        it('maps framework to control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleMapFramework(mockControl, 'NIS2' as Framework);
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Référentiel mappé');
        });

        it('shows info toast when mapping primary framework', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleMapFramework(mockControl, 'ISO27001' as Framework);
            });

            expect(mockToastInfo).toHaveBeenCalledWith('Ce référentiel est déjà le référentiel principal');
        });

        it('shows info toast when framework already mapped', async () => {
            const controlWithMappings = {
                ...mockControl,
                mappedFrameworks: ['NIS2' as Framework]
            };

            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleMapFramework(controlWithMappings, 'NIS2' as Framework);
            });

            expect(mockToastInfo).toHaveBeenCalledWith('Ce référentiel est déjà mappé');
        });
    });

    describe('handleUnmapFramework', () => {
        it('unmaps framework from control', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            await act(async () => {
                await result.current.handleUnmapFramework(mockControl, 'NIS2' as Framework);
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockToastSuccess).toHaveBeenCalledWith('Mapping supprimé');
        });
    });

    describe('createRisk', () => {
        it('creates risk in Firestore', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let riskId: string | null;
            await act(async () => {
                riskId = await result.current.createRisk({
                    threat: 'SQL Injection',
                    organizationId: 'org-1'
                });
            });

            expect(riskId!).toBe('new-doc-id');
            expect(mockToastSuccess).toHaveBeenCalledWith('Risque créé avec succès');
        });

        it('handles create risk error', async () => {
            mockAddDoc.mockRejectedValue(new Error('Create failed'));

            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let riskId: string | null;
            await act(async () => {
                riskId = await result.current.createRisk({ threat: 'Test' });
            });

            expect(riskId!).toBeNull();
            expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la création du risque');
        });
    });

    describe('createAudit', () => {
        it('creates audit in Firestore', async () => {
            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let auditId: string | null;
            await act(async () => {
                auditId = await result.current.createAudit({
                    name: 'Q1 Internal Audit',
                    organizationId: 'org-1'
                });
            });

            expect(auditId!).toBe('new-doc-id');
            expect(mockToastSuccess).toHaveBeenCalledWith('Audit planifié avec succès');
        });

        it('handles create audit error', async () => {
            mockAddDoc.mockRejectedValue(new Error('Create failed'));

            const { result } = renderHook(() => useComplianceActions(mockUser as unknown as User));

            let auditId: string | null;
            await act(async () => {
                auditId = await result.current.createAudit({ name: 'Test Audit' });
            });

            expect(auditId!).toBeNull();
            expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la création de l'audit");
        });
    });

    describe('null user', () => {
        it('handles null user gracefully', () => {
            const { result } = renderHook(() => useComplianceActions(null));

            expect(result.current.updating).toBe(false);
            expect(result.current.handleStatusChange).toBeDefined();
        });
    });
});
