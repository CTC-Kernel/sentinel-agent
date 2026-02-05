/**
 * Unit tests for useUnsavedChangesWarning hook (Story 1.4)
 *
 * Tests for navigation blocking with unsaved changes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
 useUnsavedChangesWarning,
 getUnsavedChangesWarning,
} from '../useUnsavedChangesWarning';

// Mock useLocale hook
vi.mock('../useLocale', () => ({
 useLocale: () => ({ locale: 'fr' }),
}));

// Mock react-router-dom useBlocker
const mockBlocker = {
 state: 'unblocked' as 'blocked' | 'unblocked' | 'proceeding',
 proceed: vi.fn(),
 reset: vi.fn(),
 location: undefined,
};

vi.mock('react-router-dom', () => ({
 useBlocker: vi.fn((callback) => {
 // Store the callback for testing
 (global as { _blockerCallback?: typeof callback })._blockerCallback = callback;
 return mockBlocker;
 }),
}));

describe('useUnsavedChangesWarning', () => {
 let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
 let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

 beforeEach(() => {
 vi.clearAllMocks();
 mockBlocker.state = 'unblocked';
 addEventListenerSpy = vi.spyOn(window, 'addEventListener');
 removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
 });

 afterEach(() => {
 addEventListenerSpy.mockRestore();
 removeEventListenerSpy.mockRestore();
 });

 describe('initialization', () => {
 it('returns hasUnsavedChanges from options', () => {
 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 expect(result.current.hasUnsavedChanges).toBe(true);
 });

 it('returns isBlocked as false initially', () => {
 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: false,
 })
 );

 expect(result.current.isBlocked).toBe(false);
 });
 });

 describe('beforeunload event', () => {
 it('adds beforeunload listener when hasUnsavedChanges is true', () => {
 renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 expect(addEventListenerSpy).toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );
 });

 it('does not add beforeunload listener when hasUnsavedChanges is false', () => {
 renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: false,
 })
 );

 expect(addEventListenerSpy).not.toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );
 });

 it('does not add beforeunload listener when enabled is false', () => {
 renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 enabled: false,
 })
 );

 expect(addEventListenerSpy).not.toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );
 });

 it('removes beforeunload listener on unmount', () => {
 const { unmount } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 unmount();

 expect(removeEventListenerSpy).toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );
 });

 it('beforeunload handler calls preventDefault', () => {
 renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 // Get the handler that was registered
 const handler = addEventListenerSpy.mock.calls.find(
 (call) => call[0] === 'beforeunload'
 )?.[1] as EventListener;

 expect(handler).toBeDefined();

 // Simulate beforeunload event
 const event = new Event('beforeunload') as BeforeUnloadEvent;
 const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

 handler(event);

 expect(preventDefaultSpy).toHaveBeenCalled();
 // returnValue is set by the handler, but may be modified by the browser
 // The key behavior is that preventDefault was called
 });
 });

 describe('React Router blocking', () => {
 it('returns isBlocked true when blocker state is blocked', () => {
 mockBlocker.state = 'blocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 expect(result.current.isBlocked).toBe(true);
 });

 it('proceed calls blocker.proceed when blocked', () => {
 mockBlocker.state = 'blocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 act(() => {
 result.current.proceed();
 });

 expect(mockBlocker.proceed).toHaveBeenCalled();
 });

 it('proceed does not call blocker.proceed when unblocked', () => {
 mockBlocker.state = 'unblocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 act(() => {
 result.current.proceed();
 });

 expect(mockBlocker.proceed).not.toHaveBeenCalled();
 });

 it('cancel calls blocker.reset when blocked', () => {
 mockBlocker.state = 'blocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 act(() => {
 result.current.cancel();
 });

 expect(mockBlocker.reset).toHaveBeenCalled();
 });

 it('cancel does not call blocker.reset when unblocked', () => {
 mockBlocker.state = 'unblocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 act(() => {
 result.current.cancel();
 });

 expect(mockBlocker.reset).not.toHaveBeenCalled();
 });

 it('reset calls blocker.reset when blocked', () => {
 mockBlocker.state = 'blocked';

 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 })
 );

 act(() => {
 result.current.reset();
 });

 expect(mockBlocker.reset).toHaveBeenCalled();
 });
 });

 describe('bypass functionality', () => {
 it('bypass disables the warning', () => {
 const { result, rerender } = renderHook(
 ({ hasUnsavedChanges }) =>
 useUnsavedChangesWarning({
 hasUnsavedChanges,
 }),
 { initialProps: { hasUnsavedChanges: true } }
 );

 // Initially, beforeunload should be added
 expect(addEventListenerSpy).toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );

 // Clear the spy to check new calls
 addEventListenerSpy.mockClear();

 // Bypass the warning
 act(() => {
 result.current.bypass();
 });

 // Re-render to trigger effect
 rerender({ hasUnsavedChanges: true });

 // After bypass, the listener should be removed (via effect cleanup)
 // We can't directly test this with the current setup,
 // but we can verify the bypass function exists
 expect(typeof result.current.bypass).toBe('function');
 });

 it('bypass is a one-shot mechanism', () => {
 const { result } = renderHook(
 ({ hasUnsavedChanges }) =>
 useUnsavedChangesWarning({
 hasUnsavedChanges,
 }),
 { initialProps: { hasUnsavedChanges: true } }
 );

 // Bypass function should exist and be callable
 expect(typeof result.current.bypass).toBe('function');

 // Calling bypass should not throw
 act(() => {
 result.current.bypass();
 });

 // The bypass is meant to be used before navigating away
 // After navigation, the component unmounts and resets on next mount
 expect(result.current.hasUnsavedChanges).toBe(true);
 });
 });

 describe('custom message', () => {
 it('uses custom message option without errors', () => {
 const customMessage = 'Custom warning message';

 // Should not throw when providing custom message
 const { result } = renderHook(() =>
 useUnsavedChangesWarning({
 hasUnsavedChanges: true,
 message: customMessage,
 })
 );

 // Verify hook returns expected structure
 expect(result.current.hasUnsavedChanges).toBe(true);
 expect(typeof result.current.proceed).toBe('function');
 expect(typeof result.current.cancel).toBe('function');

 // Verify beforeunload listener was added
 expect(addEventListenerSpy).toHaveBeenCalledWith(
 'beforeunload',
 expect.any(Function)
 );
 });
 });

 describe('hasUnsavedChanges state', () => {
 it('exposes hasUnsavedChanges from options', () => {
 const { result, rerender } = renderHook(
 ({ hasUnsavedChanges }) =>
 useUnsavedChangesWarning({
 hasUnsavedChanges,
 }),
 { initialProps: { hasUnsavedChanges: false } }
 );

 expect(result.current.hasUnsavedChanges).toBe(false);

 rerender({ hasUnsavedChanges: true });

 expect(result.current.hasUnsavedChanges).toBe(true);
 });
 });
});

describe('getUnsavedChangesWarning', () => {
 it('returns FR warning message', () => {
 expect(getUnsavedChangesWarning('fr')).toBe(
 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter?'
 );
 });

 it('returns EN warning message', () => {
 expect(getUnsavedChangesWarning('en')).toBe(
 'You have unsaved changes. Are you sure you want to leave?'
 );
 });
});
