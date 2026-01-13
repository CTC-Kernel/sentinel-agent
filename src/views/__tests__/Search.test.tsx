/**
 * Search View Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Search } from '../Search';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) =>
            <div {...props}>{children}</div>
    }
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: () => [new URLSearchParams()]
    };
});

// Mock useGlobalSearch hook
const mockPerformSearch = vi.fn();
const mockSetResults = vi.fn();

vi.mock('../../hooks/useGlobalSearch', () => ({
    useGlobalSearch: () => ({
        results: [],
        loading: false,
        performSearch: mockPerformSearch,
        setResults: mockSetResults
    })
}));

// Mock components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));

vi.mock('../../components/SEO', () => ({
    SEO: ({ title }: { title: string }) => <div data-testid="seo" data-title={title} />
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => (
        <div data-testid="page-header">
            <h1>{title}</h1>
        </div>
    )
}));

vi.mock('../../components/ui/EmptyState', () => ({
    EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>
}));

vi.mock('../../components/ui/AdvancedSearch', () => ({
    AdvancedSearch: ({ onSearch, onClose }: { onSearch: (filters: object) => void; onClose: () => void }) => (
        <div data-testid="advanced-search">
            <button onClick={() => onSearch({ query: 'test', type: 'all' })}>Apply Filters</button>
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

vi.mock('../../components/ui/Icons', () => ({
    Search: () => <span>SearchIcon</span>,
    Filter: () => <span>FilterIcon</span>,
    ArrowRight: () => <span>ArrowRightIcon</span>,
    ShieldCheck: () => <span>ShieldCheckIcon</span>,
    AlertTriangle: () => <span>AlertTriangleIcon</span>,
    FileText: () => <span>FileTextIcon</span>,
    FolderKanban: () => <span>FolderKanbanIcon</span>
}));

describe('Search View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <Search />
            </BrowserRouter>
        );
    };

    it('should render SEO component with correct title', () => {
        renderComponent();

        const seo = screen.getByTestId('seo');
        expect(seo).toHaveAttribute('data-title', 'Recherche Avancée');
    });

    it('should render MasterpieceBackground', () => {
        renderComponent();

        expect(screen.getByTestId('masterpiece-background')).toBeInTheDocument();
    });

    it('should render search input', () => {
        renderComponent();

        expect(screen.getByPlaceholderText(/Rechercher/)).toBeInTheDocument();
    });

    it('should update search query on input change', async () => {
        renderComponent();

        const input = screen.getByPlaceholderText(/Rechercher/);
        fireEvent.change(input, { target: { value: 'test query' } });

        expect(input).toHaveValue('test query');
    });

    it('should debounce search and call performSearch', async () => {
        renderComponent();

        const input = screen.getByPlaceholderText(/Rechercher/);
        fireEvent.change(input, { target: { value: 'test' } });

        // Fast-forward debounce timer
        vi.advanceTimersByTime(500);

        expect(mockPerformSearch).toHaveBeenCalled();
    });

    it('should clear results when query is too short', async () => {
        renderComponent();

        const input = screen.getByPlaceholderText(/Rechercher/);
        fireEvent.change(input, { target: { value: 'a' } });

        // Fast-forward debounce timer
        vi.advanceTimersByTime(500);

        expect(mockSetResults).toHaveBeenCalledWith([]);
    });

    it('should render filter tabs', () => {
        renderComponent();

        expect(screen.getByText('Tout')).toBeInTheDocument();
        expect(screen.getByText('Actifs')).toBeInTheDocument();
        expect(screen.getByText('Risques')).toBeInTheDocument();
        expect(screen.getByText('Documents')).toBeInTheDocument();
        expect(screen.getByText('Projets')).toBeInTheDocument();
    });

    it('should toggle advanced search panel', () => {
        renderComponent();

        // Initially, advanced search should not be visible
        expect(screen.queryByTestId('advanced-search')).not.toBeInTheDocument();

        // Click filter button to show advanced search
        const filterButton = screen.getByLabelText('Filtres');
        fireEvent.click(filterButton);

        expect(screen.getByTestId('advanced-search')).toBeInTheDocument();
    });
});
