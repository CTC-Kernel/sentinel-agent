/**
 * Tests for RiskMatrixSelector component
 * Story 3.2: Risk Evaluation Matrix
 *
 * Tests:
 * - Score calculation utilities
 * - Risk level classification
 * - Component rendering
 * - Interactive cell selection
 * - Residual risk display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  RiskMatrixSelector,
  getRiskLevelFromScore,
  calculateRiskScore
} from '../RiskMatrixSelector';

describe('calculateRiskScore', () => {
  it('should calculate score as impact × probability', () => {
    expect(calculateRiskScore(1, 1)).toBe(1);
    expect(calculateRiskScore(2, 3)).toBe(6);
    expect(calculateRiskScore(5, 5)).toBe(25);
    expect(calculateRiskScore(4, 3)).toBe(12);
  });

  it('should handle boundary values', () => {
    expect(calculateRiskScore(1, 5)).toBe(5);
    expect(calculateRiskScore(5, 1)).toBe(5);
  });
});

describe('getRiskLevelFromScore', () => {
  describe('Low risk (1-4)', () => {
    it('should return Faible for scores 1-4', () => {
      expect(getRiskLevelFromScore(1).label).toBe('Faible');
      expect(getRiskLevelFromScore(2).label).toBe('Faible');
      expect(getRiskLevelFromScore(3).label).toBe('Faible');
      expect(getRiskLevelFromScore(4).label).toBe('Faible');
    });

    it('should have emerald color', () => {
      const level = getRiskLevelFromScore(4);
      expect(level.bgColor).toBe('bg-emerald-500');
      expect(level.color).toBe('emerald');
    });
  });

  describe('Medium risk (5-9)', () => {
    it('should return Moyen for scores 5-9', () => {
      expect(getRiskLevelFromScore(5).label).toBe('Moyen');
      expect(getRiskLevelFromScore(6).label).toBe('Moyen');
      expect(getRiskLevelFromScore(9).label).toBe('Moyen');
    });

    it('should have amber color', () => {
      const level = getRiskLevelFromScore(5);
      expect(level.bgColor).toBe('bg-amber-400');
      expect(level.color).toBe('amber');
    });
  });

  describe('High risk (10-14)', () => {
    it('should return Élevé for scores 10-14', () => {
      expect(getRiskLevelFromScore(10).label).toBe('Élevé');
      expect(getRiskLevelFromScore(12).label).toBe('Élevé');
      expect(getRiskLevelFromScore(14).label).toBe('Élevé');
    });

    it('should have orange color', () => {
      const level = getRiskLevelFromScore(10);
      expect(level.bgColor).toBe('bg-orange-500');
      expect(level.color).toBe('orange');
    });
  });

  describe('Critical risk (15-25)', () => {
    it('should return Critique for scores 15-25', () => {
      expect(getRiskLevelFromScore(15).label).toBe('Critique');
      expect(getRiskLevelFromScore(20).label).toBe('Critique');
      expect(getRiskLevelFromScore(25).label).toBe('Critique');
    });

    it('should have rose color', () => {
      const level = getRiskLevelFromScore(15);
      expect(level.bgColor).toBe('bg-rose-500');
      expect(level.color).toBe('rose');
    });
  });
});

describe('RiskMatrixSelector', () => {
  const defaultProps = {
    probability: 3,
    impact: 3,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the matrix label', () => {
      render(<RiskMatrixSelector {...defaultProps} />);
      expect(screen.getByText('Évaluation du Risque')).toBeInTheDocument();
    });

    it('should render custom label', () => {
      render(<RiskMatrixSelector {...defaultProps} label="Custom Label" />);
      expect(screen.getByText('Custom Label')).toBeInTheDocument();
    });

    it('should render 25 cells (5x5 matrix)', () => {
      render(<RiskMatrixSelector {...defaultProps} />);
      const cells = screen.getAllByRole('button');
      expect(cells).toHaveLength(25);
    });

    it('should display axis labels', () => {
      render(<RiskMatrixSelector {...defaultProps} />);
      expect(screen.getByText('Probabilité')).toBeInTheDocument();
      expect(screen.getByText('Impact')).toBeInTheDocument();
    });

    it('should display current score', () => {
      render(<RiskMatrixSelector {...defaultProps} probability={3} impact={4} />);
      expect(screen.getByText('Score: 12')).toBeInTheDocument();
    });

    it('should display risk level', () => {
      render(<RiskMatrixSelector {...defaultProps} probability={5} impact={5} />);
      expect(screen.getByText('Critique')).toBeInTheDocument();
    });
  });

  describe('legend', () => {
    it('should show legend by default', () => {
      render(<RiskMatrixSelector {...defaultProps} />);
      expect(screen.getByText('Faible (1-4)')).toBeInTheDocument();
      expect(screen.getByText('Moyen (5-9)')).toBeInTheDocument();
      expect(screen.getByText('Élevé (10-14)')).toBeInTheDocument();
      expect(screen.getByText('Critique (15-25)')).toBeInTheDocument();
    });

    it('should hide legend when showLegend is false', () => {
      render(<RiskMatrixSelector {...defaultProps} showLegend={false} />);
      expect(screen.queryByText('Faible (1-4)')).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onChange when cell is clicked', () => {
      const onChange = vi.fn();
      render(<RiskMatrixSelector {...defaultProps} onChange={onChange} />);

      // Find and click a cell
      const cells = screen.getAllByRole('button');
      fireEvent.click(cells[0]); // Top-left cell (probability 5, impact 1)

      expect(onChange).toHaveBeenCalledWith(5, 1);
    });

    it('should not call onChange when readOnly', () => {
      const onChange = vi.fn();
      render(<RiskMatrixSelector {...defaultProps} onChange={onChange} readOnly />);

      const cells = screen.getAllByRole('button');
      fireEvent.click(cells[0]);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should mark current position as pressed', () => {
      render(<RiskMatrixSelector {...defaultProps} probability={3} impact={3} />);

      const currentCell = screen.getByRole('button', { name: /Probabilité 3, Impact 3/ });
      expect(currentCell).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('residual risk display', () => {
    it('should display residual score when provided', () => {
      render(
        <RiskMatrixSelector
          {...defaultProps}
          probability={4}
          impact={4}
          residualProbability={2}
          residualImpact={2}
        />
      );

      expect(screen.getByText('Brut: 16')).toBeInTheDocument();
      expect(screen.getByText('Résiduel: 4')).toBeInTheDocument();
    });

    it('should show position markers legend when residual exists', () => {
      render(
        <RiskMatrixSelector
          {...defaultProps}
          residualProbability={2}
          residualImpact={2}
        />
      );

      expect(screen.getByText('Position brute')).toBeInTheDocument();
      expect(screen.getByText('Position résiduelle')).toBeInTheDocument();
    });

    it('should not show comparison when showComparison is false', () => {
      render(
        <RiskMatrixSelector
          {...defaultProps}
          probability={4}
          impact={4}
          residualProbability={2}
          residualImpact={2}
          showComparison={false}
        />
      );

      expect(screen.queryByText('Résiduel:')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels on cells', () => {
      render(<RiskMatrixSelector {...defaultProps} />);

      const cell = screen.getByRole('button', { name: /Probabilité 3, Impact 3, Score 9/ });
      expect(cell).toBeInTheDocument();
    });

    it('should have title attribute with score details', () => {
      render(<RiskMatrixSelector {...defaultProps} />);

      const cell = screen.getByRole('button', { name: /Probabilité 5, Impact 5/ });
      expect(cell).toHaveAttribute('title', 'Probabilité: 5, Impact: 5, Score: 25');
    });
  });

  describe('compact mode', () => {
    it('should apply compact styles when compact is true', () => {
      const { container } = render(<RiskMatrixSelector {...defaultProps} compact />);

      // Check for compact max-width class
      const grid = container.querySelector('.max-w-\\[220px\\]');
      expect(grid).toBeInTheDocument();
    });

    it('should apply regular styles when compact is false', () => {
      const { container } = render(<RiskMatrixSelector {...defaultProps} compact={false} />);

      const grid = container.querySelector('.max-w-\\[300px\\]');
      expect(grid).toBeInTheDocument();
    });
  });
});
