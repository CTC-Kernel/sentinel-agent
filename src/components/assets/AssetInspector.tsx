import React from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { useInspector } from '../../hooks/useInspector';
import { Asset, UserProfile, Supplier, BusinessProcess } from '../../types';
import { AssetFormData } from '../../schemas/assetSchema';
import { AssetForm } from './AssetForm';
import { RelationshipGraph } from '../RelationshipGraph';
import { AssetAIAssistant } from './AssetAIAssistant';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { AssetInspectorSecurity } from './inspector/AssetInspectorSecurity';
import { AssetInspectorLifecycle } from './inspector/AssetInspectorLifecycle';
import { AssetInspectorCompliance } from './inspector/AssetInspectorCompliance';
import { AssetInspectorProjects } from './inspector/AssetInspectorProjects';
import { AssetInspectorAudits } from './inspector/AssetInspectorAudits';
import { AssetInspectorDocuments } from './inspector/AssetInspectorDocuments';
import { AssetInspectorHistory } from './inspector/AssetInspectorHistory';
import { AgentDownloadModal } from './AgentDownloadModal';
import { useAssetDetails } from '../../hooks/assets/useAssetDetails';
import { useAssetSecurity } from '../../hooks/assets/useAssetSecurity';
import { useStore } from '../../store';
import { canDeleteResource } from '../../utils/permissions';
import { Trash2 } from '../ui/Icons';
import {
    ShieldAlert,
    FolderKanban, CheckSquare,
    FileText, History, Plus, Server
} from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, RefreshCw, Shield, Network, BrainCircuit, MessageSquare } from '../ui/Icons';
import { Button } from '../ui/button';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

