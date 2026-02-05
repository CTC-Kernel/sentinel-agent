/**
 * usePagination Hook Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../utils/usePagination';

describe('usePagination', () => {
 const createItems = (count: number) =>
 Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

 it('should return correct initial state', () => {
 const items = createItems(50);
 const { result } = renderHook(() => usePagination(items, 10));

 expect(result.current.currentPage).toBe(1);
 expect(result.current.itemsPerPage).toBe(10);
 expect(result.current.totalPages).toBe(5);
 expect(result.current.totalItems).toBe(50);
 });

 it('should return correct paginated items for page 1', () => {
 const items = createItems(25);
 const { result } = renderHook(() => usePagination(items, 10));

 expect(result.current.paginatedItems).toHaveLength(10);
 expect(result.current.paginatedItems[0].id).toBe(1);
 expect(result.current.paginatedItems[9].id).toBe(10);
 });

 it('should change page correctly', () => {
 const items = createItems(30);
 const { result } = renderHook(() => usePagination(items, 10));

 act(() => {
 result.current.setCurrentPage(2);
 });

 expect(result.current.currentPage).toBe(2);
 expect(result.current.paginatedItems[0].id).toBe(11);
 expect(result.current.paginatedItems[9].id).toBe(20);
 });

 it('should handle last page with fewer items', () => {
 const items = createItems(25);
 const { result } = renderHook(() => usePagination(items, 10));

 act(() => {
 result.current.setCurrentPage(3);
 });

 expect(result.current.currentPage).toBe(3);
 expect(result.current.paginatedItems).toHaveLength(5);
 expect(result.current.paginatedItems[0].id).toBe(21);
 expect(result.current.paginatedItems[4].id).toBe(25);
 });

 it('should change items per page correctly', () => {
 const items = createItems(50);
 const { result } = renderHook(() => usePagination(items, 10));

 expect(result.current.totalPages).toBe(5);

 act(() => {
 result.current.setItemsPerPage(25);
 });

 expect(result.current.itemsPerPage).toBe(25);
 expect(result.current.totalPages).toBe(2);
 expect(result.current.paginatedItems).toHaveLength(25);
 });

 it('should reset to page 1 when current page exceeds total pages', () => {
 const items = createItems(50);
 const { result, rerender } = renderHook(
 ({ items, perPage }) => usePagination(items, perPage),
 { initialProps: { items, perPage: 10 } }
 );

 // Go to page 5
 act(() => {
 result.current.setCurrentPage(5);
 });
 expect(result.current.currentPage).toBe(5);

 // Reduce items so page 5 doesn't exist
 const fewerItems = createItems(20);
 rerender({ items: fewerItems, perPage: 10 });

 // Should reset to page 1
 expect(result.current.currentPage).toBe(1);
 });

 it('should handle empty items array', () => {
 const { result } = renderHook(() => usePagination([], 10));

 expect(result.current.currentPage).toBe(1);
 expect(result.current.totalPages).toBe(0);
 expect(result.current.totalItems).toBe(0);
 expect(result.current.paginatedItems).toEqual([]);
 });

 it('should handle items less than per page', () => {
 const items = createItems(5);
 const { result } = renderHook(() => usePagination(items, 10));

 expect(result.current.totalPages).toBe(1);
 expect(result.current.paginatedItems).toHaveLength(5);
 });

 it('should use default items per page of 20', () => {
 const items = createItems(50);
 const { result } = renderHook(() => usePagination(items));

 expect(result.current.itemsPerPage).toBe(20);
 expect(result.current.totalPages).toBe(3);
 });

 it('should work with string items', () => {
 const items = ['a', 'b', 'c', 'd', 'e'];
 const { result } = renderHook(() => usePagination(items, 2));

 expect(result.current.paginatedItems).toEqual(['a', 'b']);

 act(() => {
 result.current.setCurrentPage(2);
 });

 expect(result.current.paginatedItems).toEqual(['c', 'd']);
 });

 it('should update when items array changes', () => {
 const { result, rerender } = renderHook(
 ({ items }) => usePagination(items, 10),
 { initialProps: { items: createItems(20) } }
 );

 expect(result.current.totalItems).toBe(20);

 rerender({ items: createItems(30) });

 expect(result.current.totalItems).toBe(30);
 expect(result.current.totalPages).toBe(3);
 });
});
