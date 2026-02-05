/**
 * ModelLibraryContext Tests
 * Story 14-1: Test Coverage 50%
 * 
 * These tests verify the lazy loading model library context functionality.
 * The implementation uses a module-level cache that persists across renders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { Group } from 'three';

// Create a mock module for modelLibraryConstants
vi.mock('../modelLibraryConstants', async (importOriginal) => {
 const original = await importOriginal<typeof import('../modelLibraryConstants')>();
 return {
 ...original,
 // We mock MODEL_URLS to provide consistent test data
 MODEL_URLS: {
 asset: '/models/server/console.obj',
 risk: '/models/flame/flame.obj',
 incident: '/models/shield/shield.obj',
 supplier: '/models/cap/cap.obj',
 project: '/models/box/box.obj',
 },
 // loadSafe is a normal async function that we mock per-test
 loadSafe: vi.fn().mockResolvedValue(new Group()),
 };
});

// Import after mocks are set up
import { ModelLibraryProvider } from '../ModelLibraryContext';
import { ModelLibraryContext } from '../ModelLibraryContextDefinition';
import { loadSafe } from '../modelLibraryConstants';

const mockLoadSafe = vi.mocked(loadSafe);

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
 // Reset to default behavior
 mockLoadSafe.mockResolvedValue(new Group());
 });

 afterEach(() => {
 vi.restoreAllMocks();
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

 it('should return null on first getModel call before loading', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // getModel should return null initially and trigger lazy load
 let model: Group | null = null;
 act(() => {
 model = result.current!.getModel('control' as 'risk'); // Use a type that won't be cached
 });

 // getModel returns null synchronously for unloaded models
 expect(model).toBeNull();
 });

 it('should have loadModel that returns a promise', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 const promise = result.current!.loadModel('risk');
 expect(promise).toBeInstanceOf(Promise);

 await act(async () => {
 await promise;
 });
 });

 it('should have isLoading function that returns boolean', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 const isLoading = result.current!.isLoading('risk');
 expect(typeof isLoading).toBe('boolean');
 });

 it('should have isLoaded function that returns boolean', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 const isLoaded = result.current!.isLoaded('risk');
 expect(typeof isLoaded).toBe('boolean');
 });

 it('should handle concurrent loadModel calls for same model type', async () => {
 mockLoadSafe.mockResolvedValue(new Group());

 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // Call loadModel multiple times concurrently
 const promise1 = result.current!.loadModel('project');
 const promise2 = result.current!.loadModel('project');

 await act(async () => {
 await Promise.all([promise1, promise2]);
 });

 // Both should resolve successfully
 const model = result.current!.getModel('project');
 // Model should be returned (either loaded or from cache)
 expect(model !== null || result.current!.isLoading('project')).toBeTruthy();
 });

 it('should handle load errors gracefully', async () => {
 mockLoadSafe.mockRejectedValue(new Error('Load failed'));

 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // Should not throw
 await act(async () => {
 await result.current!.loadModel('incident');
 });

 // After error, should still work (fallback to empty group)
 expect(result.current).toBeDefined();
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

 it('getModel should accept all model types', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // Should not throw for any valid model type
 expect(() => result.current!.getModel('asset')).not.toThrow();
 expect(() => result.current!.getModel('risk')).not.toThrow();
 expect(() => result.current!.getModel('incident')).not.toThrow();
 expect(() => result.current!.getModel('supplier')).not.toThrow();
 expect(() => result.current!.getModel('project')).not.toThrow();
 });

 it('loadModel should accept all model types', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // All should return promises
 expect(result.current!.loadModel('asset')).toBeInstanceOf(Promise);
 expect(result.current!.loadModel('risk')).toBeInstanceOf(Promise);
 expect(result.current!.loadModel('incident')).toBeInstanceOf(Promise);
 expect(result.current!.loadModel('supplier')).toBeInstanceOf(Promise);
 expect(result.current!.loadModel('project')).toBeInstanceOf(Promise);
 });

 it('isLoaded should accept all model types', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // Should return boolean for any model type
 expect(typeof result.current!.isLoaded('asset')).toBe('boolean');
 expect(typeof result.current!.isLoaded('risk')).toBe('boolean');
 expect(typeof result.current!.isLoaded('incident')).toBe('boolean');
 expect(typeof result.current!.isLoaded('supplier')).toBe('boolean');
 expect(typeof result.current!.isLoaded('project')).toBe('boolean');
 });

 it('isLoading should accept all model types', async () => {
 const { result } = renderHook(() => useModelLibrary(), { wrapper });

 // Should return boolean for any model type
 expect(typeof result.current!.isLoading('asset')).toBe('boolean');
 expect(typeof result.current!.isLoading('risk')).toBe('boolean');
 expect(typeof result.current!.isLoading('incident')).toBe('boolean');
 expect(typeof result.current!.isLoading('supplier')).toBe('boolean');
 expect(typeof result.current!.isLoading('project')).toBe('boolean');
 });
 });
});
