import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
 useOverdueActions,
 getOverdueSeverityColorScheme,
 OVERDUE_SEVERITY_COLOR_CLASSES,
} from '../useOverdueActions';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

const mockOverdue3Days = new Date();
mockOverdue3Days.setDate(mockOverdue3Days.getDate() - 3);

const mockOverdue7Days = new Date();
mockOverdue7Days.setDate(mockOverdue7Days.getDate() - 7);

const mockOverdue14Days = new Date();
mockOverdue14Days.setDate(mockOverdue14Days.getDate() - 14);

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 orderBy: vi.fn(),
 limit: vi.fn(),
 onSnapshot: vi.fn((_q, onSuccess) => {
 onSuccess({
 docs: [
 {
 id: 'action-1',
 data: () => ({
 title: 'Action en retard 3 jours',
 description: 'Description action 1',
 status: 'pending',
 dueDate: mockOverdue3Days.toISOString(),
 assigneeName: 'Jean Dupont',
 }),
 },
 {
 id: 'action-2',
 data: () => ({
 title: 'Action en retard 7 jours',
 status: 'pending',
 dueDate: mockOverdue7Days.toISOString(),
 }),
 },
 {
 id: 'action-3',
 data: () => ({
 title: 'Action en retard 14 jours',
 status: 'in_progress',
 dueDate: mockOverdue14Days.toISOString(),
 assigneeName: 'Marie Martin',
 }),
 },
 ],
 size: 3,
 });
 return vi.fn(); // Return unsubscribe function
 }),
}));

describe('useOverdueActions', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return empty data when no tenantId', () => {
 const { result } = renderHook(() => useOverdueActions(undefined));

 expect(result.current.actions).toEqual([]);
 expect(result.current.count).toBe(0);
 expect(result.current.loading).toBe(false);
 });

 it('should return actions with correct structure', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.actions.length).toBeGreaterThan(0);
 expect(result.current.actions[0]).toHaveProperty('id');
 expect(result.current.actions[0]).toHaveProperty('title');
 expect(result.current.actions[0]).toHaveProperty('dueDate');
 expect(result.current.actions[0]).toHaveProperty('daysOverdue');
 expect(result.current.actions[0]).toHaveProperty('status');
 });

 it('should calculate daysOverdue correctly', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 const action3Days = result.current.actions.find((a) => a.id === 'action-1');
 expect(action3Days?.daysOverdue).toBeGreaterThanOrEqual(3);
 });

 it('should include assigneeName when present', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 const actionWithAssignee = result.current.actions.find((a) => a.id === 'action-1');
 expect(actionWithAssignee?.assigneeName).toBe('Jean Dupont');
 });

 it('should sort by days overdue (most overdue first)', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 // First action should have the most days overdue
 expect(result.current.actions[0].daysOverdue).toBeGreaterThanOrEqual(
 result.current.actions[result.current.actions.length - 1].daysOverdue
 );
 });

 it('should have refetch function', () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 expect(typeof result.current.refetch).toBe('function');
 });

 it('should return correct count', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.count).toBe(3);
 });

 it('should respect maxItems parameter', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123', 2));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.actions.length).toBeLessThanOrEqual(2);
 });

 it('should return no error on successful load', async () => {
 const { result } = renderHook(() => useOverdueActions('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.error).toBeNull();
 });
});

describe('getOverdueSeverityColorScheme', () => {
 it('should return critical for 14+ days overdue', () => {
 expect(getOverdueSeverityColorScheme(14)).toBe('critical');
 expect(getOverdueSeverityColorScheme(21)).toBe('critical');
 expect(getOverdueSeverityColorScheme(30)).toBe('critical');
 });

 it('should return high for 7-13 days overdue', () => {
 expect(getOverdueSeverityColorScheme(7)).toBe('high');
 expect(getOverdueSeverityColorScheme(10)).toBe('high');
 expect(getOverdueSeverityColorScheme(13)).toBe('high');
 });

 it('should return medium for less than 7 days overdue', () => {
 expect(getOverdueSeverityColorScheme(1)).toBe('medium');
 expect(getOverdueSeverityColorScheme(3)).toBe('medium');
 expect(getOverdueSeverityColorScheme(6)).toBe('medium');
 });
});

describe('OVERDUE_SEVERITY_COLOR_CLASSES', () => {
 it('should have all severity levels defined', () => {
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.critical).toBeDefined();
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.high).toBeDefined();
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.medium).toBeDefined();
 });

 it('should have bg, text, border, and badge classes for each level', () => {
 const levels = ['critical', 'high', 'medium'] as const;

 levels.forEach((level) => {
 expect(OVERDUE_SEVERITY_COLOR_CLASSES[level].bg).toBeTruthy();
 expect(OVERDUE_SEVERITY_COLOR_CLASSES[level].text).toBeTruthy();
 expect(OVERDUE_SEVERITY_COLOR_CLASSES[level].border).toBeTruthy();
 expect(OVERDUE_SEVERITY_COLOR_CLASSES[level].badge).toBeTruthy();
 });
 });

 it('should use correct color classes for severity', () => {
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.critical.text).toContain('red');
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.high.text).toContain('red');
 expect(OVERDUE_SEVERITY_COLOR_CLASSES.medium.text).toContain('orange');
 });
});
