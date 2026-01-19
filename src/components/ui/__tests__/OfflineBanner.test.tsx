/**
 * OfflineBanner Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from '../OfflineBanner';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.ComponentProps<'div'>) =>
            React.createElement('div', props, children)
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children)
}));

// Mock lucide-react
vi.mock('lucide-react', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = ({ className, ...props }: any) => React.createElement('span', { className: `icon ${className}`, ...props });
    return {
        WifiOff: ({ className, ...props }: any) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'wifi-off-icon', ...props }),
        Settings: Icon,
        Grid3X3: Icon,
        Unlock: Icon,
    };
});

describe('OfflineBanner', () => {
    let originalOnLine: boolean;

    beforeEach(() => {
        originalOnLine = navigator.onLine;
        vi.clearAllMocks();
    });

    afterEach(() => {
        Object.defineProperty(navigator, 'onLine', {
            value: originalOnLine,
            writable: true
        });
    });

    it('should not show banner when online', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true
        });

        render(<OfflineBanner />);

        expect(screen.queryByText(/Vous êtes hors ligne/)).not.toBeInTheDocument();
    });

    it('should show banner when offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        render(<OfflineBanner />);

        expect(screen.getByText(/Vous êtes hors ligne/)).toBeInTheDocument();
        expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });

    it('should show full offline message', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        render(<OfflineBanner />);

        expect(screen.getByText(/Vérifiez votre connexion internet/)).toBeInTheDocument();
    });

    it('should update when going offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true
        });

        render(<OfflineBanner />);

        expect(screen.queryByText(/Vous êtes hors ligne/)).not.toBeInTheDocument();

        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                value: false,
                writable: true
            });
            window.dispatchEvent(new Event('offline'));
        });

        expect(screen.getByText(/Vous êtes hors ligne/)).toBeInTheDocument();
    });

    it('should update when going online', () => {
        Object.defineProperty(navigator, 'onLine', {
            value: false,
            writable: true
        });

        render(<OfflineBanner />);

        expect(screen.getByText(/Vous êtes hors ligne/)).toBeInTheDocument();

        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                value: true,
                writable: true
            });
            window.dispatchEvent(new Event('online'));
        });

        expect(screen.queryByText(/Vous êtes hors ligne/)).not.toBeInTheDocument();
    });

    it('should clean up event listeners on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true
        });

        const { unmount } = render(<OfflineBanner />);
        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        removeEventListenerSpy.mockRestore();
    });
});
