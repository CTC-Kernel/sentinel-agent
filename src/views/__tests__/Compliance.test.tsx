import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Compliance } from '../Compliance';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { ComplianceInspector } from '../../components/compliance/ComplianceInspector';
import { ComplianceDashboard } from '../../components/compliance/ComplianceDashboard';
import { ComplianceList } from '../../components/compliance/ComplianceList';
import { SoAView } from '../../components/compliance/SoAView';

// Mocks
vi.mock('../../store', () => {
    const useStore = vi.fn();
    // @ts-expect-error: vitest mock logic requires partial implementation
    useStore.getState = vi.fn(() => ({
        customRoles: [],
        user: { organizationId: 'test-org', role: 'rssi', uid: 'test-user' }
    }));
    return { useStore };
});

vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    __esModule: true,
    default: vi.fn(),
    collection: vi.fn(() => ({ type: 'collection' })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    doc: vi.fn(() => ({ id: 'test-id' })),
    updateDoc: vi.fn(),
    writeBatch: vi.fn(() => ({
        set: vi.fn(),
        commit: vi.fn()
    })),
    arrayUnion: vi.fn(),
    query: vi.fn(() => ({ type: 'query' })),
    where: vi.fn(() => ({ type: 'constraint' })),
    limit: vi.fn(() => ({ type: 'constraint' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'test-doc-id' })),
    memoryLocalCache: vi.fn(),
}));

vi.mock('../../hooks/useComplianceActions', () => ({
    useComplianceActions: vi.fn(() => ({
        createRisk: vi.fn(),
        createAudit: vi.fn(),
        handleLinkDocument: vi.fn(),
    })),
}));

vi.mock('../../hooks/useComplianceData', () => ({
    useComplianceData: vi.fn(() => ({
        filteredControls: [],
        risks: [],
        findings: [],
        documents: [],
        usersList: [],
        assets: [],
        suppliers: [],
        projects: [],
        loading: false,
    })),
}));

vi.mock('../../hooks/useComplianceDataSeeder', () => ({
    useComplianceDataSeeder: vi.fn(() => ({
        seedControls: vi.fn(),
    })),
}));

vi.mock('../../hooks/projects/useProjectLogic', () => ({
    useProjectLogic: vi.fn(() => ({
        handleProjectFormSubmit: vi.fn(),
        isSubmitting: false,
    })),
}));

vi.mock('../../hooks/documents/useDocumentActions', () => ({
    useDocumentActions: vi.fn(() => ({
        handleCreate: vi.fn(),
    })),
}));

vi.mock('../../hooks/documents/useDocumentsData', () => ({
    useDocumentsData: vi.fn(() => ({
        folders: [],
    })),
}));

vi.mock('../../components/compliance/ComplianceInspector', () => ({
    ComplianceInspector: vi.fn(() => <div data-testid="compliance-inspector">Inspector</div>),
}));

vi.mock('../../components/compliance/ComplianceDashboard', () => ({
    ComplianceDashboard: vi.fn(() => <div data-testid="compliance-dashboard">Dashboard</div>),
}));

vi.mock('../../components/compliance/ComplianceList', () => ({
    ComplianceList: vi.fn(() => <div data-testid="compliance-list">List</div>),
}));

vi.mock('../../components/compliance/SoAView', () => ({
    SoAView: vi.fn(() => <div data-testid="soa-view">SoA</div>),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('Compliance View', () => {
    const mockUser = {
        uid: 'test-user',
        email: 'test@example.com',
        role: 'rssi' as const,
        displayName: 'Test User',
        organizationId: 'test-org',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockImplementation(() => ({
            user: mockUser,
            addToast: vi.fn(),
            t: (key: string) => key,
        }));
    });

    it('renders correctly with default state', () => {
        render(<Compliance />);
        
        expect(screen.getByText('compliance.title')).toBeInTheDocument();
        expect(screen.getByText('compliance.subtitle')).toBeInTheDocument();
    });

    it('displays framework tabs', () => {
        render(<Compliance />);
        
        expect(screen.getByText('frameworks.ISO27001')).toBeInTheDocument();
        expect(screen.getByText('frameworks.ISO22301')).toBeInTheDocument();
    });

    it('switches between tabs correctly', async () => {
        render(<Compliance />);
        
        // Should start with overview tab
        expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
        
        // Click on controls tab
        const controlsTab = screen.getByText('compliance.controls');
        fireEvent.click(controlsTab);
        
        await waitFor(() => {
            expect(screen.getByTestId('compliance-list')).toBeInTheDocument();
        });
        
        // Click on SoA tab
        const soaTab = screen.getByText('compliance.soa');
        fireEvent.click(soaTab);
        
        await waitFor(() => {
            expect(screen.getByTestId('soa-view')).toBeInTheDocument();
        });
    });

    it('switches frameworks correctly', async () => {
        render(<Compliance />);
        
        // Click on ISO22301 framework
        const iso22301Tab = screen.getByText('frameworks.ISO22301');
        fireEvent.click(iso22301Tab);
        
        await waitFor(() => {
            expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
        });
    });

    it('opens inspector when control is selected', async () => {
        render(<Compliance />);
        
        // Should not show inspector initially
        expect(screen.queryByTestId('compliance-inspector')).not.toBeInTheDocument();
        
        // Simulate control selection via URL params
        window.history.pushState({}, '', '/compliance?id=test-control');
        
        await waitFor(() => {
            expect(screen.getByTestId('compliance-inspector')).toBeInTheDocument();
        });
    });

    it('shows creation buttons for users with edit permissions', () => {
        render(<Compliance />);
        
        // Should show creation buttons for RSSI role
        expect(screen.getByText('compliance.newRisk')).toBeInTheDocument();
    });

    it('hides creation buttons for users without edit permissions', () => {
        (useStore as any).mockImplementation(() => ({
            user: { ...mockUser, role: 'user' as const },
            addToast: vi.fn(),
            t: (key: string) => key,
        }));
        
        render(<Compliance />);
        
        // Should not show creation buttons for user role
        expect(screen.queryByText('compliance.newRisk')).not.toBeInTheDocument();
    });

    it('handles framework switching with proper data loading', async () => {
        render(<Compliance />);
        
        // Switch to NIS2 framework
        const nis2Tab = screen.getByText('frameworks.NIS2');
        fireEvent.click(nis2Tab);
        
        await waitFor(() => {
            expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
        });
    });

    it('displays proper empty state when no controls', () => {
        render(<Compliance />);
        
        // Should show empty state in dashboard
        expect(screen.getByTestId('compliance-dashboard')).toBeInTheDocument();
    });

    it('handles search and filtering', async () => {
        render(<Compliance />);
        
        // Switch to controls tab
        const controlsTab = screen.getByText('compliance.controls');
        fireEvent.click(controlsTab);
        
        await waitFor(() => {
            expect(screen.getByTestId('compliance-list')).toBeInTheDocument();
        });
        
        // Should show search input
        const searchInput = screen.getByPlaceholderText('Rechercher un contrôle (code, nom...)');
        expect(searchInput).toBeInTheDocument();
    });

    it('handles keyboard navigation', () => {
        render(<Compliance />);
        
        // Test tab navigation with keyboard
        fireEvent.keyDown(screen.getByText('compliance.controls'), { key: 'Enter' });
        
        expect(screen.getByText('compliance.controls')).toBeInTheDocument();
    });
});
