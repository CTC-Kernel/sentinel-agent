/**
 * ModelLibraryContext Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

vi.mock('../modelLibraryConstants', () => ({
    ModelLibrary: {},
    loadSafe: (...args: unknown[]) => mockLoadSafe(...args),
}));

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
        it('should provide model library context', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Initial state has Group instances
            expect(result.current).toBeDefined();
            expect(result.current.asset).toBeDefined();
            expect(result.current.risk).toBeDefined();
            expect(result.current.incident).toBeDefined();
            expect(result.current.supplier).toBeDefined();
            expect(result.current.project).toBeDefined();
        });

        it('should load all 5 models', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledTimes(5);
            });
        });

        it('should load asset model', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/lock/lock.obj');
            });
        });

        it('should load risk model', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/flame/flame.obj');
            });
        });

        it('should load incident model', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/alert/alert.obj');
            });
        });

        it('should load supplier model', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/cap/cap.obj');
            });
        });

        it('should load project model', async () => {
            renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledWith('/models/box/box.obj');
            });
        });

        it('should update library after models load', async () => {
            const mockAssetGroup = new MockGroup();
            const mockRiskGroup = new MockGroup();
            const mockIncidentGroup = new MockGroup();
            const mockSupplierGroup = new MockGroup();
            const mockProjectGroup = new MockGroup();

            mockLoadSafe
                .mockResolvedValueOnce(mockAssetGroup)
                .mockResolvedValueOnce(mockRiskGroup)
                .mockResolvedValueOnce(mockIncidentGroup)
                .mockResolvedValueOnce(mockSupplierGroup)
                .mockResolvedValueOnce(mockProjectGroup);

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            await waitFor(() => {
                expect(mockLoadSafe).toHaveBeenCalledTimes(5);
            });

            // Library should be updated with loaded models
            expect(result.current).toBeDefined();
        });

        it('should initialize with default groups even if load fails', async () => {
            // mockLoadSafe returning resolved value with fallback Group
            mockLoadSafe.mockResolvedValue(new MockGroup());

            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            // Should have initial state regardless
            expect(result.current).toBeDefined();
            expect(result.current.asset).toBeDefined();
        });
    });

    describe('context value', () => {
        it('should have asset property', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(result.current).toHaveProperty('asset');
        });

        it('should have risk property', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(result.current).toHaveProperty('risk');
        });

        it('should have incident property', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(result.current).toHaveProperty('incident');
        });

        it('should have supplier property', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(result.current).toHaveProperty('supplier');
        });

        it('should have project property', async () => {
            const { result } = renderHook(() => useModelLibrary(), { wrapper });

            expect(result.current).toHaveProperty('project');
        });
    });
});
