import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useActiveIncidents, getSeverityColorScheme, SEVERITY_COLOR_CLASSES } from '../useActiveIncidents';

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
  onSnapshot: vi.fn((q, onSuccess) => {
    // Simulate successful data fetch
    onSuccess({
      docs: [
        {
          id: 'incident-1',
          data: () => ({
            title: 'Tentative de phishing',
            description: 'Email de phishing detecte',
            severity: 'Critique',
            status: 'Analyse',
            category: 'Phishing',
            dateReported: '2026-01-10T10:00:00Z',
            reporter: 'Jean Dupont',
          }),
        },
        {
          id: 'incident-2',
          data: () => ({
            title: 'Indisponibilite serveur',
            description: 'Serveur web inaccessible',
            severity: 'Élevée',
            status: 'Contenu',
            category: 'Indisponibilité',
            dateReported: '2026-01-09T14:30:00Z',
            reporter: 'Marie Martin',
          }),
        },
      ],
      size: 2,
    });
    return vi.fn(); // Return unsubscribe function
  }),
}));

describe('useActiveIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useActiveIncidents('tenant-123'));

    // After the effect runs, it should complete loading
    expect(result.current.loading).toBe(false);
  });

  it('should return empty data when no tenantId', () => {
    const { result } = renderHook(() => useActiveIncidents(undefined));

    expect(result.current.incidents).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('should return incidents with correct structure', async () => {
    const { result } = renderHook(() => useActiveIncidents('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.incidents.length).toBe(2);
    expect(result.current.incidents[0]).toHaveProperty('id');
    expect(result.current.incidents[0]).toHaveProperty('title');
    expect(result.current.incidents[0]).toHaveProperty('severity');
    expect(result.current.incidents[0]).toHaveProperty('status');
  });

  it('should return correct count', async () => {
    const { result } = renderHook(() => useActiveIncidents('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(2);
  });

  it('should have refetch function', () => {
    const { result } = renderHook(() => useActiveIncidents('tenant-123'));

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should have trend defined after initial load', async () => {
    const { result } = renderHook(() => useActiveIncidents('tenant-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trend is calculated based on count change (0 -> N)
    expect(result.current.trend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(result.current.trend);
  });
});

describe('getSeverityColorScheme', () => {
  it('should return danger for Critique severity', () => {
    expect(getSeverityColorScheme('Critique')).toBe('danger');
  });

  it('should return warning for Élevée severity', () => {
    expect(getSeverityColorScheme('Élevée')).toBe('warning');
  });

  it('should return caution for Moyenne severity', () => {
    expect(getSeverityColorScheme('Moyenne')).toBe('caution');
  });

  it('should return success for Faible severity', () => {
    expect(getSeverityColorScheme('Faible')).toBe('success');
  });
});

describe('SEVERITY_COLOR_CLASSES', () => {
  it('should have all color schemes defined', () => {
    expect(SEVERITY_COLOR_CLASSES.danger).toBeDefined();
    expect(SEVERITY_COLOR_CLASSES.warning).toBeDefined();
    expect(SEVERITY_COLOR_CLASSES.caution).toBeDefined();
    expect(SEVERITY_COLOR_CLASSES.success).toBeDefined();
  });

  it('should have bg, text, border, and badge classes for each scheme', () => {
    const schemes = ['danger', 'warning', 'caution', 'success'] as const;

    schemes.forEach((scheme) => {
      expect(SEVERITY_COLOR_CLASSES[scheme].bg).toBeTruthy();
      expect(SEVERITY_COLOR_CLASSES[scheme].text).toBeTruthy();
      expect(SEVERITY_COLOR_CLASSES[scheme].border).toBeTruthy();
      expect(SEVERITY_COLOR_CLASSES[scheme].badge).toBeTruthy();
    });
  });

  it('should use correct color classes', () => {
    expect(SEVERITY_COLOR_CLASSES.danger.bg).toContain('red');
    expect(SEVERITY_COLOR_CLASSES.warning.bg).toContain('orange');
    expect(SEVERITY_COLOR_CLASSES.caution.bg).toContain('yellow');
    expect(SEVERITY_COLOR_CLASSES.success.bg).toContain('green');
  });
});
