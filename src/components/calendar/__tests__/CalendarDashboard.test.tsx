/**
 * Unit tests for CalendarDashboard component
 * Tests calendar display and event interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarDashboard } from '../CalendarDashboard';

// Toolbar props interface for react-big-calendar
interface ToolbarProps {
    date: Date;
    onNavigate: () => void;
    onView: () => void;
}

// Mock react-big-calendar
vi.mock('react-big-calendar', () => ({
    Calendar: ({ events, onSelectEvent, onSelectSlot, components }: {
        events: unknown[];
        onSelectEvent: (event: unknown) => void;
        onSelectSlot: (slotInfo: { start: Date }) => void;
        components?: { toolbar?: React.ComponentType<ToolbarProps> };
    }) => {
        const Toolbar = components?.toolbar;
        return (
            <div data-testid="calendar">
                {Toolbar && <Toolbar date={new Date()} onNavigate={() => { }} onView={() => { }} />}
                <div data-testid="events-container">
                    {events.map((event: unknown, idx: number) => (
                        <div
                            key={idx}
                            data-testid="calendar-event"
                            onClick={() => onSelectEvent(event)}
                        >
                            {(event as { title: string }).title}
                        </div>
                    ))}
                </div>
                <button
                    data-testid="select-slot"
                    onClick={() => onSelectSlot({ start: new Date() })}
                >
                    Select Slot
                </button>
            </div>
        );
    },
    dateFnsLocalizer: () => ({}),
    Views: { MONTH: 'month', WEEK: 'week', DAY: 'day' }
}));

vi.mock('react-big-calendar/lib/addons/dragAndDrop', () => ({
    default: (Calendar: unknown) => Calendar
}));

// Mock CalendarService
const mockFetchAllEvents = vi.fn();
vi.mock('../../../services/calendarService', () => ({
    CalendarService: {
        fetchAllEvents: () => mockFetchAllEvents(),
        updateEvent: vi.fn()
    }
}));

// Mock GoogleCalendarService
vi.mock('../../../services/googleCalendarService', () => ({
    GoogleCalendarService: {
        listEvents: vi.fn().mockResolvedValue([])
    }
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

// Mock toast
vi.mock('@/lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
    ErrorLogger: {
        error: vi.fn()
    }
}));

// Mock Drawer
vi.mock('../../ui/Drawer', () => ({
    Drawer: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div data-testid="drawer">{children}</div> : null
}));

// Mock CreateEventModal
vi.mock('../CreateEventModal', () => ({
    CreateEventModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="create-modal">Create Event Modal</div> : null
}));

// Mock AddToCalendar
vi.mock('../../ui/AddToCalendar', () => ({
    AddToCalendar: () => <button>Add to Calendar</button>
}));

// Mock calendar utils
vi.mock('../../../utils/calendarUtils', () => ({
    generateICS: vi.fn().mockReturnValue('ICS content'),
    downloadICS: vi.fn()
}));

// Mock date-fns
vi.mock('date-fns', async () => {
    const actual = await vi.importActual('date-fns');
    return {
        ...actual as object,
        format: vi.fn().mockReturnValue('January 2024')
    };
});

describe('CalendarDashboard', () => {
    const mockEvents = [
        {
            id: 'event-1',
            title: 'Test Audit',
            type: 'audit',
            start: new Date('2024-01-15T10:00:00'),
            end: new Date('2024-01-15T11:00:00'),
            description: 'Audit description',
            location: 'Room A'
        },
        {
            id: 'event-2',
            title: 'Maintenance Window',
            type: 'maintenance',
            start: new Date('2024-01-20T14:00:00'),
            end: new Date('2024-01-20T16:00:00')
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchAllEvents.mockResolvedValue(mockEvents);
    });

    describe('rendering', () => {
        it('renders calendar component', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByTestId('calendar')).toBeInTheDocument();
            });
        });

        it('loads events on mount', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(mockFetchAllEvents).toHaveBeenCalled();
            });
        });

        it('renders filter buttons', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByLabelText('Filtrer par audit')).toBeInTheDocument();
                expect(screen.getByLabelText('Filtrer par project')).toBeInTheDocument();
                expect(screen.getByLabelText('Filtrer par maintenance')).toBeInTheDocument();
                expect(screen.getByLabelText('Filtrer par incident')).toBeInTheDocument();
                expect(screen.getByLabelText('Filtrer par drill')).toBeInTheDocument();
            });
        });
    });

    describe('filter interactions', () => {
        it('toggles filter when clicked', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByLabelText('Filtrer par audit')).toBeInTheDocument();
            });

            const auditFilter = screen.getByLabelText('Filtrer par audit');
            expect(auditFilter).toHaveAttribute('aria-pressed', 'true');

            fireEvent.click(auditFilter);

            expect(auditFilter).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('event selection', () => {
        it('opens drawer when event is selected', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByText('Test Audit')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Test Audit'));

            await waitFor(() => {
                expect(screen.getByTestId('drawer')).toBeInTheDocument();
            });
        });
    });

    describe('create event', () => {
        it('opens create modal when slot is selected', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByTestId('select-slot')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId('select-slot'));

            await waitFor(() => {
                expect(screen.getByTestId('create-modal')).toBeInTheDocument();
            });
        });
    });

    describe('toolbar', () => {
        it('renders navigation buttons', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByLabelText('Mois précédent')).toBeInTheDocument();
                expect(screen.getByLabelText('Mois suivant')).toBeInTheDocument();
                expect(screen.getByLabelText("Aller à aujourd'hui")).toBeInTheDocument();
            });
        });

        it('renders view toggle buttons', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByLabelText('Vue Mois')).toBeInTheDocument();
                expect(screen.getByLabelText('Vue Semaine')).toBeInTheDocument();
                expect(screen.getByLabelText('Vue Jour')).toBeInTheDocument();
            });
        });

        it('renders export button', async () => {
            render(<CalendarDashboard />);

            await waitFor(() => {
                expect(screen.getByLabelText('Exporter le calendrier')).toBeInTheDocument();
            });
        });
    });

    describe('styling', () => {
        it('has glass-panel container', async () => {
            const { container } = render(<CalendarDashboard />);

            await waitFor(() => {
                expect(container.querySelector('.glass-panel')).toBeInTheDocument();
            });
        });
    });
});
