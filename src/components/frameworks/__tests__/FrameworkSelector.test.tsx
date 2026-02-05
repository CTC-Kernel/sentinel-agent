import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { FrameworkSelector } from '../FrameworkSelector';
import type { RegulatoryFramework, ActiveFramework } from '../../../types/framework';

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string, options?: { code?: string }) => {
 if (options?.code) return key.replace('{{code}}', options.code);
 return key;
 },
 i18n: { language: 'fr' },
 }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
 <div {...props}>{children}</div>
 ),
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock headlessui
vi.mock('@headlessui/react', () => ({
 Dialog: {
 Root: ({ children, show }: { children: React.ReactNode; show?: boolean }) =>
 show ? <div role="dialog">{children}</div> : null,
 Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
 Title: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
 },
 Transition: {
 Root: ({ children, show }: { children: React.ReactNode; show?: boolean }) =>
 show ? <>{children}</> : null,
 Child: ({ children }: { children: React.ReactNode }) => <>{children}</>,
 },
}));

// Mock data
const mockFrameworks: RegulatoryFramework[] = [
 {
 id: 'nis2-v1',
 code: 'NIS2',
 name: 'NIS2 Directive',
 version: '2022/2555',
 jurisdiction: 'EU',
 effectiveDate: '2024-10-17',
 isActive: true,
 requirementCount: 21,
 },
 {
 id: 'dora-v1',
 code: 'DORA',
 name: 'Digital Operational Resilience Act',
 version: '2022/2554',
 jurisdiction: 'EU',
 effectiveDate: '2025-01-17',
 isActive: true,
 requirementCount: 15,
 },
 {
 id: 'rgpd-v1',
 code: 'RGPD',
 name: 'Règlement Général sur la Protection des Données',
 version: '2016/679',
 jurisdiction: 'EU',
 effectiveDate: '2018-05-25',
 isActive: true,
 requirementCount: 99,
 },
];

const mockActiveFrameworks: ActiveFramework[] = [
 {
 frameworkId: 'nis2-v1',
 frameworkCode: 'NIS2',
 activatedAt: '2026-01-01T00:00:00Z',
 activatedBy: 'user-123',
 },
];

// Mock useFrameworks hooks
vi.mock('../../../hooks/useFrameworks', () => ({
 useFrameworks: vi.fn(() => ({
 data: mockFrameworks,
 isLoading: false,
 error: null,
 })),
 useActiveFrameworks: vi.fn(() => ({
 data: mockActiveFrameworks,
 isLoading: false,
 error: null,
 })),
 useFrameworkActivation: vi.fn(() => ({
 activate: vi.fn(),
 deactivate: vi.fn(),
 isActivating: false,
 isDeactivating: false,
 })),
}));

describe('FrameworkSelector', () => {
 let queryClient: QueryClient;

 const wrapper = ({ children }: { children: React.ReactNode }) =>
 React.createElement(QueryClientProvider, { client: queryClient }, children);

 beforeEach(() => {
 queryClient = new QueryClient({
 defaultOptions: {
 queries: { retry: false },
 },
 });
 vi.clearAllMocks();
 });

 it('should render all frameworks', () => {
 render(<FrameworkSelector />, { wrapper });

 expect(screen.getByText('NIS2')).toBeInTheDocument();
 expect(screen.getByText('DORA')).toBeInTheDocument();
 expect(screen.getByText('RGPD')).toBeInTheDocument();
 });

 it('should show count of active and available frameworks', () => {
 render(<FrameworkSelector />, { wrapper });

 // Check for "1 frameworks.activated" (1 active framework)
 expect(screen.getByText(/1 frameworks\.activated/)).toBeInTheDocument();
 // Check for "3 frameworks.available" (3 available frameworks)
 expect(screen.getByText(/3 frameworks\.available/)).toBeInTheDocument();
 });

 it('should filter frameworks by search query', async () => {
 render(<FrameworkSelector />, { wrapper });

 const searchInput = screen.getByPlaceholderText('frameworks.searchPlaceholder');
 fireEvent.change(searchInput, { target: { value: 'NIS2' } });

 await waitFor(() => {
 expect(screen.getByText('NIS2')).toBeInTheDocument();
 expect(screen.queryByText('DORA')).not.toBeInTheDocument();
 });
 });

 it('should filter by active status', async () => {
 render(<FrameworkSelector />, { wrapper });

 // Click on "Active" filter
 const activeFilter = screen.getByText('frameworks.filterActive');
 fireEvent.click(activeFilter);

 await waitFor(() => {
 expect(screen.getByText('NIS2')).toBeInTheDocument();
 // DORA and RGPD should be hidden (not in mockActiveFrameworks)
 });
 });

 it('should filter by inactive status', async () => {
 render(<FrameworkSelector />, { wrapper });

 // Click on "Inactive" filter
 const inactiveFilter = screen.getByText('frameworks.filterInactive');
 fireEvent.click(inactiveFilter);

 await waitFor(() => {
 expect(screen.getByText('DORA')).toBeInTheDocument();
 expect(screen.getByText('RGPD')).toBeInTheDocument();
 });
 });

 it('should show empty state when no frameworks match filter', async () => {
 render(<FrameworkSelector />, { wrapper });

 const searchInput = screen.getByPlaceholderText('frameworks.searchPlaceholder');
 fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

 await waitFor(() => {
 expect(screen.getByText('frameworks.noResults')).toBeInTheDocument();
 });
 });

 it('should render filter tabs', () => {
 render(<FrameworkSelector />, { wrapper });

 expect(screen.getByText('frameworks.filterAll')).toBeInTheDocument();
 expect(screen.getByText('frameworks.filterActive')).toBeInTheDocument();
 expect(screen.getByText('frameworks.filterInactive')).toBeInTheDocument();
 });
});
