/**
 * Unit tests for useDeepLinkAction hook
 * Tests deep linking for opening items by ID, create mode, presets
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeepLinkAction } from '../useDeepLinkAction';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Track setSearchParams calls
const mockSetSearchParams = vi.fn();
let currentParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useSearchParams: () => [currentParams, mockSetSearchParams]
    };
});

describe('useDeepLinkAction', () => {
    const createWrapper = (initialEntries: string[] = ['/']) =>
        ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={initialEntries}>
                {children}
            </MemoryRouter>
        );

    const mockData = [
        { id: 'item-1', name: 'Item 1' },
        { id: 'item-2', name: 'Item 2' },
        { id: 'item-3', name: 'Item 3' }
    ];

    const mockOnOpen = vi.fn();
    const mockOnCreate = vi.fn();
    const mockOnCreateWithPreset = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        currentParams = new URLSearchParams();
        mockSetSearchParams.mockImplementation((fn) => {
            if (typeof fn === 'function') {
                fn(currentParams);
            }
        });
    });

    describe('open by ID', () => {
        it('opens item when id param matches data', () => {
            currentParams = new URLSearchParams('id=item-2');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).toHaveBeenCalledWith(mockData[1]);
        });

        it('does not open item when loading', () => {
            currentParams = new URLSearchParams('id=item-1');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: true,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).not.toHaveBeenCalled();
        });

        it('does not open item when already selected', () => {
            currentParams = new URLSearchParams('id=item-1');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: mockData[0],
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).not.toHaveBeenCalled();
        });

        it('does not call onOpen when id not found in data', () => {
            currentParams = new URLSearchParams('id=non-existent');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).not.toHaveBeenCalled();
        });

        it('does not call onOpen when data is empty', () => {
            currentParams = new URLSearchParams('id=item-1');

            renderHook(() =>
                useDeepLinkAction({
                    data: [],
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).not.toHaveBeenCalled();
        });
    });

    describe('create action', () => {
        it('triggers onCreate when action=create', () => {
            currentParams = new URLSearchParams('action=create');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnCreate).toHaveBeenCalled();
        });

        it('does not trigger onCreate when already in creation mode', () => {
            currentParams = new URLSearchParams('action=create');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: true
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnCreate).not.toHaveBeenCalled();
        });

        it('clears action param after triggering create', () => {
            currentParams = new URLSearchParams('action=create');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockSetSearchParams).toHaveBeenCalled();
        });
    });

    describe('create with preset', () => {
        it('triggers onCreateWithPreset when createForAsset param exists', () => {
            currentParams = new URLSearchParams('createForAsset=asset-123');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    onCreateWithPreset: mockOnCreateWithPreset,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnCreateWithPreset).toHaveBeenCalledWith({ assetId: 'asset-123' });
        });

        it('does not trigger onCreateWithPreset when already in creation mode', () => {
            currentParams = new URLSearchParams('createForAsset=asset-123');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    onCreateWithPreset: mockOnCreateWithPreset,
                    currentSelection: null,
                    isCreationMode: true
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnCreateWithPreset).not.toHaveBeenCalled();
        });

        it('does not trigger when onCreateWithPreset not provided', () => {
            currentParams = new URLSearchParams('createForAsset=asset-123');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnCreateWithPreset).not.toHaveBeenCalled();
        });

        it('clears createForAsset param after triggering', () => {
            currentParams = new URLSearchParams('createForAsset=asset-123');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    onCreateWithPreset: mockOnCreateWithPreset,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockSetSearchParams).toHaveBeenCalled();
        });
    });

    describe('cleanup on close', () => {
        it('clears id param when selection cleared', () => {
            currentParams = new URLSearchParams('id=item-1');

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            // setSearchParams should be called to clear the id param
            expect(mockSetSearchParams).toHaveBeenCalled();
        });

        it('does not clear id param when item is selected', () => {
            currentParams = new URLSearchParams('id=item-1');
            mockSetSearchParams.mockClear();

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: mockData[0],
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            // The first useEffect opens, the second should not clear
            // since currentSelection matches
        });

        it('does not clear params when loading', () => {
            currentParams = new URLSearchParams('id=item-1');
            mockSetSearchParams.mockClear();

            renderHook(() =>
                useDeepLinkAction({
                    data: [],
                    loading: true,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockSetSearchParams).not.toHaveBeenCalled();
        });
    });

    describe('no params', () => {
        it('does nothing when no deep link params', () => {
            currentParams = new URLSearchParams();

            renderHook(() =>
                useDeepLinkAction({
                    data: mockData,
                    loading: false,
                    onOpen: mockOnOpen,
                    onCreate: mockOnCreate,
                    currentSelection: null,
                    isCreationMode: false
                }),
                { wrapper: createWrapper() }
            );

            expect(mockOnOpen).not.toHaveBeenCalled();
            expect(mockOnCreate).not.toHaveBeenCalled();
        });
    });
});
