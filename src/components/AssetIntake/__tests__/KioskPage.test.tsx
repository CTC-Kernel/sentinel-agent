/**
 * Unit tests for KioskPage component
 * Tests asset intake kiosk display and hardware detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KioskPage } from '../KioskPage';

// Mock hardware detection
const mockDetectHardware = vi.fn();
vi.mock('../../../utils/hardwareDetection', () => ({
 detectHardware: () => mockDetectHardware()
}));

// Mock IntakeForm
vi.mock('../IntakeForm', () => ({
 IntakeForm: ({ onSuccess }: { onSuccess: () => void }) => (
 <div data-testid="intake-form">
 <button data-testid="submit-success" onClick={onSuccess}>
 Submit
 </button>
 </div>
 )
}));

// Mock Icons
vi.mock('../../ui/Icons', () => ({
 CheckCircle2: () => <div data-testid="check-icon" />,
 ShieldCheck: () => <div data-testid="shield-icon" />,
 Lock: () => <div data-testid="lock-icon" />
}));

describe('KioskPage', () => {
 const mockHardwareInfo = {
 os: 'macOS',
 browser: 'Chrome',
 ram: '16 GB',
 gpu: 'Apple M1',
 cpuCores: 8,
 screenResolution: '2560x1440',
 isMobile: false,
 fingerprint: 'abc123'
 };

 beforeEach(() => {
 vi.clearAllMocks();
 mockDetectHardware.mockResolvedValue(mockHardwareInfo);
 });

 const renderWithRouter = (searchParams = '') => {
 return render(
 <MemoryRouter initialEntries={[`/kiosk${searchParams}`]}>
 <KioskPage />
 </MemoryRouter>
 );
 };

 describe('loading state', () => {
 it('shows loading state initially', () => {
 // Make detectHardware never resolve to keep loading state
 mockDetectHardware.mockImplementation(() => new Promise(() => { }));

 renderWithRouter('?org=test-org');

 expect(screen.getByText('Analyse du matériel...')).toBeInTheDocument();
 });

 it('shows loading message', () => {
 mockDetectHardware.mockImplementation(() => new Promise(() => { }));

 renderWithRouter('?org=test-org');

 expect(screen.getByText('Veuillez patienter pendant que nous détectons la configuration.')).toBeInTheDocument();
 });

 it('shows spinner during loading', () => {
 mockDetectHardware.mockImplementation(() => new Promise(() => { }));

 const { container } = renderWithRouter('?org=test-org');

 expect(container.querySelector('.animate-spin')).toBeInTheDocument();
 });
 });

 describe('header', () => {
 it('renders brand name', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText('Sentinel GRC')).toBeInTheDocument();
 });
 });

 it('renders Asset Intake label', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText('Asset Intake')).toBeInTheDocument();
 });
 });

 it('renders secure connection indicator', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText('Connexion Sécurisée')).toBeInTheDocument();
 });
 });

 it('renders shield icon', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
 });
 });

 it('renders lock icon', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
 });
 });
 });

 describe('form display', () => {
 it('shows form after hardware detection', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });
 });

 it('shows title after loading', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText('Nouvel Équipement')).toBeInTheDocument();
 });
 });

 it('shows description after loading', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText('Vérifiez les informations détectées et complétez la fiche.')).toBeInTheDocument();
 });
 });
 });

 describe('success state', () => {
 it('shows success message after form submission', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByTestId('submit-success'));

 await waitFor(() => {
 expect(screen.getByText('Enregistré !')).toBeInTheDocument();
 });
 });

 it('shows success description', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByTestId('submit-success'));

 await waitFor(() => {
 expect(screen.getByText("L'équipement a été ajouté avec succès à l'inventaire. Vous pouvez fermer cette fenêtre.")).toBeInTheDocument();
 });
 });

 it('shows check icon on success', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByTestId('submit-success'));

 await waitFor(() => {
 expect(screen.getByTestId('check-icon')).toBeInTheDocument();
 });
 });

 it('shows register another button on success', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });

 fireEvent.click(screen.getByTestId('submit-success'));

 await waitFor(() => {
 expect(screen.getByText('Enregistrer un autre appareil')).toBeInTheDocument();
 });
 });
 });

 describe('footer', () => {
 it('renders copyright notice', async () => {
 renderWithRouter('?org=test-org');

 await waitFor(() => {
 expect(screen.getByText(/Cyber Threat Consulting/)).toBeInTheDocument();
 });
 });

 it('includes current year in copyright', async () => {
 renderWithRouter('?org=test-org');

 const currentYear = new Date().getFullYear().toString();

 await waitFor(() => {
 expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();
 });
 });
 });

 describe('URL parameters', () => {
 it('passes orgId from URL to form', async () => {
 renderWithRouter('?org=my-organization');

 await waitFor(() => {
 expect(screen.getByTestId('intake-form')).toBeInTheDocument();
 });
 });
 });
});
