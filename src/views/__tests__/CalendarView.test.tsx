/**
 * CalendarView Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CalendarView } from '../CalendarView';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    }
}));

// Mock MasterpieceBackground
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

// Mock SEO component
vi.mock('../../components/SEO', () => ({
    SEO: ({ title }: { title: string }) => <div data-testid="seo" data-title={title} />
}));

// Mock PageHeader
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
        </div>
    )
}));

// Mock CalendarDashboard
vi.mock('../../components/calendar/CalendarDashboard', () => ({
    CalendarDashboard: () => <div data-testid="calendar-dashboard">Calendar Dashboard</div>
}));

describe('CalendarView', () => {
    const renderComponent = () => {
        return render(
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <CalendarView />
            </BrowserRouter>
        );
    };

    it('should render SEO component with correct title', () => {
        renderComponent();

        const seo = screen.getByTestId('seo');
        expect(seo).toHaveAttribute('data-title', 'Calendrier');
    });

    it('should render PageHeader with correct title', () => {
        renderComponent();

        expect(screen.getByText('Calendrier')).toBeInTheDocument();
    });

    it('should render PageHeader with correct subtitle', () => {
        renderComponent();

        expect(screen.getByText("Vue d'ensemble des échéances, audits et maintenances.")).toBeInTheDocument();
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render CalendarDashboard component', () => {
        renderComponent();

        expect(screen.getByTestId('calendar-dashboard')).toBeInTheDocument();
    });
});
