/**
 * Unit tests for SeveritySelector component
 * Tests severity selection UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeveritySelector } from '../SeveritySelector';

describe('SeveritySelector', () => {
 const mockOnChange = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders with default label', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 expect(screen.getByText('Sévérité')).toBeInTheDocument();
 });

 it('renders with custom label', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} label="Custom Label" />);

 expect(screen.getByText('Custom Label')).toBeInTheDocument();
 });

 it('renders all severity options', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 expect(screen.getByText('Majeure')).toBeInTheDocument();
 expect(screen.getByText('Mineure')).toBeInTheDocument();
 expect(screen.getByText('Observation')).toBeInTheDocument();
 expect(screen.getByText('Opportunité')).toBeInTheDocument();
 });

 it('renders four buttons', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 expect(buttons).toHaveLength(4);
 });
 });

 describe('selection', () => {
 it('calls onChange when Majeure is clicked', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 fireEvent.click(screen.getByText('Majeure'));

 expect(mockOnChange).toHaveBeenCalledWith('Majeure');
 });

 it('calls onChange when Mineure is clicked', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 fireEvent.click(screen.getByText('Mineure'));

 expect(mockOnChange).toHaveBeenCalledWith('Mineure');
 });

 it('calls onChange when Observation is clicked', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 fireEvent.click(screen.getByText('Observation'));

 expect(mockOnChange).toHaveBeenCalledWith('Observation');
 });

 it('calls onChange when Opportunité is clicked', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 fireEvent.click(screen.getByText('Opportunité'));

 expect(mockOnChange).toHaveBeenCalledWith('Opportunité');
 });
 });

 describe('selected state', () => {
 it('shows Majeure as selected when value is Majeure', () => {
 render(<SeveritySelector value="Majeure" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 const majeureButton = buttons.find(b => b.textContent?.includes('Majeure'));
 expect(majeureButton).toHaveClass('scale-105');
 });

 it('shows Mineure as selected when value is Mineure', () => {
 render(<SeveritySelector value="Mineure" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 const mineureButton = buttons.find(b => b.textContent?.includes('Mineure'));
 expect(mineureButton).toHaveClass('scale-105');
 });

 it('shows Observation as selected when value is Observation', () => {
 render(<SeveritySelector value="Observation" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 const observationButton = buttons.find(b => b.textContent?.includes('Observation'));
 expect(observationButton).toHaveClass('scale-105');
 });

 it('shows Opportunité as selected when value is Opportunité', () => {
 render(<SeveritySelector value="Opportunité" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 const opportuniteButton = buttons.find(b => b.textContent?.includes('Opportunité'));
 expect(opportuniteButton).toHaveClass('scale-105');
 });
 });

 describe('accessibility', () => {
 it('all buttons have type="button"', () => {
 render(<SeveritySelector value="" onChange={mockOnChange} />);

 const buttons = screen.getAllByRole('button');
 buttons.forEach(button => {
 expect(button).toHaveAttribute('type', 'button');
 });
 });
 });
});
