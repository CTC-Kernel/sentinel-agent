/**
 * usePrivacy Hook Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePrivacy } from '../usePrivacy';

// Mock dependencies
const mockAddToast = vi.fn();
const mockUser = {
    uid: 'user-123',
    email: 'rssi@example.com',
    organizationId: 'org-123',
    organizationName: 'Test Org',
    displayName: 'RSSI User',
    role: 'rssi',
};

import { AppState } from '../../store';

const mockStoreState = {
    user: mockUser,
    addToast: mockAddToast,
    demoMode: false,
};

vi.mock('../../store', () => ({
    useStore: Object.assign(
        vi.fn((selector) => {
            if (selector) return selector(mockStoreState);
            return mockStoreState;
        }),
        {
            getState: () => mockStoreState,
        }
    ),
}));

// Mock Firebase
const mockGetDocs = vi.fn();
const mockUnsubscribe = vi.fn();
const mockOnSnapshot = vi.fn(() => mockUnsubscribe);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: () => mockGetDocs(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

// Mock PrivacyService
const mockFetchActivities = vi.fn();
const mockFetchActivityHistory = vi.fn();
const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockDeleteActivity = vi.fn();
const mockImportActivities = vi.fn();
const mockStartDPIA = vi.fn();
const mockFindDPIAResponseId = vi.fn();

vi.mock('../../services/PrivacyService', () => ({
    PrivacyService: {
        fetchActivities: () => mockFetchActivities(),
        fetchActivityHistory: (...args: unknown[]) => mockFetchActivityHistory(...args),
        createActivity: (...args: unknown[]) => mockCreateActivity(...args),
        updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
        deleteActivity: (...args: unknown[]) => mockDeleteActivity(...args),
        importActivities: (...args: unknown[]) => mockImportActivities(...args),
        startDPIA: (...args: unknown[]) => mockStartDPIA(...args),
        findDPIAResponseId: (...args: unknown[]) => mockFindDPIAResponseId(...args),
    },
}));

vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
        handleErrorWithToast: vi.fn(),
    },
}));

import { useStore } from '../../store';

// TODO: Tests need updating - hook now uses onSnapshot instead of getDocs
describe.skip('usePrivacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock responses
        mockFetchActivities.mockResolvedValue([]);
        mockGetDocs.mockResolvedValue({ docs: [] });
        mockFetchActivityHistory.mockResolvedValue([]);

        // Reset store mock
        vi.mocked(useStore).mockImplementation((selector) => {
            if (selector) return selector(mockStoreState as unknown as AppState);
            return mockStoreState as unknown as AppState;
        });
        (useStore as unknown as { getState: () => typeof mockStoreState }).getState = () => mockStoreState;
    });

    describe('initialization', () => {
        it('should initialize with empty state', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activities).toEqual([]);
            expect(result.current.selectedActivity).toBeNull();
            expect(result.current.isEditing).toBe(false);
        });

        it('should fetch activities on mount', async () => {
            mockFetchActivities.mockResolvedValue([
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    purpose: 'Testing',
                    manager: 'Manager',
                    status: 'Actif',
                    dataCategories: [],
                    dataSubjects: [],
                    legalBasis: 'Consentement',
                    retentionPeriod: '5 ans',
                    hasDPIA: false,
                },
            ]);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(mockFetchActivities).toHaveBeenCalled();
            expect(result.current.activities).toHaveLength(1);
        });

        it('should calculate stats correctly', async () => {
            mockFetchActivities.mockResolvedValue([
                {
                    id: 'activity-1',
                    name: 'Activity 1',
                    status: 'Actif',
                    dataCategories: ['Contact'],
                    hasDPIA: false,
                },
                {
                    id: 'activity-2',
                    name: 'Activity 2',
                    status: 'Actif',
                    dataCategories: ['Santé (Sensible)'],
                    hasDPIA: true,
                },
                {
                    id: 'activity-3',
                    name: 'Activity 3',
                    status: 'En révision',
                    dataCategories: ['Biométrique'],
                    hasDPIA: false,
                },
            ]);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.stats.total).toBe(3);
            expect(result.current.stats.sensitive).toBe(2); // Santé + Biométrique
            expect(result.current.stats.dpiaMissing).toBe(1); // Biométrique without DPIA
            expect(result.current.stats.review).toBe(1); // En révision
        });

        it('should not fetch when no organizationId and not demo mode', async () => {
            const noOrgState = { ...mockStoreState, user: { ...mockUser, organizationId: undefined } };
            vi.mocked(useStore).mockImplementation((selector) => {
                if (selector) return selector(noOrgState as unknown as AppState);
                return noOrgState as unknown as AppState;
            });
            (useStore as unknown as { getState: () => typeof noOrgState }).getState = () => noOrgState;

            renderHook(() => usePrivacy());

            // Should still be loading or finished without fetching
            expect(mockFetchActivities).not.toHaveBeenCalled();
        });
    });

    describe('handleCreate', () => {
        it('should create activity successfully', async () => {
            mockCreateActivity.mockResolvedValue('new-activity-id');

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleCreate({
                    name: 'New Activity',
                    purpose: 'Testing',
                });
            });

            expect(mockCreateActivity).toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Traitement ajouté avec succès', 'success');
            expect(result.current.showCreateModal).toBe(false);
        });

        it('should deny creation for non-authorized roles', async () => {
            const viewerState = { ...mockStoreState, user: { ...mockUser, role: 'user' } };
            vi.mocked(useStore).mockImplementation((selector) => {
                if (selector) return selector(viewerState as unknown as AppState);
                return viewerState as unknown as AppState;
            });
            (useStore as unknown as { getState: () => typeof viewerState }).getState = () => viewerState;

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleCreate({
                    name: 'New Activity',
                });
            });

            expect(mockCreateActivity).not.toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Permission refusée', 'error');
        });

        it('should not create when no organizationId', async () => {
            const noOrgState = { ...mockStoreState, user: { ...mockUser, organizationId: undefined } };
            vi.mocked(useStore).mockImplementation((selector) => {
                if (selector) return selector(noOrgState as unknown as AppState);
                return noOrgState as unknown as AppState;
            });

            const { result } = renderHook(() => usePrivacy());

            await act(async () => {
                await result.current.handleCreate({ name: 'Test' });
            });

            expect(mockCreateActivity).not.toHaveBeenCalled();
        });
    });

    describe('handleUpdate', () => {
        it('should update activity successfully', async () => {
            mockFetchActivities.mockResolvedValue([
                {
                    id: 'activity-1',
                    name: 'Test Activity',
                    purpose: 'Testing',
                    status: 'Actif',
                    dataCategories: [],
                },
            ]);
            mockUpdateActivity.mockResolvedValue(undefined);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Select activity first
            act(() => {
                result.current.setSelectedActivity(result.current.activities[0]);
            });

            await act(async () => {
                await result.current.handleUpdate({
                    name: 'Updated Activity',
                });
            });

            expect(mockUpdateActivity).toHaveBeenCalledWith(
                'activity-1',
                { name: 'Updated Activity' },
                expect.any(Object)
            );
            expect(mockAddToast).toHaveBeenCalledWith('Traitement mis à jour', 'success');
            expect(result.current.isEditing).toBe(false);
        });

        it('should deny update for non-authorized roles', async () => {
            const viewerState = { ...mockStoreState, user: { ...mockUser, role: 'user' } };
            vi.mocked(useStore).mockImplementation((selector) => {
                if (selector) return selector(viewerState as unknown as AppState);
                return viewerState as unknown as AppState;
            });
            (useStore as unknown as { getState: () => typeof viewerState }).getState = () => viewerState;

            mockFetchActivities.mockResolvedValue([
                { id: 'activity-1', name: 'Test', status: 'Actif', dataCategories: [] },
            ]);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.setSelectedActivity(result.current.activities[0]);
            });

            await act(async () => {
                await result.current.handleUpdate({ name: 'Updated' });
            });

            expect(mockUpdateActivity).not.toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith('Permission refusée', 'error');
        });

        it('should not update without selected activity', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleUpdate({ name: 'Test' });
            });

            expect(mockUpdateActivity).not.toHaveBeenCalled();
        });
    });

    describe('handleDelete', () => {
        it('should delete activity successfully', async () => {
            mockFetchActivities.mockResolvedValue([
                { id: 'activity-1', name: 'Test', status: 'Actif', dataCategories: [] },
            ]);
            mockDeleteActivity.mockResolvedValue(undefined);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleDelete('activity-1', 'Test');
            });

            expect(mockDeleteActivity).toHaveBeenCalledWith('activity-1', 'Test', expect.any(Object));
            expect(mockAddToast).toHaveBeenCalledWith('Traitement supprimé', 'success');
        });

        it('should deny delete for non-authorized roles', async () => {
            const pmState = { ...mockStoreState, user: { ...mockUser, role: 'project_manager' } };
            vi.mocked(useStore).mockImplementation((selector) => {
                if (selector) return selector(pmState as unknown as AppState);
                return pmState as unknown as AppState;
            });
            (useStore as unknown as { getState: () => typeof pmState }).getState = () => pmState;

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.handleDelete('activity-1', 'Test');
            });

            expect(mockDeleteActivity).not.toHaveBeenCalled();
            expect(mockAddToast).toHaveBeenCalledWith(
                'Permission refusée : Seuls les RSSI/Direction peuvent supprimer.',
                'error'
            );
        });

        it('should clear selected activity when deleted', async () => {
            mockFetchActivities.mockResolvedValue([
                { id: 'activity-1', name: 'Test', status: 'Actif', dataCategories: [] },
            ]);
            mockDeleteActivity.mockResolvedValue(undefined);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Select the activity
            act(() => {
                result.current.setSelectedActivity(result.current.activities[0]);
            });

            expect(result.current.selectedActivity?.id).toBe('activity-1');

            await act(async () => {
                await result.current.handleDelete('activity-1', 'Test');
            });

            expect(result.current.selectedActivity).toBeNull();
        });
    });

    describe('handleStartDPIA', () => {
        it('should start DPIA successfully', async () => {
            mockStartDPIA.mockResolvedValue('dpia-response-123');

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const activity = {
                id: 'activity-1',
                name: 'Test',
                status: 'Actif',
                dataCategories: ['Santé (Sensible)'],
                hasDPIA: false,
            };

            await act(async () => {
                await result.current.handleStartDPIA(activity as never);
            });

            expect(mockStartDPIA).toHaveBeenCalledWith(activity, expect.any(Object));
            expect(mockAddToast).toHaveBeenCalledWith('Dossier DPIA créé', 'success');
            expect(result.current.viewingAssessmentId).toBe('dpia-response-123');
        });

        it('should update selected activity hasDPIA when starting DPIA', async () => {
            mockFetchActivities.mockResolvedValue([
                { id: 'activity-1', name: 'Test', status: 'Actif', dataCategories: [], hasDPIA: false },
            ]);
            mockStartDPIA.mockResolvedValue('dpia-response-123');

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Select the activity
            act(() => {
                result.current.setSelectedActivity(result.current.activities[0]);
            });

            await act(async () => {
                await result.current.handleStartDPIA(result.current.selectedActivity as never);
            });

            expect(result.current.selectedActivity?.hasDPIA).toBe(true);
        });
    });

    describe('handleViewDPIA', () => {
        it('should view existing DPIA', async () => {
            mockFindDPIAResponseId.mockResolvedValue('existing-dpia-123');

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const activity = {
                id: 'activity-1',
                name: 'Test',
                hasDPIA: true,
            };

            await act(async () => {
                await result.current.handleViewDPIA(activity as never);
            });

            expect(mockFindDPIAResponseId).toHaveBeenCalledWith('activity-1');
            expect(result.current.viewingAssessmentId).toBe('existing-dpia-123');
        });

        it('should start DPIA if none exists', async () => {
            mockFindDPIAResponseId.mockResolvedValue(null);
            mockStartDPIA.mockResolvedValue('new-dpia-123');

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const activity = {
                id: 'activity-1',
                name: 'Test',
                hasDPIA: false,
            };

            await act(async () => {
                await result.current.handleViewDPIA(activity as never);
            });

            expect(mockStartDPIA).toHaveBeenCalled();
        });
    });

    describe('UI state management', () => {
        it('should toggle showCreateModal', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.showCreateModal).toBe(false);

            act(() => {
                result.current.setShowCreateModal(true);
            });

            expect(result.current.showCreateModal).toBe(true);
        });

        it('should toggle isEditing', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.isEditing).toBe(false);

            act(() => {
                result.current.setIsEditing(true);
            });

            expect(result.current.isEditing).toBe(true);
        });

        it('should set and clear viewingAssessmentId', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.setViewingAssessmentId('assessment-123');
            });

            expect(result.current.viewingAssessmentId).toBe('assessment-123');

            act(() => {
                result.current.setViewingAssessmentId(null);
            });

            expect(result.current.viewingAssessmentId).toBeNull();
        });
    });

    describe('activity history', () => {
        it('should fetch history when activity is selected', async () => {
            mockFetchActivities.mockResolvedValue([
                { id: 'activity-1', name: 'Test', status: 'Actif', dataCategories: [] },
            ]);
            mockFetchActivityHistory.mockResolvedValue([
                { id: 'log-1', action: 'CREATE', timestamp: Date.now() },
            ]);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                result.current.setSelectedActivity(result.current.activities[0]);
            });

            await waitFor(() => {
                expect(mockFetchActivityHistory).toHaveBeenCalled();
                // Wait for the state update to be processed
                expect(result.current.activityHistory).toHaveLength(1);
            });
        });
    });

    describe('manager resolution', () => {
        it('should resolve managerId from manager name', async () => {
            mockFetchActivities.mockResolvedValue([
                {
                    id: 'activity-1',
                    name: 'Test',
                    manager: 'John Doe',
                    status: 'Actif',
                    dataCategories: [],
                },
            ]);

            mockGetDocs.mockResolvedValue({
                docs: [
                    {
                        id: 'user-1',
                        data: () => ({ uid: 'user-1', displayName: 'John Doe' }),
                    },
                ],
            });

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Activity should have managerId resolved
            expect(result.current.activities[0].managerId).toBe('user-1');
        });
    });

    describe('file upload', () => {
        it('should handle file upload', async () => {
            mockImportActivities.mockResolvedValue(2);

            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Create a mock file and event
            const csvContent = 'Name,Purpose\nActivity1,Purpose1\nActivity2,Purpose2';
            const file = new File([csvContent], 'activities.csv', { type: 'text/csv' });

            const event = {
                target: {
                    files: [file],
                },
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            // Call handleFileUpload
            act(() => {
                result.current.handleFileUpload(event);
            });

            // Wait for import to be called
            await waitFor(() => {
                expect(mockImportActivities).toHaveBeenCalled();
            });

            // Wait for data reload triggered by import
            await waitFor(() => {
                expect(mockFetchActivities).toHaveBeenCalled();
            });
        });

        it('should not process empty files', async () => {
            const { result } = renderHook(() => usePrivacy());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            const event = {
                target: {
                    files: [],
                },
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            act(() => {
                result.current.handleFileUpload(event);
            });

            expect(mockImportActivities).not.toHaveBeenCalled();
        });
    });
});
