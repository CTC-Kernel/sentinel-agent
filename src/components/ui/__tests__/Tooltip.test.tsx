/**
 * Tooltip Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock react-dom createPortal
vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom');
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node
    };
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.HTMLProps<HTMLDivElement>) =>
            React.createElement('div', props, children)
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children
}));

import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render children', () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );
        expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('should show tooltip on hover after delay', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.mouseEnter(trigger);

        // Tooltip should not be visible immediately
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        // Advance past the delay
        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });

    it('should hide tooltip on mouse leave', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;

        // Show tooltip
        fireEvent.mouseEnter(trigger);
        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        // Hide tooltip
        fireEvent.mouseLeave(trigger);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should show tooltip on focus', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.focus(trigger);

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should hide tooltip on blur', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.focus(trigger);

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        fireEvent.blur(trigger);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should toggle tooltip on Enter key', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.keyDown(trigger, { key: 'Enter' });

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should toggle tooltip on Space key', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.keyDown(trigger, { key: ' ' });

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should close on Escape key', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.mouseEnter(trigger);

        await act(async () => {
            vi.advanceTimersByTime(250);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should have accessible role button', () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        expect(trigger).toHaveAttribute('role', 'button');
        expect(trigger).toHaveAttribute('tabIndex', '0');
    });

    it('should support custom delay', async () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text', delay: 500 },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        fireEvent.mouseEnter(trigger);

        // Should not be visible after 250ms
        await act(async () => {
            vi.advanceTimersByTime(250);
        });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        // Should be visible after 500ms
        await act(async () => {
            vi.advanceTimersByTime(250);
        });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('should render different positions', async () => {
        const positions: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];

        for (const position of positions) {
            const { unmount } = render(
                React.createElement(Tooltip, { content: 'Tooltip text', position },
                    React.createElement('button', null, 'Hover me')
                )
            );

            const trigger = screen.getByText('Hover me').parentElement!;
            fireEvent.mouseEnter(trigger);

            await act(async () => {
                vi.advanceTimersByTime(250);
            });

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            unmount();
        }
    });

    it('should support custom className', () => {
        render(
            React.createElement(Tooltip, { content: 'Tooltip text', className: 'custom-class' },
                React.createElement('button', null, 'Hover me')
            )
        );

        const trigger = screen.getByText('Hover me').parentElement!;
        expect(trigger.className).toContain('custom-class');
    });
});
