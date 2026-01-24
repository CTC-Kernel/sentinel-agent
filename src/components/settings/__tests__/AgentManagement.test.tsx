import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentManagement } from '../AgentManagement';
import { AgentService } from '../../../services/AgentService';
import { useStore } from '../../../store';
import { useAuth } from '../../../hooks/useAuth';
import { SentinelAgent, AgentEnrollmentToken } from '../../../types/agent';
import { vi, expect, it, describe, beforeEach } from 'vitest';

// Mock firebase/functions to avoid getReleaseInfo errors
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({
        data: {
            version: '1.0.0',
            platforms: {
                macos: { available: true, filename: 'SentinelAgent-macOS-1.0.0.dmg', size: 6600000 },
                windows: { available: false },
                linux: { available: false }
            }
        }
    }))
}));

vi.mock('../../../services/AgentService', () => ({
    AgentService: {
        subscribeToAgents: vi.fn((_orgId, onAgents) => {
            // We'll set the initial data here or in the test
            onAgents([]);
            return () => { };
        }),
        generateEnrollmentToken: vi.fn(),
        deleteAgent: vi.fn(),
    }
}));
vi.mock('../../../store');
vi.mock('../../../hooks/useAuth');

const mockUser = {
    organizationId: 'test-org',
    role: 'admin'
};

const mockAgents = [
    {
        id: 'agent-1',
        name: 'SRV-PROD-01',
        os: 'linux',
        status: 'active',
        version: '1.2.4',
        lastHeartbeat: new Date().toISOString(),
        ipAddress: '10.0.1.45',
        hostname: 'prod-app-01',
        organizationId: 'test-org'
    }
];

describe('AgentManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockReturnValue({
            user: mockUser,
            t: (key: string) => key
        } as unknown as ReturnType<typeof useStore>);

        // Mock useAuth to return claimsSynced: true so subscriptions are enabled
        vi.mocked(useAuth).mockReturnValue({
            claimsSynced: true,
            user: null,
            firebaseUser: null,
            loading: false,
            error: null,
            isAdmin: true,
            dismissBlockerError: vi.fn(),
            refreshSession: vi.fn(),
            logout: vi.fn(),
            enrollMFA: vi.fn(),
            verifyMFA: vi.fn(),
            unenrollMFA: vi.fn(),
            loginWithSSO: vi.fn(),
        });

        vi.mocked(AgentService.subscribeToAgents).mockImplementation((_orgId, onAgents) => {
            onAgents(mockAgents as unknown as SentinelAgent[]);
            return () => { };
        });
    });

    it('renders agent list', async () => {
        render(<AgentManagement />);

        await waitFor(() => {
            expect(screen.getByText('SRV-PROD-01')).toBeDefined();
            expect(screen.getByText('v1.2.4 • 10.0.1.45')).toBeDefined();
        });
    });

    it('handles token generation', async () => {
        vi.mocked(AgentService.generateEnrollmentToken).mockResolvedValue({
            token: 'test-token-123',
            expiresAt: new Date().toISOString(),
            organizationId: 'test-org'
        } as unknown as AgentEnrollmentToken);

        render(<AgentManagement />);

        const enrollButton = screen.getByText('Enrôler un Agent');
        fireEvent.click(enrollButton);

        await waitFor(() => {
            expect(screen.getByText('test-token-123')).toBeDefined();
            expect(screen.getByText("Token d'Installation")).toBeDefined();
        });
    });

    it('handles agent deletion', async () => {
        render(<AgentManagement />);

        await waitFor(() => screen.getByText('SRV-PROD-01'));

        // The delete button is rendered in the table row
        const deleteButton = screen.getByRole('button', { name: /supprimer/i });
        expect(deleteButton).toBeDefined();

        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(AgentService.deleteAgent).toHaveBeenCalledWith('test-org', 'agent-1');
        });
    });
});
