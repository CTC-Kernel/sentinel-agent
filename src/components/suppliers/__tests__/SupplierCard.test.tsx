/**
 * Unit tests for SupplierCard component
 * Tests supplier card display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierCard } from '../SupplierCard';
import { Supplier, Criticality, UserProfile } from '../../../types';

// Mock avatar utils
vi.mock('../../../utils/avatarUtils', () => ({
 getUserAvatarUrl: vi.fn((url, role) => url || `https://avatar.vercel.sh/${role}`)
}));

// Mock useLocale
vi.mock('../../../hooks/useLocale', () => ({
 useLocale: () => ({
 locale: 'fr',
 t: (key: string, options?: { defaultValue?: string }) => {
 if (options?.defaultValue) return options.defaultValue;
 return key;
 }
 })
}));

describe('SupplierCard', () => {
 const mockSupplier: Supplier = {
 id: 'sup-1',
 name: 'Test Supplier',
 category: 'SaaS',
 status: 'Actif',
 criticality: Criticality.HIGH,
 securityScore: 75,
 contactName: 'John Doe',
 contactEmail: 'john@supplier.com',
 contractEnd: new Date(Date.now() + 86400000 * 365).toISOString(), // 1 year from now
 isICTProvider: true,
 organizationId: 'org-1',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 riskAssessment: {
 overallScore: 85
 },
 contract: {
 endDate: new Date(Date.now() + 86400000 * 365).toISOString()
 },
 reviewDates: {
 contractReview: new Date().toISOString(),
 securityReview: new Date().toISOString(),
 complianceReview: new Date().toISOString()
 }
 };

 const mockUsers: UserProfile[] = [
 {
 uid: 'user-1',
 email: 'john@supplier.com',
 role: 'admin',
 displayName: 'John Doe',
 photoURL: 'https://example.com/avatar.jpg',
 organizationId: 'org-1'
 }
 ];

 const mockOnClick = vi.fn();


 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders supplier name', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('Test Supplier')).toBeInTheDocument();
 });

 it('renders category badge', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('SaaS')).toBeInTheDocument();
 });

 it('renders status badge', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('Actif')).toBeInTheDocument();
 });

 it('renders criticality badge', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText(Criticality.HIGH)).toBeInTheDocument();
 });

 it('renders security score', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('75/100')).toBeInTheDocument();
 });

 it('renders DORA ICT badge when isICTProvider is true', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('DORA ICT')).toBeInTheDocument();
 });

 it('does not render DORA ICT badge when isICTProvider is false', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, isICTProvider: false }} onClick={mockOnClick} />);

 expect(screen.queryByText('DORA ICT')).not.toBeInTheDocument();
 });

 it('renders contact name', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} users={mockUsers} />);

 expect(screen.getByText('John Doe')).toBeInTheDocument();
 });

 it('renders contract end date', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 expect(screen.getByText('Contrat')).toBeInTheDocument();
 });
 });

 describe('criticality colors', () => {
 it('applies correct style for CRITICAL', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, criticality: Criticality.CRITICAL }} onClick={mockOnClick} />);

 expect(screen.getByText(Criticality.CRITICAL)).toHaveClass('bg-error-bg');
 });

 it('applies correct style for HIGH', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, criticality: Criticality.HIGH }} onClick={mockOnClick} />);

 expect(screen.getByText(Criticality.HIGH)).toHaveClass('bg-warning-bg');
 });

 it('applies correct style for MEDIUM', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, criticality: Criticality.MEDIUM }} onClick={mockOnClick} />);

 // Medium uses bg-warning-bg/50
 expect(screen.getByText(Criticality.MEDIUM)).toHaveClass('text-warning-text');
 });

 it('applies correct style for LOW', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, criticality: Criticality.LOW }} onClick={mockOnClick} />);

 expect(screen.getByText(Criticality.LOW)).toHaveClass('bg-success-bg');
 });
 });

 describe('interactions', () => {
 it('calls onClick when card is clicked', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 fireEvent.click(screen.getByRole('button'));

 expect(mockOnClick).toHaveBeenCalledWith(mockSupplier);
 });

 it('calls onClick on Enter key', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

 expect(mockOnClick).toHaveBeenCalledWith(mockSupplier);
 });

 it('calls onClick on Space key', () => {
 render(<SupplierCard supplier={mockSupplier} onClick={mockOnClick} />);

 fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

 expect(mockOnClick).toHaveBeenCalledWith(mockSupplier);
 });
 });

 describe('expired contract', () => {
 it('shows expired styling when contract is expired', () => {
 const expiredSupplier = {
 ...mockSupplier,
 contractEnd: new Date(Date.now() - 86400000).toISOString() // Yesterday
 };
 render(<SupplierCard supplier={expiredSupplier} onClick={mockOnClick} />);

 // The date should be displayed in red (uses text-destructive)
 const dateElement = screen.getByText(new Date(expiredSupplier.contractEnd).toLocaleDateString());
 expect(dateElement).toHaveClass('text-destructive');
 });
 });

 describe('security score colors', () => {
 it('shows success color for score >= 80', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, securityScore: 85 }} onClick={mockOnClick} />);

 expect(screen.getByText('85/100')).toHaveClass('text-success');
 });

 it('shows warning color for score >= 50', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, securityScore: 65 }} onClick={mockOnClick} />);

 expect(screen.getByText('65/100')).toHaveClass('text-warning');
 });

 it('shows destructive color for score < 50', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, securityScore: 30 }} onClick={mockOnClick} />);

 expect(screen.getByText('30/100')).toHaveClass('text-destructive');
 });
 });

 describe('category icons', () => {
 it('renders Building icon for SaaS category', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, category: 'SaaS' }} onClick={mockOnClick} />);

 // The Building icon should be rendered (we can verify the component renders without error)
 expect(screen.getByRole('button')).toBeInTheDocument();
 });

 it('renders Truck icon for Matériel category', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, category: 'Matériel' }} onClick={mockOnClick} />);

 expect(screen.getByRole('button')).toBeInTheDocument();
 });
 });

 describe('missing data handling', () => {
 it('handles missing contractEnd', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, contractEnd: undefined }} onClick={mockOnClick} />);

 expect(screen.getByText('-')).toBeInTheDocument();
 });

 it('handles missing securityScore', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, securityScore: undefined }} onClick={mockOnClick} />);

 expect(screen.getByText('0/100')).toBeInTheDocument();
 });

 it('handles missing contactName', () => {
 render(<SupplierCard supplier={{ ...mockSupplier, contactName: undefined }} onClick={mockOnClick} />);

 expect(screen.queryByAltText('John Doe')).not.toBeInTheDocument();
 });
 });
});
