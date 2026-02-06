import { toast } from '@/lib/toast';
import React, { useEffect } from 'react';
import { Controller, SubmitHandler, useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { supplierSchema, SupplierFormData } from '../../schemas/supplierSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk, Document } from '../../types';
import { ShieldAlert, Building2, Wand2, Link as LinkIcon, FileText } from '../ui/Icons';
import { aiService } from '../../services/aiService';
import { useStore } from '../../store';
import { useLocale } from '../../hooks/useLocale';
import { ErrorLogger } from '../../services/errorLogger';
import { integrationService, CompanySearchResult } from '../../services/integrationService';
import { Search, Loader2 } from '../ui/Icons';
import { Button } from '../ui/button';
import { AIAssistantHeader, BaseTemplate } from '../ui/AIAssistantHeader';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

type SupplierTemplate = BaseTemplate & { category: string; criticality: Criticality };

const SUPPLIER_TEMPLATES: SupplierTemplate[] = [
 { name: 'Hébergeur Cloud Santé (HDS)', description: 'Fournisseur critique hébergeant des données de santé.', category: 'Hébergement', criticality: Criticality.CRITICAL },
 { name: 'Fournisseur SaaS RH', description: 'Solution de gestion des congés et paies.', category: 'SaaS', criticality: Criticality.MEDIUM },
 { name: 'Maintenance Informatique', description: 'Prestataire de maintenance sur site.', category: 'Services IT', criticality: Criticality.HIGH },
];
import { SUPPLIER_CATEGORIES, SUPPLIER_STATUSES, DORA_SERVICE_TYPES, DORA_CRITICALITIES } from '../../data/supplierConstants';

interface SupplierFormProps {
 onSubmit: SubmitHandler<SupplierFormData>;
 onCancel: () => void;
 initialData?: SupplierFormData;
 isEditing?: boolean;
 users: UserProfile[];
 processes: BusinessProcess[];
 assets: Asset[];
 risks: Risk[];
 documents: Document[];
 isLoading?: boolean;
 readOnly?: boolean;
 onDirtyChange?: (isDirty: boolean) => void;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({
 onSubmit,
 onCancel,
 initialData,
 isEditing = false,
 users,
 processes,
 assets,
 risks,
 documents,
 isLoading = false,
 readOnly = false,
 onDirtyChange
}) => {
 const { addToast, demoMode } = useStore();
 const { t } = useLocale();
 const defaultData: SupplierFormData = {
 name: '', category: 'SaaS', criticality: Criticality.MEDIUM, status: 'Actif',
 owner: '', ownerId: '', vatNumber: '',
 description: '',
 contactName: '', contactEmail: '',
 contractDocumentId: '',
 contractEnd: '',
 assessment: { hasIso27001: false, hasGdprPolicy: false, hasEncryption: false, hasBcp: false, hasIncidentProcess: false },
 isICTProvider: false, supportsCriticalFunction: false, doraCriticality: 'Aucun', serviceType: 'SaaS',
 relatedAssetIds: [], relatedRiskIds: [], relatedProjectIds: [], supportedProcessIds: []
 };

 const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isDirty }, getValues } = useZodForm<typeof supplierSchema>({
 schema: supplierSchema,
 mode: 'onChange',
 shouldUnregister: false,
 defaultValues: initialData ? {
 ...defaultData,
 ...initialData,
 // Ensure enum fields have valid values if they are missing or invalid in initialData
 doraCriticality: initialData.doraCriticality ?? 'Aucun',
 serviceType: initialData.serviceType ?? 'SaaS',
 category: initialData.category ?? 'SaaS',
 status: initialData.status ?? 'Actif',
 } : defaultData
 });

 useEffect(() => {
 onDirtyChange?.(isDirty);
 }, [isDirty, onDirtyChange]);

 // Persistence Hook
 const { clearDraft } = useFormPersistence<SupplierFormData>('sentinel_supplier_draft_new', {
 watch,
 reset
 }, {
 enabled: !isEditing && !initialData
 });

 const handleFormSubmit: SubmitHandler<SupplierFormData> = async (data) => {
 await onSubmit(data);
 clearDraft();
 };


 const onInvalid = (errors: FieldErrors<SupplierFormData>) => {
 const missingFields = Object.keys(errors).join(', ');
 toast.error(t('suppliers.form.invalid', { defaultValue: 'Formulaire invalide' }) + `. ${t('suppliers.form.fieldsInError', { defaultValue: 'Champs en erreur' })} : ${missingFields}`);
 };

 const [searchResults, setSearchResults] = React.useState<CompanySearchResult[]>([]);
 const [searching, setSearching] = React.useState(false);
 const [logoUrl, setLogoUrl] = React.useState<string>('');

 const handleCompanySearch = async (query: string) => {
 if (query.length < 3) {
 setSearchResults([]);
 return;
 }
 setSearching(true);
 try {
 const results = await integrationService.searchCompany(query, demoMode);
 setSearchResults(results);
 } catch (error) {
 ErrorLogger.error(error, "SupplierForm.handleCompanySearch");
 } finally {
 setSearching(false);
 }
 };

 const selectCompany = (company: CompanySearchResult) => {
 setValue('name', company.name);
 // Assuming we might want to store address/siren in description or custom fields later
 // For now, let's append to description if empty
 const currentDesc = getValues('description') || '';
 if (!currentDesc.includes(company.siren)) {
 setValue('description', `${currentDesc}\n\n[Auto-Import]\nSIREN: ${company.siren}\nAdresse: ${company.address}\nActivité: ${company.activity}`.trim());
 }
 setSearchResults([]);
 };

 // Watch name to fetch logo if it looks like a domain
 const nameValue = useWatch({ control, name: 'name' });
 useEffect(() => {
 if (nameValue && (nameValue.includes('.') || nameValue.includes('http'))) {
 // Extract domain
 const domain = nameValue.replace(/^https?:\/\//, '').split('/')[0];
 setLogoUrl(integrationService.getLogoUrl(domain));
 }
 }, [nameValue]);

 const selectedOwnerId = useWatch({ control, name: 'ownerId' });

 const [isGenerating, setIsGenerating] = React.useState(false);

 const handleSelectTemplate = (templateName: string) => {
 const t = SUPPLIER_TEMPLATES.find(t => t.name === templateName);
 if (t) {
 setValue('name', t.name);
 setValue('description', t.description);
 // category and criticality are enums in schema
 if (t.category === 'SaaS' || t.category === 'Hébergement' || t.category === 'Matériel' || t.category === 'Consulting' || t.category === 'Autre') {
 setValue('category', t.category);
 }
 setValue('criticality', t.criticality);
 }
 };

 const handleAutoGenerate = async () => {
 const currentName = getValues('name');
 if (!currentName) return;

 setIsGenerating(true);
 try {
 const prompt = `Décris un fournisseur de services intitulé "${currentName}".
 Format JSON attendu:
 {
 "description": "Description des services fournis",
 "category": "Catégorie probable (SaaS, Hébergement, etc.)",
  "criticality": "Critique, Élevée, Moyenne, ou Faible"
 }`;

 const resultText = await aiService.generateText(prompt);
 const jsonMatch = resultText.match(/\{[\s\S]*\}/);
 if (jsonMatch) {
 const data = JSON.parse(jsonMatch[0]);
 if (data.description) setValue('description', data.description);
 if (data.category) setValue('category', data.category);
 if (data.criticality) setValue('criticality', data.criticality);
 }
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'SupplierForm.handleAutoGenerate', 'AI_ERROR');
 } finally {
 setIsGenerating(false);
 }
 };

 // const isEditing = !!initialData; // Use initialData to determine if editing

 useEffect(() => {
 if (!selectedOwnerId) {
 setValue('owner', '', { shouldDirty: true, shouldValidate: true });
 return;
 }
 const selectedUser = users.find(u => u.uid === selectedOwnerId);
 setValue('owner', selectedUser ? (selectedUser.displayName || selectedUser.email || '') : '', {
 shouldDirty: true,
 shouldValidate: true
 });
 }, [selectedOwnerId, users, setValue]);

 const handleAISuggestion = async (field: keyof SupplierFormData) => {
 const name = getValues('name');
 if (!name) {
 addToast(t('suppliers.form.enterNameFirst', { defaultValue: "Veuillez d'abord saisir un nom de fournisseur" }), "info");
 return;
 }

 try {
 addToast(t('suppliers.form.aiGenerating', { defaultValue: 'Génération de suggestions IA...' }), "info");
 const prompt = `Suggère une valeur pour le champ ${field} d'un fournisseur nommé ${name}. Réponds uniquement par la valeur.`;
 const suggestion = await aiService.generateText(prompt);

 if (suggestion) {
 // Simple mapping for demo purposes - in prod use structured output
 if (field === 'category') setValue('category', 'SaaS');
 if (field === 'criticality') setValue('criticality', Criticality.MEDIUM);
 if (field === 'description') setValue('description', suggestion);
 addToast(t('suppliers.form.suggestionApplied', { defaultValue: 'Suggestion appliquée' }), "success");
 }
 } catch (error) {
 ErrorLogger.error(error, 'SupplierForm.handleAISuggestion');
 addToast(t('suppliers.form.aiError', { defaultValue: 'Erreur lors de la génération' }), "error");
 }
 };

 const handleVatValidation = async () => {
 const vat = getValues('vatNumber');
 if (!vat) return;
 try {
 const result = await integrationService.validateVat(vat);
 addToast(result.message, result.valid ? 'success' : 'error');
 } catch {
 addToast(t('suppliers.toast.viesValidationError', { defaultValue: 'Erreur de validation VIES' }), 'error');
 }
 };

 return (
 <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar h-full">
 <fieldset disabled={readOnly} className="space-y-6 disabled:text-muted-foreground">
 {!isEditing && !readOnly && (
  <AIAssistantHeader
  templates={SUPPLIER_TEMPLATES}
  onSelectTemplate={handleSelectTemplate}
  onAutoGenerate={handleAutoGenerate}
  isGenerating={isGenerating}
  title={t('suppliers.form.assistantTitle', { defaultValue: 'Assistant Fournisseur' })}
  description={t('suppliers.form.assistantDescription', { defaultValue: 'Ajoutez un fournisseur type ou laissez l\'IA le qualifier.' })}
  />
 )}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
  <Building2 className="w-5 h-5 mr-2 text-indigo-500" />
  {t('suppliers.form.generalInfo', { defaultValue: 'Informations Générales' })}
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <div className="col-span-1 md:col-span-2 relative">
  <Controller
  name="name"
  control={control}
  render={({ field }) => (
   <FloatingLabelInput
   label={t('suppliers.form.companyName', { defaultValue: "Nom de l'entreprise" })}
   {...field}
   value={field.value || ''}
   error={errors.name?.message}
   />
  )}
  />
  {!readOnly && (
  <button
   type="button"
   onClick={() => handleAISuggestion('name')}
   className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
   title={t('suppliers.form.suggestNameTitle', { defaultValue: 'Suggérer un nom complet' })}
   aria-label={t('suppliers.form.suggestNameAria', { defaultValue: 'Suggérer un nom complet par IA' })}
  >
   <Wand2 className="w-4 h-4" />
  </button>
  )}
  </div>

  {/* Company Search Results */}
  {searchResults.length > 0 && !readOnly && (
  <div className="col-span-1 md:col-span-2 bg-card rounded-3xl shadow-xl border border-border/40 overflow-hidden z-dropdown max-h-60 overflow-y-auto">
  {searchResults.map((company) => (
   <button
   key={company.siren || 'unknown'}
   type="button"
   onClick={() => selectCompany(company)}
   className="w-full text-left px-4 py-3 hover:bg-muted/50 dark:hover:bg-muted/50 border-b border-border/40 dark:border-white/5 last:border-0 transition-colors flex justify-between items-center"
   aria-label={`Sélectionner l'entreprise ${company.name}`}
   >
   <div>
   <div className="font-bold text-foreground text-sm">{company.name}</div>
   <div className="text-xs text-muted-foreground">{company.address}</div>
   </div>
   <div className="text-xs font-mono bg-muted/60 backdrop-blur-sm px-2 py-1 rounded text-muted-foreground">
   {company.siren}
   </div>
   </button>
  ))}
  </div>
  )}

  {!readOnly && (
  <div className="col-span-1 md:col-span-2">
  <label htmlFor="company-search" className="sr-only">{t('suppliers.form.searchCompanyLabel', { defaultValue: 'Rechercher une entreprise' })}</label>
  <div className="relative">
   <input
   id="company-search"
   type="text"
   placeholder={t('suppliers.form.searchCompanyPlaceholder', { defaultValue: 'Rechercher une entreprise (Sirene/Pappers)...' })}
   className="w-full px-4 py-2 bg-transparent border-b border-border/40 text-sm focus:border-indigo-500 outline-none transition-colors"
   onChange={(e) => handleCompanySearch(e.target.value)}
   aria-label={t('suppliers.form.searchCompanyLabel', { defaultValue: 'Rechercher une entreprise' })}
   />
   <div className="absolute right-0 top-2 text-muted-foreground">
   {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
   </div>
  </div>
  </div>
  )}


  <div className="col-span-1 md:col-span-2">
  <div className="relative">
  <Controller
   name="vatNumber"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('suppliers.form.vatNumber', { defaultValue: 'Numéro de TVA (VIES)' })}
   {...field}
   value={field.value || ''}
   />
   )}
  />
  {!readOnly && (
   <button
   type="button"
   onClick={handleVatValidation}
   className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-wider"
   >
   {t('suppliers.form.verify', { defaultValue: 'Vérifier' })}
   </button>
  )}
  </div>
  </div>

  {logoUrl && (
  <div className="col-span-1 md:col-span-2 flex justify-center py-4">
  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
  <img src={logoUrl} alt={t('suppliers.form.supplierLogoAlt', { defaultValue: 'Logo du fournisseur' })} className="h-16 w-16 object-contain rounded-3xl bg-white p-2 shadow-sm border border-border/40" onError={(e) => e.currentTarget.style.display = 'none'} />
  </div>
  )}

  <div>
  <Controller
  name="category"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('suppliers.form.categoryLabel', { defaultValue: 'Catégorie' })}
   options={SUPPLIER_CATEGORIES.map(c => ({ value: c, label: c }))}
   value={field.value || ''}
   onChange={field.onChange}
   />
  )}
  />
  </div>

  <div>
  <Controller
  name="criticality"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('suppliers.form.criticalityLabel', { defaultValue: 'Criticité' })}
   options={Object.values(Criticality).map(c => ({ value: c, label: c }))}
   value={field.value || ''}
   onChange={field.onChange}
   />
  )}
  />
  </div>

  <div>
  <Controller
  name="status"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('suppliers.form.statusLabel', { defaultValue: 'Statut' })}
   options={SUPPLIER_STATUSES.map(s => ({ value: s, label: s }))}
   value={field.value || ''}
   onChange={field.onChange}
   />
  )}
  />
  </div>

  <div>
  <label htmlFor="internal-owner" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('suppliers.form.internalOwnerLabel', { defaultValue: 'Responsable Interne' })}</label>
  <Controller
  name="ownerId"
  control={control}
  render={({ field }) => (
   <CustomSelect
   id="internal-owner"
   options={users.map(u => ({ value: u.uid, label: u.displayName, subLabel: u.role }))}
   value={field.value ?? ''}
   onChange={field.onChange}
   placeholder={t('suppliers.form.selectResponsiblePlaceholder', { defaultValue: 'Sélectionner un responsable...' })}
   />
  )}
  />
  </div>


  <div className="col-span-1 md:col-span-2 relative">
  <Controller
  name="description"
  control={control}
  render={({ field }) => (
   <FloatingLabelInput
   label={t('suppliers.form.descriptionLabel', { defaultValue: 'Description' })}
   {...field}
   value={field.value || ''}
   textarea
   />
  )}
  />
  {!readOnly && (
  <button
   type="button"
   onClick={() => handleAISuggestion('description')}
   className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
   title={t('suppliers.form.suggestDescription', { defaultValue: 'Suggérer une description' })}
   aria-label={t('suppliers.form.suggestDescriptionAria', { defaultValue: 'Suggérer une description par IA' })}
  >
   <Wand2 className="w-4 h-4" />
  </button>
  )}
  </div>
  </div>
 </div>

 {/* DORA Compliance Card */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm bg-indigo-50/30/10">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
  <ShieldAlert className="w-5 h-5 mr-2 text-indigo-600" />
  {t('suppliers.form.doraComplianceTitle', { defaultValue: 'Conformité DORA' })}
  </h3>

  <p className="text-xs text-muted-foreground mb-4">
  {t('suppliers.form.doraHelperText', { defaultValue: 'Les champs DORA sont requis pour les prestataires TIC critiques soumis au r\u00e8glement DORA. Cochez "Prestataire TIC Critique" si ce fournisseur fournit des services TIC essentiels.' })}
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <div className="flex items-center space-x-3 p-4 glass-premium rounded-2xl border border-white/50 dark:border-white/5">
  <input id="isICTProvider" type="checkbox" disabled={readOnly} className="h-5 w-5 rounded text-primary focus-visible:ring-primary border-border/40" {...register('isICTProvider')} />
  <label htmlFor="isICTProvider" className="text-sm font-bold text-foreground cursor-pointer">{t('suppliers.form.ictProviderLabel', { defaultValue: 'Prestataire TIC Critique' })}</label>
  </div>
  <div className="flex items-center space-x-3 p-4 glass-premium rounded-2xl border border-white/50 dark:border-white/5">
  <input id="supportsCriticalFunction" type="checkbox" disabled={readOnly} className="h-5 w-5 rounded text-primary focus-visible:ring-primary border-border/40" {...register('supportsCriticalFunction')} />
  <label htmlFor="supportsCriticalFunction" className="text-sm font-bold text-foreground cursor-pointer">{t('suppliers.form.supportsCriticalFunctionLabel', { defaultValue: 'Supporte Fonction Critique' })}</label>
  </div>


  <div>
  <Controller
  name="serviceType"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('suppliers.form.serviceTypeLabel', { defaultValue: 'Type de Service' })}
   options={DORA_SERVICE_TYPES.map(c => ({ value: c, label: c }))}
   value={field.value || ''}
   onChange={field.onChange}
   />
  )}
  />
  </div>
  <div>
  <Controller
  name="doraCriticality"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('suppliers.form.doraCriticalityLabel', { defaultValue: 'Criticité DORA' })}
   options={DORA_CRITICALITIES.map(c => ({ value: c, label: c }))}
   value={field.value || ''}
   onChange={field.onChange}
   />
  )}
  />
  </div>
  </div>
 </div>

 {/* Relations Card */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
  <LinkIcon className="w-5 h-5 mr-2 text-indigo-500" />
  {t('suppliers.form.relationsTitle', { defaultValue: 'Relations & Dépendances' })}
  </h3>

  <div className="space-y-6">
  <div>
  <label htmlFor="supported-processes" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('suppliers.form.supportedProcessesLabel', { defaultValue: 'Processus Supportés' })}</label>
  <Controller
  name="supportedProcessIds"
  control={control}
  render={({ field }) => (
   <CustomSelect
   id="supported-processes"
   options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}

   value={field.value || []}
   onChange={field.onChange}
   placeholder={t('suppliers.form.selectProcessesPlaceholder', { defaultValue: 'Sélectionner les processus...' })}
   multiple
   />
  )}
  />
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <div>
  <label htmlFor="related-assets" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('suppliers.form.relatedAssetsLabel', { defaultValue: 'Actifs Liés' })}</label>

  {/* This button seems to be misplaced or part of a different context, adding it as requested */}

  <Controller
   name="relatedAssetIds"
   control={control}
   render={({ field }) => (
   <CustomSelect
   id="related-assets"
   options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.type }))}

   value={field.value || []}
   onChange={field.onChange}
   placeholder={t('suppliers.form.linkAssetsPlaceholder', { defaultValue: 'Lier des actifs...' })}
   multiple
   />
   )}
  />
  </div>
  <div>
  <label htmlFor="related-risks" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('suppliers.form.relatedRisksLabel', { defaultValue: 'Risques Liés' })}</label>
  <Controller
   name="relatedRiskIds"
   control={control}
   render={({ field }) => (
   <CustomSelect
   id="related-risks"
   options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}

   value={field.value || []}
   onChange={field.onChange}
   placeholder={t('suppliers.form.linkRisksPlaceholder', { defaultValue: 'Lier des risques...' })}
   multiple
   />
   )}
  />
  </div>
  </div>
  </div>
 </div>

 {/* Contract & Contact Card */}
 <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
  <FileText className="w-5 h-5 mr-2 text-indigo-500" />
  {t('suppliers.form.contractContactTitle', { defaultValue: 'Contrat & Contact' })}
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <Controller
  name="contactName"
  control={control}
  render={({ field }) => (
  <FloatingLabelInput label={t('suppliers.form.contactNameLabel', { defaultValue: 'Nom du Contact' })} {...field} value={field.value || ''} />
  )}
  />
  <Controller
  name="contactEmail"
  control={control}
  render={({ field }) => (
  <FloatingLabelInput label={t('suppliers.form.contactEmailLabel', { defaultValue: 'Email du Contact' })} {...field} value={field.value || ''} type="email" />
  )}
  />

  <div>
  <label htmlFor="contract-doc" className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">{t('suppliers.form.contractDocLabel', { defaultValue: 'Contrat (Document)' })}</label>
  <Controller
  name="contractDocumentId"
  control={control}
  render={({ field }) => (
   <CustomSelect
   id="contract-doc"
   options={documents.map(d => ({ value: d.id, label: d.title, subLabel: d.version }))}
   value={field.value ?? ''}
   onChange={field.onChange}
   placeholder={t('suppliers.form.linkContractPlaceholder', { defaultValue: 'Lier un contrat...' })}
   />
  )}
  />
  </div>


  <Controller
  name="contractEnd"
  control={control}
  render={({ field }) => (
  <FloatingLabelInput label={t('suppliers.form.contractEndLabel', { defaultValue: 'Fin de Contrat' })} {...field} value={field.value || ''} type="date" />
  )}
  />
  </div>
 </div>

 {!readOnly && (
  <div className="flex justify-end gap-3 pt-6">
  <Button
  type="button"
  onClick={onCancel}
  variant="ghost"
  disabled={isLoading}
  className="px-6 py-3 text-sm font-bold text-muted-foreground hover:bg-muted rounded-3xl transition-colors"
  >
  {t('common.cancel', { defaultValue: 'Annuler' })}
  </Button>
  <Button
  type="submit"
  isLoading={isLoading}
  className="px-8 py-3 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-700 text-white rounded-3xl hover:scale-105 transition-transform shadow-lg shadow-primary/20 font-bold text-sm"
  >
  {isEditing ? t('suppliers.form.updateButton', { defaultValue: 'Mettre à jour' }) : t('suppliers.form.createButton', { defaultValue: 'Créer le Fournisseur' })}
  </Button>
  </div>
 )}
 </fieldset>
 </form>
 );
};
