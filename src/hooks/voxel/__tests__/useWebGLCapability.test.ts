/**
 * Unit tests for useWebGLCapability hook
 *
 * @see Story VOX-1.4: WebGL Capability Detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Store original values
const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalCreateElement = document.createElement.bind(document);

// Mock WebGL context results
let mockWebGL2Context: WebGL2RenderingContext | null = null;
let mockWebGL1Context: WebGLRenderingContext | null = null;

// Create mock canvas that doesn't interfere with React
function createMockCanvas() {
 return {
 getContext: vi.fn().mockImplementation((contextType: string) => {
 if (contextType === 'webgl2') {
 return mockWebGL2Context;
 }
 if (contextType === 'webgl' || contextType === 'experimental-webgl') {
 return mockWebGL1Context;
 }
 return null;
 }),
 };
}

describe('useWebGLCapability', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockWebGL2Context = null;
 mockWebGL1Context = null;

 // Mock matchMedia
 Object.defineProperty(window, 'matchMedia', {
 writable: true,
 value: vi.fn().mockImplementation((query: string) => ({
 matches: false,
 media: query,
 onchange: null,
 addListener: vi.fn(),
 removeListener: vi.fn(),
 addEventListener: vi.fn(),
 removeEventListener: vi.fn(),
 dispatchEvent: vi.fn(),
 })),
 });

 // Set desktop viewport by default
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 1920,
 });

 // Mock document.createElement to return mock canvas for 'canvas' only
 vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
 if (tagName === 'canvas') {
 return createMockCanvas() as unknown as HTMLCanvasElement;
 }
 return originalCreateElement(tagName);
 });
 });

 afterEach(() => {
 // Restore originals
 Object.defineProperty(window, 'matchMedia', {
 writable: true,
 value: originalMatchMedia,
 });
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: originalInnerWidth,
 });
 vi.restoreAllMocks();
 });

 describe('WebGL detection', () => {
 it('detects WebGL 2.0 support when available', async () => {
 mockWebGL2Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(4096),
 } as unknown as WebGL2RenderingContext;

 // Import fresh module
 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 expect(result.current.capability).toBe('webgl2');
 expect(result.current.isAvailable).toBe(true);
 });

 it('falls back to WebGL 1.0 when WebGL 2.0 is unavailable', async () => {
 mockWebGL2Context = null;
 mockWebGL1Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(2048),
 } as unknown as WebGLRenderingContext;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 expect(result.current.capability).toBe('webgl1');
 expect(result.current.isAvailable).toBe(true);
 });

 it('returns none when no WebGL support', async () => {
 mockWebGL2Context = null;
 mockWebGL1Context = null;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 expect(result.current.capability).toBe('none');
 expect(result.current.isAvailable).toBe(false);
 expect(result.current.shouldShow3D).toBe(false);
 });
 });

 describe('Mobile detection', () => {
 it('detects mobile device when viewport is small', async () => {
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 375, // iPhone width
 });

 mockWebGL2Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(4096),
 } as unknown as WebGL2RenderingContext;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 expect(result.current.isMobile).toBe(true);
 expect(result.current.shouldShow3D).toBe(false);
 });

 it('shows 3D on desktop with WebGL support', async () => {
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 1920, // Desktop width
 });

 mockWebGL2Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(4096),
 } as unknown as WebGL2RenderingContext;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 expect(result.current.isMobile).toBe(false);
 expect(result.current.shouldShow3D).toBe(true);
 });
 });

 describe('shouldShow3D logic', () => {
 it('returns false when mobile even with WebGL', async () => {
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 375,
 });

 mockWebGL2Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(4096),
 } as unknown as WebGL2RenderingContext;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 // Mobile = true, WebGL available = true
 expect(result.current.isAvailable).toBe(true);
 expect(result.current.isMobile).toBe(true);
 // shouldShow3D should be false because mobile
 expect(result.current.shouldShow3D).toBe(false);
 });

 it('returns false on desktop without WebGL', async () => {
 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 1920,
 });

 mockWebGL2Context = null;
 mockWebGL1Context = null;

 const { useWebGLCapability } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLCapability());

 await waitFor(() => {
 expect(result.current.capability).not.toBe('checking');
 });

 // Desktop but no WebGL
 expect(result.current.isAvailable).toBe(false);
 expect(result.current.isMobile).toBe(false);
 expect(result.current.shouldShow3D).toBe(false);
 });
 });
});

describe('useWebGLSupport', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockWebGL2Context = null;
 mockWebGL1Context = null;

 Object.defineProperty(window, 'innerWidth', {
 writable: true,
 configurable: true,
 value: 1920,
 });

 vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
 if (tagName === 'canvas') {
 return createMockCanvas() as unknown as HTMLCanvasElement;
 }
 return originalCreateElement(tagName);
 });
 });

 afterEach(() => {
 vi.restoreAllMocks();
 });

 it('returns only the capability level', async () => {
 mockWebGL2Context = {
 getExtension: vi.fn().mockReturnValue(null),
 getParameter: vi.fn().mockReturnValue(4096),
 } as unknown as WebGL2RenderingContext;

 const { useWebGLSupport } = await import('../useWebGLCapability');
 const { result } = renderHook(() => useWebGLSupport());

 await waitFor(() => {
 expect(result.current).not.toBe('checking');
 });

 expect(result.current).toBe('webgl2');
 });
});
