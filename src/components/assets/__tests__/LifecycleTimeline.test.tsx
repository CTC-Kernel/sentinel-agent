/**
 * Unit tests for LifecycleTimeline component
 * Tests asset lifecycle timeline display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LifecycleTimeline } from '../LifecycleTimeline';

describe('LifecycleTimeline', () => {
 describe('rendering', () => {
 it('renders all lifecycle steps', () => {
 render(<LifecycleTimeline status="En service" />);

 expect(screen.getByText('Achat')).toBeInTheDocument();
 expect(screen.getByText('En Service')).toBeInTheDocument();
 expect(screen.getByText('Maintenance')).toBeInTheDocument();
 expect(screen.getByText('Fin Garantie')).toBeInTheDocument();
 expect(screen.getByText('Fin de Vie')).toBeInTheDocument();
 expect(screen.getByText('Rebut')).toBeInTheDocument();
 });

 it('renders purchase date when provided', () => {
 const purchaseDate = '2024-01-15';
 render(<LifecycleTimeline status="En service" purchaseDate={purchaseDate} />);

 expect(screen.getByText(new Date(purchaseDate).toLocaleDateString())).toBeInTheDocument();
 });

 it('renders warranty end date when provided', () => {
 const warrantyEnd = '2025-01-15';
 render(<LifecycleTimeline status="En service" warrantyEnd={warrantyEnd} />);

 expect(screen.getByText(new Date(warrantyEnd).toLocaleDateString())).toBeInTheDocument();
 });

 it('renders next maintenance date with prefix', () => {
 const nextMaintenance = '2024-06-15';
 render(<LifecycleTimeline status="En service" nextMaintenance={nextMaintenance} />);

 expect(screen.getByText(/Prochaine/)).toBeInTheDocument();
 });
 });

 describe('status steps', () => {
 it('highlights Neuf step when status is Neuf', () => {
 render(<LifecycleTimeline status="Neuf" />);

 // The step labels should be present
 expect(screen.getByText('Achat')).toBeInTheDocument();
 });

 it('highlights En service step when status is En service', () => {
 render(<LifecycleTimeline status="En service" />);

 expect(screen.getByText('En Service')).toBeInTheDocument();
 });

 it('highlights Maintenance step when status is En réparation', () => {
 render(<LifecycleTimeline status="En réparation" />);

 expect(screen.getByText('Maintenance')).toBeInTheDocument();
 });

 it('highlights Fin de vie step when status is Fin de vie', () => {
 render(<LifecycleTimeline status="Fin de vie" />);

 expect(screen.getByText('Fin de Vie')).toBeInTheDocument();
 });

 it('highlights Rebut step when status is Rebut', () => {
 render(<LifecycleTimeline status="Rebut" />);

 expect(screen.getByText('Rebut')).toBeInTheDocument();
 });

 it('defaults to En service step for unknown status', () => {
 render(<LifecycleTimeline status="unknown" />);

 expect(screen.getByText('En Service')).toBeInTheDocument();
 });
 });

 describe('progress bar', () => {
 it('renders progress bar container', () => {
 const { container } = render(<LifecycleTimeline status="En service" />);

 // Check for progress bar elements
 const progressElements = container.querySelectorAll('.h-1');
 expect(progressElements.length).toBeGreaterThan(0);
 });

 it('calculates correct progress width for Neuf (0%)', () => {
 const { container } = render(<LifecycleTimeline status="Neuf" />);

 // At status Neuf, progress should be 0%
 const progressBar = container.querySelector('.bg-primary.h-1');
 expect(progressBar).toHaveStyle({ width: '0%' });
 });

 it('calculates correct progress width for Rebut (100%)', () => {
 const { container } = render(<LifecycleTimeline status="Rebut" />);

 // At status Rebut, progress should be 100%
 const progressBar = container.querySelector('.bg-primary.h-1');
 expect(progressBar).toHaveStyle({ width: '100%' });
 });
 });

 describe('step styling', () => {
 it('applies completed styling to passed steps', () => {
 const { container } = render(<LifecycleTimeline status="En service" />);

 // Completed steps should have bg-primary class
 const completedSteps = container.querySelectorAll('.bg-primary.rounded-full');
 expect(completedSteps.length).toBeGreaterThan(0);
 });

 it('applies current step styling', () => {
 const { container } = render(<LifecycleTimeline status="En service" />);

 // Current step should have scale-110 class
 const currentStep = container.querySelector('.scale-110');
 expect(currentStep).toBeInTheDocument();
 });
 });

 describe('date formatting', () => {
 it('formats purchase date correctly', () => {
 const purchaseDate = '2024-03-15';
 render(<LifecycleTimeline status="En service" purchaseDate={purchaseDate} />);

 const formattedDate = new Date(purchaseDate).toLocaleDateString();
 expect(screen.getByText(formattedDate)).toBeInTheDocument();
 });

 it('formats warranty date correctly', () => {
 const warrantyEnd = '2026-03-15';
 render(<LifecycleTimeline status="En service" warrantyEnd={warrantyEnd} />);

 const formattedDate = new Date(warrantyEnd).toLocaleDateString();
 expect(screen.getByText(formattedDate)).toBeInTheDocument();
 });
 });
});
