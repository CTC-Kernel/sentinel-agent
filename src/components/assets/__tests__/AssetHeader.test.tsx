/**
 * Unit tests for AssetHeader component
 * Tests page header with actions dropdown and new asset button
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AssetHeader } from '../AssetHeader';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
    ChevronDown: () => <span data-testid="chevron-down-icon" />,
    Link: () => <span data-testid="link-icon" />,
    FileSpreadsheet: () => <span data-testid="file-spreadsheet-icon" />,
    Plus: () => <span data-testid="plus-icon" />,
    Box: () => <span data-testid="box-icon" />
}));

// Mock PageHeader
vi.mock('../../ui/PageHeader', () => ({
    PageHeader: ({ title, subtitle, actions, icon, breadcrumbs }: {
        title: string;
        subtitle: string;
        actions: React.ReactNode;
        icon: React.ReactNode;
        breadcrumbs: { label: string; path: string }[];
    }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
            <div data-testid="header-icon">{icon}</div>
            <div data-testid="breadcrumbs">
                {breadcrumbs.map((b, i) => <span key={i || 'unknown'}>{b.label}</span>)}
            </div>
            <div data-testid="header-actions">{actions}</div>
        </div>
    )
}));

// Mock Tooltip
vi.mock('../../ui/Tooltip', () => ({
    Tooltip: ({ children, content }: { children: React.ReactNode; content: string }) => (
        <div data-tooltip={content}>{children}</div>
    )
}));

// Mock Button
vi.mock('../../ui/button', () => ({
    Button: ({ children, onClick, className, variant }: {
        children: React.ReactNode;
        onClick?: () => void;
        className?: string;
        variant?: string;
    }) => (
        <button onClick={onClick} className={className} data-variant={variant}>
            {children}
        </button>
    )
}));

const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('AssetHeader', () => {
    const mockOnGenerateLink = vi.fn();
    const mockOnExportCSV = vi.fn();
    const mockOnNewAsset = vi.fn();

    const defaultProps = {
        onGenerateLink: mockOnGenerateLink,
        onExportCSV: mockOnExportCSV,
        onNewAsset: mockOnNewAsset,
        canEdit: true
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('page header', () => {
        it('renders page header', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByTestId('page-header')).toBeInTheDocument();
        });

        it('displays correct title', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByText('Actifs & Inventaire')).toBeInTheDocument();
        });

        it('displays correct subtitle', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByText("Gérez votre cartographie des actifs et votre analyse d'impact.")).toBeInTheDocument();
        });

        it('renders box icon', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByTestId('box-icon')).toBeInTheDocument();
        });

        it('displays breadcrumbs', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
            expect(screen.getByText('Inventaire')).toBeInTheDocument();
        });
    });

    describe('actions dropdown', () => {
        it('renders Actions button', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByText('Actions')).toBeInTheDocument();
        });

        it('renders chevron down icon', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
        });

        it('shows dropdown menu when clicked', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));

            expect(screen.getByText('Outils')).toBeInTheDocument();
            expect(screen.getByText('Lien Kiosque')).toBeInTheDocument();
            expect(screen.getByText('Export CSV')).toBeInTheDocument();
        });

        it('calls onGenerateLink when Lien Kiosque clicked', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));
            fireEvent.click(screen.getByText('Lien Kiosque'));

            expect(mockOnGenerateLink).toHaveBeenCalled();
        });

        it('calls onExportCSV when Export CSV clicked', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));
            fireEvent.click(screen.getByText('Export CSV'));

            expect(mockOnExportCSV).toHaveBeenCalled();
        });
    });

    describe('new asset button', () => {
        it('renders new asset button when canEdit is true', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByText('Nouvel Actif')).toBeInTheDocument();
        });

        it('hides new asset button when canEdit is false', () => {
            renderWithRouter(<AssetHeader {...defaultProps} canEdit={false} />);

            expect(screen.queryByText('Nouvel Actif')).not.toBeInTheDocument();
        });

        it('calls onNewAsset when button clicked', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Nouvel Actif'));

            expect(mockOnNewAsset).toHaveBeenCalled();
        });

        it('renders plus icon', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
        });
    });

    describe('icons', () => {
        it('shows link icon in dropdown', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));

            expect(screen.getByTestId('link-icon')).toBeInTheDocument();
        });

        it('shows file spreadsheet icon in dropdown', () => {
            renderWithRouter(<AssetHeader {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));

            expect(screen.getByTestId('file-spreadsheet-icon')).toBeInTheDocument();
        });
    });
});
