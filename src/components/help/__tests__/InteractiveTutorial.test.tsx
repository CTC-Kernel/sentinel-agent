/**
 * Unit tests for InteractiveTutorial component
 * Tests tutorial step navigation and display
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteractiveTutorial } from '../InteractiveTutorial';

describe('InteractiveTutorial', () => {
 const defaultProps = {
 title: 'Getting Started',
 description: 'Learn the basics of the platform',
 duration: '15 min',
 difficulty: 'Débutant' as const,
 audience: 'Nouveaux utilisateurs',
 steps: [
 { title: 'Step 1', description: 'First step description', action: 'Click here' },
 { title: 'Step 2', description: 'Second step description' },
 { title: 'Step 3', description: 'Third step description', action: 'Finish' }
 ]
 };

 describe('header rendering', () => {
 it('renders tutorial title', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Getting Started')).toBeInTheDocument();
 });

 it('renders tutorial description', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Learn the basics of the platform')).toBeInTheDocument();
 });

 it('renders duration', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('15 min')).toBeInTheDocument();
 });

 it('renders difficulty badge', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Débutant')).toBeInTheDocument();
 });

 it('renders audience', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Nouveaux utilisateurs')).toBeInTheDocument();
 });

 it('shows interactive tutorial label', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Tutoriel interactif')).toBeInTheDocument();
 });
 });

 describe('difficulty colors', () => {
 it('shows green for Débutant', () => {
 const { container } = render(<InteractiveTutorial {...defaultProps} difficulty="Débutant" />);

 expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
 });

 it('shows yellow for Intermédiaire', () => {
 const { container } = render(<InteractiveTutorial {...defaultProps} difficulty="Intermédiaire" />);

 expect(container.querySelector('.bg-yellow-100')).toBeInTheDocument();
 });

 it('shows red for Avancé', () => {
 const { container } = render(<InteractiveTutorial {...defaultProps} difficulty="Avancé" />);

 expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
 });
 });

 describe('progress', () => {
 it('shows progress text', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Progression')).toBeInTheDocument();
 });

 it('shows step counter', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('1 / 3')).toBeInTheDocument();
 });
 });

 describe('steps rendering', () => {
 it('renders all step titles', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Step 1')).toBeInTheDocument();
 expect(screen.getByText('Step 2')).toBeInTheDocument();
 expect(screen.getByText('Step 3')).toBeInTheDocument();
 });

 it('renders step descriptions', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('First step description')).toBeInTheDocument();
 });

 it('shows action button for current step', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Click here')).toBeInTheDocument();
 });

 it('shows step numbers', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('1')).toBeInTheDocument();
 expect(screen.getByText('2')).toBeInTheDocument();
 expect(screen.getByText('3')).toBeInTheDocument();
 });
 });

 describe('navigation', () => {
 it('renders previous button', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Étape précédente')).toBeInTheDocument();
 });

 it('renders next button', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Étape suivante')).toBeInTheDocument();
 });

 it('disables previous button on first step', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 expect(screen.getByText('Étape précédente')).toBeDisabled();
 });

 it('advances to next step when next clicked', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 fireEvent.click(screen.getByText('Étape suivante'));

 expect(screen.getByText('2 / 3')).toBeInTheDocument();
 });

 it('goes back when previous clicked', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 fireEvent.click(screen.getByText('Étape suivante'));
 fireEvent.click(screen.getByText('Étape précédente'));

 expect(screen.getByText('1 / 3')).toBeInTheDocument();
 });

 it('shows Terminer on last step', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 fireEvent.click(screen.getByText('Étape suivante'));
 fireEvent.click(screen.getByText('Étape suivante'));

 expect(screen.getByText('Terminer')).toBeInTheDocument();
 });

 it('disables next on last step', () => {
 render(<InteractiveTutorial {...defaultProps} />);

 fireEvent.click(screen.getByText('Étape suivante'));
 fireEvent.click(screen.getByText('Étape suivante'));

 expect(screen.getByText('Terminer')).toBeDisabled();
 });
 });

 describe('completed steps', () => {
 it('marks step as completed when advancing', () => {
 const { container } = render(<InteractiveTutorial {...defaultProps} />);

 fireEvent.click(screen.getByText('Étape suivante'));

 // First step should now have completed styling (green background)
 expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
 });
 });
});
