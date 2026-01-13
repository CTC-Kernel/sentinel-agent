/**
 * useOnClickOutside Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnClickOutside } from '../utils/useOnClickOutside';

describe('useOnClickOutside', () => {
    let container: HTMLDivElement;
    let inside: HTMLDivElement;
    let outside: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        inside = document.createElement('div');
        outside = document.createElement('div');

        container.appendChild(inside);
        document.body.appendChild(container);
        document.body.appendChild(outside);
    });

    afterEach(() => {
        document.body.removeChild(container);
        document.body.removeChild(outside);
    });

    it('should call handler when clicking outside the element', () => {
        const handler = vi.fn();
        const ref = { current: container };

        renderHook(() => useOnClickOutside(ref, handler));

        const event = new MouseEvent('mousedown', { bubbles: true });
        outside.dispatchEvent(event);

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not call handler when clicking inside the element', () => {
        const handler = vi.fn();
        const ref = { current: container };

        renderHook(() => useOnClickOutside(ref, handler));

        const event = new MouseEvent('mousedown', { bubbles: true });
        inside.dispatchEvent(event);

        expect(handler).not.toHaveBeenCalled();
    });

    it('should not call handler when clicking on the element itself', () => {
        const handler = vi.fn();
        const ref = { current: container };

        renderHook(() => useOnClickOutside(ref, handler));

        const event = new MouseEvent('mousedown', { bubbles: true });
        container.dispatchEvent(event);

        expect(handler).not.toHaveBeenCalled();
    });

    it('should handle touch events', () => {
        const handler = vi.fn();
        const ref = { current: container };

        renderHook(() => useOnClickOutside(ref, handler));

        const event = new TouchEvent('touchstart', { bubbles: true });
        outside.dispatchEvent(event);

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not call handler when ref is null', () => {
        const handler = vi.fn();
        const ref = { current: null };

        renderHook(() => useOnClickOutside(ref, handler));

        const event = new MouseEvent('mousedown', { bubbles: true });
        outside.dispatchEvent(event);

        expect(handler).not.toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
        const handler = vi.fn();
        const ref = { current: container };

        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const { unmount } = renderHook(() => useOnClickOutside(ref, handler));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));

        removeEventListenerSpy.mockRestore();
    });

    it('should update handler when it changes', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        const ref = { current: container };

        const { rerender } = renderHook(
            ({ handler }) => useOnClickOutside(ref, handler),
            { initialProps: { handler: handler1 } }
        );

        const event1 = new MouseEvent('mousedown', { bubbles: true });
        outside.dispatchEvent(event1);

        expect(handler1).toHaveBeenCalledTimes(1);

        rerender({ handler: handler2 });

        const event2 = new MouseEvent('mousedown', { bubbles: true });
        outside.dispatchEvent(event2);

        expect(handler2).toHaveBeenCalledTimes(1);
    });
});
