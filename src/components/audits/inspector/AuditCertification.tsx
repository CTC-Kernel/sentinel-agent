import React from 'react';
import { ShieldCheck, Link as LinkIcon, ExternalLink, Plus } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { useStore } from '../../../store';

interface AuditCertificationProps {
    canEdit: boolean;
    onOpenShareModal: () => void;
    onOpenAssignModal: () => void;
}

export const AuditCertification: React.FC<AuditCertificationProps> = ({
    canEdit,
    onOpenShareModal,
    onOpenAssignModal
}) => {
    const { t } = useStore();

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                    Accès Auditeur Externe
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Créez un lien sécurisé pour permettre à un auditeur externe ou un organisme de certification d'accéder à cet audit, consulter les preuves et valider la conformité.
                </p>

                {canEdit && (
                    <button
                        onClick={onOpenShareModal}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all"
                    >
                        <LinkIcon className="w-4 h-4" />
                        Générer un lien d'accès
                    </button>
                )}

                {/* Assuming we might fetch active shares in the future, simpler placeholder for now */}
                <div className="mt-8 border-t border-slate-100 dark:border-white/5 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Partenaires Assignés</h4>
                        {canEdit && (
                            <button
                                onClick={onOpenAssignModal}
                                className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                {t('audits.actions.assignPartner') || "Assigner un partenaire"}
                            </button>
                        )}
                    </div>
                    <EmptyState
                        icon={ExternalLink}
                        title="Aucun auditeur externe actif"
                        description="Aucun lien d'accès n'est actuellement actif pour cet audit."
                        color="slate"
                    />
                </div>
            </div>
        </div>
    );
};
