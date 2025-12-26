
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Team from '../Team';
import { MemoryRouter } from 'react-router-dom';
import { usePersistedState } from '../../hooks/usePersistedState';
import { getDocs } from 'firebase/firestore';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        addToast: vi.fn(),
    }),
}));

vi.mock('../../hooks/usePersistedState', () => ({
    usePersistedState: vi.fn((_key, defaultVal) => [defaultVal, vi.fn()])
}));

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {}
}));

vi.mock('firebase/firestore', () => ({
    getDocs: vi.fn(),
    query: vi.fn(),
    collection: vi.fn(),
    where: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    doc: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k })
}));

// Mock Services
vi.mock('../../services/emailService', () => ({
    sendEmail: vi.fn()
}));
vi.mock('../../services/emailTemplates', () => ({
    getInvitationTemplate: vi.fn()
}));
vi.mock('../../services/logger', () => ({
    logAction: vi.fn()
}));
vi.mock('../../services/subscriptionService', () => ({
    SubscriptionService: {
        checkLimit: vi.fn().mockResolvedValue(true)
    }
}));
vi.mock('../../services/errorLogger', () => ({
    ErrorLogger: {
        logError: vi.fn(),
        handleErrorWithToast: vi.fn()
    }
}));

// Mock Utils
vi.mock('../../utils/permissions', () => ({
    hasPermission: vi.fn().mockReturnValue(true)
}));

// Mock Child Components
vi.mock('../../components/team/RoleManager', () => ({
    RoleManager: () => <div data-testid="role-manager" />
}));
vi.mock('../../components/team/GroupManager', () => ({
    GroupManager: () => <div data-testid="group-manager" />
}));
vi.mock('../../components/ui/RoleBadge', () => ({
    RoleBadge: () => <div data-testid="role-badge" />
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ children, rightActions }: { children: React.ReactNode, rightActions?: React.ReactNode }) => (
        <div data-testid="premium-page-control">
            {children}
            {rightActions}
        </div>
    )
}));
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children }: { isOpen: boolean, children: React.ReactNode }) => isOpen ? <div data-testid="drawer">{children}</div> : null
}));
vi.mock('../../components/ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen, onConfirm }: { isOpen: boolean, onConfirm: () => void }) => isOpen ? <button aria-label="Confirm" onClick={onConfirm} data-testid="confirm-btn">Confirm</button> : null
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

describe('Team View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the team dashboard and fetches users', async () => {
        const mockUsers = [
            { id: 'u1', displayName: 'User One', email: 'user1@test.com', role: 'admin' },
            { id: 'u2', displayName: 'User Two', email: 'user2@test.com', role: 'user' }
        ];

        // Mock getDocs sequence for users, invitations, and join requests
        vi.mocked(getDocs)
            .mockResolvedValueOnce({
                docs: mockUsers.map(u => ({ id: u.id, data: () => u })) as any,
                empty: false,
                size: mockUsers.length,
                query: {} as any,
                metadata: {} as any,
                forEach: (cb: (doc: unknown) => void) => mockUsers.map(u => ({ id: u.id, data: () => u })).forEach(cb),
                docChanges: () => [],
                toJSON: () => ({})
            } as any)
            .mockResolvedValueOnce({ docs: [], empty: true, size: 0, query: {} as any, metadata: {} as any, forEach: () => { }, docChanges: () => [], toJSON: () => ({}) } as any)
            .mockResolvedValueOnce({ docs: [], empty: true, size: 0, query: {} as any, metadata: {} as any, forEach: () => { }, docChanges: () => [], toJSON: () => ({}) } as any);

        render(
            <MemoryRouter>
                <Team />
            </MemoryRouter>
        );

        // Expect loading state first if possible, but we might wait for result
        await waitFor(() => {
            expect(screen.getByText('User One')).toBeInTheDocument();
            expect(screen.getByText('User Two')).toBeInTheDocument();
        });
    });

    it('handles tab switching', async () => {
        vi.mocked(getDocs).mockResolvedValue({ docs: [], empty: true, size: 0, query: {} as any, metadata: {} as any, forEach: () => { }, docChanges: () => [], toJSON: () => ({}) } as any);
        vi.mocked(usePersistedState).mockReturnValue(['roles', vi.fn()]);

        render(
            <MemoryRouter>
                <Team />
            </MemoryRouter>
        );

        expect(screen.getByTestId('role-manager')).toBeInTheDocument();
    });

    // Additional tests for invite flow, delete, etc. could be added here
});
