/**
 * useHotkeys Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHotkeys, useHotkeysHelp } from '../useHotkeys';

describe('useHotkeys', () => {
 let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
 let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

 beforeEach(() => {
 addEventListenerSpy = vi.spyOn(window, 'addEventListener');
 removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
 });

 afterEach(() => {
 vi.clearAllMocks();
 });

 it('should add event listener on mount', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback));

 expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
 });

 it('should remove event listener on unmount', () => {
 const callback = vi.fn();
 const { unmount } = renderHook(() => useHotkeys('ctrl+k', callback));

 unmount();

 expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
 });

 it('should not add listener when disabled', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback, { enabled: false }));

 expect(addEventListenerSpy).not.toHaveBeenCalled();
 });

 it('should call callback when matching keys are pressed', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 ctrlKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
 handler(event);
 });

 expect(callback).toHaveBeenCalled();
 });

 it('should not call callback when different keys are pressed', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'j',
 ctrlKey: true
 });
 handler(event);
 });

 expect(callback).not.toHaveBeenCalled();
 });

 it('should call preventDefault by default', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;
 const preventDefaultMock = vi.fn();

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 ctrlKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: preventDefaultMock });
 handler(event);
 });

 expect(preventDefaultMock).toHaveBeenCalled();
 });

 it('should not call preventDefault when option is false', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('ctrl+k', callback, { preventDefault: false }));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;
 const preventDefaultMock = vi.fn();

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 ctrlKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: preventDefaultMock });
 handler(event);
 });

 expect(preventDefaultMock).not.toHaveBeenCalled();
 });

 it('should handle shift modifier', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('shift+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 shiftKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
 handler(event);
 });

 expect(callback).toHaveBeenCalled();
 });

 it('should handle alt modifier', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('alt+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 altKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
 handler(event);
 });

 expect(callback).toHaveBeenCalled();
 });

 it('should handle cmd as ctrl', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('cmd+k', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'k',
 metaKey: true
 });
 Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
 handler(event);
 });

 expect(callback).toHaveBeenCalled();
 });

 it('should handle escape key', () => {
 const callback = vi.fn();
 renderHook(() => useHotkeys('escape', callback));

 const handler = addEventListenerSpy.mock.calls[0][1] as (event: KeyboardEvent) => void;

 act(() => {
 const event = new KeyboardEvent('keydown', {
 key: 'Escape'
 });
 Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
 handler(event);
 });

 expect(callback).toHaveBeenCalled();
 });
});

describe('useHotkeysHelp', () => {
 it('should return list of shortcuts', () => {
 const { result } = renderHook(() => useHotkeysHelp());

 expect(Array.isArray(result.current)).toBe(true);
 expect(result.current.length).toBeGreaterThan(0);
 });

 it('should include ctrl+k shortcut', () => {
 const { result } = renderHook(() => useHotkeysHelp());

 const ctrlK = result.current.find(s => s.keys === 'Ctrl+K');
 expect(ctrlK).toBeDefined();
 expect(ctrlK?.description).toBe('Ouvrir la recherche');
 });

 it('should include escape shortcut', () => {
 const { result } = renderHook(() => useHotkeysHelp());

 const escape = result.current.find(s => s.keys === 'Escape');
 expect(escape).toBeDefined();
 expect(escape?.description).toBe('Fermer les modals');
 });

 it('should return shortcuts with keys and description', () => {
 const { result } = renderHook(() => useHotkeysHelp());

 result.current.forEach(shortcut => {
 expect(shortcut).toHaveProperty('keys');
 expect(shortcut).toHaveProperty('description');
 expect(typeof shortcut.keys).toBe('string');
 expect(typeof shortcut.description).toBe('string');
 });
 });
});
