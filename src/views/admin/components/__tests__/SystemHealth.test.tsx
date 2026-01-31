/**
 * SystemHealth Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SystemHealth } from '../SystemHealth';
import { BUILD_VERSION } from '../../../../config/version';

// Mock ConnectivityService
vi.mock('../../../../services/connectivityService', () => ({
    ConnectivityService: {
        checkFirestore: vi.fn().mockResolvedValue({
            name: 'Firestore Database',
            status: 'operational' as const,
            latency: 45,
        }),
        checkStorage: vi.fn().mockResolvedValue({
            name: 'Cloud Storage',
            status: 'operational' as const,
            latency: 120,
        }),
        checkCloudFunctions: vi.fn().mockResolvedValue({
            name: 'Cloud Functions',
            status: 'operational' as const,
            latency: 200,
        }),
    },
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

describe('SystemHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the component title', async () => {
        render(<SystemHealth />);
        expect(screen.getByText('System Status')).toBeInTheDocument();
        // Wait for loading to finish to prevent act warnings
        await waitFor(() => {
            expect(screen.queryByText('Checking system connectivity...')).not.toBeInTheDocument();
        });
    });

    it('should show loading state initially', async () => {
        render(<SystemHealth />);
        expect(screen.getByText('Checking system connectivity...')).toBeInTheDocument();
        // Wait for loading to finish to prevent act warnings from subsequent state updates
        await waitFor(() => {
            expect(screen.queryByText('Checking system connectivity...')).not.toBeInTheDocument();
        });
    });

    it('should display services after loading', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText('Firestore Database')).toBeInTheDocument();
        }, { timeout: 10000 });

        expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
        expect(screen.getByText('Cloud Functions')).toBeInTheDocument();
    });

    it('should display AI service as operational', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText('AI Models (Gemini)')).toBeInTheDocument();
        }, { timeout: 10000 });
    });

    it('should display service latency values', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText('45ms')).toBeInTheDocument();
        }, { timeout: 10000 });

        expect(screen.getByText('120ms')).toBeInTheDocument();
        expect(screen.getByText('200ms')).toBeInTheDocument();
    });

    it('should display operational status badges', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            const operationalBadges = screen.getAllByText('Operational');
            expect(operationalBadges.length).toBeGreaterThan(0);
        }, { timeout: 10000 });
    });

    it('should have a "Check Now" button', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText('Check Now')).toBeInTheDocument();
        }, { timeout: 10000 });
    });

    it('should display version number', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText(`v${BUILD_VERSION}`)).toBeInTheDocument();
        }, { timeout: 10000 });
    });

    it('should display last update time', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
        }, { timeout: 10000 });
    });

    it('should display uptime information', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            const uptimeElements = screen.getAllByText('Uptime: 99.99%');
            expect(uptimeElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });
    });

    it('should call refresh when "Check Now" is clicked', async () => {
        const { ConnectivityService } = await import('../../../../services/connectivityService');

        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText('Check Now')).toBeInTheDocument();
        }, { timeout: 10000 });

        const checkNowButton = screen.getByText('Check Now');

        await act(async () => {
            fireEvent.click(checkNowButton);
        });

        // Verify the mock was called
        await waitFor(() => {
            expect(ConnectivityService.checkFirestore).toHaveBeenCalled();
        }, { timeout: 10000 });
    });
});

describe('SystemHealth - Latency Colors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should display green color for fast latency', async () => {
        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.queryByText('Checking system connectivity...')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            const latency45 = screen.getByText('45ms');
            // Check for color class (supports both light/dark theme classes)
            expect(latency45.className).toMatch(/text-success-600|dark:text-success-400/);
        }, { timeout: 4000 }); // Decrease timeout to stay within vitest limit if it fails
    });
});
