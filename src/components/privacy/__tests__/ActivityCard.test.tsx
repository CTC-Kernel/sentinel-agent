/**
 * Unit tests for ActivityCard component
 * Tests privacy activity card display and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityCard } from '../ActivityCard';
import { ProcessingActivity } from '../../../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
 motion: {
 div: ({ children, onClick, className }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
 <div 
 onClick={onClick} 
 onKeyDown={(e) => {
  if (onClick && (e.key === 'Enter' || e.key === ' ')) {
  e.preventDefault();
  onClick();
  }
 }}
 className={className}
 role="button"
 tabIndex={0}
 >{children}</div>
 )
 }
}));

// Mock ConfirmModal
vi.mock('../../ui/ConfirmModal', () => ({
 ConfirmModal: ({ isOpen, onClose, onConfirm, title }: {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 }) => isOpen ? (
 <div data-testid="confirm-modal">
 <h2>{title}</h2>
 <button onClick={onClose}>Annuler</button>
 <button onClick={onConfirm}>Supprimer</button>
 </div>
 ) : null
}));

describe('ActivityCard', () => {
 const mockActivity: ProcessingActivity = {
 id: 'act-1',
 name: 'Newsletter Processing',
 purpose: 'Marketing communications to subscribers',
 status: 'Actif',
 legalBasis: 'Consentement',
 dataCategories: ['Email', 'Prénom'],
 dataSubjects: ['Abonnés'],
 retentionPeriod: '3 ans',
 hasDPIA: true,
 organizationId: 'org-1',
 manager: 'John Doe',
 createdAt: new Date(Date.now()).toISOString(),
 updatedAt: new Date(Date.now()).toISOString()
 };

 const mockOnClick = vi.fn();
 const mockOnDelete = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering', () => {
 it('renders activity name', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Newsletter Processing')).toBeInTheDocument();
 });

 it('renders activity purpose', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Marketing communications to subscribers')).toBeInTheDocument();
 });

 it('renders activity status', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Actif')).toBeInTheDocument();
 });

 it('renders legal basis', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Base Légale')).toBeInTheDocument();
 expect(screen.getByText('Consentement')).toBeInTheDocument();
 });

 it('renders data categories', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Catégories')).toBeInTheDocument();
 expect(screen.getByText('Email, Prénom')).toBeInTheDocument();
 });

 it('renders retention period', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('Conservation')).toBeInTheDocument();
 expect(screen.getByText('3 ans')).toBeInTheDocument();
 });

 it('renders DPIA badge when hasDPIA is true', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('DPIA Effectué')).toBeInTheDocument();
 });

 it('does not render DPIA badge when hasDPIA is false', () => {
 render(<ActivityCard activity={{ ...mockActivity, hasDPIA: false }} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.queryByText('DPIA Effectué')).not.toBeInTheDocument();
 });
 });

 describe('empty data categories', () => {
 it('renders dash when no data categories', () => {
 render(<ActivityCard activity={{ ...mockActivity, dataCategories: [] }} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByText('-')).toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls onClick when card is clicked', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 fireEvent.click(screen.getByText('Newsletter Processing'));

 expect(mockOnClick).toHaveBeenCalledWith(mockActivity);
 });
 });

 describe('delete functionality', () => {
 it('shows delete button when canEdit is true', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 expect(screen.getByLabelText('Delete')).toBeInTheDocument();
 });

 it('hides delete button when canEdit is false', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={false} />);

 expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();
 });

 it('opens confirm modal when delete clicked', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 fireEvent.click(screen.getByLabelText('Delete'));

 expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
 });

 it('calls onDelete when deletion confirmed', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 fireEvent.click(screen.getByLabelText('Delete'));
 fireEvent.click(screen.getByText('Supprimer'));

 expect(mockOnDelete).toHaveBeenCalledWith('act-1', 'Newsletter Processing');
 });

 it('closes modal when cancelled', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 fireEvent.click(screen.getByLabelText('Delete'));
 fireEvent.click(screen.getByText('Annuler'));

 expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
 });
 });

 describe('status styling', () => {
 it('shows green styling for Actif status', () => {
 render(<ActivityCard activity={mockActivity} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 const statusBadge = screen.getByText('Actif');
 expect(statusBadge).toHaveClass('bg-green-50');
 });

 it('shows gray styling for Archivé status', () => {
 render(<ActivityCard activity={{ ...mockActivity, status: 'Archivé' }} onClick={mockOnClick} onDelete={mockOnDelete} canEdit={true} />);

 const statusBadge = screen.getByText('Archivé');
 expect(statusBadge).toHaveClass('bg-muted');
 });
 });
});
