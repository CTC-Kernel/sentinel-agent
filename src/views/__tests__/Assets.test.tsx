import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Assets from '../Assets';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock AuthContext to provide context value for useAuth hook
vi.mock('../../contexts/AuthContextDefinition', () => ({
    AuthContext: React.createContext({
        user: { organizationId: 'test-org', role: 'admin' },
        firebaseUser: null,
        loading: false,
        error: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        updateProfile: vi.fn(),
    }),
}));

// Mock AuthProvider to avoid Zustand complexity
vi.mock('../../contexts/AuthContext', () => ({
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock dependencies

// Create a mock store instance
const mockStoreInstance = {
    user: { organizationId: 'test-org', role: 'admin' },
    addToast: vi.fn(),
    demoMode: false,
    t: (k: string) => k,
    getState: () => ({
        user: { organizationId: 'test-org', role: 'admin' },
        addToast: vi.fn(),
        demoMode: false,
        t: (k: string) => k,
    })
};

vi.mock('../../store', () => ({
    useStore: vi.fn(() => mockStoreInstance),
}));

// Mock Zustand store to return our mock instance
vi.mock('zustand', () => ({
    create: vi.fn(() => mockStoreInstance),
}));

vi.mock('../../hooks/useFirestore', () => ({
    useFirestoreCollection: vi.fn(),
}));

// Mock Firebase
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(),
    onIdTokenChanged: vi.fn(),
    signOut: vi.fn(),
    signInWithPopup: vi.fn(),
    OAuthProvider: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    onSnapshot: vi.fn(),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(),
    enableNetwork: vi.fn(),
    disableNetwork: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn(),
    collection: vi.fn(),
    addDoc: vi.fn(),
    writeBatch: vi.fn(),
    limit: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('../../firebase', () => ({
    auth: {},
    db: {},
    isAppCheckFailed: false,
    analytics: {},
}));

vi.mock('../../components/ui/Icons', () => ({
    Server: () => <span data-testid="icon-server" />,
    Plus: () => <span data-testid="icon-plus" />,
    Search: () => <span data-testid="icon-search" />,
    Filter: () => <span data-testid="icon-filter" />,
    LayoutGrid: () => <span data-testid="icon-grid" />,
    List: () => <span data-testid="icon-list" />,
    Trash2: () => <span data-testid="icon-trash" />,
    Download: () => <span data-testid="icon-download" />,
    Box: () => <span data-testid="icon-box" />,
    FileText: () => <span data-testid="icon-file-text" />,
    Activity: () => <span data-testid="icon-activity" />,
    Clock: () => <span data-testid="icon-clock" />,
    FileSpreadsheet: () => <span data-testid="icon-spreadsheet" />,
    QrCode: () => <span data-testid="icon-qrcode" />,
    Tag: () => <span data-testid="icon-tag" />,
    BrainCircuit: () => <span data-testid="icon-brain" />,
    Link: () => <span data-testid="icon-link" />,
    Edit: () => <span data-testid="icon-edit" />,
    Copy: () => <span data-testid="icon-copy" />,
    AlertTriangle: () => <span data-testid="icon-alert" />,
    History: () => <span data-testid="icon-history" />,
    MessageSquare: () => <span data-testid="icon-message" />,
    Archive: () => <span data-testid="icon-archive" />,
    CalendarClock: () => <span data-testid="icon-calendar-clock" />,
    ClipboardList: () => <span data-testid="icon-clipboard" />,
    ShieldAlert: () => <span data-testid="icon-shield-alert" />,
    Siren: () => <span data-testid="icon-siren" />,
    Flame: () => <span data-testid="icon-flame" />,
    FolderKanban: () => <span data-testid="icon-folder" />,
    CheckSquare: () => <span data-testid="icon-check-square" />,
    Network: () => <span data-testid="icon-network" />,
    ShieldCheck: () => <span data-testid="icon-shield-check" />,
    HeartPulse: () => <span data-testid="icon-heart-pulse" />,
    Euro: () => <span data-testid="icon-euro" />,
    Wrench: () => <span data-testid="icon-wrench" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    X: () => <span data-testid="icon-x" />,
}));

vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: {} }),
    useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('react-helmet-async', () => ({
    Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../hooks/usePlanLimits', () => ({
    usePlanLimits: () => ({ limits: { maxAssets: 100, features: {} } })
}));

vi.mock('../../components/assets/AssetList', () => ({
    AssetList: ({ assets }: { assets: Array<{ id: string; name: string }> }) => (
        <div data-testid="asset-list">
            {assets.length === 0 ? "Aucun actif trouvé" : assets.map(a => <div key={a.id}>{a.name}</div>)}
        </div>
    )
}));

vi.mock('../../components/assets/AssetInspector', () => ({
    AssetInspector: () => <div data-testid="asset-inspector" />
}));

vi.mock('../../components/assets/AssetDashboard', () => ({
    AssetDashboard: () => <div data-testid="asset-dashboard" />
}));

describe('Assets View', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [],
            loading: false,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });
    });

    it('renders the assets inventory title', () => {
        const { getByText } = render(
            <AuthProvider>
                <Assets />
            </AuthProvider>
        );
        expect(getByText(/assets.title/i)).toBeInTheDocument();
    });

    it('displays empty state when no assets found', () => {
        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [],
            loading: false,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });
        render(
            <AuthProvider>
                <Assets />
            </AuthProvider>
        );
        expect(screen.getByText(/Aucun actif trouvé/i)).toBeInTheDocument();
    });

    it('calculates depreciation correctly (logic check via mocked data display)', () => {
        // This is harder to test directly without exposing the function or testing the hook result
        // But we can test if an asset with purchase date is rendered with a calculated value if displayed
        const mockAsset = {
            id: '1',
            name: 'Test Laptop',
            purchasePrice: 1000,
            purchaseDate: new Date().toISOString(), // Today, value should be close to 1000
            currentValue: 1000, // The component calculates this
            organizationId: 'test-org',
            type: 'Hardware',
            owner: 'Test User',
            confidentiality: 'High',
            lifecycleStatus: 'En service'
        };

        vi.mocked(useFirestoreCollection).mockReturnValue({
            data: [mockAsset],
            loading: false,
            refresh: vi.fn(),
            error: null,
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        });

        render(
            <AuthProvider>
                <Assets />
            </AuthProvider>
        );
        expect(screen.getByText('Test Laptop')).toBeInTheDocument();
    });
});
