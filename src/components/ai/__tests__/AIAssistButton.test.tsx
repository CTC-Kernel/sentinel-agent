/**
 * Unit tests for AIAssistButton component
 * Tests AI suggestion button functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIAssistButton } from '../AIAssistButton';

// Mock aiService
const mockChatWithAI = vi.fn();
const mockSuggestField = vi.fn();
vi.mock('../../../services/aiService', () => ({
 aiService: {
 chatWithAI: (...args: unknown[]) => mockChatWithAI(...args),
 suggestField: (...args: unknown[]) => mockSuggestField(...args)
 }
}));

// Mock store
const mockAddToast = vi.fn();
vi.mock('../../../store', () => ({
 useStore: () => ({
 addToast: mockAddToast,
 t: (key: string, options?: Record<string, unknown>) => {
 if (options && 'defaultValue' in options) {
 return (options as { defaultValue?: string }).defaultValue || key;
 }
 return key;
 }
 })
}));

// Mock ErrorLogger
vi.mock('../../../services/errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

describe('AIAssistButton', () => {
 const defaultProps = {
 context: { name: 'Test Risk', severity: 'Medium' },
 fieldName: 'description',
 onSuggest: vi.fn()
 };

 beforeEach(() => {
 vi.clearAllMocks();
 mockSuggestField.mockResolvedValue({ value: 'AI generated suggestion' });
 mockChatWithAI.mockResolvedValue('AI chat response');
 });

 describe('rendering', () => {
 it('renders button', () => {
 render(<AIAssistButton {...defaultProps} />);

 expect(screen.getByRole('button')).toBeInTheDocument();
 });

 it('renders with default tooltip', () => {
 render(<AIAssistButton {...defaultProps} />);

 expect(screen.getByTitle("Suggérer avec l'IA")).toBeInTheDocument();
 });

 it('renders with custom tooltip', () => {
 render(<AIAssistButton {...defaultProps} tooltip="Custom tooltip" />);

 expect(screen.getByTitle('Custom tooltip')).toBeInTheDocument();
 });

 it('applies custom className', () => {
 const { container } = render(<AIAssistButton {...defaultProps} className="custom-class" />);

 expect(container.querySelector('.custom-class')).toBeInTheDocument();
 });
 });

 describe('suggest field (default)', () => {
 it('calls suggestField when clicked', async () => {
 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(mockSuggestField).toHaveBeenCalledWith(defaultProps.context, 'description');
 });
 });

 it('calls onSuggest with result', async () => {
 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(defaultProps.onSuggest).toHaveBeenCalledWith('AI generated suggestion');
 });
 });

 it('shows success toast', async () => {
 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(mockAddToast).toHaveBeenCalledWith('Suggestion appliquée !', 'success');
 });
 });
 });

 describe('with custom prompt', () => {
 it('calls chatWithAI when prompt provided', async () => {
 render(<AIAssistButton {...defaultProps} prompt="Generate a description" />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(mockChatWithAI).toHaveBeenCalled();
 });
 });

 it('includes context in prompt', async () => {
 render(<AIAssistButton {...defaultProps} prompt="Generate a description" />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 const call = mockChatWithAI.mock.calls[0][0];
 expect(call).toContain('Generate a description');
 expect(call).toContain('Test Risk');
 });
 });
 });

 describe('loading state', () => {
 it('shows loading indicator during request', async () => {
 mockSuggestField.mockImplementation(() => new Promise(() => {})); // Never resolves

 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(screen.getByRole('button')).toBeDisabled();
 });
 });

 it('disables button during loading', async () => {
 mockSuggestField.mockImplementation(() => new Promise(() => {}));

 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(screen.getByRole('button')).toHaveAttribute('disabled');
 });
 });
 });

 describe('error handling', () => {
 it('shows error toast on failure', async () => {
 mockSuggestField.mockRejectedValue(new Error('API Error'));

 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(mockAddToast).toHaveBeenCalledWith('Erreur lors de la génération.', 'error');
 });
 });
 });

 describe('empty response', () => {
 it('shows info toast for empty suggestion', async () => {
 mockSuggestField.mockResolvedValue({ value: '' });

 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(mockAddToast).toHaveBeenCalledWith("Je n'ai pas trouvé de suggestion pertinente.", 'info');
 });
 });

 it('does not call onSuggest for empty result', async () => {
 mockSuggestField.mockResolvedValue({ value: '' });

 render(<AIAssistButton {...defaultProps} />);

 fireEvent.click(screen.getByRole('button'));

 await waitFor(() => {
 expect(defaultProps.onSuggest).not.toHaveBeenCalled();
 });
 });
 });
});
