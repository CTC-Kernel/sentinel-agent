import React, { useState } from 'react';
import { Plus, Trash2, Server, Shield } from '../ui/Icons';
import { Asset, Strategy } from '../../types';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorLogger } from '../../services/errorLogger';
import { useContinuityActions } from '../../hooks/continuity/useContinuityActions';
import { StrategyInspector } from './inspector/StrategyInspector';
import { StrategyFormData } from '../../schemas/continuitySchema';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ContinuityStrategiesProps {
    assets: Asset[];
}

export const ContinuityStrategies: React.FC<ContinuityStrategiesProps> = ({ assets }) => {
    const { user, addToast } = useStore();
    const { strategies, addStrategy, removeStrategy } = useContinuityActions();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

    const canManage = user?.role === 'admin' || user?.role === 'rssi' || user?.role === 'project_manager';

    const onSubmit = async (data: StrategyFormData) => {
        if (!user?.organizationId) return;

        try {
            await addStrategy({
                ...data,
                organizationId: user.organizationId,
                linkedAssets: data.linkedAssets || []
            });
            addToast('Stratégie ajoutée', 'success');
            setIsModalOpen(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ContinuityStrategies.onSubmit', 'CREATE_FAILED');
        }
    };

    const handleDeleteClick = (id: string) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        if (!confirmDelete.id) return;
        try {
            await removeStrategy(confirmDelete.id);
            addToast('Stratégie supprimée', 'success');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ContinuityStrategies.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmDelete({ isOpen: false, id: null });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Stratégies de Continuité</h2>
                    <p className="text-sm text-slate-500">Définissez vos stratégies de reprise (PCA/PRA) pour vos actifs critiques.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Nouvelle Stratégie
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map((strategy: Strategy) => (
                    <div key={strategy.id} className="glass-panel p-6 rounded-2xl relative group hover:border-brand-500/30">
                        {canManage && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(strategy.id)}
                                aria-label="Supprimer la stratégie"
                                className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{strategy.title}</h3>
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500">{strategy.type}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase font-bold">RTO Cible</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-muted-foreground">{strategy.rto}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase font-bold">RPO Cible</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-muted-foreground">{strategy.rpo}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Actifs Couverts</p>
                            <div className="flex flex-wrap gap-2">
                                {strategy.linkedAssets?.map((assetId: string) => {
                                    const asset = assets.find(a => a.id === assetId);
                                    return asset ? (
                                        <span key={assetId} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-100">
                                            <Server className="w-3 h-3" /> {asset.name}
                                        </span>
                                    ) : null;
                                })}
                                {(!strategy.linkedAssets || strategy.linkedAssets.length === 0) && <span className="text-xs text-muted-foreground italic">Aucun actif lié</span>}
                            </div>
                        </div>
                    </div>
                ))}

                {strategies.length === 0 && (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Shield}
                            title="Aucune stratégie définie"
                            description="Commencez par définir vos stratégies de continuité pour protéger vos actifs critiques."
                            actionLabel="Créer une stratégie"
                            onAction={() => setIsModalOpen(true)}
                        />
                    </div>
                )}
            </div>

            <StrategyInspector
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={onSubmit}
                assets={assets}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleConfirmDelete}
                title="Supprimer la stratégie"
                message="Êtes-vous sûr de vouloir supprimer cette stratégie ? Cette action est irréversible."
            />
        </div>
    );
};
