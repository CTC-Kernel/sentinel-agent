/**
 * MappingMatrix Component Tests
 *
 * @see Story EU-1.5: Cross-Framework Mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MappingMatrix } from '../MappingMatrix';
import type { ControlWithMappings } from '../../../types/framework';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
    tr: ({ children, ...props }: React.ComponentProps<'tr'>) => (
      <tr {...props}>{children}</tr>
    ),
    button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'mapping.title': 'Cross-Framework Mapping',
        'mapping.subtitle': 'Visualize control coverage across frameworks',
        'mapping.controls': 'Controls',
        'mapping.frameworks': 'Frameworks',
        'mapping.fullCoverage': 'Full coverage',
        'mapping.partialCoverage': 'Partial coverage',
        'mapping.unmapped': 'Unmapped',
        'mapping.reqs': 'requirements',
        'mapping.noResults': 'No results',
        'mapping.noResultsSearch': 'Try adjusting your search',
        'mapping.noControls': 'No controls to display',
        'mapping.control': 'Control',
        'mapping.searchPlaceholder': 'Search controls...',
        'mapping.filterAll': 'All statuses',
        'mapping.filterFull': 'Full coverage',
        'mapping.filterPartial': 'Partial coverage',
        'mapping.filterNone': 'No coverage',
        'mapping.filterUnmapped': 'Unmapped',
        'mapping.viewMatrix': 'Matrix view',
        'mapping.viewList': 'List view',
        'mapping.coverage.full': 'Full',
        'mapping.coverage.partial': 'Partial',
        'mapping.coverage.none': 'None',
        'mapping.coverage.not_assessed': 'Not assessed',
        'mapping.noMappings': 'No mappings',
        'mapping.requirements': `${options?.count || 0} requirements`,
      };
      return translations[key] || key;
    },
  }),
}));

// Mock hooks
const mockActiveFrameworks = [
  { id: 'af-1', frameworkId: 'fw-1', activatedAt: new Date() },
  { id: 'af-2', frameworkId: 'fw-2', activatedAt: new Date() },
];

const mockFrameworks = [
  { id: 'fw-1', code: 'NIS2', name: 'NIS2', requirementCount: 20 },
  { id: 'fw-2', code: 'DORA', name: 'DORA', requirementCount: 15 },
  { id: 'fw-3', code: 'RGPD', name: 'RGPD', requirementCount: 25 },
];

vi.mock('../../../hooks/useFrameworks', () => ({
  useActiveFrameworks: vi.fn(() => ({
    data: mockActiveFrameworks,
    isLoading: false,
  })),
  useFrameworks: vi.fn(() => ({
    data: mockFrameworks,
    isLoading: false,
  })),
}));

// Mock MappingCell to simplify testing
vi.mock('../MappingCell', () => ({
  MappingCell: ({ coverageStatus, coveragePercentage, onClick }: {
    coverageStatus: string;
    coveragePercentage: number;
    onClick?: () => void;
  }) => (
    <button data-testid="mapping-cell" onClick={onClick}>
      {coverageStatus}: {coveragePercentage}%
    </button>
  ),
}));

// Mock ControlMappingCard to simplify testing
vi.mock('../ControlMappingCard', () => ({
  ControlMappingCard: ({ control, onClick, isSelected }: {
    control: ControlWithMappings;
    onClick?: (control: ControlWithMappings) => void;
    isSelected?: boolean;
  }) => (
    <div
      data-testid="control-mapping-card"
      data-selected={isSelected}
      onClick={() => onClick?.(control)}
    >
      {control.controlCode} - {control.controlName}
    </div>
  ),
}));

describe('MappingMatrix', () => {
  const mockControls: ControlWithMappings[] = [
    {
      controlId: 'ctrl-1',
      controlCode: 'AC-001',
      controlName: 'Access Control Policy',
      mappings: [
        { frameworkId: 'fw-1', frameworkCode: 'NIS2', coveragePercentage: 85, requirementCount: 5 },
        { frameworkId: 'fw-2', frameworkCode: 'DORA', coveragePercentage: 60, requirementCount: 3 },
      ],
    },
    {
      controlId: 'ctrl-2',
      controlCode: 'IR-002',
      controlName: 'Incident Response',
      mappings: [
        { frameworkId: 'fw-1', frameworkCode: 'NIS2', coveragePercentage: 100, requirementCount: 4 },
      ],
    },
    {
      controlId: 'ctrl-3',
      controlCode: 'BC-003',
      controlName: 'Business Continuity',
      mappings: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    render(<MappingMatrix controls={mockControls} />);

    expect(screen.getByText('Cross-Framework Mapping')).toBeInTheDocument();
    expect(screen.getByText('Visualize control coverage across frameworks')).toBeInTheDocument();
  });

  it('renders stats summary', () => {
    render(<MappingMatrix controls={mockControls} />);

    // Should show 3 controls
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<MappingMatrix controls={mockControls} />);

    expect(screen.getByPlaceholderText('Search controls...')).toBeInTheDocument();
  });

  it('renders coverage filter dropdown', () => {
    render(<MappingMatrix controls={mockControls} />);

    expect(screen.getByText('All statuses')).toBeInTheDocument();
  });

  it('renders view mode toggle buttons', () => {
    render(<MappingMatrix controls={mockControls} />);

    // Both matrix and list view buttons should be present (as icons)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('filters controls by search query', async () => {
    render(<MappingMatrix controls={mockControls} />);

    const searchInput = screen.getByPlaceholderText('Search controls...');
    fireEvent.change(searchInput, { target: { value: 'Access' } });

    await waitFor(() => {
      expect(screen.getByText('AC-001')).toBeInTheDocument();
      expect(screen.queryByText('IR-002')).not.toBeInTheDocument();
      expect(screen.queryByText('BC-003')).not.toBeInTheDocument();
    });
  });

  it('filters controls by coverage status - full', async () => {
    render(<MappingMatrix controls={mockControls} />);

    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: 'full' } });

    await waitFor(() => {
      // IR-002 has 100% coverage (full)
      // AC-001 has 85% on NIS2 (full) and 60% on DORA (partial)
      // Both should appear as they have at least one full coverage mapping
      expect(screen.getByText('AC-001')).toBeInTheDocument();
      expect(screen.getByText('IR-002')).toBeInTheDocument();
    });
  });

  it('filters controls by coverage status - unmapped', async () => {
    render(<MappingMatrix controls={mockControls} />);

    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: 'unmapped' } });

    await waitFor(() => {
      // Only BC-003 has no mappings
      expect(screen.getByText('BC-003')).toBeInTheDocument();
      expect(screen.queryByText('AC-001')).not.toBeInTheDocument();
      expect(screen.queryByText('IR-002')).not.toBeInTheDocument();
    });
  });

  it('switches to list view when list button is clicked', async () => {
    render(<MappingMatrix controls={mockControls} />);

    // Find the list view button (second toggle button)
    const buttons = screen.getAllByRole('button');
    const listButton = buttons.find(btn => btn.getAttribute('title') === 'List view');

    if (listButton) {
      fireEvent.click(listButton);
    }

    await waitFor(() => {
      // In list view, ControlMappingCard components are rendered
      expect(screen.getAllByTestId('control-mapping-card').length).toBeGreaterThan(0);
    });
  });

  it('renders matrix view by default', () => {
    render(<MappingMatrix controls={mockControls} />);

    // In matrix view, we should see a table with framework headers
    expect(screen.getByText('NIS2')).toBeInTheDocument();
    expect(screen.getByText('DORA')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<MappingMatrix controls={[]} isLoading />);

    // Loading spinner should be visible (RefreshCw with animate-spin)
    const container = document.querySelector('.animate-spin');
    expect(container).toBeInTheDocument();
  });

  it('shows empty state when no controls', () => {
    render(<MappingMatrix controls={[]} />);

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No controls to display')).toBeInTheDocument();
  });

  it('shows empty search state when search yields no results', async () => {
    render(<MappingMatrix controls={mockControls} />);

    const searchInput = screen.getByPlaceholderText('Search controls...');
    fireEvent.change(searchInput, { target: { value: 'xyz123nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No results')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search')).toBeInTheDocument();
    });
  });

  it('calls onSelectControl when a control is clicked in matrix view', () => {
    const handleSelect = vi.fn();
    render(<MappingMatrix controls={mockControls} onSelectControl={handleSelect} />);

    // Click on the control name in the matrix
    fireEvent.click(screen.getByText('Access Control Policy'));

    expect(handleSelect).toHaveBeenCalledWith(mockControls[0]);
  });

  it('calls onCellClick when a mapping cell is clicked', () => {
    const handleCellClick = vi.fn();
    render(<MappingMatrix controls={mockControls} onCellClick={handleCellClick} />);

    // Click on a mapping cell (our mock renders buttons)
    const cells = screen.getAllByTestId('mapping-cell');
    fireEvent.click(cells[0]);

    expect(handleCellClick).toHaveBeenCalled();
  });

  it('highlights selected control row', () => {
    const handleSelect = vi.fn();
    render(<MappingMatrix controls={mockControls} onSelectControl={handleSelect} />);

    // Click to select a control
    fireEvent.click(screen.getByText('Access Control Policy'));

    // The row should have highlight class
    const row = screen.getByText('Access Control Policy').closest('tr');
    expect(row?.className).toContain('bg-brand-50');
  });

  it('renders legend with all coverage statuses', () => {
    render(<MappingMatrix controls={mockControls} />);

    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('Not assessed')).toBeInTheDocument();
  });

  it('shows framework requirement counts in headers', () => {
    render(<MappingMatrix controls={mockControls} />);

    // NIS2 has 20 requirements
    expect(screen.getByText('20 requirements')).toBeInTheDocument();
    // DORA has 15 requirements
    expect(screen.getByText('15 requirements')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MappingMatrix controls={mockControls} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
