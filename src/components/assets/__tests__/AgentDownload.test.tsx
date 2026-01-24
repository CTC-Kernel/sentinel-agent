import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssetInspector } from '../AssetInspector';
import { UserProfile, Supplier } from '../../../types';

// Mock dependencies
vi.mock('../../../store', () => ({
    useStore: () => ({
        user: { uid: 'user-1', role: 'admin' },
        t: (key: string) => key
    })
}));

// Mock hook
vi.mock('../../../hooks/useInspector', () => ({
    useInspector: ({ actions }: { actions: { onCreate: () => void } }) => ({
        activeTab: 'details',
        setActiveTab: vi.fn(),
        handleUpdate: vi.fn(),
        handleCreate: actions.onCreate
    })
}));

// Mock hooks
vi.mock('../../../hooks/assets/useAssetDetails', () => ({
    useAssetDetails: () => ({
        maintenanceRecords: [],
        linkedRisks: [],
        linkedIncidents: [],
        linkedProjects: [],
        linkedAudits: [],
        linkedDocuments: [],
        linkedControls: [],
        addMaintenance: vi.fn()
    })
}));

vi.mock('../../../hooks/assets/useAssetSecurity', () => ({
    useAssetSecurity: () => ({
        scanning: false,
        shodanResult: null,
        vulnerabilities: [],
        scanShodan: vi.fn(),
        checkCVEs: vi.fn(),
        createRiskFromVuln: vi.fn()
    })
}));

// Mock complex child components to simplify test
vi.mock('../AssetForm', () => ({
    AssetForm: ({ onSubmit }: { onSubmit: (data: unknown) => void }) => (
        <form onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: 'Test Asset', type: 'Matériel', owner: 'me' });
        }}>
            <button type="submit">Create IT Asset</button>
        </form>
    )
}));

// Mock AgentDownloadModal to verify it renders
vi.mock('../AgentDownloadModal', () => ({
    AgentDownloadModal: ({ isOpen, onDownload, onClose }: { isOpen: boolean; onDownload: () => void; onClose: () => void }) => (
        isOpen ? (
            <div data-testid="agent-modal">
                <button onClick={onDownload}>Download</button>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null
    )
}));

describe('AssetInspector - Agent Download Flow', () => {
    const mockOnClose = vi.fn();
    const mockOnCreate = vi.fn();
    const mockOnUpdate = vi.fn();
    const mockOnDelete = vi.fn();

    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        selectedAsset: null,
        onUpdate: mockOnUpdate,
        onCreate: mockOnCreate,
        users: [] as UserProfile[],
        suppliers: [] as Supplier[],
        processes: [],
        canEdit: true,
        onDelete: mockOnDelete
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show agent modal when creating IT asset', async () => {
        mockOnCreate.mockResolvedValue(true); // Success

        render(
            <MemoryRouter>
                <AssetInspector {...defaultProps} />
            </MemoryRouter>
        );

        // Click create button from mocked form
        fireEvent.click(screen.getByText('Create IT Asset'));

        // Wait for onCreate to be called
        await waitFor(() => {
            expect(mockOnCreate).toHaveBeenCalled();
        });

        // Inspector should NOT close yet
        expect(mockOnClose).not.toHaveBeenCalled();

        // Modal should appear
        expect(screen.getByTestId('agent-modal')).toBeInTheDocument();
    });

    it('should close inspector when dismissing modal', async () => {
        mockOnCreate.mockResolvedValue(true);
        render(
            <MemoryRouter>
                <AssetInspector {...defaultProps} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Create IT Asset'));

        await waitFor(() => {
            expect(screen.getByTestId('agent-modal')).toBeInTheDocument();
        });

        // Click close on modal
        fireEvent.click(screen.getByText('Close'));

        expect(mockOnClose).toHaveBeenCalled();
    });
});
