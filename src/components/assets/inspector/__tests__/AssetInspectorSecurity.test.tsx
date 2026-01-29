/**
 * Unit tests for AssetInspectorSecurity component
 * Tests security scanning and vulnerability display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetInspectorSecurity } from '../AssetInspectorSecurity';
import { Asset, Risk, Incident, Vulnerability, Criticality } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    Search: () => <span data-testid="search-icon" />,
    ShieldAlert: () => <span data-testid="shield-alert-icon" />,
    Server: () => <span data-testid="server-icon" />,
    Plus: () => <span data-testid="plus-icon" />,
    Flame: () => <span data-testid="flame-icon" />,
    Siren: () => <span data-testid="siren-icon" />
}));

// Mock Tooltip
vi.mock('../../../ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'common.inspector.security.scanShodan': 'Scan Shodan',
                'common.inspector.security.checkCVEs': 'Check CVEs (NVD)',
                'common.inspector.security.scanShodanTooltip': 'Lancer un scan Shodan',
                'common.inspector.security.checkCVEsTooltip': 'Rechercher des vulnérabilités CVE',
                'common.inspector.security.identifiedRisks': 'Risques Identifiés',
                'common.inspector.security.nvdVulnerabilities': 'Vulnérabilités NVD',
                'common.inspector.security.linkedIncidents': 'Incidents',
                'common.inspector.security.newRisk': 'Créer un nouveau risque',
                'common.inspector.security.newIncident': 'Signaler un incident',
                'common.inspector.security.criticalRisk': 'Risque Critique',
                'common.inspector.security.noRisks': 'Aucun risque associé.',
                'common.inspector.security.noIncidents': 'Aucun incident signalé.',
                'common.inspector.security.shodanResult': 'Résultat Shodan',
                'common.inspector.security.createRiskFor': 'Créer un risque pour',
            };
            return translations[key] || key;
        }
    })
}));

describe('AssetInspectorSecurity', () => {
    const mockNavigate = vi.fn();
    const mockScanShodan = vi.fn();
    const mockCheckCVEs = vi.fn();
    const mockCreateRiskFromVuln = vi.fn();

    const mockAsset: Asset = {
        id: 'asset-1',
        organizationId: 'org-1',
        name: 'Server-01',
        type: 'Matériel',
        confidentiality: Criticality.HIGH,
        integrity: Criticality.HIGH,
        availability: Criticality.HIGH,
        owner: 'user-1',
        location: 'Datacenter',
        createdAt: '2024-01-01',
        ipAddress: '192.168.1.1'
    };

    const mockVulnerabilities: Vulnerability[] = [
        {
            cveId: 'CVE-2024-1234',
            severity: 'Critical',
            score: 9.8,
            description: 'Remote code execution vulnerability',
            publishedDate: '2024-01-01',
            source: 'NVD'
        },
        {
            cveId: 'CVE-2024-5678',
            severity: 'High',
            score: 7.5,
            description: 'SQL injection vulnerability',
            publishedDate: '2024-01-01',
            source: 'NVD'
        }
    ];

    const mockRisks: Risk[] = [
        {
            id: 'risk-1',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'Ransomware Attack',
            vulnerability: 'Unpatched server',
            score: 20,
            probability: 4,
            impact: 5,
            status: 'En cours',
            strategy: 'Atténuer',
            owner: 'user-1'
        },
        {
            id: 'risk-2',
            organizationId: 'org-1',
            assetId: 'asset-1',
            threat: 'Data Breach',
            vulnerability: 'Weak passwords',
            score: 12,
            probability: 3,
            impact: 4,
            status: 'Ouvert',
            strategy: 'Atténuer',
            owner: 'user-1'
        }
    ];

    const mockIncidents: Incident[] = [
        {
            id: 'inc-1',
            organizationId: 'org-1',
            title: 'Server Downtime',
            status: 'Nouveau',
            severity: Criticality.HIGH,
            dateReported: '2024-01-15',
            description: 'Server became unresponsive',
            reporter: 'user-1'
        },
        {
            id: 'inc-2',
            organizationId: 'org-1',
            title: 'Security Alert',
            status: 'Résolu',
            severity: Criticality.MEDIUM,
            dateReported: '2024-01-10',
            description: 'Suspicious login detected',
            reporter: 'user-1'
        }
    ];

    const defaultProps = {
        selectedAsset: mockAsset,
        scanning: false,
        shodanResult: null,
        vulnerabilities: [],
        linkedRisks: [],
        linkedIncidents: [],
        scanShodan: mockScanShodan,
        checkCVEs: mockCheckCVEs,
        createRiskFromVuln: mockCreateRiskFromVuln,
        navigate: mockNavigate
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('scan buttons', () => {
        it('renders Shodan scan button', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            expect(screen.getByText('Scan Shodan')).toBeInTheDocument();
        });

        it('renders CVE check button', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            expect(screen.getByText('Check CVEs (NVD)')).toBeInTheDocument();
        });

        it('calls scanShodan when button clicked', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Lancer un scan Shodan'));

            expect(mockScanShodan).toHaveBeenCalled();
        });

        it('calls checkCVEs when button clicked', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Rechercher des vulnérabilités CVE'));

            expect(mockCheckCVEs).toHaveBeenCalled();
        });

        it('disables buttons when scanning', () => {
            render(<AssetInspectorSecurity {...defaultProps} scanning={true} />);

            expect(screen.getByLabelText('Lancer un scan Shodan')).toBeDisabled();
            expect(screen.getByLabelText('Rechercher des vulnérabilités CVE')).toBeDisabled();
        });
    });

    describe('Shodan results', () => {
        const shodanResult = {
            ip_str: '192.168.1.1',
            os: 'Linux',
            ports: [22, 80, 443],
            org: 'Test Organization'
        };

        it('displays Shodan result when available', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={shodanResult} />);

            expect(screen.getByText('Résultat Shodan')).toBeInTheDocument();
        });

        it('shows IP address', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={shodanResult} />);

            expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        });

        it('shows OS', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={shodanResult} />);

            expect(screen.getByText('Linux')).toBeInTheDocument();
        });

        it('shows ports', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={shodanResult} />);

            expect(screen.getByText('22, 80, 443')).toBeInTheDocument();
        });

        it('shows organization', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={shodanResult} />);

            expect(screen.getByText('Test Organization')).toBeInTheDocument();
        });

        it('does not show Shodan result when null', () => {
            render(<AssetInspectorSecurity {...defaultProps} shodanResult={null} />);

            expect(screen.queryByText('Résultat Shodan')).not.toBeInTheDocument();
        });
    });

    describe('vulnerabilities', () => {
        it('shows vulnerability count', () => {
            render(<AssetInspectorSecurity {...defaultProps} vulnerabilities={mockVulnerabilities} />);

            expect(screen.getByText(/Vulnérabilités NVD \(2\)/)).toBeInTheDocument();
        });

        it('displays CVE IDs', () => {
            render(<AssetInspectorSecurity {...defaultProps} vulnerabilities={mockVulnerabilities} />);

            expect(screen.getByText('CVE-2024-1234')).toBeInTheDocument();
            expect(screen.getByText('CVE-2024-5678')).toBeInTheDocument();
        });

        it('displays severity and score', () => {
            render(<AssetInspectorSecurity {...defaultProps} vulnerabilities={mockVulnerabilities} />);

            expect(screen.getByText('Critical (9.8)')).toBeInTheDocument();
        });

        it('calls createRiskFromVuln when plus button clicked', () => {
            render(<AssetInspectorSecurity {...defaultProps} vulnerabilities={mockVulnerabilities} />);

            fireEvent.click(screen.getByLabelText('Créer un risque pour CVE-2024-1234'));

            expect(mockCreateRiskFromVuln).toHaveBeenCalledWith(mockVulnerabilities[0]);
        });

        it('does not show vulnerabilities section when empty', () => {
            render(<AssetInspectorSecurity {...defaultProps} vulnerabilities={[]} />);

            expect(screen.queryByText(/Vulnérabilités NVD/)).not.toBeInTheDocument();
        });
    });

    describe('linked risks', () => {
        it('shows risk count', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedRisks={mockRisks} />);

            expect(screen.getByText(/Risques Identifiés \(2\)/)).toBeInTheDocument();
        });

        it('displays risk threats', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedRisks={mockRisks} />);

            expect(screen.getByText('Ransomware Attack')).toBeInTheDocument();
            expect(screen.getByText('Data Breach')).toBeInTheDocument();
        });

        it('displays risk scores', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedRisks={mockRisks} />);

            expect(screen.getByText('Score 20')).toBeInTheDocument();
            expect(screen.getByText('Score 12')).toBeInTheDocument();
        });

        it('shows critical risk indicator for high scores', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedRisks={mockRisks} />);

            expect(screen.getByText('Risque Critique')).toBeInTheDocument();
        });

        it('shows empty state when no risks', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedRisks={[]} />);

            expect(screen.getByText('Aucun risque associé.')).toBeInTheDocument();
        });

        it('calls navigate to create risk when new risk clicked', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Créer un nouveau risque'));

            expect(mockNavigate).toHaveBeenCalledWith('/risks', {
                state: { createForAsset: 'asset-1', assetName: 'Server-01' }
            });
        });
    });

    describe('linked incidents', () => {
        it('shows incident count', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedIncidents={mockIncidents} />);

            expect(screen.getByText(/Incidents \(2\)/)).toBeInTheDocument();
        });

        it('displays incident titles', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedIncidents={mockIncidents} />);

            expect(screen.getByText('Server Downtime')).toBeInTheDocument();
            expect(screen.getByText('Security Alert')).toBeInTheDocument();
        });

        it('shows incident status', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedIncidents={mockIncidents} />);

            expect(screen.getByText('Nouveau')).toBeInTheDocument();
            expect(screen.getByText('Résolu')).toBeInTheDocument();
        });

        it('shows empty state when no incidents', () => {
            render(<AssetInspectorSecurity {...defaultProps} linkedIncidents={[]} />);

            expect(screen.getByText('Aucun incident signalé.')).toBeInTheDocument();
        });

        it('calls navigate to create incident when button clicked', () => {
            render(<AssetInspectorSecurity {...defaultProps} />);

            fireEvent.click(screen.getByLabelText('Signaler un incident'));

            expect(mockNavigate).toHaveBeenCalledWith('/incidents', {
                state: { createForAsset: 'asset-1', assetName: 'Server-01' }
            });
        });
    });
});
