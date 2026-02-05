/**
 * Unit tests for WorkflowStatusBadge component
 * Tests document workflow status display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowStatusBadge } from '../WorkflowStatusBadge';

describe('WorkflowStatusBadge', () => {
 describe('workflow status priority', () => {
 it('displays Review workflow status over legacy status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Review" />);

 expect(screen.getByText('En Revue Peer')).toBeInTheDocument();
 });

 it('displays Approved workflow status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Approved" />);

 expect(screen.getByText('Validé')).toBeInTheDocument();
 });

 it('displays Rejected workflow status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Rejected" />);

 expect(screen.getByText('Rejeté')).toBeInTheDocument();
 });
 });

 describe('legacy status fallback', () => {
 it('displays Publié status', () => {
 render(<WorkflowStatusBadge status="Publié" />);

 expect(screen.getByText('Publié')).toBeInTheDocument();
 });

 it('displays Approuvé status', () => {
 render(<WorkflowStatusBadge status="Approuvé" />);

 expect(screen.getByText('Approuvé')).toBeInTheDocument();
 });

 it('displays En revue status', () => {
 render(<WorkflowStatusBadge status="En revue" />);

 expect(screen.getByText('En revue')).toBeInTheDocument();
 });

 it('displays Rejeté status', () => {
 render(<WorkflowStatusBadge status="Rejeté" />);

 expect(screen.getByText('Rejeté')).toBeInTheDocument();
 });

 it('displays Obsolète status', () => {
 render(<WorkflowStatusBadge status="Obsolète" />);

 expect(screen.getByText('Obsolète')).toBeInTheDocument();
 });

 it('displays Archivé status', () => {
 render(<WorkflowStatusBadge status="Archivé" />);

 expect(screen.getByText('Archivé')).toBeInTheDocument();
 });

 it('displays Brouillon status as default', () => {
 render(<WorkflowStatusBadge status="Brouillon" />);

 expect(screen.getByText('Brouillon')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('applies correct styles for Review status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Review" />);

 const badge = screen.getByText('En Revue Peer');
 expect(badge).toHaveClass('bg-warning-bg');
 });

 it('applies correct styles for Approved status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Approved" />);

 const badge = screen.getByText('Validé');
 expect(badge).toHaveClass('bg-success-bg');
 });

 it('applies correct styles for Rejected status', () => {
 render(<WorkflowStatusBadge status="Brouillon" workflowStatus="Rejected" />);

 const badge = screen.getByText('Rejeté');
 expect(badge).toHaveClass('bg-error-bg');
 });

 it('renders as span element', () => {
 render(<WorkflowStatusBadge status="Publié" />);

 const badge = screen.getByText('Publié');
 expect(badge.tagName).toBe('SPAN');
 });

 it('has inline-flex display', () => {
 render(<WorkflowStatusBadge status="Publié" />);

 const badge = screen.getByText('Publié');
 expect(badge).toHaveClass('inline-flex');
 });
 });
});
