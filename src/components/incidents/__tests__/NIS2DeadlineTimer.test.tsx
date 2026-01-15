/**
 * Unit tests for NIS2DeadlineTimer component
 * Tests NIS2 deadline display and timer functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NIS2DeadlineTimer } from '../NIS2DeadlineTimer';
import { Incident } from '../../../types';
import { DeadlineStatus } from '../../../utils/nis2Utils';

// Mock nis2Utils
vi.mock('../../../utils/nis2Utils', () => ({
    getIncidentDeadlines: vi.fn(),
    DeadlineStatus: {
        OK: 'OK',
        WARNING: 'WARNING',
        OVERDUE: 'OVERDUE'
    }
}));

import { getIncidentDeadlines } from '../../../utils/nis2Utils';

describe('NIS2DeadlineTimer', () => {
    const mockIncident: Incident = {
        id: 'inc-1',
        title: 'Security Incident',
        description: 'Test incident',
        status: 'En cours',
        severity: 'Critique',
        isSignificant: true,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const mockDeadlines = [
        {
            label: 'Alerte initiale',
            deadlineDate: new Date(Date.now() + 3600000), // 1 hour from now
            remainingHours: 1,
            status: DeadlineStatus.WARNING,
            isCompleted: false
        },
        {
            label: 'Notification formelle',
            deadlineDate: new Date(Date.now() + 86400000), // 24 hours from now
            remainingHours: 24,
            status: DeadlineStatus.OK,
            isCompleted: false
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (getIncidentDeadlines as ReturnType<typeof vi.fn>).mockReturnValue(mockDeadlines);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('rendering', () => {
        it('returns null when incident is not significant', () => {
            const { container } = render(
                <NIS2DeadlineTimer incident={{ ...mockIncident, isSignificant: false }} />
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders deadlines when incident is significant', () => {
            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(screen.getByText('Alerte initiale')).toBeInTheDocument();
            expect(screen.getByText('Notification formelle')).toBeInTheDocument();
        });

        it('shows remaining hours for pending deadlines', () => {
            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(screen.getByText('1h')).toBeInTheDocument();
            expect(screen.getByText('24h')).toBeInTheDocument();
        });
    });

    describe('compact mode', () => {
        it('shows compact view when compact=true', () => {
            render(<NIS2DeadlineTimer incident={mockIncident} compact />);

            // In compact mode, only the most urgent is shown
            expect(screen.getByText('1h')).toBeInTheDocument();
        });

        it('shows NIS2 OK in compact mode when all completed', () => {
            (getIncidentDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([
                { ...mockDeadlines[0], isCompleted: true },
                { ...mockDeadlines[1], isCompleted: true }
            ]);

            render(<NIS2DeadlineTimer incident={mockIncident} compact />);

            expect(screen.getByText('NIS2 OK')).toBeInTheDocument();
        });

        it('shows "Retard" in compact mode when overdue', () => {
            (getIncidentDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([
                {
                    ...mockDeadlines[0],
                    remainingHours: -1,
                    status: DeadlineStatus.OVERDUE
                }
            ]);

            render(<NIS2DeadlineTimer incident={mockIncident} compact />);

            expect(screen.getByText('Retard')).toBeInTheDocument();
        });
    });

    describe('status display', () => {
        it('shows EXPIRÉ for overdue deadlines', () => {
            (getIncidentDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([
                {
                    ...mockDeadlines[0],
                    remainingHours: 0,
                    status: DeadlineStatus.OVERDUE,
                    isCompleted: false
                }
            ]);

            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(screen.getByText('EXPIRÉ')).toBeInTheDocument();
        });

        it('shows Notifié for completed deadlines', () => {
            (getIncidentDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([
                { ...mockDeadlines[0], isCompleted: true }
            ]);

            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(screen.getByText('Notifié')).toBeInTheDocument();
        });

        it('shows Restant label for pending deadlines with time', () => {
            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(screen.getAllByText('Restant').length).toBeGreaterThan(0);
        });
    });

    describe('deadline updates', () => {
        it('calls getIncidentDeadlines on render', () => {
            render(<NIS2DeadlineTimer incident={mockIncident} />);

            expect(getIncidentDeadlines).toHaveBeenCalledWith(mockIncident);
        });
    });
});
