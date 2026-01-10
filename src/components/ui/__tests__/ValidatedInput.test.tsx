/**
 * Unit tests for ValidatedInput component (Story 1.5)
 *
 * Tests for validated input with visual feedback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { z } from 'zod';
import { ValidatedInput, getValidationLabel } from '../ValidatedInput';

// Mock useLocale hook
vi.mock('../../../hooks/useLocale', () => ({
  useLocale: vi.fn(() => ({ locale: 'fr' })),
}));

import { useLocale } from '../../../hooks/useLocale';
const mockUseLocale = vi.mocked(useLocale);

describe('ValidatedInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseLocale.mockReturnValue({ locale: 'fr' } as ReturnType<typeof useLocale>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders input element', () => {
      render(<ValidatedInput name="test" />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<ValidatedInput name="test" label="Test Label" />);

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    });

    it('shows required indicator when required', () => {
      render(<ValidatedInput name="test" label="Test Label" required />);

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<ValidatedInput name="test" helperText="Some helper text" />);

      expect(screen.getByText('Some helper text')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ValidatedInput name="test" className="custom-class" />);

      expect(screen.getByRole('textbox')).toHaveClass('custom-class');
    });
  });

  describe('idle state', () => {
    it('does not show validation icon in idle state', () => {
      const { container } = render(<ValidatedInput name="test" />);

      // Check that no icon is rendered
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBe(0);
    });
  });

  describe('valid state', () => {
    it('shows green checkmark when valid', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="valid"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      // Check for the Check icon (it has a specific class)
      expect(screen.getByRole('textbox').parentElement).toContainHTML(
        'text-emerald-500'
      );
    });

    it('applies green border when valid', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="valid"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(input).toHaveClass('border-emerald-500');
    });
  });

  describe('invalid state', () => {
    it('shows red error icon when invalid', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(screen.getByRole('textbox').parentElement).toContainHTML(
        'text-rose-500'
      );
    });

    it('applies red border when invalid', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(input).toHaveClass('border-rose-500');
    });

    it('displays error message below input', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3, 'At least 3 characters')}
          trigger="blur"
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(screen.getByText('At least 3 characters')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('sets aria-invalid when invalid', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('external error', () => {
    it('displays external error message', () => {
      render(
        <ValidatedInput
          name="test"
          externalError="Server validation failed"
        />
      );

      expect(screen.getByText('Server validation failed')).toBeInTheDocument();
    });

    it('shows invalid state with external error', () => {
      render(
        <ValidatedInput
          name="test"
          externalError="Server validation failed"
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-rose-500');
    });

    it('external error takes precedence over validation error', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3, 'Min 3 chars')}
          externalError="External error"
          trigger="blur"
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(screen.getByText('External error')).toBeInTheDocument();
      expect(screen.queryByText('Min 3 chars')).not.toBeInTheDocument();
    });
  });

  describe('onChange callback', () => {
    it('calls onChange when value changes', () => {
      const handleChange = vi.fn();

      render(<ValidatedInput name="test" onChange={handleChange} />);

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'new value' } });
      });

      expect(handleChange).toHaveBeenCalledWith('new value');
    });
  });

  describe('onValidationChange callback', () => {
    it('calls onValidationChange when validation state changes', () => {
      const handleValidationChange = vi.fn();

      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          onValidationChange={handleValidationChange}
          defaultValue="ab"
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      expect(handleValidationChange).toHaveBeenCalledWith(
        'invalid',
        expect.any(String)
      );
    });
  });

  describe('delay trigger', () => {
    it('validates after delay', async () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="delay"
          delayMs={500}
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.change(input, { target: { value: 'ab' } });
      });

      // Before delay, should not have error class
      expect(input).not.toHaveClass('border-rose-500');

      // Advance timers
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // After delay, should have error class
      expect(input).toHaveClass('border-rose-500');
    });
  });

  describe('hideIcon option', () => {
    it('hides validation icon when hideIcon is true', () => {
      render(
        <ValidatedInput
          name="test"
          schema={z.string().min(3)}
          trigger="blur"
          defaultValue="valid"
          hideIcon
        />
      );

      const input = screen.getByRole('textbox');

      act(() => {
        fireEvent.blur(input);
      });

      // Should not have the pr-10 class for icon space
      expect(input).not.toHaveClass('pr-10');
    });
  });

  describe('disabled state', () => {
    it('applies disabled styles when disabled', () => {
      render(<ValidatedInput name="test" disabled />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('disabled:bg-slate-100');
    });
  });
});

describe('getValidationLabel', () => {
  it('returns FR labels', () => {
    expect(getValidationLabel('fr', 'required')).toBe('Ce champ est requis');
    expect(getValidationLabel('fr', 'invalid')).toBe('Valeur invalide');
  });

  it('returns EN labels', () => {
    expect(getValidationLabel('en', 'required')).toBe('This field is required');
    expect(getValidationLabel('en', 'invalid')).toBe('Invalid value');
  });
});
