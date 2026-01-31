
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Continuity } from '../Continuity';
import { MemoryRouter } from 'react-router-dom';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'continuity.title': 'Continuité d\'Activité',
                'continuity.subtitle': 'Gestion de la continuité d\'activité et de la résilience',
                'continuity.keywords': 'BIA, PCA, PRA, Crise, Audit',
                'continuity.deleteDrillTitle': 'Supprimer l\'exercice',
                'continuity.deleteDrillMessage': 'Êtes-vous sûr de vouloir supprimer cet exercice de continuité ?',
                'continuity.editProcess': 'Modifier Processus',
                'continuity.newProcess': 'Nouveau Processus',
                'continuity.tabs.overview': 'Vue d\'ensemble',
                'continuity.tabs.bia': 'BIA',
                'continuity.tabs.strategies': 'Stratégies',
                'continuity.tabs.pra': 'PRA',
                'continuity.tabs.drills': 'Exercices',
                'continuity.tabs.tlpt': 'Tests de Résilience (TLPT)',
                'continuity.tabs.crisis': 'Gestion de Crise'
            };
            return translations[key] || key;
        }
    })
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

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
    __esModule: true,
    ...vi.importActual('firebase/firestore'),
    collection: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    onSnapshot: vi.fn((_query, onNext) => {
        onNext({
            docs: [],
            empty: true,
            forEach: (callback: () => void) => { callback(); }
        });
        return () => ({}); // Return unsubscribe function
    }),
    doc: vi.fn().mockReturnThis(),
    getDoc: vi.fn().mockResolvedValue({
        exists: () => false,
        data: () => ({}),
        id: 'test-doc',
    }),
    getDocs: vi.fn().mockResolvedValue({
        docs: [],
        empty: true,
        forEach: (callback: () => void) => { callback(); }
    }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    addDoc: vi.fn().mockResolvedValue({ id: 'new-doc' }),
    serverTimestamp: vi.fn(() => new Date().toISOString()),
}));

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        addToast: vi.fn(),
        t: (k: string) => {
            // Mock translation keys to actual values
            const translations: Record<string, string> = {
                'continuity.title': 'Continuité d\'Activité',
                'continuity.subtitle': 'Gérez votre plan de continuité',
                'continuity.tabs.overview': 'Vue d\'ensemble',
                'continuity.tabs.bia': 'BIA',
                'continuity.tabs.strategies': 'Stratégies',
                'continuity.tabs.drills': 'Exercices',
                'continuity.tabs.crisis': 'Gestion de crise'
            };
            return translations[k] || k;
        }
    }),
}));

vi.mock('../../hooks/usePersistedState', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        usePersistedState: (_key: string, defaultVal: unknown) => React.useState(defaultVal)
    };
});

// Mock useFirestoreCollection
const mockProcesses = [
    { id: 'p1', name: 'Process A', rto: '4h', rpo: '1h', status: 'Active' },
    { id: 'p2', name: 'Process B', rto: '24h', rpo: '4h', status: 'Draft' }
];

vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn((collectionName) => {
        if (collectionName === 'business_processes') return { data: mockProcesses, loading: false, refresh: vi.fn() };
        if (collectionName === 'bcp_drills') return { data: [], loading: false, refresh: vi.fn() };
        return { data: [], loading: false, refresh: vi.fn() };
    })
}));

// Mock Firebase functions
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn()
}));

vi.mock('../../firebase', () => ({
    db: {},
    analytics: {
        logEvent: vi.fn()
    },
    auth: {},
    storage: {},
    functions: {}
}));

// Mock Child Components
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => null
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => null
}));
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));
vi.mock('../../components/ui/ScrollableTabs', () => ({
    ScrollableTabs: ({ tabs, onTabChange }: { tabs: Array<{ id: string; label: string }>, onTabChange: (id: string) => void }) => (
        <div>
            {tabs.map((t: { id: string; label: string }) => (
                <button aria-label={t.label} key={t.id || 'unknown'} onClick={() => onTabChange(t.id)}>{t.label}</button>
            ))}
        </div>
    )
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ onSearchChange, actions }: { onSearchChange: (val: string) => void, actions?: React.ReactNode }) => (
        <div>
            <input aria-label="Search" data-testid="search-input" onChange={(e) => onSearchChange(e.target.value)} />
            {actions}
        </div>
    )
}));

// Mock Sub-components
vi.mock('../../components/continuity/ContinuityDashboard', () => ({
    ContinuityDashboard: () => <div data-testid="continuity-dashboard" />
}));
vi.mock('../../components/continuity/ContinuityBIA', () => ({
    ContinuityBIA: ({ processes }: { processes: Array<{ id: string; name: string }> }) => (
        <div data-testid="continuity-bia">
            {processes.map((p: { id: string; name: string }) => <div key={p.id || 'unknown'}>{p.name}</div>)}
        </div>
    )
}));
vi.mock('../../components/continuity/ContinuityDrills', () => ({
    ContinuityDrills: () => <div data-testid="continuity-drills" />
}));
vi.mock('../../components/continuity/ContinuityStrategies', () => ({
    ContinuityStrategies: () => <div data-testid="continuity-strategies" />
}));
vi.mock('../../components/continuity/ContinuityCrisis', () => ({
    ContinuityCrisis: () => <div data-testid="continuity-crisis" />
}));
vi.mock('../../components/continuity/ProcessFormModal', () => ({
    ProcessFormModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="process-form-modal" /> : null
}));
vi.mock('../../components/continuity/inspector/DrillInspector', () => ({
    DrillInspector: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="drill-inspector" /> : null
}));
vi.mock('../../components/continuity/ProcessInspector', () => ({
    ProcessInspector: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="process-inspector" /> : null
}));
vi.mock('../../components/continuity/ContinuityContent', () => ({
    ContinuityContent: ({ activeTab }: { activeTab: string }) => (
        <div>
            {activeTab === 'overview' && <div data-testid="continuity-dashboard" />}
            {activeTab === 'bia' && <div data-testid="continuity-bia" />}
        </div>
    )
}));
vi.mock('../../utils/pdfGenerator', () => ({
    generateContinuityReport: vi.fn()
}));

// Mock useContinuityData
vi.mock('../../hooks/continuity/useContinuityData', () => ({
    useContinuityData: () => ({
        processes: [
            { id: 'p1', name: 'Process A', rto: '4h', rpo: '1h', status: 'Active' },
            { id: 'p2', name: 'Process B', rto: '24h', rpo: '4h', status: 'Draft' }
        ],
        drills: [],
        assets: [],
        risks: [],
        suppliers: [],
        users: [],
        incidents: [],
        loading: false
    })
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('Continuity View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the continuity dashboard by default', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Continuity />
            </MemoryRouter>
        );

        expect(screen.getByText('Continuité d\'Activité')).toBeInTheDocument();
        expect(screen.getByTestId('continuity-dashboard')).toBeInTheDocument();
    });

    it('switches to BIA tab and renders processes', () => {
        render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Continuity />
            </MemoryRouter>
        );

        const biaTab = screen.getByText('BIA');
        fireEvent.click(biaTab);

        expect(screen.getByTestId('continuity-bia')).toBeInTheDocument();
    });
});
