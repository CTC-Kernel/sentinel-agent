/**
 * Unit tests for AutoSaveIndicator component (Story 1.4)
 *
 * Tests for auto-save visual indicator with status-based rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoSaveIndicator, getAutoSaveLabel } from '../AutoSaveIndicator';

// Mock useLocale hook
vi.mock('../../../hooks/useLocale', () => ({
  useLocale: vi.fn(() => ({ locale: 'fr' })),
}));

// Import the mock to change its behavior
import { useLocale } from '../../../hooks/useLocale';
const mockUseLocale = vi.mocked(useLocale);

describe('AutoSaveIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);
  });

  describe('idle status', () => {
    it('renders nothing when status is idle', () => {
      const { container } = render(
        <AutoSaveIndicator
          status="idle"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('pending status', () => {
    it('renders pending indicator with FR label', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="pending"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Modifications en attente...')).toBeInTheDocument();
    });

    it('renders pending indicator with EN label', () => {
      mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="pending"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Changes pending...')).toBeInTheDocument();
    });

    it('has role="status" for accessibility', () => {
      render(
        <AutoSaveIndicator
          status="pending"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('saving status', () => {
    it('renders saving indicator with FR label', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Enregistrement...')).toBeInTheDocument();
    });

    it('renders saving indicator with EN label', () => {
      mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('has aria-busy="true" for accessibility', () => {
      render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('includes animated spinner', () => {
      const { container } = render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
        />
      );

      // Check for animate-spin class on the spinner
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('saved status', () => {
    it('renders saved indicator with FR label', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Enregistré')).toBeInTheDocument();
    });

    it('renders saved indicator with EN label', () => {
      mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={null}
          error={null}
        />
      );

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('displays relative timestamp when lastSavedAt is provided (just now)', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={new Date()} // Just now
          error={null}
        />
      );

      expect(screen.getByText(/À l'instant/)).toBeInTheDocument();
    });

    it('displays relative timestamp in minutes (FR)', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      // 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={fiveMinutesAgo}
          error={null}
        />
      );

      expect(screen.getByText(/il y a 5 min/)).toBeInTheDocument();
    });

    it('displays relative timestamp in minutes (EN)', () => {
      mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

      // 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={fiveMinutesAgo}
          error={null}
        />
      );

      expect(screen.getByText(/5 min ago/)).toBeInTheDocument();
    });

    it('displays relative timestamp in hours', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      // 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={twoHoursAgo}
          error={null}
        />
      );

      expect(screen.getByText(/il y a 2h/)).toBeInTheDocument();
    });
  });

  describe('error status', () => {
    it('renders error indicator with FR label', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
        />
      );

      expect(screen.getByText("Échec de l'enregistrement")).toBeInTheDocument();
    });

    it('renders error indicator with EN label', () => {
      mockUseLocale.mockReturnValue({ locale: 'en' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
        />
      );

      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    it('has role="alert" for accessibility', () => {
      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      const onRetry = vi.fn();

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
          onRetry={onRetry}
        />
      );

      fireEvent.click(screen.getByText('Réessayer'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render retry button when onRetry is not provided', () => {
      mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
        />
      );

      expect(screen.queryByText('Réessayer')).not.toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('hides text in compact mode for pending status', () => {
      render(
        <AutoSaveIndicator
          status="pending"
          lastSavedAt={null}
          error={null}
          compact
        />
      );

      expect(screen.queryByText('Modifications en attente...')).not.toBeInTheDocument();
    });

    it('hides text in compact mode for saving status', () => {
      render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
          compact
        />
      );

      expect(screen.queryByText('Enregistrement...')).not.toBeInTheDocument();
    });

    it('hides text in compact mode for saved status', () => {
      render(
        <AutoSaveIndicator
          status="saved"
          lastSavedAt={new Date()}
          error={null}
          compact
        />
      );

      expect(screen.queryByText('Enregistré')).not.toBeInTheDocument();
    });

    it('hides text and retry button in compact mode for error status', () => {
      const onRetry = vi.fn();

      render(
        <AutoSaveIndicator
          status="error"
          lastSavedAt={null}
          error={new Error('Network error')}
          onRetry={onRetry}
          compact
        />
      );

      expect(screen.queryByText("Échec de l'enregistrement")).not.toBeInTheDocument();
      expect(screen.queryByText('Réessayer')).not.toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <AutoSaveIndicator
          status="saving"
          lastSavedAt={null}
          error={null}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('getAutoSaveLabel', () => {
  it('returns FR labels', () => {
    expect(getAutoSaveLabel('fr', 'saving')).toBe('Enregistrement...');
    expect(getAutoSaveLabel('fr', 'saved')).toBe('Enregistré');
    expect(getAutoSaveLabel('fr', 'error')).toBe("Échec de l'enregistrement");
    expect(getAutoSaveLabel('fr', 'retry')).toBe('Réessayer');
    expect(getAutoSaveLabel('fr', 'pending')).toBe('Modifications en attente...');
    expect(getAutoSaveLabel('fr', 'justNow')).toBe("À l'instant");
  });

  it('returns EN labels', () => {
    expect(getAutoSaveLabel('en', 'saving')).toBe('Saving...');
    expect(getAutoSaveLabel('en', 'saved')).toBe('Saved');
    expect(getAutoSaveLabel('en', 'error')).toBe('Save failed');
    expect(getAutoSaveLabel('en', 'retry')).toBe('Retry');
    expect(getAutoSaveLabel('en', 'pending')).toBe('Changes pending...');
    expect(getAutoSaveLabel('en', 'justNow')).toBe('Just now');
  });

  it('returns function for time-based labels', () => {
    const minutesAgoFr = getAutoSaveLabel('fr', 'minutesAgo') as (n: number) => string;
    const minutesAgoEn = getAutoSaveLabel('en', 'minutesAgo') as (n: number) => string;

    expect(typeof minutesAgoFr).toBe('function');
    expect(minutesAgoFr(5)).toBe('il y a 5 min');
    expect(minutesAgoEn(5)).toBe('5 min ago');
  });
});
