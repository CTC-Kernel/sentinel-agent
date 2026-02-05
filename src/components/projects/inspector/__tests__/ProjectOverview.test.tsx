/**
 * Unit tests for ProjectOverview component
 * Tests project stats display with assets, risks, and controls counts
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectOverview } from '../ProjectOverview';
import { Project } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
 Server: () => <span data-testid="server-icon" />,
 ShieldAlert: () => <span data-testid="shield-alert-icon" />,
 ClipboardCheck: () => <span data-testid="clipboard-check-icon" />
}));

describe('ProjectOverview', () => {
 const mockProject: Project = {
 id: 'project-1',
 organizationId: 'org-1',
 name: 'Security Enhancement',
 description: 'Comprehensive security enhancement project to improve organizational resilience.',
 status: 'En cours',
 manager: 'John Doe',
 dueDate: '2024-12-31',
 progress: 50,
 tasks: [],
 startDate: '2024-01-01',
 createdAt: '2024-01-01',
 relatedAssetIds: ['asset-1', 'asset-2', 'asset-3'],
 relatedRiskIds: ['risk-1', 'risk-2'],
 relatedControlIds: ['control-1', 'control-2', 'control-3', 'control-4']
 };

 const projectWithoutDescription: Project = {
 ...mockProject,
 description: ''
 };

 const projectWithoutRelations: Project = {
 ...mockProject,
 relatedAssetIds: undefined,
 relatedRiskIds: undefined,
 relatedControlIds: undefined
 };

 describe('description section', () => {
 it('renders objective header', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('Objectif')).toBeInTheDocument();
 });

 it('displays project description', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('Comprehensive security enhancement project to improve organizational resilience.')).toBeInTheDocument();
 });

 it('shows fallback when no description', () => {
 render(<ProjectOverview project={projectWithoutDescription} />);

 expect(screen.getByText('Aucune description disponible.')).toBeInTheDocument();
 });
 });

 describe('stats grid', () => {
 it('renders assets stat card', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('Actifs Concernés')).toBeInTheDocument();
 });

 it('renders risks stat card', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('Risques Traités')).toBeInTheDocument();
 });

 it('renders controls stat card', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('Contrôles Implémentés')).toBeInTheDocument();
 });
 });

 describe('stat values', () => {
 it('displays correct asset count', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('3')).toBeInTheDocument();
 });

 it('displays correct risk count', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('2')).toBeInTheDocument();
 });

 it('displays correct control count', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByText('4')).toBeInTheDocument();
 });

 it('shows zero when no relations defined', () => {
 render(<ProjectOverview project={projectWithoutRelations} />);

 // All three stat cards should show 0
 expect(screen.getAllByText('0').length).toBe(3);
 });
 });

 describe('icons', () => {
 it('renders server icon for assets', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByTestId('server-icon')).toBeInTheDocument();
 });

 it('renders shield alert icon for risks', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByTestId('shield-alert-icon')).toBeInTheDocument();
 });

 it('renders clipboard check icon for controls', () => {
 render(<ProjectOverview project={mockProject} />);

 expect(screen.getByTestId('clipboard-check-icon')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has glass-premium container for description', () => {
 const { container } = render(<ProjectOverview project={mockProject} />);

 expect(container.querySelector('.glass-premium')).toBeInTheDocument();
 });

 it('has rounded stat cards', () => {
 const { container } = render(<ProjectOverview project={mockProject} />);

 // Uses rounded-4xl custom Tailwind class for stat cards
 expect(container.querySelector('.rounded-4xl')).toBeInTheDocument();
 });

 it('has gradient backgrounds for stat cards', () => {
 const { container } = render(<ProjectOverview project={mockProject} />);

 // Check for indigo gradient (assets card)
 expect(container.querySelector('.from-indigo-50\\/50')).toBeInTheDocument();
 });

 it('has red gradient for risks card', () => {
 const { container } = render(<ProjectOverview project={mockProject} />);

 expect(container.querySelector('.from-red-50\\/50')).toBeInTheDocument();
 });

 it('has emerald gradient for controls card', () => {
 const { container } = render(<ProjectOverview project={mockProject} />);

 expect(container.querySelector('.from-emerald-50\\/50')).toBeInTheDocument();
 });
 });

 describe('edge cases', () => {
 it('handles empty arrays', () => {
 const projectWithEmptyArrays: Project = {
 ...mockProject,
 relatedAssetIds: [],
 relatedRiskIds: [],
 relatedControlIds: []
 };

 render(<ProjectOverview project={projectWithEmptyArrays} />);

 expect(screen.getAllByText('0').length).toBe(3);
 });

 it('handles single item arrays', () => {
 const projectWithSingleItems: Project = {
 ...mockProject,
 relatedAssetIds: ['asset-1'],
 relatedRiskIds: ['risk-1'],
 relatedControlIds: ['control-1']
 };

 render(<ProjectOverview project={projectWithSingleItems} />);

 // All three should show 1
 expect(screen.getAllByText('1').length).toBe(3);
 });
 });
});
