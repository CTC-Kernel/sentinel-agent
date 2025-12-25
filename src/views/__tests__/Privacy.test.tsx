
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Privacy } from '../Privacy';
import { MemoryRouter } from 'react-router-dom';
import { usePersistedState } from '../../hooks/usePersistedState';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', displayName: 'Test User', role: 'admin' },
        addToast: vi.fn()
    }),
}));


vi.mock('../../hooks/usePersistedState', async () => {
    const React = await vi.importActual<any>('react');
    return {
        usePersistedState: (key: any, defaultVal: any) => React.useState(defaultVal)
    };
});


// Mock usePrivacy
vi.mock('../../hooks/usePrivacy', () => {
    const mockActivities = [
        {
            id: 'act1',
            name: 'Gestion RH',
            purpose: 'Gérer les employés',
            manager: 'HR Manager',
            legalBasis: 'Contrat',
            dataCategories: ['État civil', 'Bancaire / Financier'],
            status: 'Actif',
            retentionPeriod: '5 ans',
            hasDPIA: false
        },
        {
            id: 'act2',
            name: 'Newsletter',
            purpose: 'Marketing',
            manager: 'Marketing Lead',
            legalBasis: 'Consentement',
            dataCategories: ['Vie personnelle'],
            status: 'Actif',
            retentionPeriod: '3 ans',
            hasDPIA: true
        }
    ];

    return {
        usePrivacy: vi.fn().mockReturnValue({
            activities: mockActivities,
            usersList: [{ uid: 'u1', displayName: 'User 1' }],
            assetsList: [{ id: 'asset1', name: 'Server A' }],
            risksList: [{ id: 'risk1', threat: 'Data Breach' }],
            loading: false,
            selectedActivity: null,
            setSelectedActivity: vi.fn(),
            isEditing: false,
            setIsEditing: vi.fn(),
            viewingAssessmentId: null,
            setViewingAssessmentId: vi.fn(),
            showCreateModal: false,
            setShowCreateModal: vi.fn(),
            fetchData: vi.fn(),
            handleCreate: vi.fn(),
            handleUpdate: vi.fn(),
            handleDelete: vi.fn(),
            handleStartDPIA: vi.fn(),
            handleViewDPIA: vi.fn(),
            activityHistory: [],
            stats: { total: 2, sensitive: 1, dpiaMissing: 0, review: 0 },
            handleFileUpload: vi.fn()
        })
    };
});

// Mock Child Components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => null
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ onSearchChange, actions }: any) => (
        <div data-testid="premium-page-control">
            <input
                placeholder="Rechercher..."
                onChange={(e) => onSearchChange(e.target.value)}
                data-testid="search-input"
            />
            {actions}
        </div>
    )
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children, title }: any) => isOpen ? (
        <div data-testid="drawer">
            <h2>{title}</h2>
            {children}
        </div>
    ) : null
}));
vi.mock('../../components/ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen }: any) => isOpen ? <div data-testid="confirm-modal" /> : null
}));
vi.mock('../../components/collaboration/CommentSection', () => ({
    CommentSection: () => <div data-testid="comment-section" />
}));
vi.mock('../../components/suppliers/AssessmentView', () => ({
    AssessmentView: () => <div data-testid="assessment-view" />
}));

vi.mock('../../utils/permissions', () => ({
    canEditResource: vi.fn().mockReturnValue(true)
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: any) => (
            <div className={className} onClick={onClick} {...props}>{children}</div>
        )
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Privacy View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the privacy dashboard with activities', () => {
        render(
            <MemoryRouter>
                <Privacy />
            </MemoryRouter>
        );

        expect(screen.getByText('Registre des Traitements')).toBeInTheDocument();
        expect(screen.getByText('Gestion RH')).toBeInTheDocument();
        expect(screen.getByText('Newsletter')).toBeInTheDocument();
    });


    it('opens create modal when clicking new treatment', async () => {
        const { usePrivacy } = await import('../../hooks/usePrivacy');
        const setShowCreateModal = vi.fn();
        const localMockActivities = [
            { id: 'act1', name: 'Test Activity', status: 'Actif' }
        ];

        (usePrivacy as any).mockReturnValue({
            activities: localMockActivities,
            usersList: [],
            assetsList: [],
            risksList: [],
            stats: { total: 2 },
            handleCreate: vi.fn(),
            showCreateModal: false,
            setShowCreateModal
        });

        render(
            <MemoryRouter>
                <Privacy />
            </MemoryRouter>
        );

        const createBtn = screen.getByText('Nouveau Traitement');
        fireEvent.click(createBtn);
        expect(setShowCreateModal).toHaveBeenCalledWith(true);
    });

    it('filters activities', async () => {
        render(
            <MemoryRouter>
                <Privacy />
            </MemoryRouter>
        );

        const filterInput = screen.getByTestId('search-input');
        fireEvent.change(filterInput, { target: { value: 'RH' } });

        await waitFor(() => {
            expect(screen.getByText('Gestion RH')).toBeInTheDocument();
            expect(screen.queryByText('Newsletter')).not.toBeInTheDocument();
        });
    });
});
