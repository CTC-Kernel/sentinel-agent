/**
 * ContentBlockerError Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentBlockerError } from '../ContentBlockerError';

// Mock useAuth hook
const mockDismissBlockerError = vi.fn();
vi.mock('../../../hooks/useAuth', () => ({
 useAuth: () => ({
 dismissBlockerError: mockDismissBlockerError
 })
}));

// Mock lucide-react with importOriginal to include all exports
vi.mock('lucide-react', async (importOriginal) => {
 const actual = await importOriginal<typeof import('lucide-react')>();
 return {
 ...actual,
 ShieldAlert: (props: React.ComponentProps<'svg'>) =>
 React.createElement('svg', { ...props, 'data-testid': 'shield-alert-icon' }),
 RefreshCw: (props: React.ComponentProps<'svg'>) =>
 React.createElement('svg', { ...props, 'data-testid': 'refresh-icon' }),
 AlertTriangle: (props: React.ComponentProps<'svg'>) =>
 React.createElement('svg', { ...props, 'data-testid': 'alert-triangle-icon' })
 };
});

describe('ContentBlockerError', () => {
 let originalLocation: Location;

 beforeEach(() => {
 vi.clearAllMocks();
 originalLocation = window.location;
 Object.defineProperty(window, 'location', {
 value: { reload: vi.fn() },
 writable: true
 });
 });

 afterEach(() => {
 Object.defineProperty(window, 'location', {
 value: originalLocation,
 writable: true
 });
 });

 it('should render error message', () => {
 render(<ContentBlockerError />);

 expect(screen.getByText('Connexion Interrompue')).toBeInTheDocument();
 });

 it('should render shield alert icon', () => {
 render(<ContentBlockerError />);

 expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
 });

 it('should show description about blocked services', () => {
 render(<ContentBlockerError />);

 expect(screen.getByText(/services de sécurité.*bloqués/)).toBeInTheDocument();
 });

 it('should show solutions section', () => {
 render(<ContentBlockerError />);

 expect(screen.getByText('Solutions possibles :')).toBeInTheDocument();
 expect(screen.getByText(/Désactivez votre bloqueur de publicité/)).toBeInTheDocument();
 expect(screen.getByText(/Vérifiez votre connexion internet/)).toBeInTheDocument();
 expect(screen.getByText(/Rechargez la page/)).toBeInTheDocument();
 });

 it('should show error code', () => {
 render(<ContentBlockerError />);

 expect(screen.getByText(/AUTH_BLOCKED_BY_CLIENT/)).toBeInTheDocument();
 });

 it('should have reload page button', () => {
 render(<ContentBlockerError />);

 const reloadButton = screen.getByRole('button', { name: /Recharger la page/i });
 expect(reloadButton).toBeInTheDocument();
 expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
 });

 it('should reload page when reload button is clicked', () => {
 render(<ContentBlockerError />);

 const reloadButton = screen.getByRole('button', { name: /Recharger la page/i });
 fireEvent.click(reloadButton);

 expect(window.location.reload).toHaveBeenCalled();
 });

 it('should have dismiss button', () => {
 render(<ContentBlockerError />);

 const dismissButton = screen.getByRole('button', { name: /Ignorer et continuer/i });
 expect(dismissButton).toBeInTheDocument();
 expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
 });

 it('should call dismissBlockerError when dismiss button is clicked', () => {
 render(<ContentBlockerError />);

 const dismissButton = screen.getByRole('button', { name: /Ignorer et continuer/i });
 fireEvent.click(dismissButton);

 expect(mockDismissBlockerError).toHaveBeenCalled();
 });

 it('should indicate risk in dismiss button text', () => {
 render(<ContentBlockerError />);

 expect(screen.getByText(/Risqué/)).toBeInTheDocument();
 });

 it('should have proper heading hierarchy', () => {
 render(<ContentBlockerError />);

 expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connexion Interrompue');
 expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Solutions possibles');
 });
});
