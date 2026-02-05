import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { RequirementsList } from '../RequirementsList';
import type { RequirementsByCategory } from '../../../types/framework';

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string, options?: { count?: number; code?: string }) => {
 if (options?.code) return key.replace('{{code}}', options.code);
 if (options?.count !== undefined) return `${options.count} ${key}`;
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
 button: ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
 <button {...props}>{children}</button>
 ),
 },
 AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock data
const mockGroupedRequirements: RequirementsByCategory[] = [
 {
 category: 'governance',
 categoryLabel: 'Gouvernance',
 count: 2,
 requirements: [
 {
 id: 'req-1',
 frameworkId: 'nis2-v1',
 articleRef: 'Article 20',
 title: 'Governance',
 description: 'Management bodies shall approve...',
 category: 'governance',
 criticality: 'high',
 isMandatory: true,
 },
 {
 id: 'req-2',
 frameworkId: 'nis2-v1',
 articleRef: 'Article 20.2',
 title: 'Training requirements',
 description: 'Members of the management bodies...',
 category: 'governance',
 criticality: 'medium',
 },
 ],
 },
 {
 category: 'risk_management',
 categoryLabel: 'Gestion des risques',
 count: 1,
 requirements: [
 {
 id: 'req-3',
 frameworkId: 'nis2-v1',
 articleRef: 'Article 21',
 title: 'Cybersecurity risk-management measures',
 description: 'Essential entities shall take appropriate measures...',
 category: 'risk_management',
 criticality: 'high',
 isMandatory: true,
 },
 ],
 },
];

// Mock useRequirements hook
vi.mock('../../../hooks/useFrameworks', () => ({
 useRequirements: vi.fn(() => ({
 data: mockGroupedRequirements,
 isLoading: false,
 error: null,
 refetch: vi.fn(),
 isGrouped: true as const,
 })),
}));

describe('RequirementsList', () => {
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

 it('should render category accordions', () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Category labels appear in both accordion header and filter dropdown
 const gouvernanceElements = screen.getAllByText('Gouvernance');
 const riskElements = screen.getAllByText('Gestion des risques');

 expect(gouvernanceElements.length).toBeGreaterThanOrEqual(1);
 expect(riskElements.length).toBeGreaterThanOrEqual(1);
 });

 it('should show requirement count in category headers', () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Find accordion count badges (inside span with specific class)
 const countBadges = screen.getAllByText(/^[0-9]+$/);
 // We expect counts: 2 (governance), 1 (risk management), plus criticality counts
 expect(countBadges.length).toBeGreaterThanOrEqual(2);
 });

 it('should show total requirements count', () => {
 render(<RequirementsList frameworkId="nis2-v1" frameworkCode="NIS2" />, { wrapper });

 // Total is 3 requirements
 expect(screen.getByText(/3 requirements\.requirements/)).toBeInTheDocument();
 });

 it('should expand accordion on click', async () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Click on governance category to expand (first one is in accordion, second in dropdown)
 const gouvernanceElements = screen.getAllByText('Gouvernance');
 const accordionHeader = gouvernanceElements.find(el => el.tagName === 'SPAN');
 if (accordionHeader) {
 fireEvent.click(accordionHeader);
 }

 await waitFor(() => {
 expect(screen.getByText('Article 20')).toBeInTheDocument();
 expect(screen.getByText('Governance')).toBeInTheDocument();
 });
 });

 it('should filter requirements by search query', async () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Expand all first
 const expandAllButton = screen.getByText('requirements.expandAll');
 fireEvent.click(expandAllButton);

 await waitFor(() => {
 expect(screen.getByText('Article 21')).toBeInTheDocument();
 });

 // Search for "Training"
 const searchInput = screen.getByPlaceholderText('requirements.searchPlaceholder');
 fireEvent.change(searchInput, { target: { value: 'Training' } });

 await waitFor(() => {
 expect(screen.getByText('Training requirements')).toBeInTheDocument();
 // Other requirements should be filtered out
 });
 });

 it('should filter by criticality', async () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Select high criticality
 const criticalitySelect = screen.getByDisplayValue('requirements.allCriticalities');
 fireEvent.change(criticalitySelect, { target: { value: 'high' } });

 // Expand all
 const expandAllButton = screen.getByText('requirements.expandAll');
 fireEvent.click(expandAllButton);

 await waitFor(() => {
 // Should show high criticality requirements
 expect(screen.getByText('Article 20')).toBeInTheDocument();
 expect(screen.getByText('Article 21')).toBeInTheDocument();
 });
 });

 it('should show expand all and collapse all buttons', () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 expect(screen.getByText('requirements.expandAll')).toBeInTheDocument();
 expect(screen.getByText('requirements.collapseAll')).toBeInTheDocument();
 });

 it('should expand all categories when clicking expand all', async () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 const expandAllButton = screen.getByText('requirements.expandAll');
 fireEvent.click(expandAllButton);

 await waitFor(() => {
 // All requirements should be visible
 expect(screen.getByText('Article 20')).toBeInTheDocument();
 expect(screen.getByText('Article 20.2')).toBeInTheDocument();
 expect(screen.getByText('Article 21')).toBeInTheDocument();
 });
 });

 it('should show framework code in title when provided', () => {
 render(<RequirementsList frameworkId="nis2-v1" frameworkCode="NIS2" />, { wrapper });

 expect(screen.getByText('NIS2')).toBeInTheDocument();
 });

 it('should render filter controls', () => {
 render(<RequirementsList frameworkId="nis2-v1" />, { wrapper });

 // Search input
 expect(screen.getByPlaceholderText('requirements.searchPlaceholder')).toBeInTheDocument();
 // Criticality filter
 expect(screen.getByDisplayValue('requirements.allCriticalities')).toBeInTheDocument();
 // Category filter
 expect(screen.getByDisplayValue('requirements.allCategories')).toBeInTheDocument();
 // Linked status filter
 expect(screen.getByDisplayValue('requirements.filterAll')).toBeInTheDocument();
 });
});
