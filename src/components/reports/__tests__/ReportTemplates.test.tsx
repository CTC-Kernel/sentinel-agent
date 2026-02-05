/**
 * Unit tests for ReportTemplates component
 * Tests report template library display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportTemplates } from '../ReportTemplates';

// Mock react-i18next
vi.mock('react-i18next', () => ({
 useTranslation: () => ({
 t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) || key,
 i18n: { language: 'en', changeLanguage: vi.fn() }
 }),
 Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
 <div className={className}>{children}</div>
 )
 }
}));

describe('ReportTemplates', () => {
 describe('rendering', () => {
 it('renders library header', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Bibliothèque de modèles')).toBeInTheDocument();
 });

 it('renders create template button', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Créer un modèle')).toBeInTheDocument();
 });

 it('renders description text', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Utilisez des modèles pré-configurés pour vos rapports récurrents.')).toBeInTheDocument();
 });
 });

 describe('template cards', () => {
 it('renders ISO 27005 template', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Rapport Complet ISO 27005')).toBeInTheDocument();
 });

 it('renders board synthesis template', () => {
 render(<ReportTemplates />);

 expect(screen.getByText("Synthèse pour Conseil d'Administration")).toBeInTheDocument();
 });

 it('renders GDPR register template', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Registre de Traitement (RGPD)')).toBeInTheDocument();
 });

 it('renders project committee template', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Support COMOP/COPIL')).toBeInTheDocument();
 });
 });

 describe('premium badges', () => {
 it('shows premium badge for ISO 27005 template', () => {
 render(<ReportTemplates />);

 expect(screen.getAllByText('Premium').length).toBeGreaterThan(0);
 });
 });

 describe('category badges', () => {
 it('shows Risques category', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Risques')).toBeInTheDocument();
 });

 it('shows Audits category', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Audits')).toBeInTheDocument();
 });

 it('shows Conformité category', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Conformité')).toBeInTheDocument();
 });

 it('shows Projets category', () => {
 render(<ReportTemplates />);

 expect(screen.getByText('Projets')).toBeInTheDocument();
 });
 });

 describe('action buttons', () => {
 it('renders use buttons for each template', () => {
 render(<ReportTemplates />);

 const useButtons = screen.getAllByText('Utiliser');
 expect(useButtons.length).toBe(4);
 });
 });

 describe('template descriptions', () => {
 it('shows ISO 27005 description', () => {
 render(<ReportTemplates />);

 expect(screen.getByText(/Analyse détaillée des risques/)).toBeInTheDocument();
 });

 it('shows GDPR description', () => {
 render(<ReportTemplates />);

 expect(screen.getByText(/registre des traitements des données personnelles/)).toBeInTheDocument();
 });
 });
});
