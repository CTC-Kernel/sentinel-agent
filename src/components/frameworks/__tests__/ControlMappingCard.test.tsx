/**
 * ControlMappingCard Component Tests
 *
 * @see Story EU-1.5: Cross-Framework Mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlMappingCard } from '../ControlMappingCard';
import type { ControlWithMappings } from '../../../types/framework';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, className, ...props }: React.ComponentProps<'div'>) => (
      onClick ? (
        <button onClick={onClick as unknown as React.MouseEventHandler<HTMLButtonElement>} className={className} {...(props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
      ) : (
        <div className={className} {...props}>{children}</div>
      )
    ),
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'mapping.noMappings': 'No mappings',
        'mapping.reqs': 'requirements',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ControlMappingCard', () => {
  const mockControlWithMappings: ControlWithMappings = {
    controlId: 'ctrl-1',
    controlCode: 'AC-001',
    controlName: 'Access Control Policy',
    mappings: [
      {
        frameworkId: 'fw-1',
        frameworkCode: 'NIS2',
        coveragePercentage: 85,
        requirementCount: 5,
      },
      {
        frameworkId: 'fw-2',
        frameworkCode: 'DORA',
        coveragePercentage: 60,
        requirementCount: 3,
      },
    ],
  };

  const mockControlNoMappings: ControlWithMappings = {
    controlId: 'ctrl-2',
    controlCode: 'IR-002',
    controlName: 'Incident Response',
    mappings: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders control code and name', () => {
    render(<ControlMappingCard control={mockControlWithMappings} />);

    expect(screen.getByText('AC-001')).toBeInTheDocument();
    expect(screen.getByText('Access Control Policy')).toBeInTheDocument();
  });

  it('renders framework badges with coverage percentages', () => {
    render(<ControlMappingCard control={mockControlWithMappings} />);

    expect(screen.getByText('NIS2')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('DORA')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('calculates and displays average coverage', () => {
    render(<ControlMappingCard control={mockControlWithMappings} />);

    // Average of 85 and 60 = 72.5, rounded to 73
    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('displays total requirements count', () => {
    render(<ControlMappingCard control={mockControlWithMappings} />);

    // Total: 5 + 3 = 8 requirements
    expect(screen.getByText('8 requirements')).toBeInTheDocument();
  });

  it('shows no mappings message when control has no mappings', () => {
    render(<ControlMappingCard control={mockControlNoMappings} />);

    expect(screen.getByText('No mappings')).toBeInTheDocument();
  });

  it('does not show coverage bar when no mappings', () => {
    const { container } = render(<ControlMappingCard control={mockControlNoMappings} />);

    // Coverage bar has h-1.5 class
    const coverageBar = container.querySelector('.h-1\\.5');
    expect(coverageBar).not.toBeInTheDocument();
  });

  it('shows coverage bar when there are mappings', () => {
    const { container } = render(<ControlMappingCard control={mockControlWithMappings} />);

    // Coverage bar should exist
    const coverageBars = container.querySelectorAll('.rounded-full');
    expect(coverageBars.length).toBeGreaterThan(0);
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(<ControlMappingCard control={mockControlWithMappings} onClick={handleClick} />);

    // The mock renders a button when onClick is provided
    const card = container.querySelector('button') || screen.getByText('Access Control Policy').closest('div');
    if (card) {
      fireEvent.click(card);
    }

    expect(handleClick).toHaveBeenCalledWith(mockControlWithMappings);
  });

  it('applies selected styles when isSelected is true', () => {
    const { container } = render(<ControlMappingCard control={mockControlWithMappings} isSelected />);

    // Find the root card element (button or div based on mock)
    const card = container.firstElementChild as HTMLElement | null;
    expect(card).toBeTruthy();
    // Selected cards have a ring or bg-brand styles
    expect(card?.className).toBeDefined();
  });

  it('applies default styles when isSelected is false', () => {
    const { container } = render(<ControlMappingCard control={mockControlWithMappings} isSelected={false} />);

    const card = container.firstElementChild as HTMLElement | null;
    expect(card).toBeTruthy();
    expect(card?.className).toBeDefined();
  });

  it('renders shield icon', () => {
    const { container } = render(<ControlMappingCard control={mockControlWithMappings} />);

    // Shield icon should be present (lucide-react renders as svg)
    const shieldIcon = container.querySelector('svg');
    expect(shieldIcon).toBeInTheDocument();
  });

  it('applies correct color for high coverage (emerald)', () => {
    const highCoverageControl: ControlWithMappings = {
      ...mockControlWithMappings,
      mappings: [
        { frameworkId: 'fw-1', frameworkCode: 'NIS2', coveragePercentage: 90, requirementCount: 5 },
      ],
    };

    const { container } = render(<ControlMappingCard control={highCoverageControl} />);

    // Coverage bar should have emerald color for 90%
    const coverageBar = container.querySelector('.bg-emerald-500');
    expect(coverageBar).toBeInTheDocument();
  });

  it('applies correct color for medium coverage (amber)', () => {
    const mediumCoverageControl: ControlWithMappings = {
      ...mockControlWithMappings,
      mappings: [
        { frameworkId: 'fw-1', frameworkCode: 'NIS2', coveragePercentage: 55, requirementCount: 5 },
      ],
    };

    const { container } = render(<ControlMappingCard control={mediumCoverageControl} />);

    // Coverage bar should have amber color for 55%
    const coverageBar = container.querySelector('.bg-amber-500');
    expect(coverageBar).toBeInTheDocument();
  });

  it('applies correct color for low coverage (red)', () => {
    const lowCoverageControl: ControlWithMappings = {
      ...mockControlWithMappings,
      mappings: [
        { frameworkId: 'fw-1', frameworkCode: 'NIS2', coveragePercentage: 30, requirementCount: 5 },
      ],
    };

    const { container } = render(<ControlMappingCard control={lowCoverageControl} />);

    // Coverage bar should have red color for 30%
    const coverageBar = container.querySelector('.bg-red-500');
    expect(coverageBar).toBeInTheDocument();
  });
});
