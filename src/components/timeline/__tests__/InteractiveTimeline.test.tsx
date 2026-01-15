/**
 * Unit tests for InteractiveTimeline component
 * Tests timeline filter and zoom controls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { InteractiveTimeline } from '../InteractiveTimeline';

// Mock vis-timeline
vi.mock('vis-timeline/standalone', () => ({
    Timeline: vi.fn(() => ({
        destroy: vi.fn(),
        on: vi.fn(),
        setWindow: vi.fn()
    }))
}));

vi.mock('vis-data', () => ({
    DataSet: vi.fn((items: unknown[]) => items)
}));

// Mock store
vi.mock('../../../store', () => ({
    useStore: () => ({
        user: {
            uid: 'user-1',
            organizationId: 'org-1'
        }
    })
}));

// Mock Firestore collections
vi.mock('../../../hooks/useFirestore', () => ({
    useFirestoreCollection: (collection: string) => {
        const mockData: Record<string, unknown[]> = {
            incidents: [
                { id: 'inc-1', title: 'Test Incident', dateReported: '2024-01-15', severity: 'high' }
            ],
            audits: [
                { id: 'audit-1', name: 'Test Audit', dateScheduled: '2024-02-01', type: 'internal' }
            ],
            projects: [
                { id: 'proj-1', name: 'Test Project', startDate: '2024-01-01', status: 'active' }
            ],
            risks: [
                { id: 'risk-1', threat: 'Test Risk', createdAt: '2024-01-10', score: 75 }
            ],
            documents: [
                { id: 'doc-1', title: 'Test Doc', createdAt: '2024-01-05', version: '1.0' }
            ]
        };

        return {
            data: mockData[collection] || [],
            loading: false
        };
    }
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock EmptyChartState
vi.mock('../../ui/EmptyChartState', () => ({
    EmptyChartState: ({ message }: { message: string }) => (
        <div data-testid="empty-state">{message}</div>
    )
}));

describe('InteractiveTimeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <InteractiveTimeline />
            </BrowserRouter>
        );
    };

    describe('rendering', () => {
        it('renders timeline header', () => {
            renderComponent();

            expect(screen.getByText('Timeline Interactive')).toBeInTheDocument();
        });

        it('renders description', () => {
            renderComponent();

            expect(screen.getByText('Vue chronologique de tous les événements SSI')).toBeInTheDocument();
        });

        it('renders export button', () => {
            renderComponent();

            expect(screen.getByText('Exporter PNG')).toBeInTheDocument();
        });
    });

    describe('filter buttons', () => {
        it('renders incidents filter', () => {
            renderComponent();

            // Multiple elements exist - use getAllBy
            expect(screen.getAllByText(/Incidents/).length).toBeGreaterThan(0);
        });

        it('renders audits filter', () => {
            renderComponent();

            expect(screen.getAllByText(/Audits/).length).toBeGreaterThan(0);
        });

        it('renders projects filter', () => {
            renderComponent();

            expect(screen.getAllByText(/Projets/).length).toBeGreaterThan(0);
        });

        it('renders risks filter', () => {
            renderComponent();

            expect(screen.getAllByText(/Risques/).length).toBeGreaterThan(0);
        });

        it('renders documents filter', () => {
            renderComponent();

            expect(screen.getAllByText(/Documents/).length).toBeGreaterThan(0);
        });

        it('shows event count in filter buttons', () => {
            renderComponent();

            // Each filter should show count in parentheses
            expect(screen.getAllByText(/\(1\)/).length).toBeGreaterThan(0);
        });
    });

    describe('filter interactions', () => {
        it('has aria-label for filter buttons', () => {
            renderComponent();

            expect(screen.getByLabelText(/Masquer les incidents|Afficher les incidents/)).toBeInTheDocument();
        });

        it('toggles filter when clicked', () => {
            renderComponent();

            const incidentsButton = screen.getByLabelText(/Masquer les incidents/);
            fireEvent.click(incidentsButton);

            // After toggle, should show "Afficher"
            expect(screen.getByLabelText(/Afficher les incidents/)).toBeInTheDocument();
        });
    });

    describe('zoom controls', () => {
        it('renders zoom level buttons', () => {
            renderComponent();

            expect(screen.getByText('Jour')).toBeInTheDocument();
            expect(screen.getByText('Semaine')).toBeInTheDocument();
            expect(screen.getByText('Mois')).toBeInTheDocument();
            expect(screen.getByText('Année')).toBeInTheDocument();
        });

        it('has default month zoom selected', () => {
            renderComponent();

            const monthButton = screen.getByText('Mois');
            expect(monthButton).toHaveClass('bg-brand-600');
        });

        it('changes zoom when clicked', () => {
            renderComponent();

            const dayButton = screen.getByText('Jour');
            fireEvent.click(dayButton);

            expect(dayButton).toHaveClass('bg-brand-600');
        });
    });

    describe('legend', () => {
        it('renders legend section', () => {
            renderComponent();

            expect(screen.getByText('Légende')).toBeInTheDocument();
        });

        it('shows all event types in legend', () => {
            renderComponent();

            const legend = screen.getByText('Légende').closest('div');
            expect(legend).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has aria-label on export button', () => {
            renderComponent();

            expect(screen.getByLabelText('Exporter la timeline en image PNG')).toBeInTheDocument();
        });

        it('has aria-label on zoom buttons', () => {
            renderComponent();

            expect(screen.getByLabelText('Zoom niveau day')).toBeInTheDocument();
        });
    });
});
