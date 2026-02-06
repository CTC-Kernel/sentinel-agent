/**
 * Unit tests for IncidentTimeline component
 * Tests incident timeline step display and status
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentTimeline } from '../IncidentTimeline';
import { Incident, Criticality } from '../../../types';
import { fr } from 'date-fns/locale';

// Mock useLocale - extract defaultValue from options for proper translation handling
vi.mock('../../../hooks/useLocale', () => ({
 useLocale: () => ({
 locale: 'fr',
 dateFnsLocale: fr,
 config: { intlLocale: 'fr-FR' },
 t: (key: string, options?: { defaultValue?: string; reporter?: string }) => {
 if (options?.defaultValue) {
 // Handle interpolation for reporter
 if (options.reporter) {
  return options.defaultValue.replace('{{reporter}}', options.reporter);
 }
 return options.defaultValue;
 }
 return key;
 },
 formatDate: (date: Date) => date.toLocaleDateString('fr-FR'),
 formatLocalizedDate: (date: Date | string | null) => date ? new Date(date).toLocaleDateString('fr-FR') : '',
 })
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({ t: (key: string) => key })
}));

// Mock Icons
vi.mock('../../ui/Icons', () => ({
 CheckCircle2: () => <span data-testid="check-circle-icon" />,
 AlertCircle: () => <span data-testid="alert-circle-icon" />,
 Clock: () => <span data-testid="clock-icon" />,
 FileText: () => <span data-testid="file-text-icon" />
}));

describe('IncidentTimeline', () => {
 const mockIncident: Incident = {
 id: 'incident-1',
 organizationId: 'org-1',
 title: 'Security Breach',
 description: 'Unauthorized access detected',
 category: 'Autre',
 severity: Criticality.CRITICAL,
 status: 'Contenu',
 dateReported: '2024-01-15T10:00:00Z',
 dateAnalysis: '2024-01-15T11:00:00Z',
 dateContained: '2024-01-15T14:00:00Z',
 reporter: 'John Doe',
 impact: 'High impact on operations'
 };

 const newIncident: Incident = {
 ...mockIncident,
 status: 'Nouveau',
 dateAnalysis: undefined,
 dateContained: undefined
 };

 const resolvedIncident: Incident = {
 ...mockIncident,
 status: 'Résolu',
 dateResolved: '2024-01-15T18:00:00Z'
 };

 const mockGetTimeToResolve = vi.fn(() => '8h');

 describe('empty state', () => {
 it('shows placeholder when no incident selected', () => {
 render(<IncidentTimeline />);

 expect(screen.getByText('Chronologie')).toBeInTheDocument();
 expect(screen.getByText('Sélectionnez un incident pour voir son historique.')).toBeInTheDocument();
 });

 it('shows clock icon in empty state', () => {
 render(<IncidentTimeline />);

 expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
 });
 });

 describe('timeline steps', () => {
 it('renders Signalé step', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Signalé')).toBeInTheDocument();
 });

 it('renders En Analyse step', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('En Analyse')).toBeInTheDocument();
 });

 it('renders Contenu step', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Contenu')).toBeInTheDocument();
 });

 it('renders Résolu step', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Résolu')).toBeInTheDocument();
 });

 it('shows reporter in first step description', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Incident signalé par John Doe')).toBeInTheDocument();
 });
 });

 describe('step descriptions', () => {
 it('shows analysis description', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Analyse initiale et qualification')).toBeInTheDocument();
 });

 it('shows containment description', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Mesures de contournement appliquées')).toBeInTheDocument();
 });

 it('shows resolution description', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.getByText('Incident résolu et service rétabli')).toBeInTheDocument();
 });
 });

 describe('resolution time', () => {
 it('shows resolution time when incident resolved', () => {
 render(<IncidentTimeline selectedIncident={resolvedIncident} getTimeToResolve={mockGetTimeToResolve} />);

 expect(screen.getByText('Résolu en 8h')).toBeInTheDocument();
 });

 it('hides resolution time when incident not resolved', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(screen.queryByText(/Résolu en/)).not.toBeInTheDocument();
 });
 });

 describe('status-based styling', () => {
 it('shows current indicator for active step', () => {
 const { container } = render(<IncidentTimeline selectedIncident={newIncident} />);

 // Nouveau status means Analyse is current
 expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
 });
 });

 describe('header', () => {
 it('renders chronologie header', () => {
 render(<IncidentTimeline selectedIncident={mockIncident} />);

 // Header shows "Chronologie" (uppercase in text)
 expect(screen.getByText('Chronologie')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has timeline border', () => {
 const { container } = render(<IncidentTimeline selectedIncident={mockIncident} />);

 expect(container.querySelector('.border-l')).toBeInTheDocument();
 });
 });
});
