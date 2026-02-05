import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectProgress, getProgressColorScheme, PROGRESS_COLOR_CLASSES } from '../useProjectProgress';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 limit: vi.fn(),
 getDocs: vi.fn(() =>
 Promise.resolve({
 docs: [
 {
 id: 'control-1',
 data: () => ({
 status: 'done',
 isCompliant: true,
 }),
 },
 {
 id: 'control-2',
 data: () => ({
 status: 'pending',
 isCompliant: false,
 }),
 },
 {
 id: 'control-3',
 data: () => ({
 status: 'completed',
 isCompliant: true,
 }),
 },
 ],
 size: 3,
 })
 ),
 onSnapshot: vi.fn((_q, _onSuccess) => {
 return vi.fn(); // Return unsubscribe function
 }),
}));

describe('useProjectProgress', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 // Suppress "act" warnings for this hook test as it involves async state updates
 const originalError = console.error;
 vi.spyOn(console, 'error').mockImplementation((...args) => {
 if (args[0]?.toString().includes('wrapped in act')) return;
 originalError(...args);
 });
 });

 it('should return default progress when no tenantId', async () => {
 const { result } = renderHook(() => useProjectProgress(undefined));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.progress.overall).toBe(0);
 expect(result.current.progress.controls.total).toBe(0);
 });

 it('should return progress data structure', async () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.progress).toHaveProperty('overall');
 expect(result.current.progress).toHaveProperty('controls');
 expect(result.current.progress).toHaveProperty('documents');
 expect(result.current.progress).toHaveProperty('actions');
 expect(result.current.progress).toHaveProperty('milestones');
 });

 it('should have category progress structure', async () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 const categoryProgress = result.current.progress.controls;
 expect(categoryProgress).toHaveProperty('completed');
 expect(categoryProgress).toHaveProperty('total');
 expect(categoryProgress).toHaveProperty('percentage');
 });

 it('should have refetch function', () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 expect(typeof result.current.refetch).toBe('function');
 });

 it('should have trend defined after initial load', async () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.trend).toBeDefined();
 });

 it('should return null previousOverall initially', () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 expect(result.current.previousOverall).toBeNull();
 });

 it('should return no error on successful load', async () => {
 const { result } = renderHook(() => useProjectProgress('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.error).toBeNull();
 });
});

describe('getProgressColorScheme', () => {
 it('should return excellent for 80% or higher', () => {
 expect(getProgressColorScheme(80)).toBe('excellent');
 expect(getProgressColorScheme(90)).toBe('excellent');
 expect(getProgressColorScheme(100)).toBe('excellent');
 });

 it('should return good for 60-79%', () => {
 expect(getProgressColorScheme(60)).toBe('good');
 expect(getProgressColorScheme(70)).toBe('good');
 expect(getProgressColorScheme(79)).toBe('good');
 });

 it('should return warning for 40-59%', () => {
 expect(getProgressColorScheme(40)).toBe('warning');
 expect(getProgressColorScheme(50)).toBe('warning');
 expect(getProgressColorScheme(59)).toBe('warning');
 });

 it('should return critical for below 40%', () => {
 expect(getProgressColorScheme(0)).toBe('critical');
 expect(getProgressColorScheme(20)).toBe('critical');
 expect(getProgressColorScheme(39)).toBe('critical');
 });
});

describe('PROGRESS_COLOR_CLASSES', () => {
 it('should have all color schemes defined', () => {
 expect(PROGRESS_COLOR_CLASSES.excellent).toBeDefined();
 expect(PROGRESS_COLOR_CLASSES.good).toBeDefined();
 expect(PROGRESS_COLOR_CLASSES.warning).toBeDefined();
 expect(PROGRESS_COLOR_CLASSES.critical).toBeDefined();
 });

 it('should have bg, bgLight, text, and border classes for each scheme', () => {
 const schemes = ['excellent', 'good', 'warning', 'critical'] as const;

 schemes.forEach((scheme) => {
 expect(PROGRESS_COLOR_CLASSES[scheme].bg).toBeTruthy();
 expect(PROGRESS_COLOR_CLASSES[scheme].bgLight).toBeTruthy();
 expect(PROGRESS_COLOR_CLASSES[scheme].text).toBeTruthy();
 expect(PROGRESS_COLOR_CLASSES[scheme].border).toBeTruthy();
 });
 });

 it('should use correct color classes', () => {
 expect(PROGRESS_COLOR_CLASSES.excellent.text).toContain('green');
 expect(PROGRESS_COLOR_CLASSES.good.text).toContain('blue');
 expect(PROGRESS_COLOR_CLASSES.warning.text).toContain('orange');
 expect(PROGRESS_COLOR_CLASSES.critical.text).toContain('red');
 });
});
