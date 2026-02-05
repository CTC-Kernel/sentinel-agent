import { FieldErrors, useWatch } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { UserProfile, Asset, Risk } from '../../types';
import { processingActivitySchema, ProcessingActivityFormData } from '../../schemas/privacySchema';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { useStore } from '../../store';
import { toast } from '@/lib/toast';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';
import { Loader2 } from '../ui/Icons';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface CreateActivityFormProps {
 usersList: UserProfile[];
 assetsList: Asset[];
 risksList: Risk[];
 onSubmit: (data: ProcessingActivityFormData) => Promise<void>;
 onCancel: () => void;
}

export const CreateActivityForm: React.FC<CreateActivityFormProps> = ({
 usersList,
 assetsList,
 risksList,
 onSubmit,
 onCancel
}) => {
 const { user, t } = useStore();

 const handleFormSubmit = async (data: ProcessingActivityFormData) => {
 await onSubmit(data);
 clearDraft();
 };

 const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isSubmitting } } = useZodForm<typeof processingActivitySchema>({
 schema: processingActivitySchema,
 mode: 'onChange',
 defaultValues: {
 name: '',
 purpose: '',
 manager: user?.displayName || '',
 managerId: user?.uid || '',
 status: 'Actif',
 legalBasis: 'Intérêt Légitime',
 dataCategories: [],
 dataSubjects: [],
 retentionPeriod: '5 ans',
 hasDPIA: false,
 relatedAssetIds: [],
 relatedRiskIds: []
 }
 });

 // Persistence Hook
 const { clearDraft } = useFormPersistence<ProcessingActivityFormData>('sentinel_privacy_activity_draft_new', {
 watch,
 reset
 });

 const [managerId, legalBasis, status, dataCategories, hasDPIA, relatedAssetIds, relatedRiskIds] = useWatch({
 control,
 name: ['managerId', 'legalBasis', 'status', 'dataCategories', 'hasDPIA', 'relatedAssetIds', 'relatedRiskIds']
 });

 const onInvalid = (errors: FieldErrors<ProcessingActivityFormData>) => {
 const missingFields = Object.keys(errors).join(', ');
 toast.error(t('common.formInvalid', { defaultValue: 'Formulaire invalide. Champs en erreur' }) + ` : ${missingFields}`);
 };

 return (
 <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="p-4 sm:p-8 space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 <div>
  <FloatingLabelInput label={t('privacy.form.activityName', { defaultValue: 'Nom du traitement' })} {...register('name')} placeholder={t('privacy.form.activityNamePlaceholder', { defaultValue: 'ex: Gestion Paie' })} error={errors.name?.message} aria-describedby={errors.name ? 'name-error' : undefined} />
 </div>
 <div>
  <label htmlFor="privacy-activity-managerId" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t('privacy.form.manager', { defaultValue: 'Responsable' })}</label>
  <CustomSelect
  value={managerId || ''}
  onChange={(val) => {
  const value = Array.isArray(val) ? val[0] : val;
  const selectedUser = usersList.find(u => u.uid === value);
  setValue('managerId', value);
  setValue('manager', selectedUser?.displayName || '');
  }}
  options={usersList.map(u => ({ value: u.uid, label: u.displayName }))}
  placeholder={t('common.select', { defaultValue: 'Sélectionner...' })}
  />
  {errors.managerId && <p id="managerId-error" className="text-destructive text-xs mt-1">{errors.managerId.message}</p>}
 </div>
 </div>
 <div>
 <FloatingLabelInput label={t('privacy.form.purpose', { defaultValue: 'Finalité principale' })} textarea rows={2} {...register('purpose')} placeholder={t('privacy.form.purposePlaceholder', { defaultValue: 'ex: Payer les salaires et déclarations sociales' })} error={errors.purpose?.message} aria-describedby={errors.purpose ? 'purpose-error' : undefined} />
 </div>
 <div className="grid grid-cols-2 gap-6">
 <div>
  <div className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t('privacy.form.legalBasis', { defaultValue: 'Base Légale' })}</div>
  <CustomSelect
  value={legalBasis}
  onChange={(val) => setValue('legalBasis', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['legalBasis'])}
  options={['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime', 'Sauvegarde Intérêts', 'Mission Publique'].map(c => ({ value: c, label: c }))}
  />
  {errors.legalBasis && <p className="text-destructive text-xs mt-1">{errors.legalBasis.message}</p>}
 </div>
 <div>
  <div className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t('privacy.form.status', { defaultValue: 'Statut' })}</div>
  <CustomSelect
  value={status}
  onChange={(val) => setValue('status', (Array.isArray(val) ? val[0] : val) as ProcessingActivityFormData['status'])}
  options={[
  { value: 'Actif', label: 'Actif' },
  { value: 'En projet', label: 'En projet' },
  { value: 'Archivé', label: 'Archivé' }
  ]}
  />
  {errors.status && <p className="text-destructive text-xs mt-1">{errors.status.message}</p>}
 </div>
 </div>
 <div>
 <CustomSelect
  label={t('privacy.form.dataCategories', { defaultValue: 'Catégories de données' })}
  multiple
  value={dataCategories}
  onChange={(val) => setValue('dataCategories', Array.isArray(val) ? val : [val])}
  options={['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(c => ({ value: c, label: c }))}
 />
 </div>
 <div className="grid grid-cols-2 gap-6">
 <div><FloatingLabelInput label={t('privacy.form.retention', { defaultValue: 'Durée Conservation' })} {...register('retentionPeriod')} placeholder={t('privacy.form.retentionPlaceholder', { defaultValue: 'ex: 5 ans après départ' })} error={errors.retentionPeriod?.message} /></div>
 <div>
  <CustomSelect
  label={t('privacy.form.dpiaRequired', { defaultValue: 'DPIA Requis ?' })}
  value={hasDPIA ? 'yes' : 'no'}
  onChange={(val) => setValue('hasDPIA', val === 'yes')}
  options={[
  { value: 'yes', label: t('privacy.form.dpiaYes', { defaultValue: 'Oui - Requis' }) },
  { value: 'no', label: t('privacy.form.dpiaNo', { defaultValue: 'Non - Pas nécessaire' }) }
  ]}
  />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 border-t border-border">
 <div>
  <CustomSelect
  label={t('privacy.form.relatedAssets', { defaultValue: 'Actifs liés' })}
  multiple
  value={relatedAssetIds || []}
  onChange={(val) => setValue('relatedAssetIds', Array.isArray(val) ? val : [val])}
  options={assetsList.map(a => ({ value: a.id, label: a.name }))}
  placeholder={t('privacy.form.relatedAssetsPlaceholder', { defaultValue: 'Associer des actifs...' })}
  />
 </div>
 <div>
  <CustomSelect
  label={t('privacy.form.relatedRisks', { defaultValue: 'Risques liés' })}
  multiple
  value={relatedRiskIds || []}
  onChange={(val) => setValue('relatedRiskIds', Array.isArray(val) ? val : [val])}
  options={risksList.map(r => ({ value: r.id, label: r.threat.substring(0, 50) + '...' }))}
  placeholder={t('privacy.form.relatedRisksPlaceholder', { defaultValue: 'Associer des risques...' })}
  />
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-border">
 <button aria-label="Cancel creation" type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-muted-foreground hover:bg-muted rounded-3xl transition-colors">{t('common.cancel', { defaultValue: 'Annuler' })}</button>
 <button aria-label="Save creation" type="submit" disabled={isSubmitting} className="px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-3xl hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
  {t('common.save', { defaultValue: 'Enregistrer' })}
 </button>
 </div>
 </form>
 );
};
