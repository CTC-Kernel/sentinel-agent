import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequirementCard } from '../RequirementCard';
import type { Requirement } from '../../../types/framework';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (options?.count !== undefined) return `${key}_${options.count}`;
      return key;
    },
    i18n: { language: 'fr' },
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RequirementCard', () => {
  const mockRequirement: Requirement = {
    id: 'req-1',
    frameworkId: 'nis2-v1',
    articleRef: 'Article 21',
    title: 'Cybersecurity risk-management measures',
    description: 'Essential entities shall take appropriate measures...',
    category: 'risk_management',
    criticality: 'high',
    isMandatory: true,
  };

  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render requirement information', () => {
    render(<RequirementCard requirement={mockRequirement} onClick={mockOnClick} />);

    expect(screen.getByText('Article 21')).toBeInTheDocument();
    expect(screen.getByText('Cybersecurity risk-management measures')).toBeInTheDocument();
  });

  it('should display criticality badge', () => {
    render(<RequirementCard requirement={mockRequirement} onClick={mockOnClick} />);

    expect(screen.getByText('requirements.criticality.high')).toBeInTheDocument();
  });

  it('should display mandatory badge when requirement is mandatory', () => {
    render(<RequirementCard requirement={mockRequirement} onClick={mockOnClick} />);

    expect(screen.getByText('requirements.mandatory')).toBeInTheDocument();
  });

  it('should not display mandatory badge when requirement is not mandatory', () => {
    const nonMandatory = { ...mockRequirement, isMandatory: false };
    render(<RequirementCard requirement={nonMandatory} onClick={mockOnClick} />);

    expect(screen.queryByText('requirements.mandatory')).not.toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(<RequirementCard requirement={mockRequirement} onClick={mockOnClick} />);

    const card = screen.getByText('Article 21').closest('div[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledWith(mockRequirement);
  });

  it('should display linked controls count when provided', () => {
    render(
      <RequirementCard
        requirement={mockRequirement}
        onClick={mockOnClick}
        linkedControlsCount={5}
      />
    );

    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/requirements\.linkedControls/)).toBeInTheDocument();
  });

  it('should not display linked controls count when zero', () => {
    render(
      <RequirementCard
        requirement={mockRequirement}
        onClick={mockOnClick}
        linkedControlsCount={0}
      />
    );

    expect(screen.queryByText(/requirements\.linkedControls/)).not.toBeInTheDocument();
  });

  it('should render with different criticality levels', () => {
    const { rerender } = render(
      <RequirementCard requirement={mockRequirement} onClick={mockOnClick} />
    );

    expect(screen.getByText('requirements.criticality.high')).toBeInTheDocument();

    const mediumReq = { ...mockRequirement, criticality: 'medium' as const };
    rerender(<RequirementCard requirement={mediumReq} onClick={mockOnClick} />);
    expect(screen.getByText('requirements.criticality.medium')).toBeInTheDocument();

    const lowReq = { ...mockRequirement, criticality: 'low' as const };
    rerender(<RequirementCard requirement={lowReq} onClick={mockOnClick} />);
    expect(screen.getByText('requirements.criticality.low')).toBeInTheDocument();
  });

  it('should apply selected styles when isSelected is true', () => {
    render(
      <RequirementCard
        requirement={mockRequirement}
        onClick={mockOnClick}
        isSelected={true}
      />
    );

    const card = screen.getByText('Article 21').closest('div[class*="cursor-pointer"]');
    expect(card?.className).toContain('brand');
  });

  it('should use localized title when available', () => {
    const localizedReq: Requirement = {
      ...mockRequirement,
      localizedTitles: {
        en: 'English Title',
        fr: 'Titre Français',
      },
    };

    render(
      <RequirementCard
        requirement={localizedReq}
        onClick={mockOnClick}
        locale="fr"
      />
    );

    expect(screen.getByText('Titre Français')).toBeInTheDocument();
  });
});
