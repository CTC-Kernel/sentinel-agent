import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCriticalRisks } from '../useCriticalRisks';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 onSnapshot: vi.fn(),
}));

vi.mock('../../firebase', () => ({
 db: {},
}));

import { onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';

describe('useCriticalRisks', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return null count when tenantId is undefined', () => {
 const { result } = renderHook(() => useCriticalRisks(undefined));

 expect(result.current.count).toBeNull();
 expect(result.current.loading).toBe(false);
 });

 it('should set loading to true initially', () => {
 vi.mocked(onSnapshot).mockImplementation(() => () => { });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 expect(result.current.loading).toBe(true);
 });

 it('should return count from snapshot', async () => {
 const mockUnsubscribe = vi.fn();
 vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
 // Simulate snapshot with 3 risks: 2 are critical (score >= 15)
 const mockSnapshot = {
 size: 3,
 docs: [
 { data: () => ({ impact: 5, probability: 4 }) }, // score: 20 (critical)
 { data: () => ({ impact: 4, probability: 4 }) }, // score: 16 (critical)
 { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
 ]
 };
 (onNext as (snapshot: QuerySnapshot<DocumentData>) => void)(mockSnapshot as unknown as QuerySnapshot<DocumentData>);
 return mockUnsubscribe;
 });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.count).toBe(2); // 2 critical risks (scores 20 and 16 are >= 15)
 });

 it('should set initial trend to stable', async () => {
 vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
 const mockSnapshot = {
 size: 5,
 docs: [
 { data: () => ({ impact: 5, probability: 4 }) }, // score: 20 (critical)
 { data: () => ({ impact: 4, probability: 4 }) }, // score: 16 (critical)
 { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
 { data: () => ({ impact: 2, probability: 2 }) }, // score: 4 (not critical)
 { data: () => ({ impact: 1, probability: 1 }) }, // score: 1 (not critical)
 ]
 };
 (onNext as (snapshot: QuerySnapshot<DocumentData>) => void)(mockSnapshot as unknown as QuerySnapshot<DocumentData>);
 return () => { };
 });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.trend).toBe('stable');
 });

 it('should handle errors', async () => {
 const mockError = new Error('Test error');
 // Suppress expected error logging
 const originalError = console.error;
 vi.spyOn(console, 'error').mockImplementation((...args) => {
 if (args[0] === mockError || args[0]?.message === 'Test error') return;
 originalError(...args);
 });

 vi.mocked(onSnapshot).mockImplementation((_, __, onError) => {
 (onError as unknown as (error: Error) => void)(mockError);
 return () => { };
 });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.error).toBe(mockError);
 });

 it('should cleanup subscription on unmount', () => {
 const mockUnsubscribe = vi.fn();
 vi.mocked(onSnapshot).mockImplementation(() => mockUnsubscribe);

 const { unmount } = renderHook(() => useCriticalRisks('tenant-123'));

 unmount();

 expect(mockUnsubscribe).toHaveBeenCalled();
 });

 it('should provide refetch function', async () => {
 let callCount = 0;
 vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
 callCount++;
 const mockSnapshot = {
 size: callCount,
 docs: Array(callCount).fill(null).map(() => ({
 data: () => ({ impact: 5, probability: 4 }) // score: 20 (critical)
 }))
 };
 (onNext as (snapshot: QuerySnapshot<DocumentData>) => void)(mockSnapshot as unknown as QuerySnapshot<DocumentData>);
 return () => { };
 });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 await waitFor(() => {
 expect(result.current.count).toBe(1);
 });

 // Call refetch
 act(() => {
 result.current.refetch();
 });

 await waitFor(() => {
 expect(callCount).toBeGreaterThan(1);
 });
 });

 it('should return zero count when no critical risks', async () => {
 vi.mocked(onSnapshot).mockImplementation((_, onNext) => {
 const mockSnapshot = {
 size: 2,
 docs: [
 { data: () => ({ impact: 3, probability: 3 }) }, // score: 9 (not critical)
 { data: () => ({ impact: 2, probability: 2 }) }, // score: 4 (not critical)
 ]
 };
 (onNext as (snapshot: QuerySnapshot<DocumentData>) => void)(mockSnapshot as unknown as QuerySnapshot<DocumentData>);
 return () => { };
 });

 const { result } = renderHook(() => useCriticalRisks('tenant-123'));

 await waitFor(() => {
 expect(result.current.loading).toBe(false);
 });

 expect(result.current.count).toBe(0); // No critical risks (all scores < 15)
 });
});
