import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreGauge } from '../ScoreGauge';
import { getScoreTextColor, getScoreStrokeColor } from '../../../utils/scoreUtils';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>,
    span: ({ children, className, ...props }: React.ComponentProps<'span'>) => <span className={className} {...props}>{children}</span>,
    circle: (props: React.SVGProps<SVGCircleElement>) => <circle {...props} />,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock microInteractions utilities
vi.mock('../../../utils/microInteractions', () => ({
  appleEasing: [0.16, 1, 0.3, 1],
  animateCounter: vi.fn((_from: number, to: number, _duration: number, onUpdate: (v: number) => void, onComplete?: () => void) => {
    // Immediately set to final value for tests
    onUpdate(to);
    if (onComplete) onComplete();
    return () => {};
  }),
  triggerConfetti: vi.fn(),
  triggerHaptic: vi.fn(),
}));

// Mock lucide-react icons with importOriginal to include all exports
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = ({ className, ...props }: any) => <span className={`icon ${className}`} {...props} />;
  return {
    ...actual,
    TrendingUp: Icon,
    TrendingDown: Icon,
    Minus: Icon,
  };
});

// Aliases for backward compatibility with test naming
const getScoreColor = getScoreTextColor;

describe('ScoreGauge', () => {
  describe('getScoreColor', () => {
    it('should return red for scores below 50', () => {
      expect(getScoreColor(0)).toBe('text-red-500');
      expect(getScoreColor(49)).toBe('text-red-500');
    });

    it('should return orange for scores 50-75', () => {
      expect(getScoreColor(50)).toBe('text-orange-500');
      expect(getScoreColor(75)).toBe('text-orange-500');
    });

    it('should return green for scores above 75', () => {
      expect(getScoreColor(76)).toBe('text-green-500');
      expect(getScoreColor(100)).toBe('text-green-500');
    });
  });

  describe('getScoreStrokeColor', () => {
    it('should return stroke-red for scores below 50', () => {
      expect(getScoreStrokeColor(30)).toBe('stroke-red-500');
    });

    it('should return stroke-orange for scores 50-75', () => {
      expect(getScoreStrokeColor(60)).toBe('stroke-orange-500');
    });

    it('should return stroke-green for scores above 75', () => {
      expect(getScoreStrokeColor(80)).toBe('stroke-green-500');
    });
  });

  describe('ScoreGauge component', () => {
    it('should render with default props', () => {
      render(<ScoreGauge score={75} />);

      expect(screen.getByRole('meter')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should display the correct score', () => {
      render(<ScoreGauge score={85.7} />);

      expect(screen.getByText('86')).toBeInTheDocument();
    });

    it('should have correct aria attributes', () => {
      render(<ScoreGauge score={60} />);

      const meter = screen.getByRole('meter');
      expect(meter).toHaveAttribute('aria-valuenow', '60');
      expect(meter).toHaveAttribute('aria-valuemin', '0');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
    });

    it('should use custom aria-label when provided', () => {
      render(<ScoreGauge score={75} ariaLabel="Custom label" />);

      expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Custom label');
    });

    it('should clamp score to 0-100 range', () => {
      const { rerender } = render(<ScoreGauge score={-10} />);
      expect(screen.getByText('0')).toBeInTheDocument();

      rerender(<ScoreGauge score={150} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should handle click when onClick is provided', () => {
      const handleClick = vi.fn();
      render(<ScoreGauge score={75} onClick={handleClick} />);

      fireEvent.click(screen.getByRole('meter'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard navigation when clickable', () => {
      const handleClick = vi.fn();
      render(<ScoreGauge score={75} onClick={handleClick} />);

      const meter = screen.getByRole('meter');

      fireEvent.keyDown(meter, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(meter, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should have tabIndex when clickable', () => {
      const { rerender } = render(<ScoreGauge score={75} onClick={() => {}} />);
      expect(screen.getByRole('meter')).toHaveAttribute('tabIndex', '0');

      rerender(<ScoreGauge score={75} />);
      expect(screen.getByRole('meter')).not.toHaveAttribute('tabIndex');
    });

    it('should hide label when showLabel is false', () => {
      render(<ScoreGauge score={75} showLabel={false} />);

      expect(screen.queryByText('75')).not.toBeInTheDocument();
    });

    it('should render different sizes', () => {
      const { rerender } = render(<ScoreGauge score={75} size="sm" />);
      let svg = screen.getByRole('meter').querySelector('svg');
      expect(svg).toHaveAttribute('width', '80');

      rerender(<ScoreGauge score={75} size="md" />);
      svg = screen.getByRole('meter').querySelector('svg');
      expect(svg).toHaveAttribute('width', '120');

      rerender(<ScoreGauge score={75} size="lg" />);
      svg = screen.getByRole('meter').querySelector('svg');
      expect(svg).toHaveAttribute('width', '180');
    });

    it('should apply custom className', () => {
      const { container } = render(<ScoreGauge score={75} className="custom-class" />);

      // The className is applied to the parent wrapper div, not the meter
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('should render SVG circles', () => {
      render(<ScoreGauge score={75} />);

      const svg = screen.getByRole('meter').querySelector('svg');
      const circles = svg?.querySelectorAll('circle');

      expect(circles).toHaveLength(2); // Background + score arc
    });
  });
});