interface AssetInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAsset?: Asset | null;
    onUpdate: (id: string, data: AssetFormData) => Promise<boolean | string>;
    onCreate: (data: AssetFormData) => Promise<boolean | string>;
    users: UserProfile[];
    suppliers: Supplier[];
    processes: BusinessProcess[];
    canEdit: boolean;
    onDelete: (id: string, name: string) => void;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
    isOpen,
    onClose,
    selectedAsset,
    onUpdate,
    onCreate,
    users,
    suppliers,
    processes,
    canEdit,
    onDelete
}) => {
    const { user, t } = useStore();
    const deletingRef = React.useRef(false);

    const canDelete = React.useMemo(() => {
        if (!user) return false;
        return canDeleteResource(user, 'Asset');
    }, [user]);

    const handleDelete = () => {
        if (deletingRef.current || !selectedAsset || !onDelete) return;
        deletingRef.current = true;
        onDelete(selectedAsset.id, selectedAsset.name);
        // Reset after a short delay to allow the operation to complete
        setTimeout(() => { deletingRef.current = false; }, 2000);
    };

    const navigate = useNavigate();

    // Memoize tabs configuration
    const tabs = React.useMemo(() => {
        const baseTabs = [{ id: 'details', label: t('assets.inspector.tabs.details', { defaultValue: 'Détails' }), icon: LayoutDashboard }];
        if (!selectedAsset) return baseTabs;

        return [
            ...baseTabs,
            { id: 'lifecycle', label: t('assets.inspector.tabs.lifecycle', { defaultValue: 'Cycle de Vie' }), icon: RefreshCw },
            { id: 'security', label: t('assets.inspector.tabs.security', { defaultValue: 'Sécurité' }), icon: ShieldAlert },
            { id: 'compliance', label: t('assets.inspector.tabs.compliance', { defaultValue: 'Conformité' }), icon: Shield },
            { id: 'projects', label: t('assets.inspector.tabs.projects', { defaultValue: 'Projets' }), icon: FolderKanban },
            { id: 'audits', label: t('assets.inspector.tabs.audits', { defaultValue: 'Audits' }), icon: CheckSquare },
            { id: 'documents', label: t('assets.inspector.tabs.documents', { defaultValue: 'Documents' }), icon: FileText },
            { id: 'history', label: t('assets.inspector.tabs.history', { defaultValue: 'Historique' }), icon: History },
            { id: 'graph', label: t('assets.inspector.tabs.graph', { defaultValue: 'Graphe' }), icon: Network },
            { id: 'intelligence', label: t('assets.inspector.tabs.intelligence', { defaultValue: 'Intelligence' }), icon: BrainCircuit },
            { id: 'comments', label: t('assets.inspector.tabs.discussion', { defaultValue: 'Discussion' }), icon: MessageSquare }
        ];
    }, [selectedAsset, t]);

    // Agent Download Modal State
    const [showAgentModal, setShowAgentModal] = React.useState(false);
    const [createdAssetName, setCreatedAssetName] = React.useState<string>('');
    const [isFormDirty, setIsFormDirty] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Use standardized Inspector hook
    const {
        activeTab,
        setActiveTab,
        handleUpdate: handleHookUpdate,
        handleCreate: handleHookCreate
    } = useInspector({
        entity: selectedAsset || null,
        tabs,
        moduleName: 'Asset',
        actions: {
            onUpdate: async (id, data) => {
                setIsSubmitting(true);
                try {
                    const result = await onUpdate(id, data as AssetFormData);
                    if (result) setIsFormDirty(false);
                    return result;
                } finally {
                    setIsSubmitting(false);
                }
            },
            onCreate: async (data) => {
                setIsSubmitting(true);
                const formData = data as AssetFormData;
                try {
                    const result = await onCreate(formData);

                    if (result === true || typeof result === 'string') {
                        setIsFormDirty(false);
                        // Check if IT Asset to propose agent
                        // Check if IT Asset to propose agent
                        if (formData.type === 'Matériel') {
                            setCreatedAssetName(formData.name);
                            setShowAgentModal(true);
                            // Do NOT close inspector immediately to allow modal to show
                            // Inspector will be closed when user dismisses modal or downloads
                        } else {
                            onClose();
                        }
                    }
                    return result;
                } finally {
                    setIsSubmitting(false);
                }
            },
            onDelete: async (id, name) => onDelete(id, name)
        },
        getEntityName: (asset) => asset.name
    });

    const handleDownloadAgent = () => {
        // Now handled inside the modal for simulation, but we ensure state is cleared
        setShowAgentModal(false);
        onClose();
    };

    const handleCloseAgentModal = () => {
        setShowAgentModal(false);
        onClose();
    };

    const {
        maintenanceRecords,
        linkedRisks,
        linkedIncidents,
        linkedProjects,
        linkedAudits,
        linkedDocuments,
        linkedControls,
        addMaintenance
    } = useAssetDetails(selectedAsset || null);

    const {
        scanning,
        shodanResult,
        vulnerabilities,
        scanShodan,
        checkCVEs,
        createRiskFromVuln
    } = useAssetSecurity(selectedAsset || null);

    // Optimized subtitle data
    const ownerInfo = React.useMemo(() => {
        if (!selectedAsset) return null;
        const ownerUser = users?.find(u => u.displayName === selectedAsset.owner || u.email === selectedAsset.owner);
        return {
            avatar: getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role),
            name: selectedAsset.owner
        };
    }, [selectedAsset, users]);

    // Tabs defined above for both hook and render

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);



    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={selectedAsset ? selectedAsset.name : t('assets.inspector.newAsset', { defaultValue: 'Nouvel Actif' })}
            subtitle={
                selectedAsset && ownerInfo ? (
                    <div className="flex items-center gap-2 mt-1">
                        <span>{selectedAsset.type}</span>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex items-center gap-1.5">
                            <img alt={`${ownerInfo.name} avatar`}
                                src={ownerInfo.avatar}
                                className="w-4 h-4 rounded-full object-cover bg-muted/30"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = getUserAvatarUrl(null, 'user');
                                }}
                                role="presentation"
                            />
                            <span>{ownerInfo.name}</span>
                        </div>
                    </div>
                ) : t('assets.inspector.addNewAsset', { defaultValue: "Ajouter un nouvel actif à l'inventaire" })
            }
            icon={selectedAsset ? Server : Plus}
            statusBadge={selectedAsset ? (
                <div className="flex gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded-3xl text-xs font-bold uppercase tracking-wider ${selectedAsset.lifecycleStatus === 'En service' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {selectedAsset.lifecycleStatus || 'Neuf'}
                    </span>
                    {canDelete && selectedAsset && (
                        <CustomTooltip content={t('assets.deleteAssetTooltip')}>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); if (confirm("Confirmer la suppression ?")) handleDelete(); }}
                                className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                    )}
                </div>
            ) : null}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasUnsavedChanges={isFormDirty}
        >

            <AgentDownloadModal
                isOpen={showAgentModal}
                onClose={handleCloseAgentModal}
                onDownload={handleDownloadAgent}
                assetName={createdAssetName}
            />

            <div className="space-y-8 max-w-7xl mx-auto">
                {activeTab === 'details' && (
                    <div className="space-y-6 sm:space-y-8">
                        <!-- required field validation -->
<AssetForm
                            initialData={selectedAsset || undefined}
                            onSubmit={async (data) => {
                                if (selectedAsset) {
                                    await handleHookUpdate(data);
                                } else {
                                    await handleHookCreate(data);
                                }
                            }}
                            usersList={users}
                            suppliers={suppliers}
                            isEditing={!!selectedAsset}
                            onCancel={onClose}
                            readOnly={!canEdit}
                            onDirtyChange={setIsFormDirty}
                            isLoading={isSubmitting}
                        />

                    </div>
                )}

                {activeTab === 'lifecycle' && selectedAsset && (
                    <AssetInspectorLifecycle
                        selectedAsset={selectedAsset}
                        maintenanceRecords={maintenanceRecords}
                        addMaintenance={addMaintenance}
                        canEdit={canEdit}
                    />
                )}

                {activeTab === 'security' && selectedAsset && (
                    <AssetInspectorSecurity
                        selectedAsset={selectedAsset}
                        scanning={scanning}
                        shodanResult={shodanResult}
                        vulnerabilities={vulnerabilities}
                        linkedRisks={linkedRisks}
                        linkedIncidents={linkedIncidents}
                        scanShodan={scanShodan}
                        checkCVEs={checkCVEs}
                        createRiskFromVuln={createRiskFromVuln}
                        navigate={navigate}
                    />
                )}

                {activeTab === 'compliance' && selectedAsset && (
                    <AssetInspectorCompliance
                        selectedAsset={selectedAsset}
                        linkedControls={linkedControls}
                        processes={processes}
                    />
                )}

                {activeTab === 'projects' && selectedAsset && (
                    <AssetInspectorProjects
                        selectedAsset={selectedAsset}
                        linkedProjects={linkedProjects}
                    />
                )}

                {activeTab === 'audits' && selectedAsset && (
                    <AssetInspectorAudits
                        linkedAudits={linkedAudits}
                    />
                )}

                {activeTab === 'documents' && selectedAsset && (
                    <AssetInspectorDocuments
                        linkedDocuments={linkedDocuments}
                    />
                )}

                {activeTab === 'history' && selectedAsset && (
                    <AssetInspectorHistory
                        selectedAsset={selectedAsset}
                    />
                )}

                {activeTab === 'graph' && selectedAsset && (
                    <div className="h-[500px]">
                        <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                    </div>
                )}

                {activeTab === 'intelligence' && selectedAsset && (
                    <div className="h-full overflow-y-auto p-6">
                        <AssetAIAssistant
                            asset={selectedAsset}
                            onUpdate={(updates) => handleHookUpdate(updates)}
                        />
                    </div>
                )}

                {activeTab === 'comments' && selectedAsset && (
                    <div className="h-full">
                        <DiscussionPanel
                            collectionName="assets"
                            documentId={selectedAsset.id}
                            title={`Discussion - ${selectedAsset.name}`}
                            enableSearch={true}
                            enableFilters={true}
                            enableExport={true}
                            enableNotifications={true}
                        />
                    </div>
                )}
            </div>
        </InspectorLayout>
    );
};
