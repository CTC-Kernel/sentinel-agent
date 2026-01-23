import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameworkCard } from '../FrameworkCard';
import type { RegulatoryFramework, ActiveFramework } from '../../../types/framework';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { code?: string }) => {
      if (options?.code) return key.replace('{{code}}', options.code);
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

describe('FrameworkCard', () => {
  const mockFramework: RegulatoryFramework = {
    id: 'nis2-v1',
    code: 'NIS2',
    name: 'NIS2 Directive',
    version: '2022/2555',
    jurisdiction: 'EU',
    effectiveDate: '2024-10-17',
    isActive: true,
    requirementCount: 21,
    description: 'Network and Information Security Directive',
  };

  const mockActiveFramework: ActiveFramework = {
    frameworkId: 'nis2-v1',
    frameworkCode: 'NIS2',
    activatedAt: '2026-01-01T00:00:00Z',
    activatedBy: 'user-123',
  };

  const mockOnActivate = vi.fn();
  const mockOnDeactivate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render framework information', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    expect(screen.getByText('NIS2')).toBeInTheDocument();
    expect(screen.getByText('NIS2 Directive')).toBeInTheDocument();
    expect(screen.getByText('EU')).toBeInTheDocument();
    expect(screen.getByText(/21/)).toBeInTheDocument();
  });

  it('should show active badge when framework is active', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        activeFramework={mockActiveFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    expect(screen.getByText('frameworks.active')).toBeInTheDocument();
  });

  it('should not show active badge when framework is inactive', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    expect(screen.queryByText('frameworks.active')).not.toBeInTheDocument();
  });

  it('should call onActivate when clicking inactive framework', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const card = screen.getByText('NIS2').closest('div[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnActivate).toHaveBeenCalledWith(mockFramework);
    expect(mockOnDeactivate).not.toHaveBeenCalled();
  });

  it('should call onDeactivate when clicking active framework', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        activeFramework={mockActiveFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const card = screen.getByText('NIS2').closest('div[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnDeactivate).toHaveBeenCalledWith(mockFramework);
    expect(mockOnActivate).not.toHaveBeenCalled();
  });

  it('should not call handlers when loading', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
        isLoading
      />
    );

    const card = screen.getByText('NIS2').closest('div[class*="cursor-pointer"]');
    if (card) fireEvent.click(card);

    expect(mockOnActivate).not.toHaveBeenCalled();
    expect(mockOnDeactivate).not.toHaveBeenCalled();
  });

  it('should render description when provided', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    expect(screen.getByText('Network and Information Security Directive')).toBeInTheDocument();
  });

  it('should show activation date when active', () => {
    render(
      <FrameworkCard
        framework={mockFramework}
        activeFramework={mockActiveFramework}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    expect(screen.getByText(/frameworks.activatedOn/)).toBeInTheDocument();
  });
});
