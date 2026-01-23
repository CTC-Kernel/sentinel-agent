/**
 * FAIR Simple Form
 * Epic 39: Financial Risk Quantification
 * Story 39-1: FAIR Model Configuration
 *
 * Simplified FAIR configuration form for non-experts.
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Calculator,
  DollarSign,
  Shield,
  AlertTriangle,
  HelpCircle,
  Loader2,
  ChevronRight
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Tooltip } from '../ui/Tooltip';
import { fairSimpleFormSchema, defaultSimpleFormValues, type FAIRSimpleFormData } from '../../schemas/fairSchema';
import { FAIR_PRESETS } from '../../types/fair';

// ============================================================================
// Types
// ============================================================================

interface FAIRSimpleFormProps {
  onSubmit: (data: FAIRSimpleFormData) => Promise<void>;
  onCancel?: () => void;
  initialValues?: Partial<FAIRSimpleFormData>;
  loading?: boolean;
}

// ============================================================================
// Scenario Type Options
// ============================================================================

const SCENARIO_TYPES = [
  { value: 'data_breach', label: 'Data Breach', labelFr: 'Violation de données', icon: AlertTriangle },
  { value: 'ransomware', label: 'Ransomware', labelFr: 'Rançongiciel', icon: AlertTriangle },
  { value: 'ddos', label: 'DDoS Attack', labelFr: 'Attaque DDoS', icon: AlertTriangle },
  { value: 'insider_threat', label: 'Insider Threat', labelFr: 'Menace interne', icon: AlertTriangle },
  { value: 'business_email_compromise', label: 'Email Compromise', labelFr: 'Compromission email', icon: AlertTriangle },
  { value: 'supply_chain', label: 'Supply Chain', labelFr: 'Chaîne d\'approvisionnement', icon: AlertTriangle },
  { value: 'custom', label: 'Custom Scenario', labelFr: 'Scénario personnalisé', icon: Calculator }
] as const;

const CONTROL_EFFECTIVENESS = [
  { value: 'weak', label: 'Weak', labelFr: 'Faible', score: 25, color: 'text-red-500' },
  { value: 'moderate', label: 'Moderate', labelFr: 'Modéré', score: 50, color: 'text-amber-500' },
  { value: 'strong', label: 'Strong', labelFr: 'Fort', score: 75, color: 'text-green-500' },
  { value: 'very_strong', label: 'Very Strong', labelFr: 'Très fort', score: 90, color: 'text-emerald-500' }
] as const;

const CURRENCIES = [
  { value: 'EUR', label: '€ EUR', symbol: '€' },
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'GBP', label: '£ GBP', symbol: '£' }
] as const;

// ============================================================================
// Component
// ============================================================================

export const FAIRSimpleForm: React.FC<FAIRSimpleFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  loading = false
}) => {
  'use no memo'; // Opt-out of React Compiler - react-hook-form's watch() is incompatible
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FAIRSimpleFormData>({
    resolver: zodResolver(fairSimpleFormSchema) as never,
    defaultValues: { ...defaultSimpleFormValues, ...initialValues }
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const currency = watch('currency');
  const currencySymbol = CURRENCIES.find((c) => c.value === currency)?.symbol || '€';

  // Auto-fill from preset when scenario changes
  const handleScenarioChange = (value: FAIRSimpleFormData['scenarioType']) => {
    const preset = FAIR_PRESETS.find((p) => p.scenarioType === value);
    if (preset?.defaultValues?.lossEventFrequency) {
      const lef = preset.defaultValues.lossEventFrequency;
      setValue('estimatedFrequencyPerYear', lef.distribution.mostLikely || 0.5);
    }
  };

  const onFormSubmit = async (data: FAIRSimpleFormData) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('fair.form.name', 'Nom de l\'analyse')}</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder={t('fair.form.namePlaceholder', 'Ex: Analyse risque violation données')}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Scenario Type */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>{t('fair.form.scenarioType', 'Type de scénario')}</Label>
          <Tooltip
            content={t(
              'fair.form.scenarioTypeHelp',
              'Sélectionnez le type de risque cyber à quantifier. Des valeurs par défaut seront pré-remplies.'
            )}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </div>
        <Controller
          control={control}
          name="scenarioType"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                handleScenarioChange(v as FAIRSimpleFormData['scenarioType']);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {isEnglish ? type.label : type.labelFr}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Frequency */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-500" />
          <h3 className="font-medium">{t('fair.form.frequency', 'Fréquence estimée')}</h3>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="estimatedFrequencyPerYear">
              {t('fair.form.frequencyPerYear', 'Occurrences par an')}
            </Label>
            <Tooltip
              content={t(
                'fair.form.frequencyHelp',
                'Nombre de fois que cet événement pourrait se produire par an. Ex: 0.5 = une fois tous les 2 ans.'
              )}
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </Tooltip>
          </div>
          <Input
            id="estimatedFrequencyPerYear"
            type="number"
            step="0.01"
            min="0.01"
            max="365"
            {...register('estimatedFrequencyPerYear', { valueAsNumber: true })}
            className={errors.estimatedFrequencyPerYear ? 'border-red-500' : ''}
          />
          {errors.estimatedFrequencyPerYear && (
            <p className="text-sm text-red-500">{errors.estimatedFrequencyPerYear.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('fair.form.frequencyExample', '0.1 = 1 fois/10 ans • 0.5 = 1 fois/2 ans • 1 = 1 fois/an • 12 = 1 fois/mois')}
          </p>
        </div>
      </Card>

      {/* Loss Magnitude */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h3 className="font-medium">{t('fair.form.lossMagnitude', 'Impact financier')}</h3>
          </div>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="estimatedLossMin">
              {t('fair.form.lossMin', 'Minimum')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="estimatedLossMin"
                type="number"
                min="0"
                step="1000"
                {...register('estimatedLossMin', { valueAsNumber: true })}
                className={cn('pl-7', errors.estimatedLossMin && 'border-red-500')}
              />
            </div>
            {errors.estimatedLossMin && (
              <p className="text-xs text-red-500">{errors.estimatedLossMin.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedLossMostLikely">
              {t('fair.form.lossMostLikely', 'Plus probable')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="estimatedLossMostLikely"
                type="number"
                min="0"
                step="1000"
                {...register('estimatedLossMostLikely', { valueAsNumber: true })}
                className={cn('pl-7', errors.estimatedLossMostLikely && 'border-red-500')}
              />
            </div>
            {errors.estimatedLossMostLikely && (
              <p className="text-xs text-red-500">{errors.estimatedLossMostLikely.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedLossMax">
              {t('fair.form.lossMax', 'Maximum')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol}
              </span>
              <Input
                id="estimatedLossMax"
                type="number"
                min="0"
                step="1000"
                {...register('estimatedLossMax', { valueAsNumber: true })}
                className={cn('pl-7', errors.estimatedLossMax && 'border-red-500')}
              />
            </div>
            {errors.estimatedLossMax && (
              <p className="text-xs text-red-500">{errors.estimatedLossMax.message}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('fair.form.lossHelp', 'Estimation de l\'impact financier en cas d\'incident (coûts directs et indirects)')}
        </p>
      </Card>

      {/* Control Effectiveness */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-500" />
          <h3 className="font-medium">{t('fair.form.controlEffectiveness', 'Efficacité des contrôles')}</h3>
        </div>

        <Controller
          control={control}
          name="controlEffectiveness"
          render={({ field }) => (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CONTROL_EFFECTIVENESS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => field.onChange(level.value)}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all text-center',
                    field.value === level.value
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  )}
                >
                  <div className={cn('text-lg font-bold', level.color)}>{level.score}%</div>
                  <div className="text-sm text-muted-foreground">
                    {isEnglish ? level.label : level.labelFr}
                  </div>
                </button>
              ))}
            </div>
          )}
        />
        <p className="text-xs text-muted-foreground">
          {t('fair.form.controlHelp', 'Évaluation globale de l\'efficacité de vos mesures de sécurité')}
        </p>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading || isSubmitting}>
            {t('common.cancel', 'Annuler')}
          </Button>
        )}
        <Button type="submit" disabled={loading || isSubmitting}>
          {(loading || isSubmitting) ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-2" />
          )}
          {t('fair.form.createAnalysis', 'Créer l\'analyse')}
        </Button>
      </div>
    </form>
  );
};

export default FAIRSimpleForm;
