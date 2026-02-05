import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreBreakdownPanel } from '../ScoreBreakdownPanel';
import type { ScoreBreakdown, CalculationDetails } from '../../../types/score.types';

describe('ScoreBreakdownPanel', () => {
 const mockBreakdown: ScoreBreakdown = {
 controls: { score: 80, weight: 0.40 },
 risks: { score: 70, weight: 0.30 },
 audits: { score: 72, weight: 0.20 },
 documents: { score: 75, weight: 0.10 },
 };

 const mockCalculationDetails: CalculationDetails = {
 implementedControls: 80,
 actionableControls: 100,
 totalRisks: 50,
 criticalRisks: 5,
 totalDocuments: 60,
 validDocuments: 45,
 totalFindings: 50,
 compliantFindings: 36,
 };

 it('should render when isOpen is true', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.getByText('Détail du Score')).toBeInTheDocument();
 });

 it('should not render when isOpen is false', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={false} />);

 expect(screen.queryByText('Détail du Score')).not.toBeInTheDocument();
 });

 it('should display all category labels', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.getByText('Contrôles')).toBeInTheDocument();
 expect(screen.getByText('Risques')).toBeInTheDocument();
 expect(screen.getByText('Audits')).toBeInTheDocument();
 expect(screen.getByText('Documents')).toBeInTheDocument();
 });

 it('should display category scores', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.getByText('80')).toBeInTheDocument();
 expect(screen.getByText('70')).toBeInTheDocument();
 expect(screen.getByText('72')).toBeInTheDocument();
 expect(screen.getByText('75')).toBeInTheDocument();
 });

 it('should display weight percentages', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.getByText('(40%)')).toBeInTheDocument();
 expect(screen.getByText('(30%)')).toBeInTheDocument();
 expect(screen.getByText('(20%)')).toBeInTheDocument();
 expect(screen.getByText('(10%)')).toBeInTheDocument();
 });

 it('should display calculation details when provided', () => {
 render(
 <ScoreBreakdownPanel
 breakdown={mockBreakdown}
 calculationDetails={mockCalculationDetails}
 isOpen={true}
 />
 );

 expect(screen.getByText('80/100 contrôles implémentés')).toBeInTheDocument();
 expect(screen.getByText('5 risques critiques sur 50')).toBeInTheDocument();
 expect(screen.getByText('45/60 documents valides')).toBeInTheDocument();
 expect(screen.getByText('36/50 constats conformes')).toBeInTheDocument();
 });

 it('should call onClose when close button is clicked', () => {
 const handleClose = vi.fn();
 render(
 <ScoreBreakdownPanel
 breakdown={mockBreakdown}
 isOpen={true}
 onClose={handleClose}
 />
 );

 const closeButton = screen.getByRole('button', { name: 'Fermer' });
 fireEvent.click(closeButton);

 expect(handleClose).toHaveBeenCalledTimes(1);
 });

 it('should not show close button when onClose is not provided', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument();
 });

 it('should apply custom className', () => {
 const { container } = render(
 <ScoreBreakdownPanel
 breakdown={mockBreakdown}
 isOpen={true}
 className="custom-panel"
 />
 );

 expect(container.querySelector('.custom-panel')).toBeInTheDocument();
 });

 it('should display weight explanation text', () => {
 render(<ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />);

 expect(screen.getByText('Score global = Somme pondérée des catégories')).toBeInTheDocument();
 });

 it('should render progress bars for each category', () => {
 const { container } = render(
 <ScoreBreakdownPanel breakdown={mockBreakdown} isOpen={true} />
 );

 // Each category has a progress bar
 const progressBars = container.querySelectorAll('.h-2.bg-muted');
 expect(progressBars.length).toBe(4);
 });
});
