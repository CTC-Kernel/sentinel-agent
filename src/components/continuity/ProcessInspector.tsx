import React, { useState } from 'react';
import { useStore } from '../../store';
import { Edit2, Trash2, Loader2, Activity, Server, Zap, History, HeartPulse } from '../ui/Icons';
import { Button } from '../ui/button';
import { BusinessProcess, Asset, Supplier, Risk, BcpDrill, UserProfile } from '../../types';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { TimelineView } from '../shared/TimelineView';
import { ProcessGeneralDetails } from './inspector/ProcessGeneralDetails';
import { ProcessDependencies } from './inspector/ProcessDependencies';
import { ProcessDrills } from './inspector/ProcessDrills';

interface ProcessInspectorProps {
    process: BusinessProcess | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (p: BusinessProcess) => void;
    onDelete: (id: string) => void;
    assets: Asset[];
    suppliers: Supplier[];
    risks: Risk[];
    drills: BcpDrill[];
    users?: UserProfile[];
}

export const ProcessInspector: React.FC<ProcessInspectorProps> = ({
    process, isOpen, onClose, onEdit, onDelete, assets, suppliers, risks, drills, users
}) => {
    const { t } = useStore();
    // Note: 'any' cast used for setInspectorTab to avoid strict generic matching issues with the layout component,
    // though the types align.
    const [inspectorTab, setInspectorTab] = useState<'details' | 'dependencies' | 'drills' | 'history'>('details');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!process || isDeleting) return;
        setIsDeleting(true);
        try {
            await onDelete(process.id);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!process) return null;

    const linkedAssets = assets.filter(a => process.supportingAssetIds?.includes(a.id));
    const linkedSuppliers = suppliers.filter(s => process.supplierIds?.includes(s.id));
    const linkedRisks = risks.filter(r => process.relatedRiskIds?.includes(r.id));
    const ownerUser = users?.find(u => u.displayName === process.owner || u.email === process.owner);

    const handleClose = () => {
        setInspectorTab('details');
        onClose();
    };

    const tabs = [
        { id: 'details', label: t('common.overview'), icon: Activity },
        { id: 'dependencies', label: t('common.dependencies'), icon: Server },
        { id: 'drills', label: t('continuity.tabs.drills'), icon: Zap },
        { id: 'history', label: t('common.history'), icon: History },
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={handleClose}
            title={process.name}
            subtitle={
                <div className="flex items-center gap-2">
                    <span className="text-slate-500">{t('common.managedBy')}</span>
                    <div className="flex items-center gap-2">
                        <img
                            src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
                            alt={process.owner}
                            className="w-5 h-5 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getUserAvatarUrl(null, ownerUser?.role);
                            }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                            {process.owner}
                        </span>
                    </div>
                </div>
            }
            icon={HeartPulse}
            statusBadge={
                <Badge
                    status={
                        process.priority === 'Critique' ? 'error' :
                            process.priority === 'Élevée' ? 'warning' :
                                'info'
                    }
                >
                    {process.priority}
                </Badge>
            }
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as 'details' | 'dependencies' | 'drills' | 'history')}
            actions={
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(process)}
                        className="text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                        aria-label="Modifier le processus"
                    >
                        <Edit2 className="w-5 h-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label={isDeleting ? "Suppression en cours" : "Supprimer le processus"}
                    >
                        {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </Button>
                </div>
            }
        >
            <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                {inspectorTab === 'details' && (
                    <ProcessGeneralDetails process={process} />
                )}

                {inspectorTab === 'dependencies' && (
                    <ProcessDependencies
                        linkedAssets={linkedAssets}
                        linkedSuppliers={linkedSuppliers}
                        linkedRisks={linkedRisks}
                    />
                )}

                {inspectorTab === 'drills' && (
                    <ProcessDrills drills={drills} />
                )}

                {inspectorTab === 'history' && (
                    <TimelineView resourceId={process.id} />
                )}
            </div>
        </InspectorLayout>
    );
};
