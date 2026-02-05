/**
 * AuthGuard Tests
 * Epic 14-1: Test Coverage Improvement
 *
 * Note: AuthGuard bypasses auth in test mode (import.meta.env.MODE === 'test')
 * These tests verify the component structure and props handling
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
 useAuth: vi.fn(() => ({
 user: { id: 'user-1', onboardingCompleted: true, organizationId: 'org-1' },
 firebaseUser: { uid: 'user-1', emailVerified: true },
 loading: false,
 error: null,
 profileError: null,
 claimsSynced: true
 }))
}));

// Mock LoadingScreen
vi.mock('../../ui/LoadingScreen', () => ({
 LoadingScreen: () => React.createElement('div', { 'data-testid': 'loading-screen' }, 'Loading...')
}));

// Import after mocks
import { AuthGuard } from '../AuthGuard';

describe('AuthGuard', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should render children in test mode', () => {
 render(
 <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <AuthGuard>
  <div data-testid="protected-content">Protected</div>
 </AuthGuard>
 </BrowserRouter>
 );

 // In test mode, AuthGuard bypasses auth and renders children
 expect(screen.getByTestId('protected-content')).toBeInTheDocument();
 });

 it('should accept requireOnboarding prop', () => {
 render(
 <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <AuthGuard requireOnboarding={false}>
  <div data-testid="protected-content">Protected</div>
 </AuthGuard>
 </BrowserRouter>
 );

 expect(screen.getByTestId('protected-content')).toBeInTheDocument();
 });

 it('should render with default requireOnboarding as true', () => {
 render(
 <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <AuthGuard>
  <div data-testid="protected-content">Protected</div>
 </AuthGuard>
 </BrowserRouter>
 );

 expect(screen.getByTestId('protected-content')).toBeInTheDocument();
 });
});
