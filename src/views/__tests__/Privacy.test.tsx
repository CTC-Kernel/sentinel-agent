
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Privacy } from '../Privacy';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            const translations: Record<string, string> = {
                'privacy.title': 'Registre RGPD',
                'privacy.subtitle': 'Registre des Activités de Traitement (ROPA) - Art. 30.',
                'privacy.keywords': 'RGPD, ROPA, Privacy, Confidentialité',
                'privacy.breadcrumb': 'RGPD',
                'privacy.formInvalid': 'Formulaire invalide. Champs en erreur',
                'privacy.deleteTitle': 'Supprimer le traitement ?',
                'privacy.deleteMessage': `Êtes-vous sûr de vouloir supprimer ${params?.name || ''} ?`,
                'privacy.newActivity': 'Nouveau Traitement',
                'privacy.newActivitySubtitle': 'Ajoutez une nouvelle activité de traitement au registre.',
                'privacy.registryLabel': 'Registre des Traitements',
                'privacy.activitiesIdentified': 'Traitements identifiés',
                'privacy.searchPlaceholder': 'Rechercher un traitement (ex: Paie, CRM)...',
                'privacy.exportRegistry': 'Exporter le Registre',
                'privacy.emptyTitle': 'Aucun traitement trouvé',
                'privacy.emptySearch': 'Aucun traitement ne correspond à votre recherche.',
                'privacy.emptyDescription': 'Commencez par ajouter vos activités de traitement au registre.',
                'privacy.stats.sensitiveData': 'Données Sensibles',
                'privacy.stats.priority': 'Prioritaire',
                'privacy.stats.dpiaRequired': 'DPIA Requis',
                'privacy.stats.toComplete': 'à réaliser',
                'privacy.stats.inProgress': 'En Projet',
                'privacy.stats.activities': 'Traitements',
                'privacy.stats.activeCompliance': 'Conformité Actifs',
                'common.import': 'Importer'
            };
            return translations[key] || key;
        }
    })
}));

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', displayName: 'Test User', role: 'admin' },
        addToast: vi.fn(),
        language: 'fr',
    }),
}));

// Mock useLocale to provide the required locale data
vi.mock('../../hooks/useLocale', async () => {
    const { fr } = await import('date-fns/locale');
    return {
        useLocale: () => ({
            locale: 'fr',
            dateFnsLocale: fr,
            zodMessages: {
                required: 'Ce champ est requis',
                invalidType: 'Type de valeur invalide',
                invalidString: 'Ce champ doit être du texte',
                tooShort: (min: number) => `Minimum ${min} caractères requis`,
                tooLong: (max: number) => `Maximum ${max} caractères autorisés`,
                invalidEmail: 'Adresse email invalide',
                invalidUrl: 'URL invalide',
                invalidUuid: 'Identifiant invalide',
                invalidRegex: 'Format invalide',
                invalidNumber: 'Veuillez entrer un nombre valide',
                notInteger: 'Veuillez entrer un nombre entier',
                tooSmall: (min: number) => `La valeur doit être au moins ${min}`,
                tooBig: (max: number) => `La valeur doit être au maximum ${max}`,
                notPositive: 'La valeur doit être positive',
                notNegative: 'La valeur doit être négative',
                notNonNegative: 'La valeur ne peut pas être négative',
                invalidDate: 'Date invalide',
                arrayTooShort: (min: number) => `Sélectionnez au moins ${min} élément${min > 1 ? 's' : ''}`,
                arrayTooLong: (max: number) => `Maximum ${max} élément${max > 1 ? 's' : ''} autorisé${max > 1 ? 's' : ''}`,
                invalidEnum: (options: string[]) => `Valeur invalide. Options: ${options.join(', ')}`,
                custom: 'Valeur invalide',
            },
            formatDate: (date: Date) => date.toLocaleDateString('fr-FR'),
            formatNumber: (num: number) => num.toLocaleString('fr-FR'),
        }),
    };
});

vi.mock('../../hooks/usePersistedState', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        usePersistedState: (_key: string, defaultVal: unknown) => React.useState(defaultVal)
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
    PremiumPageControl: ({ onSearchChange, actions }: { onSearchChange: (val: string) => void, actions?: React.ReactNode }) => (
        <div data-testid="premium-page-control">
            <input
                aria-label="Rechercher"
                placeholder="Rechercher..."
                onChange={(e) => onSearchChange(e.target.value)}
                data-testid="search-input"
            />
            {actions}
        </div>
    )
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children, title }: { isOpen: boolean, children: React.ReactNode, title: string }) => isOpen ? (
        <div data-testid="drawer">
            <h2>{title}</h2>
            {children}
        </div>
    ) : null
}));
vi.mock('../../components/ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="confirm-modal" /> : null
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
        div: ({ children, className, onClick, ...props }: React.ComponentProps<'div'>) => (
            onClick ? (
                <button
                    className={className}
                    onClick={onClick as unknown as React.MouseEventHandler<HTMLButtonElement>}
                    {...props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>}
                >
                    {children}
                </button>
            ) : (
                <div className={className} {...props}>{children}</div>
            )
        )
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Privacy View', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { usePrivacy } = await import('../../hooks/usePrivacy');
        (usePrivacy as unknown as Mock).mockReturnValue({
            activities: [
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
            ],
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
        });
    });

    it('renders the privacy dashboard with activities', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            {
                id: 'act1',
                name: 'Test Activity',
                status: 'Actif',
                purpose: 'Test Purpose',
                manager: 'Test Manager',
                legalBasis: 'Intérêt Légitime',
                dataCategories: [],
                retentionPeriod: '5 ans',
                hasDPIA: false
            }
        ];

        (usePrivacy as unknown as Mock).mockReturnValue({
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
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Privacy />
            </MemoryRouter>
        );

        const createBtn = screen.getByText('Nouveau Traitement');
        fireEvent.click(createBtn);
        expect(setShowCreateModal).toHaveBeenCalledWith(true);
    });

    it('filters activities', async () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
