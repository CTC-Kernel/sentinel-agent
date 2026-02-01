/**
 * Unit tests for IncidentImpactDetails component
 * Tests incident impact on assets, processes, and risks
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IncidentImpactDetails } from '../IncidentImpactDetails';
import { Incident, Asset, BusinessProcess, Risk, Criticality } from '../../../../types';

// Mock Icons
vi.mock('../../../ui/Icons', () => ({
    Server: () => <span data-testid="server-icon" />,
    Activity: () => <span data-testid="activity-icon" />,
    AlertTriangle: () => <span data-testid="alert-triangle-icon" />
}));

import { MemoryRouter } from 'react-router-dom';

// Mock Badge
vi.mock('../../../ui/Badge', () => ({
    Badge: ({ children, status, size }: { children: React.ReactNode; status: string; size?: string }) => (
        <span data-testid="badge" data-status={status} data-size={size}>{children}</span>
    )
}));

describe('IncidentImpactDetails', () => {
    const mockAssets: Asset[] = [
        {
            id: 'asset-1',
            organizationId: 'org-1',
            name: 'Main Database Server',
            type: 'Matériel',
            // criticality removed
            owner: 'IT Team',
            confidentiality: Criticality.HIGH,
            integrity: Criticality.HIGH,
            availability: Criticality.HIGH,
            location: 'Paris DC',
            createdAt: '2024-01-01'
        },
        {
            id: 'asset-2',
            organizationId: 'org-1',
            name: 'Backup Server',
            type: 'Matériel',
            // criticality removed
            owner: 'IT Team',
            confidentiality: Criticality.MEDIUM,
            integrity: Criticality.MEDIUM,
            availability: Criticality.MEDIUM,
            location: 'Lyon DC',
            createdAt: '2024-01-01'
        }
    ];

    const mockProcesses: BusinessProcess[] = [
        {
            id: 'process-1',
            organizationId: 'org-1',
            name: 'Order Processing',
            // criticality removed as it is not in BusinessProcess type
            owner: 'Operations',
            description: 'Processus critique de gestion des commandes',
            rto: '4h',
            rpo: '1h',
            priority: 'Critique',
            supportingAssetIds: []
        },
        {
            id: 'process-2',
            organizationId: 'org-1',
            name: 'Customer Support',
            // criticality removed
            owner: 'Support Team',
            description: 'Support client niveau 1 et 2',
            rto: '24h',
            rpo: '4h',
            priority: 'Moyenne',
            supportingAssetIds: []
        }
    ];

    const mockRisks: Risk[] = [
        {
            id: 'risk-1',
            organizationId: 'org-1',
            threat: 'Data Breach',
            scenario: 'Unauthorized access to sensitive data',
            score: 18,
            probability: 4,
            impact: 5,
            status: 'Ouvert',
            assetId: 'asset-1',
            vulnerability: 'Weak Password Policy',
            strategy: 'Atténuer',
            owner: 'CISO'
        },
        {
            id: 'risk-2',
            organizationId: 'org-1',
            threat: 'System Failure',
            scenario: 'Hardware malfunction',
            score: 8,
            probability: 2,
            impact: 4,
            status: 'Ouvert',
            assetId: 'asset-1',
            vulnerability: 'Old Firmware',
            strategy: 'Accepter',
            owner: 'IT Manager'
        }
    ];

    const mockIncident: Incident = {
        id: 'incident-1',
        organizationId: 'org-1',
        title: 'Security Breach',
        description: 'Unauthorized access detected on main server',
        severity: Criticality.CRITICAL,
        status: 'Nouveau',
        dateReported: '2024-01-15T10:00:00Z',
        reporter: 'Alice Martin',

        affectedAssetId: 'asset-1',
        affectedProcessId: 'process-1',
        relatedRiskId: 'risk-1'
    };

    const incidentNoLinks: Incident = {
        ...mockIncident,
        affectedAssetId: undefined,
        affectedProcessId: undefined,
        relatedRiskId: undefined
    };

    const incidentMissingAsset: Incident = {
        ...mockIncident,
        affectedAssetId: 'asset-missing'
    };

    const incidentMissingProcess: Incident = {
        ...mockIncident,
        affectedProcessId: 'process-missing'
    };

    const incidentMissingRisk: Incident = {
        ...mockIncident,
        relatedRiskId: 'risk-missing'
    };

    const defaultProps = {
        incident: mockIncident,
        assets: mockAssets,
        processes: mockProcesses,
        risks: mockRisks
    };

    describe('affected asset section', () => {
        it('renders asset header', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Actif Impacté')).toBeInTheDocument();
        });

        it('renders server icon', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('server-icon')).toBeInTheDocument();
        });

        it('displays linked asset name', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Main Database Server')).toBeInTheDocument();
        });

        it('displays asset type badge', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Matériel')).toBeInTheDocument();
        });

        it('shows no asset message when not linked', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentNoLinks} />
                </MemoryRouter>
            );

            expect(screen.getByText('Aucun actif lié')).toBeInTheDocument();
        });

        it('shows not found when asset missing', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentMissingAsset} />
                </MemoryRouter>
            );

            expect(screen.getByText('Actif introuvable')).toBeInTheDocument();
        });
    });

    describe('affected process section', () => {
        it('renders service header', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Service Impacté')).toBeInTheDocument();
        });

        it('renders activity icon', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
        });

        it('displays linked process name', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Order Processing')).toBeInTheDocument();
        });

        it('shows no service message when not linked', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentNoLinks} />
                </MemoryRouter>
            );

            expect(screen.getByText('Aucun service lié')).toBeInTheDocument();
        });

        it('shows not found when process missing', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentMissingProcess} />
                </MemoryRouter>
            );

            expect(screen.getByText('Processus introuvable')).toBeInTheDocument();
        });
    });

    describe('related risk section', () => {
        it('renders risk header', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Risque Lié')).toBeInTheDocument();
        });

        it('renders alert triangle icon', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
        });

        it('displays linked risk threat', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Data Breach')).toBeInTheDocument();
        });

        it('displays linked risk scenario', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Unauthorized access to sensitive data')).toBeInTheDocument();
        });

        it('displays score label', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('Score')).toBeInTheDocument();
        });

        it('displays risk score', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(screen.getByText('18/25')).toBeInTheDocument();
        });

        it('shows no risk message when not linked', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentNoLinks} />
                </MemoryRouter>
            );

            expect(screen.getByText('Aucun risque lié')).toBeInTheDocument();
        });

        it('shows not found when risk missing', () => {
            render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentMissingRisk} />
                </MemoryRouter>
            );

            expect(screen.getByText('Risque introuvable')).toBeInTheDocument();
        });
    });

    describe('risk score colors', () => {
        it('uses red color for high score >= 15', () => {
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(container.querySelector('.text-destructive')).toBeInTheDocument();
        });

        it('uses orange color for medium score >= 5', () => {
            const incidentMediumRisk = { ...mockIncident, relatedRiskId: 'risk-2' };
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} incident={incidentMediumRisk} />
                </MemoryRouter>
            );

            expect(container.querySelector('.text-warning')).toBeInTheDocument();
        });

        it('uses green color for low score < 8', () => {
            const lowRisks: Risk[] = [
                {
                    id: 'risk-low',
                    organizationId: 'org-1',
                    threat: 'Minor Issue',
                    scenario: 'Low impact issue',
                    score: 4,
                    probability: 2,
                    impact: 2,
                    status: 'Ouvert',
                    assetId: 'asset-1',
                    vulnerability: 'Minor config issue',
                    strategy: 'Accepter',
                    owner: 'Admin'
                }
            ];
            const incidentLowRisk = { ...mockIncident, relatedRiskId: 'risk-low' };
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails
                        {...defaultProps}
                        incident={incidentLowRisk}
                        risks={lowRisks}
                    />
                </MemoryRouter>
            );

            expect(container.querySelector('.text-success')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('has glass-premium containers', () => {
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(container.querySelectorAll('.glass-premium').length).toBe(3);
        });

        it('has grid layout', () => {
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(container.querySelector('.grid')).toBeInTheDocument();
        });

        it('risk section spans 2 columns on md', () => {
            const { container } = render(
                <MemoryRouter>
                    <IncidentImpactDetails {...defaultProps} />
                </MemoryRouter>
            );

            expect(container.querySelector('.md\\:col-span-2')).toBeInTheDocument();
        });
    });
});
