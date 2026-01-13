import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Team from '../Team';
import { MemoryRouter } from 'react-router-dom';
import { usePersistedState } from '../../hooks/usePersistedState';

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

// Mock Store
vi.mock('../../store', () => ({
    useStore: vi.fn().mockReturnValue({
        user: { uid: 'test-user', organizationId: 'test-org', role: 'admin' },
        addToast: vi.fn(),
        t: (k: string) => k,
        language: 'fr',
    }),
}));

// Mock useLocale to provide the required locale data
vi.mock('../../hooks/useLocale', () => ({
    useLocale: () => ({
        locale: 'fr',
        dateFnsLocale: require('date-fns/locale/fr'),
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
}));

vi.mock('../../hooks/usePersistedState', () => ({
    usePersistedState: vi.fn((_key, defaultVal) => [defaultVal, vi.fn()])
}));

// Mock Firebase
vi.mock('../../firebase', () => ({
    db: {},
    functions: {}
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

vi.mock('../../hooks/useTeamManagement', () => ({
    useTeamManagement: vi.fn()
}));
import { useTeamManagement } from '../../hooks/useTeamManagement';

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
            { id: 'u1', uid: 'u1', displayName: 'User One', email: 'user1@test.com', role: 'admin', isPending: false },
            { id: 'u2', uid: 'u2', displayName: 'User Two', email: 'user2@test.com', role: 'user', isPending: false }
        ];

        vi.mocked(useTeamManagement).mockReturnValue({
            users: mockUsers,
            joinRequests: [],
            loading: false,
            customRoles: [],
            fetchRoles: vi.fn(),
            inviteUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn(),
            checkDependencies: vi.fn(),
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
        } as unknown as ReturnType<typeof useTeamManagement>);

        render(
            <MemoryRouter>
                <Team />
            </MemoryRouter>
        );

        expect(screen.getByText('User One')).toBeInTheDocument();
        expect(screen.getByText('User Two')).toBeInTheDocument();
    });

    it('handles tab switching', async () => {
        vi.mocked(useTeamManagement).mockReturnValue({
            users: [],
            joinRequests: [],
            loading: false,
            customRoles: [],
            fetchRoles: vi.fn(),
            inviteUser: vi.fn(),
            updateUser: vi.fn(),
            deleteUser: vi.fn(),
            checkDependencies: vi.fn(),
            approveRequest: vi.fn(),
            rejectRequest: vi.fn(),
        } as unknown as ReturnType<typeof useTeamManagement>);
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
