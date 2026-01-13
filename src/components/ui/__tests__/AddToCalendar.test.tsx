/**
 * AddToCalendar Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddToCalendar, CalendarEventDetails } from '../AddToCalendar';

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Calendar: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'calendar-icon' }),
    Download: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'download-icon' }),
    ExternalLink: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'external-link-icon' })
}));

// Mock CalendarService
vi.mock('../../../services/calendarService', () => ({
    CalendarService: {
        google: vi.fn(() => 'https://calendar.google.com/event'),
        outlook: vi.fn(() => 'https://outlook.office.com/event'),
        downloadIcs: vi.fn()
    }
}));

describe('AddToCalendar', () => {
    const mockEvent: CalendarEventDetails = {
        title: 'Test Event',
        description: 'Test description',
        start: new Date('2024-01-15T10:00:00'),
        end: new Date('2024-01-15T11:00:00'),
        location: 'Test Location'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render calendar button', () => {
        render(<AddToCalendar event={mockEvent} />);

        expect(screen.getByText('Ajouter au calendrier')).toBeInTheDocument();
        expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
    });

    it('should open dropdown when button is clicked', () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));

        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
        expect(screen.getByText('Outlook')).toBeInTheDocument();
        expect(screen.getByText('Fichier ICS')).toBeInTheDocument();
    });

    it('should close dropdown when button is clicked again', () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
    });

    it('should have correct Google Calendar link', async () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));

        const googleLink = screen.getByText('Google Calendar').closest('a');
        expect(googleLink).toHaveAttribute('href', 'https://calendar.google.com/event');
        expect(googleLink).toHaveAttribute('target', '_blank');
    });

    it('should have correct Outlook link', async () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));

        const outlookLink = screen.getByText('Outlook').closest('a');
        expect(outlookLink).toHaveAttribute('href', 'https://outlook.office.com/event');
        expect(outlookLink).toHaveAttribute('target', '_blank');
    });

    it('should download ICS file when ICS button is clicked', async () => {
        const { CalendarService } = await import('../../../services/calendarService');

        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        fireEvent.click(screen.getByText('Fichier ICS'));

        expect(CalendarService.downloadIcs).toHaveBeenCalledWith(mockEvent);
    });

    it('should close dropdown when clicking outside', () => {
        render(
            <div>
                <AddToCalendar event={mockEvent} />
                <div data-testid="outside">Outside</div>
            </div>
        );

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
    });

    it('should close dropdown when Google Calendar is clicked', () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        fireEvent.click(screen.getByText('Google Calendar'));

        expect(screen.queryByText('Outlook')).not.toBeInTheDocument();
    });

    it('should close dropdown when Outlook is clicked', () => {
        render(<AddToCalendar event={mockEvent} />);

        fireEvent.click(screen.getByText('Ajouter au calendrier'));
        fireEvent.click(screen.getByText('Outlook'));

        expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <AddToCalendar event={mockEvent} className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should clean up event listener on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const { unmount } = render(<AddToCalendar event={mockEvent} />);
        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        removeEventListenerSpy.mockRestore();
    });
});
