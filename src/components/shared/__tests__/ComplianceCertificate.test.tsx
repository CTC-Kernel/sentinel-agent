/**
 * Unit tests for ComplianceCertificate component
 * Tests compliance certificate display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceCertificate } from '../ComplianceCertificate';

// Mock MasterpieceBackground
vi.mock('../../ui/MasterpieceBackground', () => ({
 MasterpieceBackground: () => <div data-testid="masterpiece-bg">Background</div>
}));

describe('ComplianceCertificate', () => {
 const defaultProps = {
 type: 'ISO 27001',
 score: 85,
 issueDate: new Date('2024-01-15'),
 recipientName: 'Acme Corporation'
 };

 describe('rendering', () => {
 it('renders certificate title', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('CERTIFICAT DE CONFORMITÉ')).toBeInTheDocument();
 });

 it('renders platform name', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Sentinel GRC Platform')).toBeInTheDocument();
 });

 it('renders recipient name', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
 });

 it('renders compliance score', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('85%')).toBeInTheDocument();
 });

 it('renders compliance type', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('ISO 27001')).toBeInTheDocument();
 });

 it('renders download button', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Télécharger PDF')).toBeInTheDocument();
 });

 it('renders signature section', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Sentinel System')).toBeInTheDocument();
 expect(screen.getByText('Signature')).toBeInTheDocument();
 });

 it('renders issue date label', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Délivré le')).toBeInTheDocument();
 });

 it('renders background component', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByTestId('masterpiece-bg')).toBeInTheDocument();
 });
 });

 describe('different scores', () => {
 it('renders zero score', () => {
 render(<ComplianceCertificate {...defaultProps} score={0} />);

 expect(screen.getByText('0%')).toBeInTheDocument();
 });

 it('renders 100% score', () => {
 render(<ComplianceCertificate {...defaultProps} score={100} />);

 expect(screen.getByText('100%')).toBeInTheDocument();
 });

 it('renders decimal score', () => {
 render(<ComplianceCertificate {...defaultProps} score={85.5} />);

 expect(screen.getByText('85.5%')).toBeInTheDocument();
 });
 });

 describe('different compliance types', () => {
 it('renders GDPR type', () => {
 render(<ComplianceCertificate {...defaultProps} type="GDPR" />);

 expect(screen.getByText('GDPR')).toBeInTheDocument();
 });

 it('renders SOC 2 type', () => {
 render(<ComplianceCertificate {...defaultProps} type="SOC 2" />);

 expect(screen.getByText('SOC 2')).toBeInTheDocument();
 });

 it('renders NIS2 type', () => {
 render(<ComplianceCertificate {...defaultProps} type="NIS2" />);

 expect(screen.getByText('NIS2')).toBeInTheDocument();
 });
 });

 describe('issue date display', () => {
 it('displays formatted date', () => {
 const date = new Date('2024-06-15');
 render(<ComplianceCertificate {...defaultProps} issueDate={date} />);

 // Date should be formatted according to locale
 const dateString = date.toLocaleDateString();
 expect(screen.getByText(dateString)).toBeInTheDocument();
 });
 });

 describe('certificate text', () => {
 it('shows certification text', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('Ce document certifie que')).toBeInTheDocument();
 });

 it('shows score achievement text', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText('a atteint un score de conformité de')).toBeInTheDocument();
 });

 it('shows framework text', () => {
 render(<ComplianceCertificate {...defaultProps} />);

 expect(screen.getByText(/pour le référentiel/)).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('has certificate frame styling', () => {
 const { container } = render(<ComplianceCertificate {...defaultProps} />);

 // Check for double border styling
 expect(container.querySelector('.border-double')).toBeInTheDocument();
 });

 it('has shadow styling', () => {
 const { container } = render(<ComplianceCertificate {...defaultProps} />);

 expect(container.querySelector('.shadow-2xl')).toBeInTheDocument();
 });
 });
});
