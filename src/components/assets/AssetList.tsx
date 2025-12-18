
import React from 'react';
import { Asset, Criticality, UserProfile } from '../../types';
import { DataTable } from '../ui/DataTable';
import { Server } from '../ui/Icons';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { canDeleteResource } from '../../utils/permissions';


interface AssetListProps {
    assets: Asset[];
    loading: boolean;
    viewMode: 'grid' | 'list' | 'matrix';
    user: UserProfile | null;
    onEdit: (asset: Asset) => void;
    onDelete: (id: string, name: string) => void;
    onGenerateLabel: (asset: Asset) => void;
    isGeneratingLabels?: boolean;
    canEdit: boolean;
    activeFiltersQuery?: string;
    onBulkDelete?: (ids: string[]) => void;
}

// ...

const getCriticalityColor = (level: Criticality) => {
    switch (level) {
        case Criticality.CRITICAL: return 'bg-red-100/80 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
        case Criticality.HIGH: return 'bg-orange-100/80 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
        case Criticality.MEDIUM: return 'bg-yellow-100/80 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
        default: return 'bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    }
};

export const AssetList: React.FC<AssetListProps> = ({
    assets,
    loading,
    viewMode,
    user,
    onEdit,
    onBulkDelete,
    activeFiltersQuery,
    canEdit
}) => {
    const canDelete = canDeleteResource(user, 'Asset');

    if (viewMode === 'list') {
        return (
            <div className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <DataTable
                        columns={[
                            // ...
                        ]}
                        data={assets}
                        selectable={canDelete}
                        onRowClick={(asset) => onEdit(asset)}
                        searchable={false}
                        exportable={false}
                        loading={loading}
                        pageSize={12}
                        onBulkDelete={onBulkDelete}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
                <div className="col-span-full"><TableSkeleton rows={3} columns={1} /></div>
            ) : assets.length === 0 ? (
                <div className="col-span-full">
                    <EmptyState
                        icon={Server}
                        title="Aucun actif trouvé"
                        description={activeFiltersQuery ? "Aucun actif ne correspond à votre recherche." : "Commencez par ajouter votre premier actif pour suivre votre parc."}
                        actionLabel={activeFiltersQuery || !canEdit ? undefined : "Nouvel Actif"}
                        onAction={activeFiltersQuery || !canEdit ? undefined : () => onEdit({} as Asset)} // hack to trigger create
                    />
                </div>
            ) : (
                assets.map((asset) => {
                    const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
                    return (
                        <div key={asset.id} onClick={() => onEdit(asset)} className="glass-panel p-6 rounded-[2.5rem] shadow-sm card-hover cursor-pointer group flex flex-col border border-white/50 dark:border-white/5 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300">
                                        <Server className="h-6 w-6" />
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getCriticalityColor(asset.confidentiality)}`}>{asset.confidentiality}</span>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-tight">{asset.name}</h3>
                                <p className="text-xs text-slate-600 font-medium mb-4">{asset.type} • {asset.owner}</p>

                                <div className="mt-auto pt-4 border-t border-dashed border-slate-200 dark:border-white/10 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${asset.lifecycleStatus === 'En service' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{asset.lifecycleStatus || 'Neuf'}</span>
                                    </div>
                                    {warrantyExpired && <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Garantie Exp.</span>}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};
