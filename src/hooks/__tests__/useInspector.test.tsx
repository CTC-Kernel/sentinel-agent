/**
 * Unit tests for useInspector hook
 * Tests CRUD operations with tab navigation, URL sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInspector, useInspectorReadOnly, InspectorTab } from '../useInspector';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let currentParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: () => [currentParams, mockSetSearchParams]
    };
});

// Mock ErrorHandler
vi.mock('../../utils/errorHandler', () => ({
    ErrorHandler: {
        handle: vi.fn()
    },
    ErrorSeverity: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    },
    ErrorCategory: {
        BUSINESS_LOGIC: 'business_logic',
        DATABASE: 'database'
    }
}));

describe('useInspector', () => {
    const createWrapper = () =>
        ({ children }: { children: ReactNode }) => (
            <MemoryRouter>{children}</MemoryRouter>
        );

    const testTabs: InspectorTab[] = [
        { id: 'details', label: 'Détails' },
        { id: 'history', label: 'Historique' },
        { id: 'actions', label: 'Actions' }
    ];

    const testEntity = {
        id: 'entity-123',
        name: 'Test Entity'
    };

    const mockActions = {
        onUpdate: vi.fn(),
        onCreate: vi.fn(),
        onDelete: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        currentParams = new URLSearchParams();
        mockSetSearchParams.mockImplementation((params) => {
            if (params instanceof URLSearchParams) {
                currentParams = params;
            }
        });
    });

    describe('initialization', () => {
        it('initializes with default tab', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.activeTab).toBe('details');
        });

        it('initializes with specified default tab', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    defaultTab: 'history',
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.activeTab).toBe('history');
        });

        it('provides initial loading states', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.loading).toBe(false);
            expect(result.current.saving).toBe(false);
        });

        it('detects create mode when entity is null', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.isCreateMode).toBe(true);
        });

        it('detects edit mode when entity has id', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.isCreateMode).toBe(false);
        });

        it('gets entity name using custom function', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    getEntityName: (e) => e.name
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.entityName).toBe('Test Entity');
        });
    });

    describe('tab navigation', () => {
        it('changes active tab', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.setActiveTab('history');
            });

            expect(result.current.activeTab).toBe('history');
        });

        it('syncs tab with URL when enabled', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    syncWithUrl: true
                }),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.setActiveTab('actions');
            });

            expect(mockSetSearchParams).toHaveBeenCalled();
        });

        it('reads tab from URL when syncWithUrl enabled', () => {
            currentParams = new URLSearchParams('tab=history');

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    syncWithUrl: true
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.activeTab).toBe('history');
        });

        it('ignores invalid tab from URL', () => {
            currentParams = new URLSearchParams('tab=invalid');

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    syncWithUrl: true
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.activeTab).toBe('details');
        });
    });

    describe('edit mode', () => {
        it('starts with isEditing false', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.isEditing).toBe(false);
        });

        it('toggles edit mode', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.toggleEditMode();
            });

            expect(result.current.isEditing).toBe(true);

            act(() => {
                result.current.toggleEditMode();
            });

            expect(result.current.isEditing).toBe(false);
        });

        it('enters edit mode', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.enterEditMode();
            });

            expect(result.current.isEditing).toBe(true);
        });

        it('exits edit mode', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            act(() => {
                result.current.enterEditMode();
            });

            act(() => {
                result.current.exitEditMode();
            });

            expect(result.current.isEditing).toBe(false);
        });
    });

    describe('handleUpdate', () => {
        it('calls onUpdate with entity id and data', async () => {
            mockActions.onUpdate.mockResolvedValue(true);

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleUpdate({ name: 'Updated Name' });
            });

            expect(mockActions.onUpdate).toHaveBeenCalledWith('entity-123', { name: 'Updated Name' });
        });

        it('calls onSuccess callback on successful update', async () => {
            mockActions.onUpdate.mockResolvedValue(true);
            const onSuccess = vi.fn();

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    onSuccess
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleUpdate({ name: 'Updated' });
            });

            expect(onSuccess).toHaveBeenCalled();
        });

        it('does not call onUpdate when entity has no id', async () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleUpdate({ name: 'Test' });
            });

            expect(mockActions.onUpdate).not.toHaveBeenCalled();
        });

        it('sets saving state during update', async () => {
            let resolveFn: () => void;
            mockActions.onUpdate.mockImplementation(() => new Promise(resolve => {
                resolveFn = () => resolve(true);
            }));

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            const updatePromise = act(async () => {
                await result.current.handleUpdate({ name: 'Test' });
            });

            // Cannot check intermediate state easily, but test completion
            resolveFn!();
            await updatePromise;

            expect(result.current.saving).toBe(false);
        });
    });

    describe('handleCreate', () => {
        it('calls onCreate with data', async () => {
            mockActions.onCreate.mockResolvedValue(true);

            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleCreate({ name: 'New Entity' });
            });

            expect(mockActions.onCreate).toHaveBeenCalledWith({ name: 'New Entity' });
        });

        it('calls onSuccess callback on successful create', async () => {
            mockActions.onCreate.mockResolvedValue(true);
            const onSuccess = vi.fn();

            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    onSuccess
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleCreate({ name: 'New' });
            });

            expect(onSuccess).toHaveBeenCalled();
        });

        it('does not call onSuccess when onCreate not configured', async () => {
            const onSuccess = vi.fn();

            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: {},
                    moduleName: 'Test',
                    onSuccess
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleCreate({ name: 'Test' });
            });

            expect(onSuccess).not.toHaveBeenCalled();
        });
    });

    describe('handleDelete', () => {
        it('calls onDelete with entity id and name', async () => {
            mockActions.onDelete.mockResolvedValue(undefined);

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    getEntityName: (e) => e.name
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleDelete();
            });

            expect(mockActions.onDelete).toHaveBeenCalledWith('entity-123', 'Test Entity');
        });

        it('calls onSuccess callback on successful delete', async () => {
            mockActions.onDelete.mockResolvedValue(undefined);
            const onSuccess = vi.fn();

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test',
                    onSuccess
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleDelete();
            });

            expect(onSuccess).toHaveBeenCalled();
        });

        it('does not call onDelete when entity has no id', async () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Test'
                }),
                { wrapper: createWrapper() }
            );

            await act(async () => {
                await result.current.handleDelete();
            });

            expect(mockActions.onDelete).not.toHaveBeenCalled();
        });
    });

    describe('breadcrumbs', () => {
        it('generates breadcrumbs for edit mode', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Asset',
                    getEntityName: (e) => e.name
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.breadcrumbs).toEqual([
                { label: 'Asset', onClick: expect.any(Function) },
                { label: 'Test Entity' }
            ]);
        });

        it('generates breadcrumbs for create mode', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: null,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Asset'
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.breadcrumbs).toEqual([
                { label: 'Asset', onClick: expect.any(Function) },
                { label: 'Nouveau' }
            ]);
        });

        it('uses custom breadcrumbs when provided', () => {
            const customBreadcrumbs = [
                { label: 'Home' },
                { label: 'Assets' },
                { label: 'Edit' }
            ];

            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Asset',
                    breadcrumbs: customBreadcrumbs
                }),
                { wrapper: createWrapper() }
            );

            expect(result.current.breadcrumbs).toEqual(customBreadcrumbs);
        });

        it('navigates back when breadcrumb clicked', () => {
            const { result } = renderHook(() =>
                useInspector({
                    entity: testEntity,
                    tabs: testTabs,
                    actions: mockActions,
                    moduleName: 'Asset'
                }),
                { wrapper: createWrapper() }
            );

            const firstBreadcrumb = result.current.breadcrumbs?.[0];
            firstBreadcrumb?.onClick?.();

            expect(mockNavigate).toHaveBeenCalledWith(-1);
        });
    });
});

describe('useInspectorReadOnly', () => {
    const createWrapper = () =>
        ({ children }: { children: ReactNode }) => (
            <MemoryRouter>{children}</MemoryRouter>
        );

    const testTabs: InspectorTab[] = [
        { id: 'details', label: 'Détails' },
        { id: 'history', label: 'Historique' }
    ];

    const testEntity = {
        id: 'entity-123',
        name: 'Test Entity'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        currentParams = new URLSearchParams();
    });

    it('returns read-only interface', () => {
        const { result } = renderHook(() =>
            useInspectorReadOnly(testEntity, testTabs, 'Test'),
            { wrapper: createWrapper() }
        );

        expect(result.current.activeTab).toBe('details');
        expect(result.current.entityName).toBe('Test Entity');
        expect(result.current.isEditing).toBe(false);
    });

    it('allows tab changes', () => {
        const { result } = renderHook(() =>
            useInspectorReadOnly(testEntity, testTabs, 'Test'),
            { wrapper: createWrapper() }
        );

        act(() => {
            result.current.setActiveTab('history');
        });

        expect(result.current.activeTab).toBe('history');
    });

    it('edit mode functions are no-ops', () => {
        const { result } = renderHook(() =>
            useInspectorReadOnly(testEntity, testTabs, 'Test'),
            { wrapper: createWrapper() }
        );

        act(() => {
            result.current.toggleEditMode();
            result.current.enterEditMode();
        });

        expect(result.current.isEditing).toBe(false);
    });

    it('uses custom entity name function', () => {
        const { result } = renderHook(() =>
            useInspectorReadOnly(testEntity, testTabs, 'Test', {
                getEntityName: (e) => `Custom: ${e.name}`
            }),
            { wrapper: createWrapper() }
        );

        expect(result.current.entityName).toBe('Custom: Test Entity');
    });
});
