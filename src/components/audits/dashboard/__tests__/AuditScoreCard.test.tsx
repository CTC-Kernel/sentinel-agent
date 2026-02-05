/**
 * Unit tests for AuditScoreCard component
 * Tests audit dashboard score card display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditScoreCard } from '../AuditScoreCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>
 }
}));

describe('AuditScoreCard', () => {
 const defaultProps = {
 complianceRate: 85,
 totalAudits: 24,
 openFindings: 5,
 upcomingAudits: 3
 };

 describe('rendering', () => {
 it('renders compliance rate', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(screen.getByText('85%')).toBeInTheDocument();
 });

 it('renders total audits count', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(screen.getByText('24')).toBeInTheDocument();
 });

 it('renders open findings count', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(screen.getByText('5')).toBeInTheDocument();
 });

 it('renders upcoming audits count', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(screen.getByText('3')).toBeInTheDocument();
 });

 it('renders section headers', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(screen.getByText('Taux de Complétion')).toBeInTheDocument();
 expect(screen.getByText('Total Audits')).toBeInTheDocument();
 expect(screen.getByText('Actions Requises')).toBeInTheDocument();
 expect(screen.getByText('À Venir (30j)')).toBeInTheDocument();
 });
 });

 describe('alerts', () => {
 it('shows alert when open findings exist', () => {
 render(<AuditScoreCard {...defaultProps} openFindings={5} />);

 expect(screen.getByText('5 actions requises')).toBeInTheDocument();
 });

 it('shows alert when upcoming audits exist', () => {
 render(<AuditScoreCard {...defaultProps} upcomingAudits={3} />);

 expect(screen.getByText('3 audits planifiés')).toBeInTheDocument();
 });

 it('shows secure system message when no issues', () => {
 render(<AuditScoreCard {...defaultProps} openFindings={0} upcomingAudits={0} />);

 expect(screen.getByText('Système Sécurisé')).toBeInTheDocument();
 });

 it('hides secure message when findings exist', () => {
 render(<AuditScoreCard {...defaultProps} openFindings={5} upcomingAudits={0} />);

 expect(screen.queryByText('Système Sécurisé')).not.toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls onFilterChange when total audits is clicked', () => {
 const onFilterChange = vi.fn();
 render(<AuditScoreCard {...defaultProps} onFilterChange={onFilterChange} />);

 fireEvent.click(screen.getByText('24'));

 expect(onFilterChange).toHaveBeenCalledWith(null);
 });

 it('calls onFilterChange on keyboard Enter', () => {
 const onFilterChange = vi.fn();
 render(<AuditScoreCard {...defaultProps} onFilterChange={onFilterChange} />);

 const totalAuditsButton = screen.getByRole('button', { name: /Afficher tous les audits/i });
 fireEvent.keyDown(totalAuditsButton, { key: 'Enter' });

 expect(onFilterChange).toHaveBeenCalledWith(null);
 });

 it('calls onFilterChange on keyboard Space', () => {
 const onFilterChange = vi.fn();
 render(<AuditScoreCard {...defaultProps} onFilterChange={onFilterChange} />);

 const totalAuditsButton = screen.getByRole('button', { name: /Afficher tous les audits/i });
 fireEvent.keyDown(totalAuditsButton, { key: ' ' });

 expect(onFilterChange).toHaveBeenCalledWith(null);
 });

 it('does not throw when onFilterChange is not provided', () => {
 render(<AuditScoreCard {...defaultProps} />);

 expect(() => {
 fireEvent.click(screen.getByText('24'));
 }).not.toThrow();
 });
 });

 describe('different values', () => {
 it('renders 0% compliance rate', () => {
 render(<AuditScoreCard {...defaultProps} complianceRate={0} />);

 expect(screen.getByText('0%')).toBeInTheDocument();
 });

 it('renders 100% compliance rate', () => {
 render(<AuditScoreCard {...defaultProps} complianceRate={100} />);

 expect(screen.getByText('100%')).toBeInTheDocument();
 });

 it('renders large audit count', () => {
 render(<AuditScoreCard {...defaultProps} totalAudits={999} />);

 expect(screen.getByText('999')).toBeInTheDocument();
 });
 });
});
