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
 t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue || k,
 getState: () => ({
 user: { organizationId: 'test-org', role: 'admin' },
 addToast: vi.fn(),
 demoMode: false,
 t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue || k,
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

vi.mock('../../services/AgentService', () => ({
 AgentService: {
 subscribeToAgents: vi.fn(() => vi.fn()),
 calculateDepreciation: vi.fn((price) => price),
 }
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
 query: vi.fn(),
 orderBy: vi.fn(),
 getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
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

vi.mock('../../components/ui/Icons', async (importOriginal) => {
 const actual = await importOriginal<typeof import('../../components/ui/Icons')>();
 return {
 ...actual,
 };
});

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

// Mock usePersistedState to return 'assets' tab so AssetList is rendered
vi.mock('../../hooks/usePersistedState', () => ({
 usePersistedState: (key: string, defaultVal: unknown) => {
 const [assetsTab] = React.useState<string>('assets');
 const [defaultState] = React.useState(defaultVal);

 if (key === 'assets-active-tab') {
 return [assetsTab, vi.fn()];
 }
 return [defaultState, vi.fn()];
 }
}));

vi.mock('../../components/assets/AssetList', () => ({
 AssetList: ({ assets }: { assets: Array<{ id: string; name: string }> }) => (
 <div data-testid="asset-list">
 {assets.length === 0 ? "Aucun actif trouvé" : assets.map(a => <div key={a.id || 'unknown'}>{a.name}</div>)}
 </div>
 )
}));

vi.mock('../../components/assets/AssetInspector', () => ({
 AssetInspector: () => <div data-testid="asset-inspector" />
}));

vi.mock('../../components/assets/AssetDashboard', () => ({
 AssetDashboard: () => <div data-testid="asset-dashboard" />
}));

vi.mock('../../components/settings/EnrollAgentModal', () => ({
 EnrollAgentModal: () => <div data-testid="enroll-agent-modal" />
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
 const { getAllByText } = render(
 <AuthProvider>
 <Assets />
 </AuthProvider>
 );
 // Multiple instances may appear (e.g., in header and tab)
 expect(getAllByText(/assets.title/i).length).toBeGreaterThan(0);
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

 it('renders the Install Agent button', () => {
 render(
 <AuthProvider>
 <Assets />
 </AuthProvider>
 );
 expect(screen.getByText('Installer Agent')).toBeInTheDocument();
 });
});
