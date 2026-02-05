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
 <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
  <ShieldCheck className="w-5 h-5 text-primary" />
  {t('audits.certification.externalAccess', { defaultValue: 'Accès Auditeur Externe' })}
 </h3>
 <p className="text-muted-foreground mb-6 leading-relaxed">
  {t('audits.certification.externalAccessDesc', { defaultValue: 'Créez un lien sécurisé pour permettre à un auditeur externe ou un organisme de certification d\'accéder à cet audit, consulter les preuves et valider la conformité.' })}
 </p>

 {canEdit && (
  <button
  onClick={onOpenShareModal}
  className="px-5 py-2.5 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-700 text-white font-semibold rounded-3xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 flex items-center gap-2 transition-all hover:-translate-y-0.5"
  >
  <LinkIcon className="w-4 h-4" />
  {t('audits.certification.generateLink', { defaultValue: 'Générer un lien d\'accès' })}
  </button>
 )}

 <div className="mt-8 border-t border-border/40 dark:border-white/5 pt-6">
  <div className="flex justify-between items-center mb-4">
  <h4 className="text-sm font-semibold text-foreground">{t('audits.certification.assignedPartners', { defaultValue: 'Partenaires Assignés' })}</h4>
  {canEdit && (
  <button
  onClick={onOpenAssignModal}
  className="text-sm font-medium text-primary hover:text-primary dark:text-primary/70 dark:hover:text-primary/50 flex items-center gap-1 transition-colors"
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
