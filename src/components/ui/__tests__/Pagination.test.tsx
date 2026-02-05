/**
 * Pagination Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../Pagination';

// Mock Icons
vi.mock('../Icons', () => ({
 ChevronRight: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'chevron-right' }),
 ChevronDown: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'chevron-down' })
}));

// Mock Button
vi.mock('../button', () => ({
 Button: ({ children, onClick, disabled, className, ...props }: React.ComponentProps<'button'>) =>
 React.createElement('button', { onClick, disabled, className, ...props }, children)
}));

describe('Pagination', () => {
 const mockOnPageChange = vi.fn();
 const mockOnItemsPerPageChange = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return null when totalItems is 0', () => {
 const { container } = render(
 <Pagination
 currentPage={1}
 totalItems={0}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 expect(container.firstChild).toBeNull();
 });

 it('should display correct item range', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 expect(screen.getByText(/1 à 20 sur 100/)).toBeInTheDocument();
 });

 it('should display correct item range for last page', () => {
 render(
 <Pagination
 currentPage={5}
 totalItems={95}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 expect(screen.getByText(/81 à 95 sur 95/)).toBeInTheDocument();
 });

 it('should call onPageChange when previous button is clicked', () => {
 render(
 <Pagination
 currentPage={3}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 fireEvent.click(screen.getByLabelText('Page précédente'));
 expect(mockOnPageChange).toHaveBeenCalledWith(2);
 });

 it('should call onPageChange when next button is clicked', () => {
 render(
 <Pagination
 currentPage={3}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 fireEvent.click(screen.getByLabelText('Page suivante'));
 expect(mockOnPageChange).toHaveBeenCalledWith(4);
 });

 it('should disable previous button on first page', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 expect(screen.getByLabelText('Page précédente')).toBeDisabled();
 });

 it('should disable next button on last page', () => {
 render(
 <Pagination
 currentPage={5}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 expect(screen.getByLabelText('Page suivante')).toBeDisabled();
 });

 it('should call onPageChange when clicking on a page number', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 fireEvent.click(screen.getByText('3'));
 expect(mockOnPageChange).toHaveBeenCalledWith(3);
 });

 it('should show items per page selector when showItemsPerPage is true', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 onItemsPerPageChange={mockOnItemsPerPageChange}
 showItemsPerPage={true}
 />
 );

 expect(screen.getByText('Afficher :')).toBeInTheDocument();
 expect(screen.getByRole('combobox')).toBeInTheDocument();
 });

 it('should call onItemsPerPageChange when select value changes', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 onItemsPerPageChange={mockOnItemsPerPageChange}
 showItemsPerPage={true}
 />
 );

 fireEvent.change(screen.getByRole('combobox'), { target: { value: '50' } });
 expect(mockOnItemsPerPageChange).toHaveBeenCalledWith(50);
 });

 it('should hide items per page selector when showItemsPerPage is false', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 showItemsPerPage={false}
 />
 );

 expect(screen.queryByText('Afficher:')).not.toBeInTheDocument();
 });

 it('should render ellipsis for large page ranges', () => {
 render(
 <Pagination
 currentPage={5}
 totalItems={200}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 // Should show ellipsis
 expect(screen.getAllByText('...').length).toBeGreaterThan(0);
 });

 it('should not render ellipsis for small page ranges', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={60}
 itemsPerPage={20}
 onPageChange={mockOnPageChange}
 />
 );

 // 3 pages total - no ellipsis needed
 expect(screen.queryByText('...')).not.toBeInTheDocument();
 });

 it('should use custom itemsPerPageOptions', () => {
 render(
 <Pagination
 currentPage={1}
 totalItems={100}
 itemsPerPage={10}
 onPageChange={mockOnPageChange}
 onItemsPerPageChange={mockOnItemsPerPageChange}
 itemsPerPageOptions={[10, 25, 50]}
 showItemsPerPage={true}
 />
 );

 const select = screen.getByRole('combobox');
 expect(select).toContainHTML('<option value="10">10</option>');
 expect(select).toContainHTML('<option value="25">25</option>');
 expect(select).toContainHTML('<option value="50">50</option>');
 });
});
