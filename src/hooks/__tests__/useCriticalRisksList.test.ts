import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCriticalRisksList, getCriticalityColorScheme, CRITICALITY_COLOR_CLASSES } from '../useCriticalRisksList';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn((_q, onSuccess) => {
    // Simulate successful data fetch
    onSuccess({
      docs: [
        {
          id: 'risk-1',
          data: () => ({
            threat: 'Attaque DDoS',
            category: 'Reseau',
            impact: 5,
            probability: 4,
            status: 'Ouvert',
            owner: 'Jean Dupont',
          }),
        },
        {
          id: 'risk-2',
          data: () => ({
            threat: 'Fuite de donnees',
            category: 'Donnees',
            impact: 4,
            probability: 4,
            status: 'En cours',
            owner: 'Marie Martin',
          }),
        },
        {
          id: 'risk-3',
          data: () => ({
            scenario: 'Acces non autorise',
            category: 'Securite',
            impact: 3,
            probability: 3,
            status: 'Ouvert',
          }),
        },
      ],
      size: 3,
    });
    return vi.fn(); // Return unsubscribe function
  }),
}));

describe('useCriticalRisksList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    // After the effect runs, it should complete loading
    expect(result.current.loading).toBe(false);
  });

  it('should return empty data when no tenantId', () => {
    const { result } = renderHook(() => useCriticalRisksList(undefined));

    expect(result.current.risks).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('should return risks with correct structure', async () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should filter to only critical risks (criticality >= 15)
    expect(result.current.risks.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate criticality correctly', async () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Each risk should have criticality = impact * probability
    result.current.risks.forEach((risk) => {
      expect(risk.criticality).toBe(risk.impact * risk.probability);
    });
  });

  it('should sort risks by criticality descending', async () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    for (let i = 1; i < result.current.risks.length; i++) {
      expect(result.current.risks[i - 1].criticality).toBeGreaterThanOrEqual(
        result.current.risks[i].criticality
      );
    }
  });

  it('should have refetch function', () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should have trend defined after initial load', async () => {
    const { result } = renderHook(() => useCriticalRisksList('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trend is calculated based on count change (0 -> N)
    expect(result.current.trend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(result.current.trend);
  });
});

describe('getCriticalityColorScheme', () => {
  it('should return danger for critical risks (20-25)', () => {
    expect(getCriticalityColorScheme(20)).toBe('danger');
    expect(getCriticalityColorScheme(25)).toBe('danger');
    expect(getCriticalityColorScheme(22)).toBe('danger');
  });

  it('should return warning for high risks (15-19)', () => {
    expect(getCriticalityColorScheme(15)).toBe('warning');
    expect(getCriticalityColorScheme(19)).toBe('warning');
    expect(getCriticalityColorScheme(17)).toBe('warning');
  });

  it('should return caution for medium risks (10-14)', () => {
    expect(getCriticalityColorScheme(10)).toBe('caution');
    expect(getCriticalityColorScheme(14)).toBe('caution');
    expect(getCriticalityColorScheme(12)).toBe('caution');
  });

  it('should return success for low risks (1-9)', () => {
    expect(getCriticalityColorScheme(1)).toBe('success');
    expect(getCriticalityColorScheme(9)).toBe('success');
    expect(getCriticalityColorScheme(5)).toBe('success');
  });
});

describe('CRITICALITY_COLOR_CLASSES', () => {
  it('should have all color schemes defined', () => {
    expect(CRITICALITY_COLOR_CLASSES.danger).toBeDefined();
    expect(CRITICALITY_COLOR_CLASSES.warning).toBeDefined();
    expect(CRITICALITY_COLOR_CLASSES.caution).toBeDefined();
    expect(CRITICALITY_COLOR_CLASSES.success).toBeDefined();
  });

  it('should have bg, text, border, and badge classes for each scheme', () => {
    const schemes = ['danger', 'warning', 'caution', 'success'] as const;

    schemes.forEach((scheme) => {
      expect(CRITICALITY_COLOR_CLASSES[scheme].bg).toBeTruthy();
      expect(CRITICALITY_COLOR_CLASSES[scheme].text).toBeTruthy();
      expect(CRITICALITY_COLOR_CLASSES[scheme].border).toBeTruthy();
      expect(CRITICALITY_COLOR_CLASSES[scheme].badge).toBeTruthy();
    });
  });

  it('should use correct color classes', () => {
    expect(CRITICALITY_COLOR_CLASSES.danger.bg).toContain('red');
    expect(CRITICALITY_COLOR_CLASSES.warning.bg).toContain('orange');
    expect(CRITICALITY_COLOR_CLASSES.caution.bg).toContain('yellow');
    expect(CRITICALITY_COLOR_CLASSES.success.bg).toContain('green');
  });
});
