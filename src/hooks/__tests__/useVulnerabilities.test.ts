/**
 * Unit tests for useVulnerabilities hook
 * Tests vulnerability CRUD operations and CISA KEV seeding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Vulnerability } from '../../types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn((field, op, value) => ({ type: 'where', fieldPath: field, opStr: op, value })),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    serverTimestamp: () => 'server-timestamp'
}));

vi.mock('../../firebase', () => ({
    db: {}
}));

// Mock store
const mockAddToast = vi.fn();
const mockStoreState = {
    user: { organizationId: 'org-123', email: 'test@example.com', uid: 'user-1', role: 'admin' },
    addToast: mockAddToast,
    demoMode: false,
    customRoles: []
};

vi.mock('../../store', () => {
    const useStore = () => mockStoreState;
    useStore.getState = () => mockStoreState;
    return { useStore };
});

// Mock error logger
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock data sanitizer
vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: (data: unknown) => data
}));

// Mock ThreatFeedService
vi.mock('../../services/ThreatFeedService', () => ({
    ThreatFeedService: {
        fetchCisaKev: vi.fn().mockResolvedValue([])
    }
}));

// Mock logger
vi.mock('../../services/logger', () => ({
    logAction: vi.fn()
}));

import { useVulnerabilities } from '../useVulnerabilities';

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useVulnerabilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOnSnapshot.mockImplementation((_, callback) => {
            callback({
                docs: [
                    {
                        id: 'vuln-1',
                        data: () => ({
                            cveId: 'CVE-2024-0001',
                            title: 'Test Vulnerability',
                            severity: 'High',
                            status: 'Open',
                            organizationId: 'org-123' // Match mock user's organizationId for IDOR check
                        })
                    }
                ]
            });
            return vi.fn(); // unsubscribe
        });
    });

    describe('initialization', () => {
        it('initializes with loading state', () => {
            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            // After onSnapshot fires, loading should be false
            expect(result.current.loading).toBe(false);
        });

        it('loads vulnerabilities from Firestore', async () => {
            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await waitFor(() => {
                expect(result.current.vulnerabilities.length).toBe(1);
            });

            expect(result.current.vulnerabilities[0].cveId).toBe('CVE-2024-0001');
        });

        it('provides all expected functions', () => {
            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            expect(typeof result.current.addVulnerability).toBe('function');
            expect(typeof result.current.updateVulnerability).toBe('function');
            expect(typeof result.current.deleteVulnerability).toBe('function');
            expect(typeof result.current.createRiskFromVuln).toBe('function');
            expect(typeof result.current.importVulnerabilities).toBe('function');
        });
    });

    describe('addVulnerability', () => {
        it('adds vulnerability to Firestore', async () => {
            mockAddDoc.mockResolvedValue({ id: 'new-vuln-id' });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.addVulnerability({
                    cveId: 'CVE-2024-0002',
                    title: 'New Vulnerability',
                    severity: 'Critical'
                });
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Vulnérabilité créée', 'success');
        });

        it('returns true on success', async () => {
            mockAddDoc.mockResolvedValue({ id: 'new-id' });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.addVulnerability({
                    cveId: 'CVE-2024-0003'
                });
            });

            expect(success).toBe(true);
        });

        it('handles errors', async () => {
            mockAddDoc.mockRejectedValue(new Error('Database error'));

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await expect(
                act(async () => {
                    await result.current.addVulnerability({
                        cveId: 'CVE-error'
                    });
                })
            ).rejects.toThrow();

            expect(mockAddToast).toHaveBeenCalledWith('Erreur lors de la création', 'error');
        });
    });

    describe('updateVulnerability', () => {
        it('updates vulnerability in Firestore', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);
            mockGetDocs.mockResolvedValue({ empty: true });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.updateVulnerability('vuln-1', {
                    status: 'In Progress'
                });
            });

            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Vulnérabilité mise à jour', 'success');
        });

        it('updates related risk when resolved', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);
            mockGetDocs.mockResolvedValue({
                empty: false,
                docs: [{
                    id: 'risk-1',
                    data: () => ({ threat: 'Related Risk' })
                }]
            });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.updateVulnerability('vuln-1', {
                    status: 'Resolved',
                    cveId: 'CVE-2024-0001'
                });
            });

            // Should update both vulnerability and related risk
            expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
            expect(mockAddToast).toHaveBeenCalledWith('1 risque associé marqué comme Traité', 'success');
        });

        it('handles errors', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await expect(
                act(async () => {
                    await result.current.updateVulnerability('vuln-1', { status: 'Resolved' });
                })
            ).rejects.toThrow();

            expect(mockAddToast).toHaveBeenCalledWith('Erreur lors de la modification', 'error');
        });
    });

    describe('deleteVulnerability', () => {
        it('deletes vulnerability from Firestore', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.deleteVulnerability('vuln-1');
            });

            expect(mockDeleteDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Supprimé avec succès', 'success');
        });

        it('returns true on success', async () => {
            mockDeleteDoc.mockResolvedValue(undefined);

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.deleteVulnerability('vuln-1');
            });

            expect(success).toBe(true);
        });

        it('returns false for non-existent vulnerability (IDOR protection)', async () => {
            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.deleteVulnerability('non-existent-vuln');
            });

            expect(success).toBe(false);
            expect(mockAddToast).toHaveBeenCalledWith('Vulnérabilité non trouvée', 'error');
            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });

        it('handles database errors', async () => {
            mockDeleteDoc.mockRejectedValue(new Error('Delete failed'));

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            // Use existing vuln-1 which has organizationId: 'org-123' matching our mock user
            await expect(
                act(async () => {
                    await result.current.deleteVulnerability('vuln-1');
                })
            ).rejects.toThrow('Delete failed');

            expect(mockAddToast).toHaveBeenCalledWith('Erreur lors de la suppression', 'error');
        });
    });

    describe('createRiskFromVuln', () => {
        it('creates risk from vulnerability', async () => {
            mockAddDoc.mockResolvedValue({ id: 'new-risk-id' });
            mockUpdateDoc.mockResolvedValue(undefined);

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.createRiskFromVuln({
                    id: 'vuln-1',
                    cveId: 'CVE-2024-0001',
                    title: 'Test Vuln',
                    description: 'Description',
                    severity: 'Critical',
                    assetId: 'asset-1'
                } as unknown as Vulnerability);
            });

            expect(mockAddDoc).toHaveBeenCalled();
            expect(mockUpdateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Risque créé et lié avec succès', 'success');
        });

        it('does nothing without vuln id', async () => {
            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.createRiskFromVuln({
                    cveId: 'CVE-no-id',
                    severity: 'High'
                } as unknown as Vulnerability);
            });

            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        it('handles errors', async () => {
            mockAddDoc.mockRejectedValue(new Error('Create risk failed'));

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await expect(
                act(async () => {
                    await result.current.createRiskFromVuln({
                        id: 'vuln-error',
                        cveId: 'CVE-error',
                        severity: 'High'
                    } as unknown as Vulnerability);
                })
            ).rejects.toThrow();

            expect(mockAddToast).toHaveBeenCalledWith('Erreur création risque', 'error');
        });
    });

    describe('importVulnerabilities', () => {
        it('imports multiple vulnerabilities', async () => {
            mockAddDoc.mockResolvedValue({ id: 'imported-id' });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await act(async () => {
                await result.current.importVulnerabilities([
                    { cveId: 'CVE-2024-0010', severity: 'High' },
                    { cveId: 'CVE-2024-0011', severity: 'Medium' },
                    { cveId: 'CVE-2024-0012', severity: 'Low' }
                ]);
            });

            expect(mockAddDoc).toHaveBeenCalledTimes(3);
            expect(mockAddToast).toHaveBeenCalledWith('3 vulnérabilités importées', 'success');
        });

        it('returns true on success', async () => {
            mockAddDoc.mockResolvedValue({ id: 'id' });

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            let success: boolean | undefined;
            await act(async () => {
                success = await result.current.importVulnerabilities([
                    { cveId: 'CVE-import' }
                ]);
            });

            expect(success).toBe(true);
        });

        it('handles errors', async () => {
            mockAddDoc.mockRejectedValue(new Error('Import failed'));

            const { result } = renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            try {
                await act(async () => {
                    await result.current.importVulnerabilities([{ cveId: 'CVE-fail' }]);
                });
            } catch {
                // Expected to throw
            }

            // Toast should show error message
            expect(mockAddToast).toHaveBeenCalled();
        });
    });

    describe('error handling on subscribe', () => {
        it('shows error toast on subscription error', async () => {
            mockOnSnapshot.mockImplementation((_, __, errorCallback) => {
                errorCallback(new Error('Subscription error'));
                return vi.fn();
            });

            renderHook(() => useVulnerabilities(), { wrapper: createWrapper() });

            await waitFor(() => {
                expect(mockAddToast).toHaveBeenCalledWith(
                    'Erreur lors du chargement des vulnérabilités',
                    'error'
                );
            });
        });
    });
});
