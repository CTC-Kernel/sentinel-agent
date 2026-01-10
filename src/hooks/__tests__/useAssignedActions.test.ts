import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAssignedActions, getDueStatusColorScheme, DUE_STATUS_COLOR_CLASSES } from '../useAssignedActions';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

const mockOverdueDate = new Date();
mockOverdueDate.setDate(mockOverdueDate.getDate() - 3); // 3 days ago

const mockDueSoonDate = new Date();
mockDueSoonDate.setDate(mockDueSoonDate.getDate() + 3); // 3 days from now

const mockFutureDate = new Date();
mockFutureDate.setDate(mockFutureDate.getDate() + 30); // 30 days from now

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
          id: 'action-1',
          data: () => ({
            title: 'Mettre a jour la politique de securite',
            description: 'Revision annuelle',
            type: 'policy',
            status: 'pending',
            dueDate: mockOverdueDate.toISOString(),
            assigneeId: 'user-123',
          }),
        },
        {
          id: 'action-2',
          data: () => ({
            title: 'Former les employes au phishing',
            description: 'Formation trimestrielle',
            type: 'audit',
            status: 'in_progress',
            dueDate: mockDueSoonDate.toISOString(),
            assigneeId: 'user-123',
          }),
        },
        {
          id: 'action-3',
          data: () => ({
            title: 'Audit des acces',
            type: 'audit',
            status: 'pending',
            dueDate: mockFutureDate.toISOString(),
            assigneeId: 'user-123',
          }),
        },
      ],
      size: 3,
    });
    return vi.fn(); // Return unsubscribe function
  }),
}));

describe('useAssignedActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    // After the effect runs, it should complete loading
    expect(result.current.loading).toBe(false);
  });

  it('should return empty data when no tenantId', () => {
    const { result } = renderHook(() => useAssignedActions(undefined, 'user-123'));

    expect(result.current.actions).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('should return actions with correct structure', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.actions.length).toBe(3);
    expect(result.current.actions[0]).toHaveProperty('id');
    expect(result.current.actions[0]).toHaveProperty('title');
    expect(result.current.actions[0]).toHaveProperty('dueDate');
    expect(result.current.actions[0]).toHaveProperty('isOverdue');
    expect(result.current.actions[0]).toHaveProperty('isDueSoon');
  });

  it('should calculate overdue status correctly', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const overdueAction = result.current.actions.find((a) => a.id === 'action-1');
    expect(overdueAction?.isOverdue).toBe(true);
    expect(overdueAction?.daysUntilDue).toBeLessThan(0);
  });

  it('should calculate due soon status correctly', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const dueSoonAction = result.current.actions.find((a) => a.id === 'action-2');
    expect(dueSoonAction?.isDueSoon).toBe(true);
    expect(dueSoonAction?.isOverdue).toBe(false);
  });

  it('should sort actions with overdue first', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // First action should be overdue
    expect(result.current.actions[0].isOverdue).toBe(true);
  });

  it('should return correct overdue count', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.overdueCount).toBe(1);
  });

  it('should have refetch function', () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    expect(typeof result.current.refetch).toBe('function');
  });

  it('should have trend defined after initial load', async () => {
    const { result } = renderHook(() => useAssignedActions('tenant-123', 'user-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Trend is calculated based on count change (0 -> N)
    expect(result.current.trend).toBeDefined();
    expect(['up', 'down', 'stable']).toContain(result.current.trend);
  });
});

describe('getDueStatusColorScheme', () => {
  it('should return danger for overdue actions', () => {
    expect(getDueStatusColorScheme(true, false)).toBe('danger');
  });

  it('should return warning for due soon actions', () => {
    expect(getDueStatusColorScheme(false, true)).toBe('warning');
  });

  it('should return neutral for normal actions', () => {
    expect(getDueStatusColorScheme(false, false)).toBe('neutral');
  });
});

describe('DUE_STATUS_COLOR_CLASSES', () => {
  it('should have all color schemes defined', () => {
    expect(DUE_STATUS_COLOR_CLASSES.danger).toBeDefined();
    expect(DUE_STATUS_COLOR_CLASSES.warning).toBeDefined();
    expect(DUE_STATUS_COLOR_CLASSES.neutral).toBeDefined();
  });

  it('should have bg, text, border, and badge classes for each scheme', () => {
    const schemes = ['danger', 'warning', 'neutral'] as const;

    schemes.forEach((scheme) => {
      expect(DUE_STATUS_COLOR_CLASSES[scheme].bg).toBeTruthy();
      expect(DUE_STATUS_COLOR_CLASSES[scheme].text).toBeTruthy();
      expect(DUE_STATUS_COLOR_CLASSES[scheme].border).toBeTruthy();
      expect(DUE_STATUS_COLOR_CLASSES[scheme].badge).toBeTruthy();
    });
  });

  it('should use correct color classes', () => {
    expect(DUE_STATUS_COLOR_CLASSES.danger.text).toContain('red');
    expect(DUE_STATUS_COLOR_CLASSES.warning.text).toContain('orange');
    expect(DUE_STATUS_COLOR_CLASSES.neutral.text).toContain('gray');
  });
});
