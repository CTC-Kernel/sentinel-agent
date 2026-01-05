import React, { useState } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
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
import { LayoutDashboard, RefreshCw, Shield, Network, BrainCircuit, MessageSquare } from 'lucide-react';
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
    const canDelete = React.useMemo(() => {
        if (!user) return false;
        return canDeleteResource(user, 'Asset');
    }, [user]);

    const handleDelete = () => {
        if (selectedAsset && onDelete) {
            onDelete(selectedAsset.id, selectedAsset.name);
        }
    };

    const navigate = useNavigate();
    const [inspectorTab, setInspectorTab] = useState<'details' | 'lifecycle' | 'security' | 'compliance' | 'projects' | 'audits' | 'documents' | 'history' | 'graph' | 'intelligence' | 'comments'>('details');
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

    const tabs = [
        { id: 'details', label: 'Détails', icon: LayoutDashboard },
        ...(selectedAsset ? [
            { id: 'lifecycle', label: 'Cycle de Vie', icon: RefreshCw },
            { id: 'security', label: 'Sécurité', icon: ShieldAlert },
            { id: 'compliance', label: 'Conformité', icon: Shield },
            { id: 'projects', label: 'Projets', icon: FolderKanban },
            { id: 'audits', label: 'Audits', icon: CheckSquare },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'history', label: 'Historique', icon: History },
            { id: 'graph', label: 'Graphe', icon: Network },
            { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
            { id: 'comments', label: 'Discussion', icon: MessageSquare }
        ] : [])
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={selectedAsset ? selectedAsset.name : "Nouvel Actif"}
            subtitle={
                selectedAsset ? (
                    <div className="flex items-center gap-2 mt-1">
                        <span>{selectedAsset.type}</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <div className="flex items-center gap-1.5">
                            <img
                                src={getUserAvatarUrl(users?.find(u => u.displayName === selectedAsset.owner || u.email === selectedAsset.owner)?.photoURL, users?.find(u => u.displayName === selectedAsset.owner || u.email === selectedAsset.owner)?.role)}
                                alt={selectedAsset.owner}
                                className="w-4 h-4 rounded-full object-cover bg-slate-100 dark:bg-slate-800"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = getUserAvatarUrl(null, users?.find(u => u.displayName === selectedAsset.owner || u.email === selectedAsset.owner)?.role);
                                }}
                            />
                            <span>{selectedAsset.owner}</span>
                        </div>
                    </div>
                ) : "Ajouter un nouvel actif à l'inventaire"
            }
            icon={selectedAsset ? Server : Plus}
            statusBadge={selectedAsset ? (
                <div className="flex gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${selectedAsset.lifecycleStatus === 'En service' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'}`}>
                        {selectedAsset.lifecycleStatus || 'Neuf'}
                    </span>
                    {canDelete && selectedAsset && (
                        <CustomTooltip content={t('assets.deleteAssetTooltip')}>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            ) : null}
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
        >

            <div className="space-y-8 max-w-7xl mx-auto">
                {inspectorTab === 'details' && (
                    <div className="space-y-8">
                        <AssetForm
                            initialData={selectedAsset || undefined}
                            onSubmit={async (data) => {
                                if (selectedAsset) {
                                    await onUpdate(selectedAsset.id, data);
                                } else {
                                    await onCreate(data);
                                    onClose();
                                }
                            }}
                            usersList={users}
                            suppliers={suppliers}
                            isEditing={!!selectedAsset}
                            onCancel={onClose}
                            readOnly={!canEdit}
                        />

                    </div>
                )}

                {inspectorTab === 'lifecycle' && selectedAsset && (
                    <AssetInspectorLifecycle
                        selectedAsset={selectedAsset}
                        maintenanceRecords={maintenanceRecords}
                        addMaintenance={addMaintenance}
                        canEdit={canEdit}
                    />
                )}

                {inspectorTab === 'security' && selectedAsset && (
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

                {inspectorTab === 'compliance' && selectedAsset && (
                    <AssetInspectorCompliance
                        selectedAsset={selectedAsset}
                        linkedControls={linkedControls}
                        processes={processes}
                    />
                )}

                {inspectorTab === 'projects' && selectedAsset && (
                    <AssetInspectorProjects
                        selectedAsset={selectedAsset}
                        linkedProjects={linkedProjects}
                    />
                )}

                {inspectorTab === 'audits' && selectedAsset && (
                    <AssetInspectorAudits
                        linkedAudits={linkedAudits}
                    />
                )}

                {inspectorTab === 'documents' && selectedAsset && (
                    <AssetInspectorDocuments
                        linkedDocuments={linkedDocuments}
                    />
                )}

                {inspectorTab === 'history' && selectedAsset && (
                    <AssetInspectorHistory
                        selectedAsset={selectedAsset}
                    />
                )}

                {inspectorTab === 'graph' && selectedAsset && (
                    <div className="h-[500px]">
                        <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                    </div>
                )}

                {inspectorTab === 'intelligence' && selectedAsset && (
                    <div className="h-full overflow-y-auto p-6">
                        <AssetAIAssistant
                            asset={selectedAsset}
                            onUpdate={(updates) => onUpdate(selectedAsset.id, { ...selectedAsset, ...updates } as unknown as AssetFormData)}
                        />
                    </div>
                )}

                {inspectorTab === 'comments' && selectedAsset && (
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
