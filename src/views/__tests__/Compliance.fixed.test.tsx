import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Compliance } from '../Compliance';

// Mock the dependencies
vi.mock('react-router-dom', () => ({
    useLocation: () => ({
        pathname: '/compliance',
        search: '',
        hash: '',
        state: null,
        key: 'default'
    })
}));

vi.mock('../../store', () => {
    const useStore = vi.fn();
    // @ts-expect-error: vitest mock logic requires partial implementation
    useStore.getState = vi.fn(() => ({
        customRoles: [],
        user: { 
            organizationId: 'test-org', 
            role: 'rssi', 
            uid: 'test-user' 
        },
        addToast: vi.fn(),
        t: (key: string) => {
            const translations: Record<string, string> = {
                'compliance.title': 'Conformité',
                'compliance.subtitle': 'Gérez votre conformité',
                'compliance.overview': 'Vue d\'ensemble',
                'compliance.controls': 'Contrôles',
                'compliance.soa': 'SoA',
                'compliance.newRisk': 'Nouveau Risque',
                'frameworks.ISO27001': 'ISO 27001 (Sécurité SI)',
                'frameworks.ISO22301': 'ISO 22301 (Continuité)',
                'frameworks.NIS2': 'NIS 2 (Cyber UE)'
            };
            return translations[key] || key;
        }
    })
}));

vi.mock('../../hooks/useComplianceData', () => ({
    useComplianceData: () => ({
        filteredControls: [],
        risks: [],
        findings: [],
        documents: [],
        usersList: [],
        assets: [],
        suppliers: [],
        projects: [],
        loading: false,
    }),
}));

vi.mock('../../hooks/useComplianceDataSeeder', () => ({
    useComplianceDataSeeder: () => ({
        seedControls: vi.fn(),
    }),
}));

describe('Compliance View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        render(<Compliance />);
        expect(screen.getByText('Conformité')).toBeInTheDocument();
    });

    it('displays framework selector', () => {
        render(<Compliance />);
        expect(screen.getByText('ISO 27001 (Sécurité SI)')).toBeInTheDocument();
        expect(screen.getByText('ISO 22301 (Continuité)')).toBeInTheDocument();
        expect(screen.getByText('NIS 2 (Cyber UE)')).toBeInTheDocument();
    });

    it('displays navigation tabs', () => {
        render(<Compliance />);
        expect(screen.getByText('Vue d\'ensemble')).toBeInTheDocument();
        expect(screen.getByText('Contrôles')).toBeInTheDocument();
        expect(screen.getByText('SoA')).toBeInTheDocument();
    });

    it('displays dashboard when no controls', () => {
        render(<Compliance />);
        expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
    });
});
