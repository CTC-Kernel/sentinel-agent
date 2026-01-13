/**
 * LoadingScreen Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingScreen } from '../LoadingScreen';

// Mock react-dom createPortal
vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom');
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node
    };
});

// Mock Button
vi.mock('../button', () => ({
    Button: ({ children, onClick, className }: React.ComponentProps<'button'>) =>
        React.createElement('button', { onClick, className, 'data-testid': 'reload-button' }, children)
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Lock: (props: React.ComponentProps<'svg'>) =>
        React.createElement('svg', { ...props, 'data-testid': 'lock-icon' })
}));

describe('LoadingScreen', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render loading animation initially', () => {
        render(<LoadingScreen />);

        // Should show bouncing dots initially
        expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });

    it('should show timeout message after 10 seconds', async () => {
        render(<LoadingScreen />);

        // Initially no timeout message
        expect(screen.queryByText(/Le chargement prend plus de temps/)).not.toBeInTheDocument();

        // Advance time by 10 seconds
        act(() => {
            vi.advanceTimersByTime(10000);
        });

        // Now should show timeout message
        expect(screen.getByText(/Le chargement prend plus de temps que prévu/)).toBeInTheDocument();
    });

    it('should display custom message when provided', async () => {
        render(<LoadingScreen message="Custom loading message" />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(screen.getByText('Custom loading message')).toBeInTheDocument();
    });

    it('should show reload button after timeout', async () => {
        render(<LoadingScreen />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        expect(screen.getByText('Recharger la page')).toBeInTheDocument();
    });

    it('should reload page when reload button is clicked', async () => {
        const reloadMock = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { reload: reloadMock },
            writable: true
        });

        render(<LoadingScreen />);

        act(() => {
            vi.advanceTimersByTime(10000);
        });

        screen.getByTestId('reload-button').click();

        expect(reloadMock).toHaveBeenCalled();
    });

    it('should render lock icon', () => {
        render(<LoadingScreen />);

        expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });

    it('should not show timeout message before 10 seconds', () => {
        render(<LoadingScreen />);

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(screen.queryByText(/Le chargement prend plus de temps/)).not.toBeInTheDocument();
    });

    it('should clear timeout on unmount', () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        const { unmount } = render(<LoadingScreen />);
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });
});
