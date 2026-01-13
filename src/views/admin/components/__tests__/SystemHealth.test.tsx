/**
 * SystemHealth Component Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SystemHealth } from '../SystemHealth';

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

    it('should render the component title', () => {
        render(<SystemHealth />);
        expect(screen.getByText('System Status')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
        render(<SystemHealth />);
        expect(screen.getByText('Checking system connectivity...')).toBeInTheDocument();
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
            expect(screen.getByText('v2.4.1')).toBeInTheDocument();
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
        fireEvent.click(checkNowButton);

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
            const latency45 = screen.getByText('45ms');
            expect(latency45).toHaveClass('text-emerald-400');
        }, { timeout: 10000 });
    });
});
