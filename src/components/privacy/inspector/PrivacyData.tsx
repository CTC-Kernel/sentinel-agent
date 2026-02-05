import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProcessingActivity } from '../../../types';
import { ProcessingActivityFormData } from '../../../schemas/privacySchema';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
// Imports
import { Shield, FileSpreadsheet, AlertTriangle, Eye, History as HistoryIcon } from '../../ui/Icons';
import { useStore } from '../../../store';

export interface PrivacyDataProps {
 activity: ProcessingActivity;
 isEditing: boolean;
 form: UseFormReturn<ProcessingActivityFormData>;
 onStartDPIA: () => void;
 onViewDPIA: () => void;
}

export const PrivacyData: React.FC<PrivacyDataProps> = ({
 activity,
 isEditing,
 form,
 onStartDPIA
}) => {
 const { t } = useStore();
 const { register, setValue, watch, formState: { errors } } = form;
 const watchedDataCategories = watch('dataCategories');
 const watchedHasDPIA = watch('hasDPIA');

 if (isEditing) {
 return (
 <div className="space-y-8 animate-fade-in">
 {/* Data Categories */}
 <div>
  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white mb-4">
  <FileSpreadsheet className="h-4 w-4 text-primary" />
  {t('privacy.data.dataCategories', { defaultValue: 'Catégories de Données' })}
  </h4>
  <div className="space-y-4">
  <CustomSelect
  label={t('privacy.data.dataCollectedLabel', { defaultValue: 'Données collectées (Sélection multiple)' })}
  value={watchedDataCategories || []}
  onChange={(val) => {
  const newValue = Array.isArray(val) ? val : [val];
  setValue('dataCategories', newValue.filter(Boolean), { shouldDirty: true });
  }}
  options={[
  { value: 'État Civil', label: 'État Civil (Nom, Prénom...)' },
  { value: 'Coordonnées', label: 'Coordonnées (Email, Tél...)' },
  { value: 'Vie Personnelle', label: 'Vie Personnelle' },
  { value: 'Vie Professionnelle', label: 'Vie Professionnelle' },
  { value: 'Données Bancaires', label: 'Données Bancaires' },
  { value: 'Connexion/Trace', label: 'Connexion / Trace' },
  { value: 'Santé', label: 'Santé (Sensible)' },
  { value: 'NIR', label: 'NIR (Sécu)' },
  { value: 'Biométrie', label: 'Biométrie' }
  ]}
  multiple
  placeholder={t('privacy.data.selectCategoriesPlaceholder', { defaultValue: 'Sélectionner les catégories...' })}
  />
  </div>
 </div>

 {/* DPIA */}
 <div>
  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white mb-4">
  <Shield className="h-4 w-4 text-purple-500" data-testid="shield-icon" />
  {t('privacy.data.dpiaTitle', { defaultValue: "Analyse d'Impact (DPIA)" })}
  </h4>
  <div className="bg-muted/50 p-4 rounded-3xl border border-border/40">
  <CustomSelect
  label={t('privacy.data.dpiaRequired', { defaultValue: 'DPIA Requis ?' })}
  value={watchedHasDPIA ? 'Oui' : 'Non'}
  onChange={(val) => {
  const value = Array.isArray(val) ? val[0] : val;
  setValue('hasDPIA', value === 'Oui', { shouldDirty: true });
  }}
  options={[
  { value: 'Non', label: t('privacy.data.dpiaNo', { defaultValue: 'Non - Risque faible à modéré' }) },
  { value: 'Oui', label: t('privacy.data.dpiaYes', { defaultValue: 'Oui - Risque élevé pour les droits et libertés' }) }
  ]}
  />
  </div>
 </div>

 {/* Retention */}
 <div>
  <h4 className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-white mb-4">
  <HistoryIcon className="h-4 w-4 text-blue-500" />
  {t('privacy.data.retention', { defaultValue: 'Conservation' })}
  </h4>
  <FloatingLabelInput
  label={t('privacy.data.retentionLabel', { defaultValue: 'Durée et règles de conservation' })}
  {...register('retentionPeriod')}
  error={errors.retentionPeriod?.message}
  placeholder={t('privacy.data.retentionPlaceholder', { defaultValue: 'Ex: 5 ans après la fin de la relation contractuelle...' })}
  textarea
  rows={3}
  />
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-8 animate-fade-in">
 {/* Read-only view */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 <div>
  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{t('privacy.data.dataCategories', { defaultValue: 'Catégories de Données' })}</h4>
  <div className="flex flex-wrap gap-2">
  {activity.dataCategories && activity.dataCategories.length > 0 ? (
  activity.dataCategories.map((cat, idx) => (
  <span key={idx || 'unknown'} className="px-3 py-1 bg-primary/10 dark:bg-primary text-primary dark:text-primary/50 rounded-full text-xs font-medium border border-primary/20 dark:border-primary/90">
   {cat}
  </span>
  ))
  ) : (
  <span className="text-muted-foreground italic text-sm">{t('privacy.data.noCategoriesSpecified', { defaultValue: 'Aucune catégorie renseignée' })}</span>
  )}
  </div>
 </div>

 <div>
  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{t('privacy.data.retention', { defaultValue: 'Conservation' })}</h4>
  <p className="text-sm text-foreground bg-muted/50 dark:bg-white/5 p-3 rounded-lg border border-border/40 dark:border-white/5">
  {activity.retentionPeriod || t('common.notSpecified', { defaultValue: 'Non spécifié' })}
  </p>
 </div>
 </div>

 <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-6 border border-purple-100 dark:border-purple-800/30">
 <div className="flex justify-between items-start">
  <div className="flex items-center gap-4">
  <div className="p-3 bg-card rounded-3xl text-purple-600">
  <Shield className="h-6 w-6" data-testid="shield-icon" />
  </div>
  <div>
  <h4 className="font-bold text-foreground">{t('privacy.data.dpiaTitle', { defaultValue: "Analyse d'Impact (DPIA)" })}</h4>
  <p className="text-sm text-muted-foreground mt-1">
  {activity.hasDPIA
   ? t('privacy.data.dpiaRequiredMessage', { defaultValue: "Une analyse d'impact est requise pour ce traitement." })
   : t('privacy.data.dpiaNotRequiredMessage', { defaultValue: "Aucune analyse d'impact n'est requise pour le moment." })}
  </p>
  </div>
  </div>
  {activity.hasDPIA && (
  <button
  onClick={onStartDPIA}
  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm shadow-purple-200 dark:shadow-none"
  >
  <Eye className="h-4 w-4" />
  {t('privacy.data.manageDpia', { defaultValue: 'Gérer DPIA' })}
  </button>
  )}
 </div>
 {activity.hasDPIA && (
  <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
  <AlertTriangle className="h-4 w-4" />
  <span>{t('privacy.data.dpiaActionRequired', { defaultValue: "Action requise : Vérifier l'analyse d'impact." })}</span>
  </div>
 )}
 </div>
 </div>
 );
};


