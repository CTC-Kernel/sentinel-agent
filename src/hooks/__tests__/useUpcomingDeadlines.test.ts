import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
 useUpcomingDeadlines,
 getUrgencyColorScheme,
 URGENCY_COLOR_CLASSES,
 getTimelineItemTypeLabel,
} from '../useUpcomingDeadlines';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

const mockDueSoonDate = new Date();
mockDueSoonDate.setDate(mockDueSoonDate.getDate() + 3); // 3 days from now

const mockFutureDate = new Date();
mockFutureDate.setDate(mockFutureDate.getDate() + 14); // 14 days from now

const mockOverdueDate = new Date();
mockOverdueDate.setDate(mockOverdueDate.getDate() - 2); // 2 days ago

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
 title: 'Action urgente',
 description: 'Description action 1',
 type: 'action',
 status: 'pending',
 dueDate: mockDueSoonDate.toISOString(),
 }),
 },
 {
 id: 'action-2',
 data: () => ({
 title: 'Action planifiee',
 type: 'action',
 status: 'in_progress',
 dueDate: mockFutureDate.toISOString(),
 }),
 },
 {
 id: 'action-3',
 data: () => ({
 title: 'Action en retard',
 type: 'action',
 status: 'pending',
 dueDate: mockOverdueDate.toISOString(),
 }),
 },
 ],
 size: 3,
 });
 return vi.fn(); // Return unsubscribe function
 }),
}));

describe('useUpcomingDeadlines', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return empty data when no tenantId', () => {
 const { result } = renderHook(() => useUpcomingDeadlines(undefined));

 expect(result.current.items).toEqual([]);
 expect(result.current.count).toBe(0);
 expect(result.current.loading).toBe(false);
 });

 it('should return items with correct structure', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.items.length).toBeGreaterThan(0);
 expect(result.current.items[0]).toHaveProperty('id');
 expect(result.current.items[0]).toHaveProperty('title');
 expect(result.current.items[0]).toHaveProperty('dueDate');
 expect(result.current.items[0]).toHaveProperty('daysUntilDue');
 expect(result.current.items[0]).toHaveProperty('isOverdue');
 expect(result.current.items[0]).toHaveProperty('isDueSoon');
 });

 it('should calculate overdue status correctly', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 const overdueItem = result.current.items.find((item) => item.id === 'action-3');
 expect(overdueItem?.isOverdue).toBe(true);
 });

 it('should calculate due soon status correctly', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 const dueSoonItem = result.current.items.find((item) => item.id === 'action-1');
 expect(dueSoonItem?.isDueSoon).toBe(true);
 expect(dueSoonItem?.isOverdue).toBe(false);
 });

 it('should sort with overdue items first', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.items[0].isOverdue).toBe(true);
 });

 it('should have refetch function', () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 expect(typeof result.current.refetch).toBe('function');
 });

 it('should return count and dueSoonCount', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.count).toBeGreaterThan(0);
 expect(typeof result.current.dueSoonCount).toBe('number');
 });

 it('should respect maxItems parameter', async () => {
 const { result } = renderHook(() => useUpcomingDeadlines('tenant-123', 30, 2));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.items.length).toBeLessThanOrEqual(2);
 });
});

describe('getUrgencyColorScheme', () => {
 it('should return danger for overdue items', () => {
 expect(getUrgencyColorScheme(-1, true)).toBe('danger');
 expect(getUrgencyColorScheme(-5, true)).toBe('danger');
 });

 it('should return warning for items due within 7 days', () => {
 expect(getUrgencyColorScheme(3, false)).toBe('warning');
 expect(getUrgencyColorScheme(7, false)).toBe('warning');
 });

 it('should return normal for items due in more than 7 days', () => {
 expect(getUrgencyColorScheme(8, false)).toBe('normal');
 expect(getUrgencyColorScheme(30, false)).toBe('normal');
 });
});

describe('URGENCY_COLOR_CLASSES', () => {
 it('should have all color schemes defined', () => {
 expect(URGENCY_COLOR_CLASSES.danger).toBeDefined();
 expect(URGENCY_COLOR_CLASSES.warning).toBeDefined();
 expect(URGENCY_COLOR_CLASSES.normal).toBeDefined();
 });

 it('should have bg, text, border, badge, and dot classes for each scheme', () => {
 const schemes = ['danger', 'warning', 'normal'] as const;

 schemes.forEach((scheme) => {
 expect(URGENCY_COLOR_CLASSES[scheme].bg).toBeTruthy();
 expect(URGENCY_COLOR_CLASSES[scheme].text).toBeTruthy();
 expect(URGENCY_COLOR_CLASSES[scheme].border).toBeTruthy();
 expect(URGENCY_COLOR_CLASSES[scheme].badge).toBeTruthy();
 expect(URGENCY_COLOR_CLASSES[scheme].dot).toBeTruthy();
 });
 });

 it('should use correct color classes', () => {
 expect(URGENCY_COLOR_CLASSES.danger.text).toContain('red');
 expect(URGENCY_COLOR_CLASSES.warning.text).toContain('orange');
 expect(URGENCY_COLOR_CLASSES.normal.text).toContain('blue');
 });
});

describe('getTimelineItemTypeLabel', () => {
 it('should return correct labels for each type', () => {
 expect(getTimelineItemTypeLabel('action')).toBe('Action');
 expect(getTimelineItemTypeLabel('milestone')).toBe('Milestone');
 expect(getTimelineItemTypeLabel('audit')).toBe('Audit');
 expect(getTimelineItemTypeLabel('document')).toBe('Document');
 });

 it('should return Item for unknown types', () => {
 // Test with invalid type cast via unknown to avoid explicit any
 expect(getTimelineItemTypeLabel('unknown' as unknown as Parameters<typeof getTimelineItemTypeLabel>[0])).toBe('Item');
 });
});
