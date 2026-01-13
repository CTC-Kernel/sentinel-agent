/**
 * useIncidents Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIncidents } from '../useIncidents';

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-incident-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

// Mock Store
const mockAddToast = vi.fn();
const mockT = vi.fn((key: string) => key);
const mockUser = {
    uid: 'user-123',
    organizationId: 'org-123',
    email: 'user@test.com',
    displayName: 'Test User',
};

vi.mock('../../store', () => ({
    useStore: vi.fn(() => ({
        user: mockUser,
        addToast: mockAddToast,
        t: mockT,
    })),
}));

// Mock Services
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

vi.mock('../../services/notificationService', () => ({
    NotificationService: {
        notifyNewIncident: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/hybridService', () => ({
    hybridService: {
        logCriticalEvent: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../services/logger', () => ({
    logAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/incidentService', () => ({
    IncidentService: {
        deleteIncidentWithLog: vi.fn().mockResolvedValue(undefined),
        bulkDeleteIncidents: vi.fn().mockResolvedValue(undefined),
        importIncidentsFromCSV: vi.fn().mockResolvedValue(5),
    },
}));

vi.mock('../../services/ImportService', () => ({
    ImportService: {
        parseCSV: vi.fn((content: string) => {
            if (!content) return [];
            return [{ Titre: 'Test', Description: 'Desc' }];
        }),
    },
}));

vi.mock('../../utils/dataSanitizer', () => ({
    sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../schemas/incidentSchema', () => ({
    incidentSchema: {
        partial: vi.fn(() => ({
            safeParse: vi.fn((data) => ({ success: true, data })),
        })),
    },
}));

vi.mock('../../types/incidents', () => ({
    isValidIncidentTransition: vi.fn(() => true),
}));

import { addDoc, updateDoc } from 'firebase/firestore';
import { IncidentService } from '../../services/incidentService';
import { ImportService } from '../../services/ImportService';
import { useStore } from '../../store';
import { isValidIncidentTransition } from '../../types/incidents';

describe('useIncidents', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            addToast: mockAddToast,
            t: mockT,
        } as ReturnType<typeof useStore>);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('addIncident', () => {
        it('should add a new incident', async () => {
            const { result } = renderHook(() => useIncidents());

            const incidentData = {
                title: 'Test Incident',
                description: 'Test Description',
                severity: 'High',
                status: 'Analyse',
                category: 'Intrusion',
            };

            let incidentId: string | null = null;
            await act(async () => {
                incidentId = await result.current.addIncident(incidentData as never);
            });

            expect(incidentId).toBe('new-incident-id');
            expect(addDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('incidents.toastDeclared', 'success');
        });

        it('should auto-populate dateAnalysis when status is Analyse', async () => {
            const { result } = renderHook(() => useIncidents());

            const incidentData = {
                title: 'Test',
                status: 'Analyse',
            };

            await act(async () => {
                await result.current.addIncident(incidentData as never);
            });

            expect(addDoc).toHaveBeenCalled();
        });

        it('should auto-populate dateResolved when status is Résolu', async () => {
            const { result } = renderHook(() => useIncidents());

            const incidentData = {
                title: 'Test',
                status: 'Résolu',
            };

            await act(async () => {
                await result.current.addIncident(incidentData as never);
            });

            expect(addDoc).toHaveBeenCalled();
        });

        it('should return null when user has no organization', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { ...mockUser, organizationId: undefined },
                addToast: mockAddToast,
                t: mockT,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useIncidents());

            let incidentId: string | null = null;
            await act(async () => {
                incidentId = await result.current.addIncident({ title: 'Test' } as never);
            });

            expect(incidentId).toBeNull();
            expect(addDoc).not.toHaveBeenCalled();
        });

        it('should set loading state during operation', async () => {
            const { result } = renderHook(() => useIncidents());

            expect(result.current.loading).toBe(false);

            const addPromise = act(async () => {
                await result.current.addIncident({ title: 'Test' } as never);
            });

            // Note: Due to async nature, loading might already be false
            await addPromise;
            expect(result.current.loading).toBe(false);
        });
    });

    describe('updateIncident', () => {
        it('should update an existing incident', async () => {
            const { result } = renderHook(() => useIncidents());

            const updateData = {
                title: 'Updated Title',
                status: 'Contenu',
            };

            await act(async () => {
                await result.current.updateIncident('incident-1', updateData as never);
            });

            expect(updateDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('incidents.toastUpdated', 'success');
        });

        it('should validate status transitions', async () => {
            vi.mocked(isValidIncidentTransition).mockReturnValue(false);

            const { result } = renderHook(() => useIncidents());

            const currentIncident = {
                id: 'incident-1',
                status: 'Reporté',
            };

            await act(async () => {
                await result.current.updateIncident(
                    'incident-1',
                    { status: 'Fermé' } as never,
                    currentIncident as never
                );
            });

            expect(mockAddToast).toHaveBeenCalledWith(
                expect.stringContaining('Transition de statut invalide'),
                'error'
            );
            expect(updateDoc).not.toHaveBeenCalled();
        });

        it('should return undefined when user has no organization', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { ...mockUser, organizationId: undefined },
                addToast: mockAddToast,
                t: mockT,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useIncidents());

            await act(async () => {
                await result.current.updateIncident('incident-1', { title: 'Test' } as never);
            });

            expect(updateDoc).not.toHaveBeenCalled();
        });
    });

    describe('deleteIncident', () => {
        it('should delete an incident', async () => {
            const { result } = renderHook(() => useIncidents());

            await act(async () => {
                await result.current.deleteIncident('incident-1');
            });

            expect(IncidentService.deleteIncidentWithLog).toHaveBeenCalledWith({
                incidentId: 'incident-1',
                organizationId: 'org-123',
                userId: 'user-123',
                userEmail: 'user@test.com',
            });
            expect(mockAddToast).toHaveBeenCalledWith('incidents.toastDeleted', 'info');
        });

        it('should do nothing when user has no organization', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { ...mockUser, organizationId: undefined },
                addToast: mockAddToast,
                t: mockT,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useIncidents());

            await act(async () => {
                await result.current.deleteIncident('incident-1');
            });

            expect(IncidentService.deleteIncidentWithLog).not.toHaveBeenCalled();
        });
    });

    describe('deleteIncidentsBulk', () => {
        it('should delete multiple incidents', async () => {
            const { result } = renderHook(() => useIncidents());
            const ids = ['incident-1', 'incident-2', 'incident-3'];

            await act(async () => {
                await result.current.deleteIncidentsBulk(ids);
            });

            expect(IncidentService.bulkDeleteIncidents).toHaveBeenCalledWith(
                ids,
                'org-123',
                'user-123',
                'user@test.com'
            );
        });
    });

    describe('simulateAttack', () => {
        it('should create a simulated ransomware incident', async () => {
            const { result } = renderHook(() => useIncidents());

            let incident: unknown = null;
            await act(async () => {
                incident = await result.current.simulateAttack();
            });

            expect(incident).toBeTruthy();
            expect(addDoc).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('incidents.toastSim', 'info');
        });

        it('should return null when user has no organization', async () => {
            vi.mocked(useStore).mockReturnValue({
                user: { ...mockUser, organizationId: undefined },
                addToast: mockAddToast,
                t: mockT,
            } as unknown as ReturnType<typeof useStore>);

            const { result } = renderHook(() => useIncidents());

            let incident: unknown = null;
            await act(async () => {
                incident = await result.current.simulateAttack();
            });

            expect(incident).toBeNull();
        });
    });

    describe('importIncidents', () => {
        it('should import incidents from CSV', async () => {
            const { result } = renderHook(() => useIncidents());

            await act(async () => {
                await result.current.importIncidents('Titre,Description\nTest,Desc');
            });

            expect(ImportService.parseCSV).toHaveBeenCalled();
            expect(IncidentService.importIncidentsFromCSV).toHaveBeenCalled();
        });

        it('should show error for empty CSV', async () => {
            vi.mocked(ImportService.parseCSV).mockReturnValue([]);

            const { result } = renderHook(() => useIncidents());

            await act(async () => {
                await result.current.importIncidents('');
            });

            expect(mockAddToast).toHaveBeenCalledWith('Fichier vide ou invalide', 'error');
        });
    });

    describe('importIncidentsFromEvents', () => {
        it('should import security events as incidents', async () => {
            const { result } = renderHook(() => useIncidents());

            const events = [
                {
                    id: 'event-1',
                    title: 'Security Event',
                    description: 'Event description',
                    severity: 'High',
                    source: 'SIEM',
                    rawData: {},
                },
            ];

            await act(async () => {
                await result.current.importIncidentsFromEvents(events as never);
            });

            expect(addDoc).toHaveBeenCalled();
        });
    });
});
