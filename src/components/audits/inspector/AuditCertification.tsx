import React from 'react';
import { ShieldCheck, Link as LinkIcon, ExternalLink, Plus } from '../../ui/Icons';
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
            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                    {t('audits.certification.externalAccess', { defaultValue: 'Accès Auditeur Externe' })}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                    {t('audits.certification.externalAccessDesc', { defaultValue: 'Créez un lien sécurisé pour permettre à un auditeur externe ou un organisme de certification d\'accéder à cet audit, consulter les preuves et valider la conformité.' })}
                </p>

                {canEdit && (
                    <button
                        onClick={onOpenShareModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-semibold rounded-3xl shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                    >
                        <LinkIcon className="w-4 h-4" />
                        {t('audits.certification.generateLink', { defaultValue: 'Générer un lien d\'accès' })}
                    </button>
                )}

                <div className="mt-8 border-t border-border/40 dark:border-white/5 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t('audits.certification.assignedPartners', { defaultValue: 'Partenaires Assignés' })}</h4>
                        {canEdit && (
                            <button
                                onClick={onOpenAssignModal}
                                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                {t('audits.actions.assignPartner') || "Assigner un partenaire"}
                            </button>
                        )}
                    </div>
                    <EmptyState
                        icon={ExternalLink}
                        title={t('audits.certification.noExternalAuditor', { defaultValue: 'Aucun auditeur externe actif' })}
                        description={t('audits.certification.noActiveLink', { defaultValue: 'Aucun lien d\'accès n\'est actuellement actif pour cet audit.' })}
                        color="slate"
                    />
                </div>
            </div>
        </div>
    );
};
