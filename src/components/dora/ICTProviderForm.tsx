/**
 * ICT Provider Form Component
 * DORA Art. 28 - Story 35.1
 * Tabbed form for creating/editing ICT Providers
 */

import React, { useState, useEffect } from 'react';
import { Controller, useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale } from '../../hooks/useLocale';
import { ictProviderSchema } from '../../schemas/doraSchema';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';
import { ICTProviderFormData } from '../../types/dora';
import {
 ICT_CRITICALITY_LEVELS,
 ICT_SERVICE_TYPES,
 SUBSTITUTABILITY_LEVELS,
 ICT_CERTIFICATIONS,
 ICTService
} from '../../types/dora';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import {
 Building2,
 FileText,
 Shield,
 AlertTriangle,
 Plus,
 Trash2,
 Server
} from '../ui/Icons';

interface ICTProviderFormProps {
 onSubmit: (data: ICTProviderFormData) => Promise<void>;
 onCancel: () => void;
 initialData?: Partial<ICTProviderFormData>;
 isEditing?: boolean;
 isLoading?: boolean;
 readOnly?: boolean;
 onDirtyChange?: (isDirty: boolean) => void;
}

type TabId = 'general' | 'services' | 'contract' | 'compliance' | 'risk';

export const ICTProviderForm: React.FC<ICTProviderFormProps> = ({
 onSubmit,
 onCancel,
 initialData,
 isEditing = false,
 isLoading = false,
 readOnly = false,
 onDirtyChange
}) => {
 'use no memo'; // Opt-out of React Compiler - react-hook-form's watch() is incompatible
 const { t } = useLocale();
 const [activeTab, setActiveTab] = useState<TabId>('general');

 const defaultService: ICTService = {
 id: `svc-${Date.now()}`,
 name: '',
 type: 'other',
 criticality: 'standard',
 businessFunctions: []
 };

 const defaultValues: ICTProviderFormData = {
 name: '',
 category: 'standard',
 description: '',
 services: [defaultService],
 contractInfo: {
 startDate: new Date().toISOString().split('T')[0],
 endDate: '',
 exitStrategy: '',
 auditRights: false
 },
 compliance: {
 doraCompliant: false,
 certifications: [],
 locationEU: true
 },
 riskAssessment: {
 concentration: 0,
 substitutability: 'medium',
 lastAssessment: new Date().toISOString()
 },
 contactName: '',
 contactEmail: '',
 contactPhone: '',
 website: '',
 status: 'active',
 ...initialData
 };

 const {
 control,
 handleSubmit,
 watch,
 reset,
 formState: { errors, isDirty }
 } = useForm<ICTProviderFormData>({
 resolver: zodResolver(ictProviderSchema) as never,
 defaultValues,
 mode: 'onChange'
 });

 // Notify parent of dirty state changes
 useEffect(() => {
 onDirtyChange?.(isDirty);
 }, [isDirty, onDirtyChange]);

 // Persistence Hook
 const { clearDraft } = useFormPersistence<ICTProviderFormData>('sentinel_ict_provider_draft_new', {
 watch,
 reset
 }, {
 enabled: !isEditing && !initialData
 });

 const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
 control,
 name: 'services'
 });

 // eslint-disable-next-line react-hooks/incompatible-library
 const category = watch('category');
 const concentration = watch('riskAssessment.concentration') || 0;

 const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
 { id: 'general', label: t('dora.tabs.general'), icon: <Building2 className="w-4 h-4" /> },
 { id: 'services', label: t('dora.tabs.services'), icon: <Server className="w-4 h-4" /> },
 { id: 'contract', label: t('dora.tabs.contract'), icon: <FileText className="w-4 h-4" /> },
 { id: 'compliance', label: t('dora.tabs.compliance'), icon: <Shield className="w-4 h-4" /> },
 { id: 'risk', label: t('dora.tabs.risk'), icon: <AlertTriangle className="w-4 h-4" /> }
 ];

 const handleFormSubmit = async (data: ICTProviderFormData) => {
 await onSubmit(data);
 clearDraft();
 };

 return (
 <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
 {/* Tabs */}
 <div className="flex gap-1 px-6 py-3 border-b border-border/40 dark:border-white/5 overflow-x-auto">
 {tabs.map((tab) => (
  <button
  key={tab.id || 'unknown'}
  type="button"
  onClick={() => setActiveTab(tab.id)}
  className={`flex items-center gap-2 px-4 py-2 rounded-3xl text-sm font-medium transition-all ${activeTab === tab.id
  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
  : 'text-muted-foreground hover:bg-muted dark:hover:bg-white/5'
  }`}
  >
  {tab.icon}
  <span className="hidden sm:inline">{tab.label}</span>
  </button>
 ))}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 <fieldset disabled={readOnly}>
  {/* General Tab */}
  {activeTab === 'general' && (
  <div className="space-y-6">
  <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
   <Building2 className="w-5 h-5 mr-2 text-indigo-500" />
   {t('dora.fields.name')}
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
   <div className="col-span-2">
   <Controller
   name="name"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
    label={t('dora.fields.name')}
    {...field}
    error={errors.name?.message}
   />
   )}
   />
   </div>

   <Controller
   name="category"
   control={control}
   render={({ field }) => (
   <CustomSelect
   label={t('dora.fields.category')}
   options={ICT_CRITICALITY_LEVELS.map(c => ({
    value: c,
    label: t(`dora.category.${c}`)
   }))}
   value={field.value}
   onChange={field.onChange}
   />
   )}
   />

   <Controller
   name="status"
   control={control}
   render={({ field }) => (
   <CustomSelect
   label={t('dora.fields.status')}
   options={[
    { value: 'active', label: t('dora.status.active') },
    { value: 'inactive', label: t('dora.status.inactive') },
    { value: 'pending', label: t('dora.status.pending') },
    { value: 'terminated', label: t('dora.status.terminated') }
   ]}
   value={field.value}
   onChange={field.onChange}
   />
   )}
   />

   <div className="col-span-2">
   <Controller
   name="description"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
    label={t('dora.fields.description')}
    {...field}
    value={field.value || ''}
    textarea
   />
   )}
   />
   </div>

   {/* Contact Info */}
   <Controller
   name="contactName"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.fields.contactName')}
   {...field}
   value={field.value || ''}
   />
   )}
   />

   <Controller
   name="contactEmail"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.fields.contactEmail')}
   {...field}
   value={field.value || ''}
   type="email"
   error={errors.contactEmail?.message}
   />
   )}
   />

   <Controller
   name="contactPhone"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.fields.contactPhone')}
   {...field}
   value={field.value || ''}
   />
   )}
   />

   <Controller
   name="website"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.fields.website')}
   {...field}
   value={field.value || ''}
   error={errors.website?.message}
   />
   )}
   />
  </div>
  </div>
  </div>
  )}

  {/* Services Tab */}
  {activeTab === 'services' && (
  <div className="space-y-6">
  <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5">
  <div className="flex items-center justify-between mb-6">
   <h3 className="text-lg font-bold text-foreground flex items-center">
   <Server className="w-5 h-5 mr-2 text-indigo-500" />
   {t('dora.fields.services')}
   </h3>
   {!readOnly && (
   <Button
   type="button"
   variant="outline"
   size="sm"
   onClick={() => appendService({
   id: `svc-${Date.now()}`,
   name: '',
   type: 'other',
   criticality: category || 'standard',
   businessFunctions: []
   })}
   >
   <Plus className="w-4 h-4 mr-1" />
   {t('common.create')}
   </Button>
   )}
  </div>

  {errors.services?.message && (
   <p className="text-red-500 text-sm mb-4">{errors.services.message}</p>
  )}

  <div className="space-y-4">
   {serviceFields.map((field, index) => (
   <div
   key={field.id || 'unknown'}
   className="p-4 bg-card rounded-2xl border border-white/50 dark:border-white/5"
   >
   <div className="flex items-start justify-between mb-4">
   <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
    {t('dora.service.label', { defaultValue: 'Service' })} {index + 1}
   </span>
   {!readOnly && serviceFields.length > 1 && (
    <button
    type="button"
    onClick={() => removeService(index)}
    className="text-red-400 hover:text-red-600 transition-colors"
    >
    <Trash2 className="w-4 h-4" />
    </button>
   )}
   </div>

   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
   <Controller
    name={`services.${index}.name`}
    control={control}
    render={({ field }) => (
    <FloatingLabelInput
    label={t('dora.service.name')}
    {...field}
    error={errors.services?.[index]?.name?.message}
    />
    )}
   />

   <Controller
    name={`services.${index}.type`}
    control={control}
    render={({ field }) => (
    <CustomSelect
    label={t('dora.service.type')}
    options={ICT_SERVICE_TYPES.map(type => ({
    value: type,
    label: t(`dora.service.types.${type}`)
    }))}
    value={field.value || ''}
    onChange={field.onChange}
    />
    )}
   />

   <Controller
    name={`services.${index}.criticality`}
    control={control}
    render={({ field }) => (
    <CustomSelect
    label={t('dora.service.criticality')}
    options={ICT_CRITICALITY_LEVELS.map(c => ({
    value: c,
    label: t(`dora.category.${c}`)
    }))}
    value={field.value || ''}
    onChange={field.onChange}
    />
    )}
   />

   <Controller
    name={`services.${index}.description`}
    control={control}
    render={({ field }) => (
    <FloatingLabelInput
    label={t('dora.fields.description')}
    {...field}
    value={field.value || ''}
    />
    )}
   />
   </div>
   </div>
   ))}
  </div>
  </div>
  </div>
  )}

  {/* Contract Tab */}
  {activeTab === 'contract' && (
  <div className="space-y-6">
  <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
   <FileText className="w-5 h-5 mr-2 text-indigo-500" />
   {t('dora.contract.title')}
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
   <Controller
   name="contractInfo.startDate"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.contract.startDate')}
   type="date"
   {...field}
   value={typeof field.value === 'string' ? field.value : ''}
   error={errors.contractInfo?.startDate?.message}
   />
   )}
   />

   <Controller
   name="contractInfo.endDate"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.contract.endDate')}
   type="date"
   {...field}
   value={typeof field.value === 'string' ? field.value : ''}
   error={errors.contractInfo?.endDate?.message}
   />
   )}
   />

   <Controller
   name="contractInfo.contractValue"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.contract.contractValue')}
   type="number"
   {...field}
   value={field.value || ''}
   onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
   />
   )}
   />

   <Controller
   name="contractInfo.noticePeriodDays"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.contract.noticePeriod')}
   type="number"
   {...field}
   value={field.value || ''}
   onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
   />
   )}
   />

   <div className="col-span-2">
   <Controller
   name="contractInfo.exitStrategy"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
    label={t('dora.contract.exitStrategy')}
    {...field}
    value={field.value || ''}
    textarea
    error={errors.contractInfo?.exitStrategy?.message}
   />
   )}
   />
   {category === 'critical' && (
   <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
   {t('dora.validation.exit_strategy_required_critical')}
   </p>
   )}
   </div>

   <div className="col-span-2">
   <label className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-white/50 dark:border-white/5 cursor-pointer">
   <Controller
   name="contractInfo.auditRights"
   control={control}
   render={({ field }) => (
    <input
    type="checkbox"
    checked={field.value || false}
    onChange={field.onChange}
    disabled={readOnly}
    className="h-5 w-5 rounded text-primary focus-visible:ring-primary border-border/40"
    />
   )}
   />
   <span className="text-sm font-medium text-foreground text-muted-foreground">
   {t('dora.contract.auditRights')}
   </span>
   </label>
   </div>
  </div>
  </div>
  </div>
  )}

  {/* Compliance Tab */}
  {activeTab === 'compliance' && (
  <div className="space-y-6">
  <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
   <Shield className="w-5 h-5 mr-2 text-indigo-500" />
   {t('dora.compliance.title')}
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
   <div className="col-span-2 flex flex-wrap gap-4">
   <label className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-white/50 dark:border-white/5 cursor-pointer flex-1 min-w-[200px]">
   <Controller
   name="compliance.doraCompliant"
   control={control}
   render={({ field }) => (
    <input
    type="checkbox"
    checked={field.value || false}
    onChange={field.onChange}
    disabled={readOnly}
    className="h-5 w-5 rounded text-primary focus-visible:ring-primary border-border/40"
    />
   )}
   />
   <span className="text-sm font-medium text-foreground text-muted-foreground">
   {t('dora.compliance.doraCompliant')}
   </span>
   </label>

   <label className="flex items-center gap-3 p-4 bg-card rounded-2xl border border-white/50 dark:border-white/5 cursor-pointer flex-1 min-w-[200px]">
   <Controller
   name="compliance.locationEU"
   control={control}
   render={({ field }) => (
    <input
    type="checkbox"
    checked={field.value || false}
    onChange={field.onChange}
    disabled={readOnly}
    className="h-5 w-5 rounded text-primary focus-visible:ring-primary border-border/40"
    />
   )}
   />
   <span className="text-sm font-medium text-foreground text-muted-foreground">
   {t('dora.compliance.locationEU')}
   </span>
   </label>
   </div>

   <Controller
   name="compliance.headquartersCountry"
   control={control}
   render={({ field }) => (
   <FloatingLabelInput
   label={t('dora.compliance.headquartersCountry')}
   {...field}
   value={field.value || ''}
   />
   )}
   />

   <div className="col-span-2">
   <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 ml-1">
   {t('dora.compliance.certifications')}
   </label>
   <Controller
   name="compliance.certifications"
   control={control}
   render={({ field }) => (
   <CustomSelect
    options={ICT_CERTIFICATIONS.map(c => ({ value: c, label: c }))}
    value={field.value || []}
    onChange={field.onChange}
    multiple
    placeholder={t('dora.compliance.selectCertifications', { defaultValue: 'Sélectionner les certifications...' })}
   />
   )}
   />
   </div>
  </div>
  </div>
  </div>
  )}

  {/* Risk Tab - Story 35-2: Enhanced UI */}
  {activeTab === 'risk' && (
  <div className="space-y-6">
  {/* DORA Risk Assessment Info Banner */}
  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
  <div className="flex items-start gap-3">
   <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
   <div>
   <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
   {t('dora.risk.doraRequirement', 'Exigence DORA Art. 28')}
   </p>
   <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
   {t('dora.risk.doraRequirementDesc', 'Évaluez le risque de concentration et la substituabilité de chaque fournisseur ICT pour garantir la résilience opérationnelle.')}
   </p>
   </div>
  </div>
  </div>

  <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-white/50 dark:border-white/5">
  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center">
   <AlertTriangle className="w-5 h-5 mr-2 text-indigo-500" />
   {t('dora.risk.title')}
  </h3>

  <div className="space-y-6 sm:space-y-8">
   {/* Concentration Risk Slider with Visual Zones */}
   <div>
   <div className="flex items-center justify-between mb-3">
   <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
   {t('dora.risk.concentration')}
   </label>
   <span className="text-xs text-muted-foreground">
   {t('dora.risk.concentrationHelp', 'Dépendance à ce fournisseur')}
   </span>
   </div>
   <Controller
   name="riskAssessment.concentration"
   control={control}
   render={({ field }) => {
   const value = field.value || 0;
   const riskLevel = value > 70 ? 'high' : value > 40 ? 'medium' : 'low';
   const riskColor = value > 70 ? 'red' : value > 40 ? 'amber' : 'green';

   return (
    <div className="space-y-3">
    {/* Visual Risk Bar */}
    <div className="relative h-10 rounded-3xl overflow-hidden bg-gradient-to-r from-green-500 via-amber-500 to-red-500">
    {/* Zones overlay */}
    <div className="absolute inset-0 flex">
    <div className="w-[40%] border-r border-white/30 flex items-center justify-center">
     <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
     {t('dora.risk.lowZone', 'Faible')}
     </span>
    </div>
    <div className="w-[30%] border-r border-white/30 flex items-center justify-center">
     <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
     {t('dora.risk.mediumZone', 'Moyen')}
     </span>
    </div>
    <div className="w-[30%] flex items-center justify-center">
     <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
     {t('dora.risk.highZone', 'Élevé')}
     </span>
    </div>
    </div>
    {/* Current value indicator */}
    <div
    className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-300"
    style={{ left: `${value}%` }}
    />
    </div>

    {/* Slider Input */}
    <input
    type="range"
    min="0"
    max="100"
    disabled={readOnly}
    value={value}
    onChange={(e) => field.onChange(Number(e.target.value))}
    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-indigo-600"
    aria-label={t('dora.risk.concentration')}
    />

    {/* Value Display */}
    <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-${riskColor}-100 text-${riskColor}-700 dark:bg-${riskColor}-900/30 dark:text-${riskColor}-400`}>
     <span className={`w-2 h-2 rounded-full bg-${riskColor}-500 ${riskLevel === 'high' ? 'animate-pulse' : ''}`} />
     {value}%
    </span>
    <span className="text-sm text-muted-foreground">
     {riskLevel === 'high'
     ? t('dora.risk.highRiskLabel', 'Risque Élevé - Action requise')
     : riskLevel === 'medium'
     ? t('dora.risk.mediumRiskLabel', 'Risque Modéré - À surveiller')
     : t('dora.risk.lowRiskLabel', 'Risque Faible')}
    </span>
    </div>
    <span className="text-xs text-muted-foreground">0% - 100%</span>
    </div>
    </div>
   );
   }}
   />
   </div>

   {/* Substitutability with Descriptive Options */}
   <div>
   <div className="flex items-center justify-between mb-3">
   <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
   {t('dora.risk.substitutability')}
   </label>
   <span className="text-xs text-muted-foreground">
   {t('dora.risk.substitutabilityHelp', 'Facilité de remplacement')}
   </span>
   </div>
   <Controller
   name="riskAssessment.substitutability"
   control={control}
   render={({ field }) => (
   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {SUBSTITUTABILITY_LEVELS.map((level) => {
    const isSelected = field.value === level;
    const config = {
    low: {
    color: 'red',
    icon: '⚠️',
    desc: t('dora.risk.lowSubstitutability')
    },
    medium: {
    color: 'amber',
    icon: '⚡',
    desc: t('dora.risk.mediumSubstitutability')
    },
    high: {
    color: 'green',
    icon: '✓',
    desc: t('dora.risk.highSubstitutability')
    }
    }[level];

    return (
    <button
    key={level || 'unknown'}
    type="button"
    disabled={readOnly}
    onClick={() => field.onChange(level)}
    className={`p-4 rounded-2xl border-2 text-left transition-all ${isSelected
     ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
     : 'border-border/40 hover:border-border/40 dark:hover:border-slate-600'
     }`}
    >
    <div className="flex items-center gap-2 mb-2">
     <span>{config.icon}</span>
     <span className={`font-bold ${isSelected ? `text-${config.color}-700 dark:text-${config.color}-400` : 'text-foreground'}`}>
     {t(`dora.risk.${level}Level`, level.charAt(0).toUpperCase() + level.slice(1))}
     </span>
    </div>
    <p className="text-xs text-muted-foreground">
     {config.desc}
    </p>
    </button>
    );
    })}
   </div>
   )}
   />
   </div>

   {/* Assessment Justification */}
   <div>
   <Controller
   name="riskAssessment.notes"
   control={control}
   render={({ field }) => {
   const isHighRisk = concentration > 70;

   return (
    <div>
    <div className="flex items-center justify-between mb-2">
    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
    {t('dora.risk.notes')}
    {isHighRisk && <span className="text-destructive ml-1">*</span>}
    </label>
    {isHighRisk && (
    <span className="text-xs text-red-500">
     {t('dora.risk.justificationRequired', 'Justification requise pour risque élevé')}
    </span>
    )}
    </div>
    <textarea
    {...field}
    value={field.value || ''}
    disabled={readOnly}
    rows={4}
    placeholder={t('dora.risk.notesPlaceholder', 'Décrivez les raisons de cette évaluation et les mesures de mitigation prévues...')}
    className={`w-full px-4 py-3 rounded-3xl border ${isHighRisk && !field.value
    ? 'border-red-300 dark:border-red-700'
    : 'border-border/40'
    } bg-card focus-visible:ring-2 focus-visible:ring-primary focus:border-transparent transition-all`}
    />
    </div>
   );
   }}
   />
   </div>

   {/* Last Assessment Info (Read Only) */}
   {initialData?.riskAssessment?.lastAssessment && (
   <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
   <span>{t('dora.risk.lastAssessment')}:</span>
   <span className="font-medium">
   {typeof initialData.riskAssessment.lastAssessment === 'string'
    ? new Date(initialData.riskAssessment.lastAssessment).toLocaleDateString()
    : (initialData.riskAssessment.lastAssessment as { toDate: () => Date }).toDate().toLocaleDateString()}
   </span>
   {initialData.riskAssessment.assessedBy && (
   <>
    <span>•</span>
    <span>{t('dora.risk.assessedBy')}: {initialData.riskAssessment.assessedBy}</span>
   </>
   )}
   </div>
   )}
  </div>
  </div>
  </div>
  )}
 </fieldset>
 </div>

 {/* Footer */}
 {!readOnly && (
 <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/40 dark:border-white/5 bg-muted/50 dark:bg-black/20">
  <Button
  type="button"
  onClick={onCancel}
  variant="ghost"
  disabled={isLoading}
  >
  {t('common.cancel')}
  </Button>
  <Button
  type="submit"
  isLoading={isLoading}
  className="bg-gradient-to-r from-primary to-indigo-600 hover:from-primary hover:to-indigo-700 text-white"
  >
  {isEditing ? t('common.update') : t('common.create')}
  </Button>
 </div>
 )}
 </form>
 );
};
