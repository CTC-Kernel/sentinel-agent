/**
 * Unit tests for IncidentGeneralDetails component
 * Tests incident details display with description, badges, and NIS2 timer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentGeneralDetails } from '../IncidentGeneralDetails';
import { Incident, Criticality } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    BookOpen: () => <span data-testid="book-open-icon" />
}));

// Mock Badge
vi.mock('../../../ui/Badge', () => ({
    Badge: ({ children, status }: { children: React.ReactNode; status: string }) => (
        <span data-testid="badge" data-status={status}>{children}</span>
    )
}));

// Mock SafeHTML
vi.mock('../../../ui/SafeHTML', () => ({
    SafeHTML: ({ content }: { content: string }) => (
        <div data-testid="safe-html">{content}</div>
    )
}));

// Mock ThreatIntelChecker
vi.mock('../../ThreatIntelChecker', () => ({
    ThreatIntelChecker: () => <div data-testid="threat-intel-checker">ThreatIntel</div>
}));

// Mock NIS2DeadlineTimer
vi.mock('../../NIS2DeadlineTimer', () => ({
    NIS2DeadlineTimer: ({ incident }: { incident: Incident }) => (
        <div data-testid="nis2-timer" data-incident={incident.id}>NIS2 Timer</div>
    )
}));

describe('IncidentGeneralDetails', () => {
    const mockIncident: Incident = {
        id: 'incident-1',
        organizationId: 'org-1',
        title: 'Security Breach',
        description: '<p>A security breach was detected in the main server.</p>',
        severity: Criticality.CRITICAL,
        status: 'Nouveau',
        dateReported: '2024-01-15T10:00:00Z',
        reporter: 'Alice Martin',
        financialImpact: 50000,
        isSignificant: false
    };

    const significantIncident: Incident = {
        ...mockIncident,
        isSignificant: true
    };

    const resolvedIncident: Incident = {
        ...mockIncident,
        status: 'Résolu'
    };

    const incidentWithoutDescription: Incident = {
        ...mockIncident,
        description: ''
    };

    const incidentWithoutFinancialImpact: Incident = {
        ...mockIncident,
        financialImpact: undefined
    };

    describe('description section', () => {
        it('renders description header', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Description')).toBeInTheDocument();
        });

        it('renders book open icon', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByTestId('book-open-icon')).toBeInTheDocument();
        });

        it('displays incident description via SafeHTML', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByTestId('safe-html')).toBeInTheDocument();
            expect(screen.getByText('<p>A security breach was detected in the main server.</p>')).toBeInTheDocument();
        });

        it('shows fallback when no description', () => {
            render(<IncidentGeneralDetails incident={incidentWithoutDescription} />);

            expect(screen.getByText('Aucune description.')).toBeInTheDocument();
        });
    });

    describe('NIS 2 deadlines section', () => {
        it('hides NIS2 section when not significant', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.queryByText('Délais de Notification (NIS 2)')).not.toBeInTheDocument();
        });

        it('shows NIS2 section when incident is significant', () => {
            render(<IncidentGeneralDetails incident={significantIncident} />);

            expect(screen.getByText('Délais de Notification (NIS 2)')).toBeInTheDocument();
        });

        it('renders NIS2 deadline timer for significant incidents', () => {
            render(<IncidentGeneralDetails incident={significantIncident} />);

            expect(screen.getByTestId('nis2-timer')).toBeInTheDocument();
        });

        it('passes incident to NIS2 timer', () => {
            render(<IncidentGeneralDetails incident={significantIncident} />);

            expect(screen.getByTestId('nis2-timer')).toHaveAttribute('data-incident', 'incident-1');
        });
    });

    describe('severity badge', () => {
        it('renders severity label', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Sévérité')).toBeInTheDocument();
        });

        it('displays severity value', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText(Criticality.CRITICAL)).toBeInTheDocument();
        });

        it('uses error status for critical severity', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            const badges = screen.getAllByTestId('badge');
            const severityBadge = badges.find(b => b.textContent === Criticality.CRITICAL);
            expect(severityBadge).toHaveAttribute('data-status', 'error');
        });

        it('uses warning status for high severity', () => {
            const highIncident = { ...mockIncident, severity: Criticality.HIGH };
            render(<IncidentGeneralDetails incident={highIncident} />);

            const badges = screen.getAllByTestId('badge');
            const severityBadge = badges.find(b => b.textContent === Criticality.HIGH);
            expect(severityBadge).toHaveAttribute('data-status', 'warning');
        });

        it('uses info status for other severities', () => {
            const lowIncident = { ...mockIncident, severity: Criticality.LOW };
            render(<IncidentGeneralDetails incident={lowIncident} />);

            const badges = screen.getAllByTestId('badge');
            const severityBadge = badges.find(b => b.textContent === Criticality.LOW);
            expect(severityBadge).toHaveAttribute('data-status', 'info');
        });
    });

    describe('status badge', () => {
        it('renders status label', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Statut')).toBeInTheDocument();
        });

        it('displays status value', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Nouveau')).toBeInTheDocument();
        });

        it('uses success status for resolved', () => {
            render(<IncidentGeneralDetails incident={resolvedIncident} />);

            const badges = screen.getAllByTestId('badge');
            const statusBadge = badges.find(b => b.textContent === 'Résolu');
            expect(statusBadge).toHaveAttribute('data-status', 'success');
        });

        it('uses info status for non-resolved', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            const badges = screen.getAllByTestId('badge');
            const statusBadge = badges.find(b => b.textContent === 'Nouveau');
            expect(statusBadge).toHaveAttribute('data-status', 'info');
        });
    });

    describe('financial impact', () => {
        it('renders financial impact label', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Impact Financier')).toBeInTheDocument();
        });

        it('displays financial impact with euro symbol', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('50000 €')).toBeInTheDocument();
        });

        it('shows dash when no financial impact', () => {
            render(<IncidentGeneralDetails incident={incidentWithoutFinancialImpact} />);

            expect(screen.getByText('-')).toBeInTheDocument();
        });
    });

    describe('reporter section', () => {
        it('renders reporter label in card', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Reporter')).toBeInTheDocument();
        });

        it('displays reporter name in card', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            // Reporter appears multiple times
            expect(screen.getAllByText('Alice Martin').length).toBeGreaterThan(0);
        });
    });

    describe('meta info section', () => {
        it('renders declared date label', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Déclaré le')).toBeInTheDocument();
        });

        it('renders declared by label', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('Déclaré par')).toBeInTheDocument();
        });

        it('shows reporter initial in avatar', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByText('A')).toBeInTheDocument();
        });
    });

    describe('threat intel', () => {
        it('renders threat intel checker', () => {
            render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(screen.getByTestId('threat-intel-checker')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-premium containers', () => {
            const { container } = render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(container.querySelectorAll('.glass-premium').length).toBeGreaterThan(0);
        });

        it('has grid layout', () => {
            const { container } = render(<IncidentGeneralDetails incident={mockIncident} />);

            expect(container.querySelector('.grid')).toBeInTheDocument();
        });
    });
});
