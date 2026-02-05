import React, { useState } from 'react';
import { TlptCampaign } from '../../../types/tlpt';
import { Button } from '../../ui/button';
import { Plus, Shield, Calendar, Users, Target } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { TLPTInspector } from './TLPTInspector';

interface Props {
    campaigns: TlptCampaign[];
    loading?: boolean;
    onAdd: (data: Partial<TlptCampaign>) => Promise<void>;
    onUpdate: (id: string, data: Partial<TlptCampaign>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    canEdit: boolean;
}

export const TlptDashboard: React.FC<Props> = ({ campaigns, loading, onAdd, onUpdate, onDelete, canEdit }) => {
    const [selectedCampaign, setSelectedCampaign] = useState<TlptCampaign | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleEdit = (campaign: TlptCampaign) => {
        setSelectedCampaign(campaign);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedCampaign(null);
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: Partial<TlptCampaign>) => {
        if (selectedCampaign) {
            await onUpdate(selectedCampaign.id, data);
        } else {
            await onAdd(data);
        }
        setIsModalOpen(false);
    };

    if (loading) return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
                <div key={i || 'unknown'} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse" />
            ))}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Campagnes de Tests de Résilience</h3>
                    <p className="text-sm text-slate-500">Gestion des tests d'intrusion avancés (TLPT) et Red Teaming.</p>
                </div>
                {canEdit && (
                    <Button onClick={handleCreate}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nouvelle Campagne
                    </Button>
                )}
            </div>

            {campaigns.length === 0 ? (
                <EmptyState
                    icon={Shield}
                    title="Aucune campagne TLPT"
                    description="Planifiez votre première campagne de test de résilience."
                    actionLabel={canEdit ? "Planifier une campagne" : undefined}
                    onAction={canEdit ? handleCreate : undefined}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id || 'unknown'}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-border/40 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => canEdit && handleEdit(campaign)}
                            onKeyDown={(e) => {
                                if (canEdit && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    handleEdit(campaign);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Edit campaign: ${campaign.name}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                                    {campaign.status}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {campaign.methodology}
                                </span>
                            </div>

                            <h4 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                                {campaign.name}
                            </h4>

                            <div className="space-y-2 text-sm text-slate-600 dark:text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-muted-foreground" />
                                    <span className="truncate">{campaign.scope}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    <span>{campaign.provider}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <span>
                                        {campaign.startDate ? new Date(((campaign.startDate as unknown) as { seconds: number }).seconds ? ((campaign.startDate as unknown) as { seconds: number }).seconds * 1000 : campaign.startDate as Date | string | number).toLocaleDateString() : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <TLPTInspector
                    onClose={() => setIsModalOpen(false)}
                    onUpdate={handleSubmit}
                    campaign={selectedCampaign || undefined}
                    onDelete={onDelete}
                    canEdit={canEdit}
                />
            )}
        </div>
    );
};

function getStatusColor(status: string) {
    switch (status) {
        case 'Planned': return 'bg-info-bg text-info-text';
        case 'In Progress': return 'bg-warning-bg text-warning-text';
        case 'Analysis': return 'bg-info-bg text-info-text';
        case 'Remediation': return 'bg-warning-bg text-warning-text';
        case 'Closed': return 'bg-success-bg text-success-text';
        default: return 'bg-muted text-muted-foreground';
    }
}
