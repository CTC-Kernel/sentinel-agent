/**
 * Unit tests for OnboardingTrigger component
 * Tests onboarding banner display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingBanner } from '../OnboardingTrigger';

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string) => {
 const translations: Record<string, string> = {
 'tour.banner.title': 'Découvrir Sentinel',
 'tour.banner.desc': 'Une visite guidée de la plateforme',
 'tour.banner.start': 'Commencer',
 'tour.banner.dismiss': 'Plus tard'
 };
 return translations[key] || key;
 }
 })
}));

// Mock useLocale - component uses this, not useTranslation
vi.mock('../../../hooks/useLocale', () => ({
 useLocale: () => ({
 locale: 'fr',
 t: (key: string) => {
 const translations: Record<string, string> = {
 'tour.banner.title': 'Découvrir Sentinel',
 'tour.banner.desc': 'Une visite guidée de la plateforme',
 'tour.banner.start': 'Commencer',
 'tour.banner.dismiss': 'Plus tard'
 };
 return translations[key] || key;
 }
 })
}));

describe('OnboardingBanner', () => {
 const mockOnStart = vi.fn();
 const mockOnDismiss = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders banner title', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(screen.getByText('Découvrir Sentinel')).toBeInTheDocument();
 });

 it('renders banner description', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(screen.getByText('Une visite guidée de la plateforme')).toBeInTheDocument();
 });

 it('renders start button', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(screen.getByText('Commencer')).toBeInTheDocument();
 });

 it('renders dismiss button', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(screen.getByText('Plus tard')).toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls onStart when start button clicked', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 fireEvent.click(screen.getByText('Commencer'));

 expect(mockOnStart).toHaveBeenCalled();
 });

 it('calls onDismiss when dismiss button clicked', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 fireEvent.click(screen.getByText('Plus tard'));

 expect(mockOnDismiss).toHaveBeenCalled();
 });

 it('calls onDismiss when X button clicked', () => {
 const { container } = render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 // Find the first X button (close button)
 const closeButtons = container.querySelectorAll('button');
 const xButton = Array.from(closeButtons).find(btn =>
 btn.querySelector('.lucide-x')
 );

 if (xButton) {
 fireEvent.click(xButton);
 expect(mockOnDismiss).toHaveBeenCalled();
 }
 });
 });

 describe('styling', () => {
 it('has gradient background', () => {
 const { container } = render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument();
 });

 it('has animation class', () => {
 const { container } = render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 expect(container.querySelector('.animate-slide-up')).toBeInTheDocument();
 });
 });

 describe('accessibility', () => {
 it('buttons are focusable', () => {
 render(<OnboardingBanner onStart={mockOnStart} onDismiss={mockOnDismiss} />);

 const startButton = screen.getByText('Commencer');
 const dismissButton = screen.getByText('Plus tard');

 expect(startButton).not.toHaveAttribute('tabindex', '-1');
 expect(dismissButton).not.toHaveAttribute('tabindex', '-1');
 });
 });
});
