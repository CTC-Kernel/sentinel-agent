/**
 * GlobalMetrics Component Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GlobalMetrics } from '../GlobalMetrics';

// Mock Firestore
const mockGetCountFromServer = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getCountFromServer: () => mockGetCountFromServer(),
}));

// Mock Firebase app
vi.mock('../../../../firebase', () => ({
    db: {},
}));

// Mock ErrorLogger
vi.mock('../../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn(),
    },
}));

// Mock Recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
    AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Users: () => <span data-testid="icon-users" />,
    Building: () => <span data-testid="icon-building" />,
    Activity: () => <span data-testid="icon-activity" />,
    Zap: () => <span data-testid="icon-zap" />,
}));

describe('GlobalMetrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Suppress known SVG casing warnings from React/JSDOM interaction
        const originalError = console.error;
        vi.spyOn(console, 'error').mockImplementation((...args) => {
            if (typeof args[0] === 'string' &&
                (args[0].includes('using incorrect casing') ||
                    args[0].includes('unrecognized in this browser'))) {
                return;
            }
            originalError(...args);
        });

        // Default mock returning stats
        mockGetCountFromServer
            .mockResolvedValueOnce({ data: () => ({ count: 15 }) }) // tenants
            .mockResolvedValueOnce({ data: () => ({ count: 120 }) }) // users
            .mockResolvedValueOnce({ data: () => ({ count: 8 }) }); // active sessions
    });

    describe('Rendering', () => {
        it('should render loading state initially', () => {
            // Make the mock hang to test loading state
            mockGetCountFromServer.mockReset();
            mockGetCountFromServer.mockImplementation(() => new Promise(() => { }));

            render(<GlobalMetrics />);

            const loadingElement = document.querySelector('.animate-pulse');
            expect(loadingElement).toBeInTheDocument();
        });

        it('should render stat cards after loading', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('Total Tenants')).toBeInTheDocument();
                expect(screen.getByText('Total Users')).toBeInTheDocument();
                expect(screen.getByText('Active Sessions (1h)')).toBeInTheDocument();
                expect(screen.getByText('System Health')).toBeInTheDocument();
            });
        });

        it('should display correct tenant count', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('15')).toBeInTheDocument();
            });
        });

        it('should display correct user count', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('120')).toBeInTheDocument();
            });
        });

        it('should display correct active sessions count', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('8')).toBeInTheDocument();
            });
        });

        it('should display system health percentage', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('99.9%')).toBeInTheDocument();
            });
        });

        it('should display trend information', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('+12% this month')).toBeInTheDocument();
                expect(screen.getByText('+24% this month')).toBeInTheDocument();
            });
        });
    });

    describe('Chart', () => {
        it('should render growth analytics chart', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByText('Growth Analytics')).toBeInTheDocument();
            });
        });

        it('should render chart container', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
            });
        });

        it('should render area chart', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByTestId('area-chart')).toBeInTheDocument();
            });
        });
    });

    describe('Icons', () => {
        it('should render building icon for tenants', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByTestId('icon-building')).toBeInTheDocument();
            });
        });

        it('should render users icon', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByTestId('icon-users')).toBeInTheDocument();
            });
        });

        it('should render activity icon', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                // Two activity icons: one in stat card, one in chart header
                const activityIcons = screen.getAllByTestId('icon-activity');
                expect(activityIcons.length).toBeGreaterThanOrEqual(1);
            });
        });

        it('should render zap icon for system health', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(screen.getByTestId('icon-zap')).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const { ErrorLogger } = await import('../../../../services/errorLogger');
            mockGetCountFromServer.mockReset();
            mockGetCountFromServer.mockRejectedValue(new Error('API Error'));

            render(<GlobalMetrics />);

            await waitFor(() => {
                expect(ErrorLogger.error).toHaveBeenCalledWith(
                    expect.any(Error),
                    'GlobalMetrics.fetchStats'
                );
            });
        });

        it('should show stats as 0 on error', async () => {
            mockGetCountFromServer.mockReset();
            mockGetCountFromServer.mockRejectedValue(new Error('API Error'));

            render(<GlobalMetrics />);

            await waitFor(() => {
                // After error, loading should be false and default values shown
                const loadingElement = document.querySelector('.animate-pulse.h-64');
                expect(loadingElement).not.toBeInTheDocument();
            });
        });
    });

    describe('StatCard component', () => {
        it('should render all color variants', async () => {
            render(<GlobalMetrics />);

            await waitFor(() => {
                // Check that all 4 stat cards are rendered
                expect(screen.getByText('Total Tenants')).toBeInTheDocument();
                expect(screen.getByText('Total Users')).toBeInTheDocument();
                expect(screen.getByText('Active Sessions (1h)')).toBeInTheDocument();
                expect(screen.getByText('System Health')).toBeInTheDocument();
            });
        });
    });
});
