import React, { useState } from 'react';
import { Control, UserProfile, Framework } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { User, Loader2, X, Plus, Layers } from '../../ui/Icons';
import { ComplianceAIAssistant } from '../ComplianceAIAssistant';
import { FRAMEWORKS } from '../../../data/frameworks';
import { useLocale } from '@/hooks/useLocale';
import { toast } from '@/lib/toast';
import { CONTROL_STATUS } from '../../../constants/complianceConfig';

interface ComplianceDetailsProps {
 control: Control;
 canEdit: boolean;
 usersList: UserProfile[];
 enabledFrameworks?: Framework[];
 handlers: {
 updating: boolean;
 handleStatusChange: (c: Control, s: Control['status']) => Promise<void>;
 handleAssign: (c: Control, uid: string) => Promise<void>;
 updateJustification: (c: Control, text: string) => Promise<void>;
 handleMapFramework?: (c: Control, f: Framework) => Promise<void>;
 handleUnmapFramework?: (c: Control, f: Framework) => Promise<void>;
 };
 onDirtyChange?: (isDirty: boolean) => void;
}

export const ComplianceDetails: React.FC<ComplianceDetailsProps> = ({
 control,
 canEdit,
 usersList,
 enabledFrameworks,
 handlers,
 onDirtyChange
}) => {
 const { t } = useLocale();
 const { updating, handleStatusChange, handleAssign, updateJustification, handleMapFramework, handleUnmapFramework } = handlers;

 // Get available frameworks for mapping (exclude primary and already mapped)
 const availableFrameworks = FRAMEWORKS.filter(f => {
 const isEnabled = !enabledFrameworks || enabledFrameworks.includes(f.id as Framework);
 const isPrimary = f.id === control.framework;
 const isAlreadyMapped = control.mappedFrameworks?.includes(f.id as Framework);
 return isEnabled && !isPrimary && !isAlreadyMapped;
 });

 // Get framework label by id
 const getFrameworkLabel = (id: string) => FRAMEWORKS.find(f => f.id === id)?.label || id;

 // Local state for justification text area
 const [justification, setJustification] = useState(control.justification || '');
 const [isSaving, setIsSaving] = useState(false);

 // Monitor dirty state
 React.useEffect(() => {
 const isDirty = justification !== (control.justification || '');
 onDirtyChange?.(isDirty);
 }, [justification, control.justification, onDirtyChange]);

 // Helper to handle justification update from AI or Textarea
 const handleJustificationChange = (text: string) => {
 setJustification(text);
 };

 const saveJustification = async () => {
 if (justification !== control.justification && !isSaving && !updating) {
 setIsSaving(true);
 try {
 await updateJustification(control, justification);
 toast.success(t('compliance.justificationSaved', { defaultValue: 'Justification enregistrée' }));
 } finally {
 setIsSaving(false);
 }
 }
 };

 return (
 <div className="space-y-8 w-full max-w-3xl mx-auto">
 <ComplianceAIAssistant
 control={control}
 onApplyPolicy={(policy) => handleJustificationChange(justification ? justification + '\n\n' + policy : policy)}
 canEdit={canEdit}
 />

 {/* Status & Assignment */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm relative overflow-hidden">
  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.implementationStatus', { defaultValue: "Statut d'implémentation" })}</h3>
  {canEdit ? (
  <div className="grid grid-cols-2 gap-2">
  {([CONTROL_STATUS.NOT_STARTED, CONTROL_STATUS.IN_PROGRESS, CONTROL_STATUS.PARTIAL, CONTROL_STATUS.IMPLEMENTED, CONTROL_STATUS.PLANNED, CONTROL_STATUS.OVERDUE, CONTROL_STATUS.NOT_APPLICABLE, CONTROL_STATUS.EXCLUDED] as Control['status'][]).map((s) => {
  const statusLabels: Record<string, string> = {
   [CONTROL_STATUS.NOT_STARTED]: t('compliance.status.notStarted', { defaultValue: 'Non commencé' }),
   [CONTROL_STATUS.IN_PROGRESS]: t('compliance.status.inProgress', { defaultValue: 'En cours' }),
   [CONTROL_STATUS.PARTIAL]: t('compliance.status.partial', { defaultValue: 'Partiel' }),
   [CONTROL_STATUS.IMPLEMENTED]: t('compliance.status.implemented', { defaultValue: 'Implémenté' }),
   [CONTROL_STATUS.PLANNED]: t('compliance.status.planned', { defaultValue: 'Planifié' }),
   [CONTROL_STATUS.OVERDUE]: t('compliance.status.overdue', { defaultValue: 'En retard' }),
   [CONTROL_STATUS.NOT_APPLICABLE]: t('compliance.status.notApplicable', { defaultValue: 'Non applicable' }),
   [CONTROL_STATUS.EXCLUDED]: t('compliance.status.excluded', { defaultValue: 'Exclu' }),
  };
  const label = statusLabels[s] || s;
  return (
   <Button
   key={s || 'unknown'}
   aria-label={t('compliance.changeStatusTo', { defaultValue: 'Changer le statut à', status: label })}
   aria-pressed={control.status === s}
   onClick={async () => {
   await handleStatusChange(control, s);
   toast.success(t('compliance.statusUpdated', { defaultValue: 'Statut mis à jour' }));
   }}
   disabled={updating}
   variant={control.status === s ? 'default' : 'outline'}
   className={`h-auto py-2 text-xs font-bold justify-center whitespace-normal ${control.status === s ? 'bg-primary hover:bg-primary/90' : 'text-muted-foreground'}`}
   >
   {updating && control.status === s ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
   {label}
   </Button>
  );
  })}
  </div>
  ) : (
  <span className={`px-4 py-2 rounded-3xl text-sm font-bold border uppercase tracking-wide inline-block`}>{control.status}</span>
  )}
 </div>

 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm relative overflow-hidden">
  <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.responsible', { defaultValue: 'Responsable' })}</h3>
  {canEdit ? (
  <CustomSelect
  label={t('compliance.assignedTo', { defaultValue: 'Assigné à' })}
  value={control.assigneeId || ''}
  onChange={(val) => handleAssign(control, val as string)}
  options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email || u.uid }))}
  placeholder={t('compliance.selectResponsible', { defaultValue: 'Sélectionner un responsable...' })}
  disabled={updating}
  />
  ) : (
  <div className="flex items-center p-3 bg-muted/50 dark:bg-black/20 rounded-3xl">
  <div className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary flex items-center justify-center text-primary mr-3">
  <User className="h-4 w-4" />
  </div>
  <span className="text-sm font-medium text-foreground">
  {usersList.find(u => u.uid === control.assigneeId)?.displayName || t('compliance.notAssigned', { defaultValue: 'Non assigné' })}
  </span>
  </div>
  )}
 </div>
 </div>

 {/* Framework Mapping Section */}
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
 <div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
  <Layers className="h-4 w-4 text-muted-foreground" />
  <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('compliance.satisfiedFrameworks', { defaultValue: 'Référentiels Satisfaits' })}</h3>
  </div>
  <span className="text-xs text-muted-foreground">
  {t('compliance.frameworksCount', { defaultValue: '{{count}} référentiel(s)', count: 1 + (control.mappedFrameworks?.length || 0) })}
  </span>
 </div>

 {/* Primary Framework Badge */}
 <div className="flex flex-wrap gap-2 mb-3">
  {control.framework && (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground border border-primary">
  <span className="w-1.5 h-1.5 rounded-full bg-white" />
  {getFrameworkLabel(control.framework)}
  <span className="text-xs text-primary/30 ml-1">({t('compliance.primary', { defaultValue: 'principal' })})</span>
  </span>
  )}

  {/* Mapped Framework Badges */}
  {control.mappedFrameworks?.map(fw => (
  <span
  key={fw || 'unknown'}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border/40"
  >
  {getFrameworkLabel(fw)}
  {canEdit && handleUnmapFramework && (
  <button
   onClick={() => handleUnmapFramework(control, fw)}
   className="ml-1 p-0.5 hover:bg-muted rounded-full transition-colors"
   disabled={updating}
   aria-label={t('compliance.removeFramework', { defaultValue: 'Retirer {{name}}', name: getFrameworkLabel(fw) })}
  >
   <X className="h-3 w-3" />
  </button>
  )}
  </span>
  ))}
 </div>

 {/* Add Framework Mapping */}
 {canEdit && handleMapFramework && availableFrameworks.length > 0 && (
  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
  <Plus className="h-4 w-4 text-muted-foreground" />
  <CustomSelect
  label=""
  value=""
  onChange={(val) => {
  if (val) handleMapFramework(control, val as Framework);
  }}
  options={availableFrameworks.map(f => ({ value: f.id, label: f.label }))}
  placeholder={t('compliance.addFramework', { defaultValue: 'Ajouter un référentiel...' })}
  disabled={updating}
  />
  </div>
 )}

 {availableFrameworks.length === 0 && !control.mappedFrameworks?.length && (
  <p className="text-xs text-muted-foreground italic mt-2">
  {t('compliance.onlySatisfiesPrimary', { defaultValue: 'Ce contrôle ne satisfait que son référentiel principal.' })}
  </p>
 )}
 </div>

 {/* Justification Area */}
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
 <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-widest">{t('compliance.justificationPolicy', { defaultValue: 'Justification / Politique' })}</h3>
 {canEdit ? (
  <>
  <textarea
  className="w-full min-h-[120px] bg-muted/50 dark:bg-black/20 border border-border/40 rounded-3xl p-4 text-sm focus:ring-2 focus-visible:ring-primary outline-none transition-all resize-y disabled:bg-muted disabled:text-muted-foreground"
  placeholder={t('compliance.justificationPlaceholder', { defaultValue: 'Décrivez comment ce contrôle est implémenté...' })}
  value={justification}
  onChange={(e) => setJustification(e.target.value)}
  onBlur={saveJustification}
  maxLength={2000}
  disabled={!canEdit || updating || isSaving}
  />
  <div className="flex items-center justify-between mt-1">
  <div className="text-xs text-muted-foreground">
  {justification.length}/2000
  </div>
  {justification !== (control.justification || '') && (
  <Button
   type="button"
   size="sm"
   variant="outline"
   onClick={saveJustification}
   disabled={isSaving || updating}
   className="text-xs"
  >
   {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
   {isSaving ? t('common.saving', { defaultValue: 'Enregistrement...' }) : t('common.save', { defaultValue: 'Enregistrer' })}
  </Button>
  )}
  </div>
  </>
 ) : (
  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
  {control.justification || <span className="text-muted-foreground italic">{t('compliance.noJustification', { defaultValue: 'Aucune justification fournie.' })}</span>}
  </div>
 )}
 </div>
 </div>
 );
};
