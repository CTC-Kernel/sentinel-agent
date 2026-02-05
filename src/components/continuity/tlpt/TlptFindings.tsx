import React, { useState } from 'react';
import { TlptCampaign } from '../../../types/tlpt';
import { Vulnerability } from '../../../types/risks';
import { useVulnerabilities } from '../../../hooks/useVulnerabilities';
import { Button } from '../../ui/button';
import { Plus, AlertTriangle, ShieldAlert } from '../../ui/Icons';
import { VulnerabilityForm } from '../../vulnerabilities/VulnerabilityForm';
import { Modal } from '../../ui/Modal';
import { EmptyState } from '../../ui/EmptyState';
import { useStore } from '../../../store'; // For assets

import { useContinuityData } from '../../../hooks/continuity/useContinuityData';

interface TlptFindingsProps {
    campaign: TlptCampaign;
}

export const TlptFindings: React.FC<TlptFindingsProps> = ({ campaign }) => {
    const { vulnerabilities, addVulnerability, updateVulnerability, loading } = useVulnerabilities();
    const { user } = useStore();
    const { assets: continuityAssets } = useContinuityData(user?.organizationId);


    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVuln, setEditingVuln] = useState<Vulnerability | undefined>(undefined);

    const findings = vulnerabilities.filter(v => v.relatedTlptCampaignId === campaign.id);

    const handleAddFinding = async (data: Partial<Vulnerability>) => {
        await addVulnerability({
            ...data,
            relatedTlptCampaignId: campaign.id,
            relatedTlptCampaignName: campaign.name,
            source: `TLPT - ${campaign.name}`
        });
        setIsFormOpen(false);
    };

    const handleUpdateFinding = async (data: Partial<Vulnerability>) => {
        if (editingVuln?.id) {
            await updateVulnerability(editingVuln.id, data);
            setEditingVuln(undefined);
            setIsFormOpen(false);
        }
    };

    const openEdit = (vuln: Vulnerability) => {
        setEditingVuln(vuln);
        setIsFormOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                    Constatations ({findings.length})
                </h3>
                <Button onClick={() => { setEditingVuln(undefined); setIsFormOpen(true); }} size="sm" className="bg-brand-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une constatation
                </Button>
            </div>

            {loading ? (
                <div className="p-4 text-center text-slate-500">Chargement...</div>
            ) : findings.length === 0 ? (
                <EmptyState
                    icon={ShieldAlert}
                    title="Aucune constatation"
                    description="Ajoutez les vulnérabilités identifiées durant cette campagne."
                    actionLabel="Ajouter"
                    onAction={() => setIsFormOpen(true)}
                />
            ) : (
                <div className="grid gap-3">
                    {findings.map(vuln => (
                        <div key={vuln.id || 'unknown'}
                            className="p-4 rounded-3xl border border-border/40 dark:border-border/40 bg-white dark:bg-white/5 hover:border-brand-500 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => openEdit(vuln)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openEdit(vuln);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                        <AlertTriangle className={`w-4 h-4 ${vuln.severity === 'Critical' ? 'text-red-500' : 'text-amber-500'}`} />
                                        {vuln.title || vuln.cveId}
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{vuln.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${vuln.status === 'Resolved' || vuln.status === 'Patch Applied'
                                        ? 'bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-blue-100 text-blue-700 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                        {vuln.status}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Score: {vuln.score}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingVuln ? "Modifier la constatation" : "Nouvelle constatation"}
                maxWidth="2xl"
            >
                <VulnerabilityForm
                    initialData={editingVuln}
                    onSubmit={editingVuln ? handleUpdateFinding : handleAddFinding}
                    onCancel={() => setIsFormOpen(false)}
                    assets={continuityAssets || []}
                    isLoading={false}
                    projects={[]} // Optional
                    users={[]} // Optional
                />
            </Modal>
        </div>
    );
};
