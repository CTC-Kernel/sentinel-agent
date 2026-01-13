/**
 * DatePicker Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from '../DatePicker';

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Calendar: (props: React.ComponentProps<'svg'>) => React.createElement('svg', { ...props, 'data-testid': 'calendar-icon' })
}));

// Mock Calendar component
vi.mock('../Calendar', () => ({
    Calendar: ({ onSelect, selected }: { onSelect: (date: Date | undefined) => void; selected?: Date }) =>
        React.createElement('div', { 'data-testid': 'calendar' },
            React.createElement('button', {
                'data-testid': 'select-date-btn',
                onClick: () => onSelect(new Date(2024, 0, 15))
            }, 'Select Jan 15, 2024'),
            React.createElement('button', {
                'data-testid': 'clear-date-btn',
                onClick: () => onSelect(undefined)
            }, 'Clear'),
            selected ? React.createElement('span', { 'data-testid': 'selected-date' }, selected.toISOString()) : null
        )
}));

describe('DatePicker', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with label', () => {
        render(
            <DatePicker
                label="Date de début"
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText('Date de début')).toBeInTheDocument();
    });

    it('should render with required indicator', () => {
        render(
            <DatePicker
                label="Date requise"
                onChange={mockOnChange}
                required={true}
            />
        );

        expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should open calendar when clicked', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByTestId('calendar')).toBeInTheDocument();
    });

    it('should close calendar when date is selected', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByTestId('select-date-btn'));

        expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
    });

    it('should call onChange with formatted date when date is selected', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByTestId('select-date-btn'));

        expect(mockOnChange).toHaveBeenCalledWith('2024-01-15');
    });

    it('should display formatted date when value is provided', () => {
        render(
            <DatePicker
                label="Date"
                value="2024-06-15"
                onChange={mockOnChange}
            />
        );

        // French locale format
        expect(screen.getByText(/15 juin 2024/)).toBeInTheDocument();
    });

    it('should show error message when error prop is provided', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
                error="Date invalide"
            />
        );

        expect(screen.getByText('Date invalide')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
                disabled={true}
            />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('should not open calendar when disabled', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
                disabled={true}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
    });

    it('should toggle calendar with keyboard', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
            />
        );

        const button = screen.getByRole('button');
        fireEvent.keyDown(button, { key: 'Enter' });
        expect(screen.getByTestId('calendar')).toBeInTheDocument();

        fireEvent.keyDown(button, { key: ' ' });
        expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
    });

    it('should show clear button when value is set', () => {
        render(
            <DatePicker
                label="Date"
                value="2024-06-15"
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Effacer la date')).toBeInTheDocument();
    });

    it('should call onChange with undefined when clear is clicked', () => {
        render(
            <DatePicker
                label="Date"
                value="2024-06-15"
                onChange={mockOnChange}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        fireEvent.click(screen.getByText('Effacer la date'));

        expect(mockOnChange).toHaveBeenCalledWith(undefined);
    });

    it('should apply custom className', () => {
        const { container } = render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
                className="custom-class"
            />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should close calendar when clicking outside', () => {
        render(
            <div>
                <DatePicker label="Date" onChange={mockOnChange} />
                <div data-testid="outside">Outside</div>
            </div>
        );

        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByTestId('calendar')).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
    });

    it('should display placeholder when no value', () => {
        render(
            <DatePicker
                label="Date"
                onChange={mockOnChange}
                placeholder="Choisir une date"
            />
        );

        // Open to see placeholder in open state
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Choisir une date')).toBeInTheDocument();
    });
});
