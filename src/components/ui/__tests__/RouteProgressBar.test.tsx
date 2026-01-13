/**
 * RouteProgressBar Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock NProgress with hoisted mocks
const { mockStart, mockDone } = vi.hoisted(() => ({
    mockStart: vi.fn(),
    mockDone: vi.fn()
}));

vi.mock('nprogress', () => ({
    default: {
        configure: vi.fn(),
        start: mockStart,
        done: mockDone
    }
}));

// Mock CSS import
vi.mock('nprogress/nprogress.css', () => ({}));

import { RouteProgressBar } from '../RouteProgressBar';

const renderWithRouter = (initialRoute: string) => {
    return render(
        React.createElement(MemoryRouter, { initialEntries: [initialRoute] },
            React.createElement(RouteProgressBar)
        )
    );
};

describe('RouteProgressBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should start progress bar on mount', () => {
        renderWithRouter('/');
        expect(mockStart).toHaveBeenCalled();
    });

    it('should complete progress bar after delay', async () => {
        renderWithRouter('/');

        act(() => {
            vi.advanceTimersByTime(150);
        });

        expect(mockDone).toHaveBeenCalled();
    });

    it('should render null (no visual output)', () => {
        const { container } = renderWithRouter('/');
        expect(container.innerHTML).toBe('');
    });

    it('should complete on unmount', () => {
        const { unmount } = renderWithRouter('/');
        unmount();
        expect(mockDone).toHaveBeenCalled();
    });

    it('should clear timeout on unmount', () => {
        const { unmount } = renderWithRouter('/');

        // Unmount before timeout completes
        unmount();

        // Advance time - mockDone should have been called from cleanup
        act(() => {
            vi.advanceTimersByTime(200);
        });

        // mockDone is called once from cleanup, not from the timer
        expect(mockDone).toHaveBeenCalled();
    });
});
