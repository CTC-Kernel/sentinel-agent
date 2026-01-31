import React, { useState } from 'react';
import { RecoveryPlan, UserProfile, Asset } from '../../../types';
import { RecoveryPlanFormData } from '../../../schemas/continuitySchema';
import { useStore } from '../../../store';
import { Button } from '../../ui/button';
import { Plus, Shield, Search, FileText, Clock, Trash2, Edit2, PlayCircle, User as UserIcon } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { Badge } from '../../ui/Badge';
import { RecoveryPlanInspector } from './RecoveryPlanInspector';
import { ConfirmModal } from '../../ui/ConfirmModal';

interface ContinuityPRAProps {
    plans: RecoveryPlan[];
    assets: Asset[];
    users: UserProfile[];
    loading: boolean;
    onAdd: (data: RecoveryPlanFormData) => Promise<void>;
    onUpdate: (id: string, data: Partial<RecoveryPlanFormData>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export const ContinuityPRA: React.FC<ContinuityPRAProps> = ({
    plans,
    assets,
    users,
    loading,
    onAdd,
    onUpdate,
    onDelete
}) => {
    const { t } = useStore();
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<RecoveryPlan | undefined>(undefined);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

    const filteredPlans = plans.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEdit = (plan: RecoveryPlan) => {
        setEditingPlan(plan);
        setIsInspectorOpen(true);
    };

    const handleDelete = async () => {
        if (confirmDelete.id) {
            await onDelete(confirmDelete.id);
            setConfirmDelete({ isOpen: false, id: null });
        }
    };

    const getOwnerName = (id: string) => {
        const user = users.find(u => u.uid === id);
        return user ? (user.displayName || user.email) : 'Inconnu';
    };

    const getStatusColor = (status: string): 'success' | 'warning' | 'neutral' => {
        switch (status) {
            case 'Active': return 'success';
            case 'Testing': return 'warning';
            case 'Archived': return 'neutral';
            default: return 'neutral'; // Draft
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Plans de Reprise d'Activité (PRA)</h2>
                    <p className="text-sm text-slate-500">Gérez vos procédures de restauration et de continuité.</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                            placeholder="Rechercher un plan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 rounded-3xl text-sm focus:outline-none focus:ring-2 focus-visible:ring-brand-500 transition-all placeholder:text-muted-foreground dark:text-white"
                        />
                    </div>
                    <Button onClick={() => { setEditingPlan(undefined); setIsInspectorOpen(true); }} className="gap-2 shrink-0">
                        <Plus className="w-4 h-4" /> Nouveau Plan
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i || 'unknown'} className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            ) : filteredPlans.length === 0 ? (
                <EmptyState
                    icon={Shield}
                    title={t('continuity.pra.emptyTitle')}
                    description={t('continuity.pra.emptyDescription')}
                    actionLabel={t('continuity.pra.createPra')}
                    onAction={() => setIsInspectorOpen(true)}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredPlans.map(plan => (
                        <div key={plan.id || 'unknown'} className="glass-premium p-4 sm:p-6 rounded-2xl border border-border/40 relative group hover:border-brand-300 transition-all flex flex-col h-full">
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-70 transition-opacity z-10">
                                <button onClick={() => handleEdit(plan)} className="p-2 text-muted-foreground hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors bg-white dark:bg-slate-800 shadow-sm border border-border/40 dark:border-border/40">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setConfirmDelete({ isOpen: true, id: plan.id })} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors bg-white dark:bg-slate-800 shadow-sm border border-border/40 dark:border-border/40">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-900 dark:text-white truncate" title={plan.title}>{plan.title}</h3>
                                    <div className="mt-1">
                                        <Badge variant="soft" status={getStatusColor(plan.status)} size="sm">
                                            {plan.status === 'Draft' ? t('continuity.pra.draft') : plan.status}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-slate-500 dark:text-muted-foreground mb-6 line-clamp-2 h-10">
                                {plan.description || t('continuity.pra.noDescription')}
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-4 mt-auto">
                                <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                    <span className="block text-xs uppercase text-slate-500 dark:text-muted-foreground font-bold mb-1">RTO</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{plan.rto}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                    <span className="block text-xs uppercase text-slate-500 dark:text-muted-foreground font-bold mb-1">RPO</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 dark:text-muted-foreground">{plan.rpo}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border/40 dark:border-white/5 mt-4">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-3 h-3" />
                                    </span>
                                    <span className="truncate max-w-[100px]">{getOwnerName(plan.ownerId)}</span>
                                </div>
                                {plan.lastTestedAt ? (
                                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                                        <Clock className="w-3 h-3" />
                                        {new Date(plan.lastTestedAt).toLocaleDateString()}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-xs text-amber-600">
                                        <PlayCircle className="w-3 h-3" />
                                        Jamais testé
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <RecoveryPlanInspector
                isOpen={isInspectorOpen}
                onClose={() => setIsInspectorOpen(false)}
                onSubmit={editingPlan ? (data) => onUpdate(editingPlan.id, data) : onAdd}
                isLoading={loading}
                initialData={editingPlan}
                users={users}
                assets={assets}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Supprimer le PRA"
                message="Êtes-vous sûr de vouloir supprimer ce plan de reprise ? Cette action est irréversible."
            />
        </div>
    );
};
