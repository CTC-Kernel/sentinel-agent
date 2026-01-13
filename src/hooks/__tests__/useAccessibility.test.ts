/**
 * useAccessibility Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccessibility, useScreenReaderAnnouncer } from '../useAccessibility';

describe('useAccessibility', () => {
    describe('generateId', () => {
        it('should generate unique IDs with prefix', () => {
            const { result } = renderHook(() => useAccessibility());

            const id1 = result.current.generateId('button');
            const id2 = result.current.generateId('button');

            expect(id1).toMatch(/^button-[a-z0-9]+$/);
            expect(id2).toMatch(/^button-[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should use provided prefix', () => {
            const { result } = renderHook(() => useAccessibility());

            const id = result.current.generateId('custom-prefix');

            expect(id).toMatch(/^custom-prefix-/);
        });
    });

    describe('getIconButtonProps', () => {
        it('should return correct props for icon button', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getIconButtonProps('Close menu');

            expect(props).toEqual({
                'aria-label': 'Close menu',
                'aria-describedby': undefined,
                role: 'button',
                tabIndex: 0
            });
        });

        it('should include describedBy when provided', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getIconButtonProps('Submit', 'form-description');

            expect(props['aria-describedby']).toBe('form-description');
        });
    });

    describe('getNavItemProps', () => {
        it('should return correct props for navigation item', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getNavItemProps('Home');

            expect(props).toEqual({
                'aria-label': 'Home',
                'aria-current': undefined,
                role: 'navigation',
                tabIndex: 0
            });
        });

        it('should set aria-current to page when active', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getNavItemProps('Dashboard', true);

            expect(props['aria-current']).toBe('page');
        });

        it('should not set aria-current when inactive', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getNavItemProps('Settings', false);

            expect(props['aria-current']).toBeUndefined();
        });
    });

    describe('getFormProps', () => {
        it('should return correct props for form', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getFormProps('Login Form');

            expect(props).toHaveProperty('aria-labelledby');
            expect(props.role).toBe('form');
            expect(props.titleProps['aria-label']).toBe('Login Form');
        });

        it('should include description props when description provided', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getFormProps('Contact Form', 'Fill out this form to contact us');

            expect(props['aria-describedby']).toBeDefined();
            expect(props.descriptionProps).toBeDefined();
            expect(props.descriptionProps!['aria-label']).toBe('Fill out this form to contact us');
        });

        it('should not include description props when no description', () => {
            const { result } = renderHook(() => useAccessibility());

            const props = result.current.getFormProps('Simple Form');

            expect(props['aria-describedby']).toBeUndefined();
            expect(props.descriptionProps).toBeUndefined();
        });
    });

    describe('keyboardHandlers', () => {
        describe('onClick', () => {
            it('should call handler on Enter key', () => {
                const { result } = renderHook(() => useAccessibility());
                const handler = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onClick(handler);
                const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(handler).toHaveBeenCalled();
                expect(event.preventDefault).toHaveBeenCalled();
            });

            it('should call handler on Space key', () => {
                const { result } = renderHook(() => useAccessibility());
                const handler = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onClick(handler);
                const event = { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(handler).toHaveBeenCalled();
            });

            it('should not call handler on other keys', () => {
                const { result } = renderHook(() => useAccessibility());
                const handler = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onClick(handler);
                const event = { key: 'Tab', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(handler).not.toHaveBeenCalled();
            });
        });

        describe('onArrowNavigation', () => {
            it('should call onUp on ArrowUp', () => {
                const { result } = renderHook(() => useAccessibility());
                const onUp = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onArrowNavigation(onUp);
                const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(onUp).toHaveBeenCalled();
            });

            it('should call onDown on ArrowDown', () => {
                const { result } = renderHook(() => useAccessibility());
                const onDown = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onArrowNavigation(undefined, onDown);
                const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(onDown).toHaveBeenCalled();
            });

            it('should call onLeft on ArrowLeft', () => {
                const { result } = renderHook(() => useAccessibility());
                const onLeft = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onArrowNavigation(undefined, undefined, onLeft);
                const event = { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(onLeft).toHaveBeenCalled();
            });

            it('should call onRight on ArrowRight', () => {
                const { result } = renderHook(() => useAccessibility());
                const onRight = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onArrowNavigation(undefined, undefined, undefined, onRight);
                const event = { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(onRight).toHaveBeenCalled();
            });
        });

        describe('onEscape', () => {
            it('should call handler on Escape key', () => {
                const { result } = renderHook(() => useAccessibility());
                const handler = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onEscape(handler);
                const event = { key: 'Escape', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(handler).toHaveBeenCalled();
                expect(event.preventDefault).toHaveBeenCalled();
            });

            it('should not call handler on other keys', () => {
                const { result } = renderHook(() => useAccessibility());
                const handler = vi.fn();

                const keyHandler = result.current.keyboardHandlers.onEscape(handler);
                const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent;

                keyHandler(event);

                expect(handler).not.toHaveBeenCalled();
            });
        });
    });
});

describe('useScreenReaderAnnouncer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Clean up any existing announcements from previous tests
        document.querySelectorAll('[aria-live]').forEach(el => el.remove());
    });

    afterEach(() => {
        vi.runAllTimers(); // Clear pending timers
        vi.useRealTimers();
        // Clean up announcements
        document.querySelectorAll('[aria-live]').forEach(el => el.remove());
    });

    it('should create announcement element with polite priority', () => {
        const { result } = renderHook(() => useScreenReaderAnnouncer());

        act(() => {
            result.current.announce('Item added to cart');
        });

        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toBeInTheDocument();
        expect(announcement).toHaveTextContent('Item added to cart');
    });

    it('should create announcement element with assertive priority', () => {
        const { result } = renderHook(() => useScreenReaderAnnouncer());

        act(() => {
            result.current.announce('Error occurred', 'assertive');
        });

        const announcement = document.querySelector('[aria-live="assertive"]');
        expect(announcement).toBeInTheDocument();
        expect(announcement).toHaveTextContent('Error occurred');
    });

    it('should remove announcement element after timeout', () => {
        const { result } = renderHook(() => useScreenReaderAnnouncer());

        act(() => {
            result.current.announce('Temporary message');
        });

        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1001); // Slightly more than 1000ms timeout
            vi.runAllTimers();
        });

        // The specific element should have been removed
        expect(announcement!.parentNode).toBeNull();
    });

    it('should visually hide announcement element', () => {
        const { result } = renderHook(() => useScreenReaderAnnouncer());

        act(() => {
            result.current.announce('Hidden message');
        });

        const announcement = document.querySelector('[aria-live="polite"]') as HTMLElement;
        expect(announcement.style.position).toBe('absolute');
        expect(announcement.style.left).toBe('-10000px');

        // Cleanup
        act(() => {
            vi.advanceTimersByTime(1000);
        });
    });
});
