import React, { useState } from 'react';
import { Supplier } from '../../../types';
import { SupplierFormData } from '../../../schemas/supplierSchema';
import { Check, ShieldCheck, AlertTriangle, FileText, Scale, Siren, LogOut, Globe } from '../../ui/Icons';
import { motion } from 'framer-motion';
import { ErrorLogger } from '../../../services/errorLogger';
import { useLocale } from '../../../hooks/useLocale';

interface Props {
 supplier: Supplier;
 canEdit: boolean;
 onUpdate: (data: SupplierFormData) => Promise<void>;
}

export const SupplierContractCompliance: React.FC<Props> = ({ supplier, canEdit, onUpdate }) => {
 const { t } = useLocale();
 const [clauses, setClauses] = useState(supplier.doraContractClauses || {
 auditRights: false,
 slaDefined: false,
 dataLocation: false,
 subcontractingConditions: false,
 incidentNotification: false,
 exitStrategy: false,
 });
 const [, setIsSaving] = useState(false);

 const handleToggle = async (key: keyof typeof clauses) => {
 if (!canEdit) return;

 const newClauses = { ...clauses, [key]: !clauses[key] };
 setClauses(newClauses);

 // Auto-save logic
 setIsSaving(true);
 try {
 await onUpdate({
 ...supplier,
 // Ensure enum fields match schema exactly
 category: supplier.category,
 criticality: supplier.criticality,
 status: supplier.status,
 doraContractClauses: newClauses
 } as unknown as SupplierFormData);
 } catch (error) {
 ErrorLogger.error(error, 'SupplierContractCompliance.handleClauseToggle');
 // Revert on error
 setClauses(clauses);
 } finally {
 setIsSaving(false);
 }
 };

 const requirements = [
 {
 key: 'auditRights',
 label: t('suppliers.contractCompliance.auditRights', { defaultValue: "Droit d'Audit et d'Inspection" }),
 description: t('suppliers.contractCompliance.auditRightsDesc', { defaultValue: "Le contrat doit garantir un accès complet aux données et systèmes pour audit (DORA Art. 30)." }),
 icon: Scale
 },
 {
 key: 'slaDefined',
 label: t('suppliers.contractCompliance.slaDefined', { defaultValue: "Niveaux de Service (SLA)" }),
 description: t('suppliers.contractCompliance.slaDefinedDesc', { defaultValue: "Définition précise des niveaux de service attendus et pénalités associées." }),
 icon: FileText
 },
 {
 key: 'dataLocation',
 label: t('suppliers.contractCompliance.dataLocation', { defaultValue: "Localisation des Données" }),
 description: t('suppliers.contractCompliance.dataLocationDesc', { defaultValue: "Clarté sur les régions de stockage et traitement (Souveraineté, RGPD)." }),
 icon: Globe
 },
 {
 key: 'subcontractingConditions',
 label: t('suppliers.contractCompliance.subcontractingConditions', { defaultValue: "Contrôle de la Sous-traitance" }),
 description: t('suppliers.contractCompliance.subcontractingConditionsDesc', { defaultValue: "Conditions strictes pour le recours à des sous-traitants (Chaîne de responsabilité)." }),
 icon: ShieldCheck
 },
 {
 key: 'incidentNotification',
 label: t('suppliers.contractCompliance.incidentNotification', { defaultValue: "Notification d'Incidents" }),
 description: t('suppliers.contractCompliance.incidentNotificationDesc', { defaultValue: "Obligation de signaler les incidents majeurs dans des délais définis." }),
 icon: Siren
 },
 {
 key: 'exitStrategy',
 label: t('suppliers.contractCompliance.exitStrategy', { defaultValue: "Stratégie de Sortie (Réversibilité)" }),
 description: t('suppliers.contractCompliance.exitStrategyDesc', { defaultValue: "Clauses garantissant la récupération des données et la transition vers un autre tiers." }),
 icon: LogOut
 }
 ] as const;

 const completedCount = Object.values(clauses).filter(Boolean).length;
 const totalCount = requirements.length;
 const progress = Math.round((completedCount / totalCount) * 100);

 return (
 <div className="p-6 h-full overflow-y-auto space-y-6 sm:space-y-8">
 {/* Header */}
 <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-border/40">
 <div className="flex justify-between items-start mb-4">
  <div>
  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
  <ShieldCheck className="w-5 h-5 text-indigo-500" />
  {t('suppliers.contractCompliance.title', { defaultValue: 'Conformité Contractuelle DORA' })}
  </h3>
  <p className="text-sm text-muted-foreground mt-1">
  {t('suppliers.contractCompliance.subtitle', { defaultValue: 'Vérifiez la présence des clauses obligatoires pour les prestataires TIC critiques.' })}
  </p>
  </div>
  <div className="text-right">
  <span className={`text-2xl font-black ${progress === 100 ? 'text-emerald-500' : 'text-indigo-600'}`}>
  {progress}%
  </span>
  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('suppliers.contractCompliance.compliance', { defaultValue: 'Conformité' })}</p>
  </div>
 </div>

 {/* Progress Bar */}
 <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
  <motion.div
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
  />
 </div>
 </div>

 {/* Checklist */}
 <div className="grid grid-cols-1 gap-4">
 {requirements.map((req) => {
  const isChecked = clauses[req.key as keyof typeof clauses];
  const Icon = req.icon;

  return (
  <button
  key={req.key || 'unknown'}
  type="button"
  onClick={() => handleToggle(req.key as keyof typeof clauses)}
  className={`
  w-full text-left group relative p-4 rounded-3xl border transition-all cursor-pointer select-none
  ${isChecked
   ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
   : 'glass-premium border-border/40 hover:border-indigo-300 dark:hover:border-indigo-700'
  }
  `}
  >
  <div className="flex items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
  <div className={`
   flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
   ${isChecked
   ? 'bg-emerald-500 border-emerald-500 text-white'
   : 'border-border/40 group-hover:border-indigo-400'
   }
  `}>
   {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
  </div>

  <div className="flex-1">
   <h4 className={`font-bold text-sm mb-1 ${isChecked ? 'text-emerald-900 dark:text-emerald-400' : 'text-foreground'}`}>
   {req.label}
   </h4>
   <p className="text-xs text-muted-foreground leading-relaxed">
   {req.description}
   </p>
  </div>

  <Icon className={`w-5 h-5 opacity-20 group-hover:opacity-40 transition-opacity ${isChecked ? 'text-emerald-600' : 'text-muted-foreground'}`} />
  </div>
  </button>
  );
 })}
 </div>

 {/* Footer Info */}
 {!canEdit && (
 <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
  <AlertTriangle className="w-4 h-4" />
  {t('suppliers.contractCompliance.readOnly', { defaultValue: "Lecture seule : Vous n'avez pas les droits pour modifier la conformité contractuelle." })}
 </div>
 )}
 </div>
 );
};
