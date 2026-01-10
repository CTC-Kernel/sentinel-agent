/**
 * Unit tests for DraftBadge component (Story 1.3)
 *
 * Tests for draft status badge rendering and localization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftBadge, ConditionalDraftBadge, isDraftStatus } from '../DraftBadge';

// Mock useLocale hook
const mockLocale = { locale: 'fr' as 'fr' | 'en' };
vi.mock('../../../hooks/useLocale', () => ({
  useLocale: () => mockLocale,
}));

describe('DraftBadge', () => {
  describe('localization', () => {
    it('renders FR label when locale is fr', () => {
      mockLocale.locale = 'fr';
      render(<DraftBadge />);

      expect(screen.getByText('Brouillon')).toBeInTheDocument();
    });

    it('renders EN label when locale is en', () => {
      mockLocale.locale = 'en';
      render(<DraftBadge />);

      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('uses custom label when provided', () => {
      render(<DraftBadge label="Custom Label" />);

      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders with default soft variant', () => {
      const { container } = render(<DraftBadge />);

      // Badge should be rendered
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts different size props', () => {
      const { rerender, container } = render(<DraftBadge size="sm" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<DraftBadge size="md" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts different variant props', () => {
      const { rerender, container } = render(<DraftBadge variant="default" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<DraftBadge variant="outline" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<DraftBadge variant="soft" />);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<DraftBadge variant="glass" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies additional className', () => {
      const { container } = render(<DraftBadge className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('isDraftStatus', () => {
  describe('draft status detection', () => {
    it('returns true for "draft"', () => {
      expect(isDraftStatus('draft')).toBe(true);
    });

    it('returns true for "Draft"', () => {
      expect(isDraftStatus('Draft')).toBe(true);
    });

    it('returns true for "Brouillon"', () => {
      expect(isDraftStatus('Brouillon')).toBe(true);
    });

    it('returns true for "brouillon"', () => {
      expect(isDraftStatus('brouillon')).toBe(true);
    });
  });

  describe('non-draft status detection', () => {
    it('returns false for "Published"', () => {
      expect(isDraftStatus('Published')).toBe(false);
    });

    it('returns false for "Active"', () => {
      expect(isDraftStatus('Active')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isDraftStatus('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isDraftStatus(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDraftStatus(undefined)).toBe(false);
    });
  });
});

describe('ConditionalDraftBadge', () => {
  beforeEach(() => {
    mockLocale.locale = 'fr';
  });

  describe('conditional rendering', () => {
    it('renders badge for draft status', () => {
      render(<ConditionalDraftBadge status="Draft" />);

      expect(screen.getByText('Brouillon')).toBeInTheDocument();
    });

    it('renders badge for Brouillon status', () => {
      render(<ConditionalDraftBadge status="Brouillon" />);

      expect(screen.getByText('Brouillon')).toBeInTheDocument();
    });

    it('does not render for non-draft status', () => {
      render(<ConditionalDraftBadge status="Published" />);

      expect(screen.queryByText('Brouillon')).not.toBeInTheDocument();
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    });

    it('does not render for null status', () => {
      render(<ConditionalDraftBadge status={null} />);

      expect(screen.queryByText('Brouillon')).not.toBeInTheDocument();
    });

    it('does not render for undefined status', () => {
      render(<ConditionalDraftBadge status={undefined} />);

      expect(screen.queryByText('Brouillon')).not.toBeInTheDocument();
    });
  });

  describe('props passthrough', () => {
    it('passes size prop to DraftBadge', () => {
      const { container } = render(
        <ConditionalDraftBadge status="Draft" size="md" />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('passes variant prop to DraftBadge', () => {
      const { container } = render(
        <ConditionalDraftBadge status="Draft" variant="outline" />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('passes className prop to DraftBadge', () => {
      const { container } = render(
        <ConditionalDraftBadge status="Draft" className="test-class" />
      );

      expect(container.firstChild).toHaveClass('test-class');
    });
  });
});
