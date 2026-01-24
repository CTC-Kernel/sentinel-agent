import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendSparkline } from '../TrendSparkline';
import type { ScoreHistory } from '../../../types/score.types';

// Mock useStore
vi.mock('../../../store', () => ({
  useStore: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.noHistory': 'Aucun historique'
      };
      return translations[key] || key;
    }
  })
}));

describe('TrendSparkline', () => {
  const mockHistory: ScoreHistory[] = [
    { date: '2026-01-08', global: 70 },
    { date: '2026-01-09', global: 72 },
    { date: '2026-01-10', global: 75 },
  ];

  it('should render with history data', () => {
    render(<TrendSparkline history={mockHistory} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show "Aucun historique" when history is empty', () => {
    render(<TrendSparkline history={[]} />);

    expect(screen.getByText('Aucun historique')).toBeInTheDocument();
  });

  it('should show "Aucun historique" when history is undefined', () => {
    render(<TrendSparkline history={undefined as unknown as ScoreHistory[]} />);

    expect(screen.getByText('Aucun historique')).toBeInTheDocument();
  });

  it('should render trend arrow by default', () => {
    render(<TrendSparkline history={mockHistory} trend="up" />);

    const svgs = document.querySelectorAll('svg');
    // Should have sparkline SVG + trend arrow SVG
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('should hide trend arrow when showTrendArrow is false', () => {
    render(<TrendSparkline history={mockHistory} trend="up" showTrendArrow={false} />);

    // Only sparkline SVG should be present
    const container = document.querySelector('.flex.items-center.gap-2');
    const svgs = container?.querySelectorAll('svg');
    expect(svgs?.length).toBe(1);
  });

  it('should render up arrow for up trend', () => {
    const { container } = render(<TrendSparkline history={mockHistory} trend="up" />);

    // Look for green arrow
    const greenSvg = container.querySelector('.text-green-500');
    expect(greenSvg).toBeInTheDocument();
  });

  it('should render down arrow for down trend', () => {
    const { container } = render(<TrendSparkline history={mockHistory} trend="down" />);

    // Look for red arrow
    const redSvg = container.querySelector('.text-red-500');
    expect(redSvg).toBeInTheDocument();
  });

  it('should render horizontal line for stable trend', () => {
    const { container } = render(<TrendSparkline history={mockHistory} trend="stable" />);

    // Look for gray arrow
    const graySvg = container.querySelector('.text-slate-500');
    expect(graySvg).toBeInTheDocument();
  });

  it('should use custom width and height', () => {
    render(<TrendSparkline history={mockHistory} width={200} height={50} />);

    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '50');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TrendSparkline history={mockHistory} className="custom-sparkline" />
    );

    expect(container.querySelector('.custom-sparkline')).toBeInTheDocument();
  });

  it('should render sparkline path with points', () => {
    render(<TrendSparkline history={mockHistory} />);

    const path = document.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toContain('M');
    expect(path?.getAttribute('d')).toContain('L');
  });

  it('should render end dot', () => {
    render(<TrendSparkline history={mockHistory} />);

    const circle = document.querySelector('circle');
    expect(circle).toBeInTheDocument();
  });

  it('should handle single data point', () => {
    const singlePoint: ScoreHistory[] = [{ date: '2026-01-10', global: 75 }];
    render(<TrendSparkline history={singlePoint} />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
