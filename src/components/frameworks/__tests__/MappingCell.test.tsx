/**
 * MappingCell Component Tests
 *
 * @see Story EU-1.5: Cross-Framework Mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MappingCell } from '../MappingCell';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button {...props}>{children}</button>
    ),
    div: ({ children, ...props }: React.ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'mapping.coverage.full': 'Full',
        'mapping.coverage.partial': 'Partial',
        'mapping.coverage.none': 'None',
        'mapping.coverage.not_assessed': 'Not assessed',
        'mapping.requirements': `${options?.count || 0} requirements`,
        'mapping.more': 'more',
      };
      return translations[key] || key;
    },
  }),
}));

describe('MappingCell', () => {
  const defaultProps = {
    coverageStatus: 'full' as const,
    coveragePercentage: 85,
    requirementCount: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with full coverage status', () => {
    render(<MappingCell {...defaultProps} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders with partial coverage status', () => {
    render(
      <MappingCell
        coverageStatus="partial"
        coveragePercentage={45}
        requirementCount={3}
      />
    );

    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders with none coverage status', () => {
    render(
      <MappingCell
        coverageStatus="none"
        coveragePercentage={0}
        requirementCount={2}
      />
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders not_assessed status without percentage', () => {
    render(
      <MappingCell
        coverageStatus="not_assessed"
        coveragePercentage={0}
        requirementCount={0}
      />
    );

    // Should not show percentage for not_assessed
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<MappingCell {...defaultProps} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onHover when mouse enters and leaves', () => {
    const handleHover = vi.fn();
    render(<MappingCell {...defaultProps} onHover={handleHover} />);

    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);
    expect(handleHover).toHaveBeenCalledWith(true);

    fireEvent.mouseLeave(button);
    expect(handleHover).toHaveBeenCalledWith(false);
  });

  it('shows tooltip on hover when there are requirements', async () => {
    const requirements = [
      { id: '1', articleRef: 'Art. 5', title: 'Data protection' },
      { id: '2', articleRef: 'Art. 6', title: 'Security measures' },
    ];

    render(
      <MappingCell
        {...defaultProps}
        requirements={requirements}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('Art. 5')).toBeInTheDocument();
      expect(screen.getByText('Data protection')).toBeInTheDocument();
    });
  });

  it('shows "+X more" when more than 5 requirements', async () => {
    const requirements = Array.from({ length: 8 }, (_, i) => ({
      id: String(i + 1),
      articleRef: `Art. ${i + 1}`,
      title: `Requirement ${i + 1}`,
    }));

    render(
      <MappingCell
        {...defaultProps}
        requirementCount={8}
        requirements={requirements}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText('+3 more')).toBeInTheDocument();
    });
  });

  it('applies highlight ring when isHighlighted is true', () => {
    render(<MappingCell {...defaultProps} isHighlighted />);

    const button = screen.getByRole('button');
    expect(button.className).toContain('ring-2');
  });

  it('does not show tooltip when requirementCount is 0', () => {
    render(
      <MappingCell
        coverageStatus="not_assessed"
        coveragePercentage={0}
        requirementCount={0}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);

    // Tooltip should not appear
    expect(screen.queryByText('Full')).not.toBeInTheDocument();
    expect(screen.queryByText('0 requirements')).not.toBeInTheDocument();
  });
});
