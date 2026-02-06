/**
 * Unit tests for DocumentVersionHistory component
 * Tests document version history display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentVersionHistory } from '../DocumentVersionHistory';
import { DocumentVersion } from '../../../types';

// Mock Icons
vi.mock('../../ui/Icons', () => ({
 Clock: () => <span data-testid="clock-icon" />,
 Download: () => <span data-testid="download-icon" />
}));

// Mock date-fns
vi.mock('date-fns', () => ({
 format: (_date: Date, _formatStr: string) => '15 janvier 2024 à 10:00'
}));

vi.mock('date-fns/locale', () => ({
 fr: { code: 'fr' },
 enUS: { code: 'en' },
 de: { code: 'de' },
}));

// Mock useLocale hook
vi.mock('../../../hooks/useLocale', () => ({
 useLocale: () => ({
 dateFnsLocale: undefined,
 locale: 'en',
 config: { intlLocale: 'en-US' },
 t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key
 })
}));

// Mock useStore
vi.mock('../../../store', () => ({
 useStore: (selector?: (s: Record<string, unknown>) => unknown) => {
 const state: Record<string, unknown> = {
 language: 'fr' as const,
 t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key,
 };
 return selector ? selector(state) : state;
 }
}));

describe('DocumentVersionHistory', () => {
 const mockVersions: DocumentVersion[] = [
 {
 id: 'ver-1',
 documentId: 'doc-1',
 version: '3',
 uploadedAt: '2024-01-15T10:00:00Z',
 uploadedBy: 'user-1',
 changeLog: 'Major security updates',
 url: 'https://example.com/doc-v3.pdf'
 },
 {
 id: 'ver-2',
 documentId: 'doc-1',
 version: '2',
 uploadedAt: '2024-01-10T09:00:00Z',
 uploadedBy: 'user-1',
 changeLog: 'Fixed typos',
 url: 'https://example.com/doc-v2.pdf'
 },
 {
 id: 'ver-3',
 documentId: 'doc-1',
 version: '1',
 uploadedAt: '2024-01-01T08:00:00Z',
 uploadedBy: 'user-1',
 changeLog: '',
 url: 'https://example.com/doc-v1.pdf'
 }
 ];

 describe('empty state', () => {
 it('shows empty message when no versions', () => {
 render(<DocumentVersionHistory versions={[]} />);

 expect(screen.getByText('Aucune version antérieure disponible.')).toBeInTheDocument();
 });
 });

 describe('header', () => {
 it('renders history title', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getByText('Historique des Versions')).toBeInTheDocument();
 });

 it('renders clock icon', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
 });
 });

 describe('version list', () => {
 it('displays all versions', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getByText('v3')).toBeInTheDocument();
 expect(screen.getByText('v2')).toBeInTheDocument();
 expect(screen.getByText('v1')).toBeInTheDocument();
 });

 it('displays changelog text', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getByText('Major security updates')).toBeInTheDocument();
 expect(screen.getByText('Fixed typos')).toBeInTheDocument();
 });

 it('shows fallback when no changelog', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getByText('Mise à jour standard')).toBeInTheDocument();
 });

 it('displays formatted dates', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getAllByText('15 janvier 2024 à 10:00').length).toBe(3);
 });
 });

 describe('current version indicator', () => {
 it('shows ACTUEL badge for current version', () => {
 render(<DocumentVersionHistory versions={mockVersions} currentVersionId="ver-1" />);

 expect(screen.getByText('ACTUEL')).toBeInTheDocument();
 });

 it('hides ACTUEL badge when not current', () => {
 render(<DocumentVersionHistory versions={mockVersions} currentVersionId="ver-2" />);

 // ACTUEL should only appear once (for ver-2)
 expect(screen.getAllByText('ACTUEL').length).toBe(1);
 });
 });

 describe('download links', () => {
 it('renders download links with correct href', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 const downloadLinks = screen.getAllByTitle('Télécharger');
 expect(downloadLinks.length).toBe(3);
 expect(downloadLinks[0]).toHaveAttribute('href', 'https://example.com/doc-v3.pdf');
 });

 it('opens links in new tab', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 const downloadLinks = screen.getAllByTitle('Télécharger');
 expect(downloadLinks[0]).toHaveAttribute('target', '_blank');
 expect(downloadLinks[0]).toHaveAttribute('rel', 'noopener noreferrer');
 });

 it('renders download icons', () => {
 render(<DocumentVersionHistory versions={mockVersions} />);

 expect(screen.getAllByTestId('download-icon').length).toBe(3);
 });
 });

 describe('styling', () => {
 it('highlights current version', () => {
 const { container } = render(<DocumentVersionHistory versions={mockVersions} currentVersionId="ver-1" />);

 // Use attribute selector since bg-primary/10 contains a slash
 expect(container.querySelector('[class*="bg-primary"]')).toBeInTheDocument();
 });
 });

 describe('edge cases', () => {
 it('handles version without url', () => {
 const versionsNoUrl: DocumentVersion[] = [
 {
  id: 'ver-1',
  documentId: 'doc-1',
  version: '1',
  uploadedAt: '2024-01-01',
  uploadedBy: 'user-1',
  changeLog: 'Test',
  url: ''
 }
 ];

 render(<DocumentVersionHistory versions={versionsNoUrl} />);

 expect(screen.queryByTitle('Télécharger')).not.toBeInTheDocument();
 });

 it('handles missing upload date', () => {
 const versionsNoDate: DocumentVersion[] = [
 {
  id: 'ver-1',
  documentId: 'doc-1',
  version: '1',
  uploadedAt: '',
  uploadedBy: 'user-1',
  changeLog: 'Test',
  url: 'https://example.com/doc.pdf'
 }
 ];

 render(<DocumentVersionHistory versions={versionsNoDate} />);

 expect(screen.getByText('Date inconnue')).toBeInTheDocument();
 });
 });
});
