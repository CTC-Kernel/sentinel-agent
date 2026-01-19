/**
 * SyncIndicator Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncIndicator } from '../SyncIndicator';

// Mock useSyncStatus hook
const mockUseSyncStatus = vi.fn();
vi.mock('../../../hooks/useSyncStatus', () => ({
    useSyncStatus: () => mockUseSyncStatus()
}));

// Mock store
vi.mock('../../../store', () => ({
    useStore: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'common.offlineMode': 'Mode Hors-ligne',
                'common.offline': 'Hors-ligne',
                'common.synced': 'Synchronisé',
                'common.saved': 'Sauvegardé'
            };
            return translations[key];
        }
    })
}));

// Mock Tooltip
vi.mock('../Tooltip', () => ({
    Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) =>
        React.createElement('div', { 'data-testid': 'tooltip', 'data-content': content }, children)
}));

// Mock lucide-react
vi.mock('lucide-react', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, ...props });
    return {
        Cloud: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'cloud-icon', ...props }),
        CloudOff: ({ className, ...props }: React.ComponentProps<'svg'>) => React.createElement('span', { className: `icon ${className}`, 'data-testid': 'cloud-off-icon', ...props }),
        Settings: Icon,
        Grid3X3: Icon,
        Unlock: Icon,
    };
});

describe('SyncIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show offline indicator when not online', () => {
        mockUseSyncStatus.mockReturnValue({
            isOnline: false,
            lastSynced: null
        });

        render(<SyncIndicator />);

        expect(screen.getByTestId('cloud-off-icon')).toBeInTheDocument();
        expect(screen.getByText('Hors-ligne')).toBeInTheDocument();
    });

    it('should show offline mode tooltip when offline', () => {
        mockUseSyncStatus.mockReturnValue({
            isOnline: false,
            lastSynced: null
        });

        render(<SyncIndicator />);

        const tooltip = screen.getByTestId('tooltip');
        expect(tooltip).toHaveAttribute('data-content', 'Mode Hors-ligne');
    });

    it('should show online indicator when connected', () => {
        mockUseSyncStatus.mockReturnValue({
            isOnline: true,
            lastSynced: new Date('2024-01-15T10:30:00')
        });

        render(<SyncIndicator />);

        expect(screen.getByTestId('cloud-icon')).toBeInTheDocument();
        expect(screen.getByText('Sauvegardé')).toBeInTheDocument();
    });

    it('should show synced tooltip with time when online', () => {
        const syncTime = new Date('2024-01-15T10:30:00');
        mockUseSyncStatus.mockReturnValue({
            isOnline: true,
            lastSynced: syncTime
        });

        render(<SyncIndicator />);

        const tooltip = screen.getByTestId('tooltip');
        expect(tooltip.getAttribute('data-content')).toContain('Synchronisé');
    });

    it('should have animate-pulse class when offline', () => {
        mockUseSyncStatus.mockReturnValue({
            isOnline: false,
            lastSynced: null
        });

        const { container } = render(<SyncIndicator />);

        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('should not have animate-pulse class when online', () => {
        mockUseSyncStatus.mockReturnValue({
            isOnline: true,
            lastSynced: new Date()
        });

        const { container } = render(<SyncIndicator />);

        expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
});
