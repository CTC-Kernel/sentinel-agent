/**
 * OT Connector Form Component
 * Story 36-2: OT Connector Configuration
 *
 * Multi-step wizard for creating/editing OT connectors.
 * Step 1: Basic info + type selection
 * Step 2: Type-specific configuration
 * Step 3: Schedule configuration
 * Step 4: Review & test connection
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Server,
  Cpu,
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle,
  Calendar,
  Settings,
  type LucideIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useToast } from '../../hooks/useToast';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import {
  OTConnectorService,
  validateConnector
} from '../../services/OTConnectorService';
import type {
  OTConnector,
  OTConnectorType,
  OTConnectorFormData,
  SyncSchedule,
  CSVConnectorConfig,
  ScheduleType
} from '../../types/otConnector';
import {
  CONNECTOR_TYPE_LABELS,
  CONNECTOR_TYPE_DESCRIPTIONS,
  SYNC_INTERVALS
} from '../../types/otConnector';

// ============================================================================
// Types
// ============================================================================

interface OTConnectorFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  connector?: OTConnector; // For editing
}

type FormStep = 'type' | 'config' | 'schedule' | 'review';

// ============================================================================
// Constants
// ============================================================================

const STEPS: Array<{ key: FormStep; labelKey: string; icon: LucideIcon }> = [
  { key: 'type', labelKey: 'otConnector.steps.type', icon: Settings },
  { key: 'config', labelKey: 'otConnector.steps.config', icon: FileText },
  { key: 'schedule', labelKey: 'otConnector.steps.schedule', icon: Calendar },
  { key: 'review', labelKey: 'otConnector.steps.review', icon: Check }
];

const TYPE_ICONS: Record<OTConnectorType, LucideIcon> = {
  csv: FileText,
  opcua: Server,
  modbus: Cpu,
  api: Globe
};

// ============================================================================
// Component
// ============================================================================

export const OTConnectorForm: React.FC<OTConnectorFormProps> = ({
  open,
  onClose,
  onSuccess,
  connector
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { organization } = useStore();
  const { user } = useAuth();
  const isEnglish = i18n.language === 'en';
  const isEditing = !!connector;

  // Form state
  const [currentStep, setCurrentStep] = useState<FormStep>('type');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form data
  const [formData, setFormData] = useState<OTConnectorFormData>(() => ({
    name: connector?.name || '',
    description: connector?.description || '',
    type: connector?.type || 'csv',
    config: connector?.config || {},
    schedule: connector?.schedule || { type: 'manual' },
    enabled: connector?.enabled ?? true,
    tags: connector?.tags || []
  }));

  // Update form field
  const updateField = useCallback(<K extends keyof OTConnectorFormData>(
    field: K,
    value: OTConnectorFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Update config field
  const updateConfig = useCallback(<K extends string>(
    field: K,
    value: unknown
  ) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [field]: value }
    }));
  }, []);

  // Update schedule field
  const updateSchedule = useCallback(<K extends keyof SyncSchedule>(
    field: K,
    value: SyncSchedule[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [field]: value }
    }));
  }, []);

  // Validation
  const validationResult = useMemo(() =>
    validateConnector(formData),
    [formData]
  );

  // Test connection
  const handleTestConnection = useCallback(async () => {
    if (!organization?.id) return;

    setTesting(true);
    setTestResult(null);

    try {
      const result = await OTConnectorService.testConnection(organization.id, formData);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      });
    } finally {
      setTesting(false);
    }
  }, [organization?.id, formData]);

  // Save connector
  const handleSave = useCallback(async () => {
    if (!organization?.id || !user?.uid) return;

    if (!validationResult.valid) {
      toast({
        variant: 'destructive',
        title: t('otConnector.errors.validation', 'Validation errors'),
        description: validationResult.errors.map(e => e.message).join(', ')
      });
      return;
    }

    setSaving(true);

    try {
      if (isEditing && connector) {
        await OTConnectorService.updateConnector(organization.id, connector.id, formData);
        toast({
          title: t('otConnector.updated', 'Connector updated'),
          description: formData.name
        });
      } else {
        await OTConnectorService.createConnector(organization.id, user.uid, formData);
        toast({
          title: t('otConnector.created', 'Connector created'),
          description: formData.name
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('otConnector.errors.saveFailed', 'Save failed'),
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setSaving(false);
    }
  }, [organization?.id, user?.uid, formData, isEditing, connector, validationResult, onSuccess, onClose, t, toast]);

  // Navigation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'type':
        return formData.name.trim().length > 0 && formData.type;
      case 'config':
        if (formData.type === 'csv') {
          const csvConfig = formData.config as Partial<CSVConnectorConfig>;
          return csvConfig.filePattern && csvConfig.filePattern.length > 0;
        }
        return true;
      case 'schedule':
        return true;
      case 'review':
        return validationResult.valid;
      default:
        return false;
    }
  }, [currentStep, formData, validationResult]);

  const handleNext = useCallback(() => {
    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].key);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].key);
    }
  }, [currentStep]);

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {STEPS.map((step, index) => {
        const isActive = step.key === currentStep;
        const isPast = STEPS.findIndex(s => s.key === currentStep) > index;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div className={cn(
                'w-12 h-0.5 mx-2',
                isPast ? 'bg-green-500' : 'bg-slate-200'
              )} />
            )}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              isActive && 'bg-blue-100 text-blue-700',
              isPast && 'bg-green-100 text-green-700',
              !isActive && !isPast && 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            )}>
              {isPast ? (
                <Check className="h-4 w-4" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {t(step.labelKey, step.key)}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step 1: Type selection
  const renderTypeStep = () => (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('otConnector.fields.name', 'Connector Name')} *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder={t('otConnector.placeholders.name', 'e.g., Production SCADA Sync')}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('otConnector.fields.description', 'Description')}
        </label>
        <textarea
          value={formData.description || ''}
          onChange={e => updateField('description', e.target.value)}
          placeholder={t('otConnector.placeholders.description', 'Optional description...')}
          rows={2}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>

      {/* Type selection */}
      <div>
        <label className="block text-sm font-medium mb-3">
          {t('otConnector.fields.type', 'Connector Type')} *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['csv', 'opcua', 'modbus', 'api'] as OTConnectorType[]).map(type => {
            const Icon = TYPE_ICONS[type];
            const isSelected = formData.type === type;
            const label = isEnglish
              ? CONNECTOR_TYPE_LABELS[type].en
              : CONNECTOR_TYPE_LABELS[type].fr;
            const desc = isEnglish
              ? CONNECTOR_TYPE_DESCRIPTIONS[type].en
              : CONNECTOR_TYPE_DESCRIPTIONS[type].fr;
            const isDisabled = type !== 'csv'; // Only CSV implemented for now

            return (
              <button
                key={type}
                type="button"
                onClick={() => !isDisabled && updateField('type', type)}
                disabled={isDisabled}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-all',
                  isSelected && 'border-blue-500 bg-blue-50',
                  !isSelected && !isDisabled && 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                  isDisabled && 'opacity-70 cursor-not-allowed border-slate-200 dark:border-slate-700'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected ? 'bg-blue-100' : 'bg-slate-100'
                  )}>
                    <Icon className={cn(
                      'h-5 w-5',
                      isSelected ? 'text-blue-600' : 'text-slate-500'
                    )} />
                  </div>
                  <span className="font-medium">{label}</span>
                  {isDisabled && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {t('common.comingSoon', 'Coming soon')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Step 2: Type-specific configuration
  const renderConfigStep = () => {
    if (formData.type === 'csv') {
      return renderCSVConfig();
    }
    return (
      <div className="text-center py-12 text-slate-500">
        {t('otConnector.configNotImplemented', 'Configuration for this connector type is not yet available')}
      </div>
    );
  };

  const renderCSVConfig = () => {
    const config = formData.config as Partial<CSVConnectorConfig>;

    return (
      <div className="space-y-6">
        {/* File pattern */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.csv.filePattern', 'File Pattern (Regex)')} *
          </label>
          <input
            type="text"
            value={config.filePattern || ''}
            onChange={e => updateConfig('filePattern', e.target.value)}
            placeholder=".*\.csv$"
            className="w-full px-4 py-2 border rounded-lg font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {t('otConnector.csv.filePatternHelp', 'Regular expression to match CSV files')}
          </p>
        </div>

        {/* Encoding */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.csv.encoding', 'File Encoding')}
          </label>
          <select
            value={config.encoding || 'utf-8'}
            onChange={e => updateConfig('encoding', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="utf-8">UTF-8</option>
            <option value="iso-8859-1">ISO-8859-1 (Latin-1)</option>
            <option value="windows-1252">Windows-1252</option>
          </select>
        </div>

        {/* Archive processed */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="archiveProcessed"
            checked={config.archiveProcessed ?? true}
            onChange={e => updateConfig('archiveProcessed', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400 focus-visible:ring-brand-500"
          />
          <label htmlFor="archiveProcessed" className="text-sm">
            {t('otConnector.csv.archiveProcessed', 'Archive processed files')}
          </label>
        </div>

        {/* Default network segment */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.csv.defaultSegment', 'Default Network Segment')}
          </label>
          <select
            value={config.defaultNetworkSegment || 'OT'}
            onChange={e => updateConfig('defaultNetworkSegment', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="IT">IT</option>
            <option value="OT">OT</option>
            <option value="DMZ">DMZ</option>
          </select>
        </div>

        {/* Default criticality */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.csv.defaultCriticality', 'Default OT Criticality')}
          </label>
          <select
            value={config.defaultOTCriticality || 'monitoring'}
            onChange={e => updateConfig('defaultOTCriticality', e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="safety">{t('otCriticality.safety', 'Safety')}</option>
            <option value="production">{t('otCriticality.production', 'Production')}</option>
            <option value="operations">{t('otCriticality.operations', 'Operations')}</option>
            <option value="monitoring">{t('otCriticality.monitoring', 'Monitoring')}</option>
          </select>
        </div>
      </div>
    );
  };

  // Step 3: Schedule
  const renderScheduleStep = () => (
    <div className="space-y-6">
      {/* Schedule type */}
      <div>
        <label className="block text-sm font-medium mb-3">
          {t('otConnector.schedule.type', 'Sync Schedule')}
        </label>
        <div className="space-y-2">
          {(['manual', 'interval', 'cron'] as ScheduleType[]).map(type => (
            <label
              key={type}
              className={cn(
                'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
                formData.schedule.type === type
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <input
                type="radio"
                name="scheduleType"
                value={type}
                checked={formData.schedule.type === type}
                onChange={() => updateSchedule('type', type)}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <span className="font-medium">
                  {type === 'manual' && t('otConnector.schedule.manual', 'Manual only')}
                  {type === 'interval' && t('otConnector.schedule.interval', 'Fixed interval')}
                  {type === 'cron' && t('otConnector.schedule.cron', 'Custom schedule (Cron)')}
                </span>
                <p className="text-sm text-slate-500">
                  {type === 'manual' && t('otConnector.schedule.manualDesc', 'Trigger syncs manually')}
                  {type === 'interval' && t('otConnector.schedule.intervalDesc', 'Run at regular intervals')}
                  {type === 'cron' && t('otConnector.schedule.cronDesc', 'Advanced scheduling with cron expression')}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Interval selection */}
      {formData.schedule.type === 'interval' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.schedule.selectInterval', 'Select Interval')}
          </label>
          <select
            value={formData.schedule.interval || 1440}
            onChange={e => updateSchedule('interval', parseInt(e.target.value))}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {SYNC_INTERVALS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cron expression */}
      {formData.schedule.type === 'cron' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otConnector.schedule.cronExpression', 'Cron Expression')}
          </label>
          <input
            type="text"
            value={formData.schedule.cronExpression || ''}
            onChange={e => updateSchedule('cronExpression', e.target.value)}
            placeholder="0 2 * * *"
            className="w-full px-4 py-2 border rounded-lg font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {t('otConnector.schedule.cronHelp', 'Format: minute hour day month weekday (e.g., "0 2 * * *" for 2 AM daily)')}
          </p>
        </div>
      )}

      {/* Enabled toggle */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={e => updateField('enabled', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400 focus-visible:ring-brand-500"
        />
        <label htmlFor="enabled" className="text-sm">
          {t('otConnector.enabled', 'Enable connector immediately after creation')}
        </label>
      </div>
    </div>
  );

  // Step 4: Review
  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Summary card */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">{t('otConnector.review.summary', 'Configuration Summary')}</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t('otConnector.fields.name', 'Name')}:</dt>
            <dd className="font-medium">{formData.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t('otConnector.fields.type', 'Type')}:</dt>
            <dd className="font-medium">
              {isEnglish
                ? CONNECTOR_TYPE_LABELS[formData.type].en
                : CONNECTOR_TYPE_LABELS[formData.type].fr}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t('otConnector.schedule.type', 'Schedule')}:</dt>
            <dd className="font-medium capitalize">{formData.schedule.type}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{t('otConnector.enabled', 'Enabled')}:</dt>
            <dd>
              <Badge variant={formData.enabled ? 'default' : 'outline'} status={formData.enabled ? 'success' : 'neutral'}>
                {formData.enabled ? t('common.yes', 'Yes') : t('common.no', 'No')}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Test connection */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">{t('otConnector.review.testConnection', 'Test Connection')}</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {t('otConnector.review.runTest', 'Run Test')}
          </Button>
        </div>

        {testResult && (
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg',
            testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          )}>
            {testResult.success ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </Card>

      {/* Validation errors */}
      {!validationResult.valid && (
        <Card className="p-4 border-red-200 dark:border-red-800 bg-red-50">
          <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">
            {t('otConnector.review.validationErrors', 'Validation Errors')}
          </h4>
          <ul className="list-disc list-inside text-sm text-red-600">
            {validationResult.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return renderTypeStep();
      case 'config':
        return renderConfigStep();
      case 'schedule':
        return renderScheduleStep();
      case 'review':
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            {isEditing
              ? t('otConnector.editTitle', 'Edit Connector')
              : t('otConnector.createTitle', 'Create Connector')}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        {renderStepIndicator()}

        {/* Step content */}
        <div className="min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t">
          <div>
            {currentStep !== 'type' && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('common.back', 'Back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            {currentStep === 'review' ? (
              <Button
                onClick={handleSave}
                disabled={saving || !validationResult.valid}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {isEditing
                  ? t('common.save', 'Save')
                  : t('otConnector.create', 'Create Connector')}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed}>
                {t('common.next', 'Next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTConnectorForm;
