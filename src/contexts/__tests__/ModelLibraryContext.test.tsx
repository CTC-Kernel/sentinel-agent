/**
 * ModelLibraryContext Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React, { useContext } from 'react';

// Mock three.js Group - must be hoisted
const { MockGroup, mockLoadSafe } = vi.hoisted(() => {
    class MockGroupClass {
        children: unknown[] = [];
        type = 'Group';
    }
    return {
        MockGroup: MockGroupClass,
        mockLoadSafe: vi.fn(),
    };
});

vi.mock('three', () => ({
    Group: MockGroup,
}));

vi.mock('../modelLibraryConstants', async (importOriginal) => {
    const original = await importOriginal<typeof import('../modelLibraryConstants')>();
    return {
        ...original,
        loadSafe: (...args: unknown[]) => mockLoadSafe(...args),
    };
});

import { ModelLibraryProvider } from '../ModelLibraryContext';
import { ModelLibraryContext } from '../ModelLibraryContextDefinition';

const useModelLibrary = () => {
    const context = useContext(ModelLibraryContext);
    return context;
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ModelLibraryProvider>{children}</ModelLibraryProvider>
);

describe('ModelLibraryContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock: return mock groups
        mockLoadSafe.mockImplementation(() => Promise.resolve(new MockGroup()));
    });

    describe('ModelLibraryProvider', () => {
        it('should provide model library context with lazy loading methods', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(result.current).toBeDefined();
                expect(result.current!.getModel).toBeDefined();
                expect(result.current!.loadModel).toBeDefined();
                expect(result.current!.isLoaded).toBeDefined();
                expect(result.current!.isLoading).toBeDefined();
            });
        });

        it('should lazy load model on first getModel call', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Initial state - no models loaded yet
            expect(mockLoadSafe).not.toHaveBeenCalled();

            // Trigger lazy load by calling getModel
            act(() => {
                result.current!.getModel('asset');
            });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/server/console.obj');
            });
        });

        it('should load asset model on demand', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('asset');
            });

            expect(mockLoadSafe).toHaveBeenCalledWith('/models/server/console.obj');
        });

        it('should load risk model on demand', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('risk');
            });

            expect(mockLoadSafe).toHaveBeenCalledWith('/models/flame/flame.obj');
        });

        it('should load incident model on demand', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('incident');
            });

            expect(mockLoadSafe).toHaveBeenCalledWith('/models/shield/shield.obj');
        });

        it('should load supplier model on demand', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('supplier');
            });

            expect(mockLoadSafe).toHaveBeenCalledWith('/models/cap/cap.obj');
        });

        it('should load project model on demand', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('project');
            });

            expect(mockLoadSafe).toHaveBeenCalledWith('/models/box/box.obj');
        });

        it('should cache loaded models', async () => {
            const mockAssetGroup = new MockGroup();
            mockLoadSafe.mockResolvedValue(mockAssetGroup);

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Load model twice
            await act(async () => {
                await result.current!.loadModel('asset');
            });
            await act(async () => {
                await result.current!.loadModel('asset');
            });

            // Should only load once due to caching
            expect(mockLoadSafe).toHaveBeenCalledTimes(1);
        });

        it('should return loaded model from getModel after loading', async () => {
            const mockAssetGroup = new MockGroup();
            mockLoadSafe.mockResolvedValue(mockAssetGroup);

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('asset');
            });

            const model = result.current!.getModel('asset');
            expect(model).toBeDefined();
        });

        it('should track loading state', async () => {
            let resolvePromise: (value: unknown) => void;
            mockLoadSafe.mockImplementation(() => new Promise(resolve => {
                resolvePromise = resolve;
            }));

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Start loading
            act(() => {
                result.current!.loadModel('asset');
            });

            // Should be loading
            expect(result.current!.isLoading('asset')).toBe(true);

            // Resolve the promise
            await act(async () => {
                resolvePromise!(new MockGroup());
            });

            // Should no longer be loading
            await waitFor(() => {
                expect(result.current!.isLoading('asset')).toBe(false);
            });
        });

        it('should track loaded state', async () => {
            mockLoadSafe.mockResolvedValue(new MockGroup());

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Initially not loaded
            expect(result.current!.isLoaded('asset')).toBe(false);

            await act(async () => {
                await result.current!.loadModel('asset');
            });

            // Should be loaded now
            expect(result.current!.isLoaded('asset')).toBe(true);
        });

        it('should handle load failure gracefully', async () => {
            mockLoadSafe.mockRejectedValue(new Error('Load failed'));

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await act(async () => {
                await result.current!.loadModel('asset');
            });

            // Should not throw and should still return a fallback
            expect(result.current!.isLoaded('asset')).toBe(true);
        });
    });

    describe('context value', () => {
        it('should have getModel function', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(typeof result.current!.getModel).toBe('function');
        });

        it('should have loadModel function', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(typeof result.current!.loadModel).toBe('function');
        });

        it('should have isLoaded function', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(typeof result.current!.isLoaded).toBe('function');
        });

        it('should have isLoading function', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(typeof result.current!.isLoading).toBe('function');
        });
    });
});
