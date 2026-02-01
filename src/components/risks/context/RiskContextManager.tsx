/**
 * Risk Context Manager (ISO 27005)
 * Main component for managing organizational risk context including
 * business context, regulatory context, risk appetite, and evaluation criteria.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRiskContext } from '../../../hooks/risks/useRiskContext';
import { useStore } from '../../../store';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { ScrollableTabs } from '../../ui/ScrollableTabs';
import {
  Building2,
  Scale,
  Target,
  BarChart3,
  ChevronRight,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  FileText,
  Shield,
  Clock,
} from '../../ui/Icons';
import type { RiskContext, ApplicableRegulation, ScaleDefinition } from '../../../types/ebios';
import { FRAMEWORKS } from '../../../types/common';

type TabId = 'business' | 'regulatory' | 'appetite' | 'criteria';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType<{ className?: string }>;
  description: string;
}

const TABS: TabConfig[] = [
  { id: 'business', label: 'Contexte Business', icon: Building2, description: 'Activités, objectifs et processus critiques' },
  { id: 'regulatory', label: 'Contexte Réglementaire', icon: Scale, description: 'Réglementations applicables' },
  { id: 'appetite', label: 'Appétit au Risque', icon: Target, description: 'Niveaux acceptables et seuils d\'escalade' },
  { id: 'criteria', label: 'Critères d\'Évaluation', icon: BarChart3, description: 'Échelles d\'impact et de probabilité' },
];

export const RiskContextManager: React.FC = () => {
  const {
    riskContext,
    loading,
    error,
    initializeContext,
    updateBusinessContext,
    updateRegulatoryContext,
    updateRiskAppetite,
    updateEvaluationCriteria,
    addRegulation,
    removeRegulation,
  } = useRiskContext();

  const [activeTab, setActiveTab] = usePersistedState<string>('risk-context-tab', 'business');
  const [isSaving, setIsSaving] = useState(false);

  // Map TABS to format expected by ScrollableTabs
  const tabs = React.useMemo(() => TABS.map(t => ({
    id: t.id,
    label: t.label,
    icon: t.icon
  })), []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!riskContext) {
    return (
      <EmptyState
        icon={Shield}
        title="Aucun contexte de risque défini"
        description="Initialisez le contexte de risque de votre organisation pour commencer à évaluer vos risques selon ISO 27005."
        actionLabel="Initialiser le contexte"
        onAction={initializeContext}
      />
    );
  }

  const handleSave = async (saveFunction: () => Promise<void>) => {
    setIsSaving(true);
    try {
      await saveFunction();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 dark:border-red-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <ScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeTab || 'unknown'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'business' && (
            <BusinessContextTab
              data={riskContext.businessContext}
              onSave={(data) => handleSave(() => updateBusinessContext(data))}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'regulatory' && (
            <RegulatoryContextTab
              data={riskContext.regulatoryContext}
              onSave={(data) => handleSave(() => updateRegulatoryContext(data))}
              onAddRegulation={(reg) => handleSave(() => addRegulation(reg))}
              onRemoveRegulation={(id) => handleSave(() => removeRegulation(id))}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'appetite' && (
            <RiskAppetiteTab
              data={riskContext.riskAppetite}
              onSave={(data) => handleSave(() => updateRiskAppetite(data))}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'criteria' && (
            <EvaluationCriteriaTab
              data={riskContext.evaluationCriteria}
              onSave={(data) => handleSave(() => updateEvaluationCriteria(data))}
              isSaving={isSaving}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Business Context Tab
// ============================================================================

interface BusinessContextTabProps {
  data: RiskContext['businessContext'];
  onSave: (data: RiskContext['businessContext']) => void;
  isSaving: boolean;
}

const BusinessContextTab: React.FC<BusinessContextTabProps> = ({ data, onSave, isSaving }) => {
  const [formData, setFormData] = useState(data);
  const [newActivity, setNewActivity] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newProcess, setNewProcess] = useState('');

  const addItem = (field: 'activities' | 'objectives' | 'criticalProcesses', value: string, setValue: (v: string) => void) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }));
    setValue('');
  };

  const removeItem = (field: 'activities' | 'objectives' | 'criticalProcesses', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  return (
    <PremiumCard glass className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-3xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contexte Business</h3>
            <p className="text-sm text-slate-500">Définissez les activités, objectifs et processus critiques de votre organisation</p>
          </div>
        </div>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Description */}
        <div>
          <label htmlFor="business-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Description générale
          </label>
          <textarea
            id="business-description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez le contexte business de votre organisation..."
          />
        </div>

        {/* Activities */}
        <div>
          <label htmlFor="new-activity" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Activités principales
          </label>
          <div className="flex gap-2 mb-3">
            <input
              id="new-activity"
              type="text"
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('activities', newActivity, setNewActivity)}
              className="flex-1 px-4 py-2 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter une activité..."
            />
            <Button variant="outline" onClick={() => addItem('activities', newActivity, setNewActivity)} aria-label="Ajouter l'activité">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.activities.map((activity, index) => (
              <Badge key={index || 'unknown'} variant="soft" className="gap-1.5 py-1.5">
                {activity}
                <button
                  onClick={() => removeItem('activities', index)}
                  className="ml-1 hover:text-red-500"
                  aria-label={`Supprimer l'activité ${activity}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div>
          <label htmlFor="new-objective" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Objectifs stratégiques
          </label>
          <div className="flex gap-2 mb-3">
            <input
              id="new-objective"
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('objectives', newObjective, setNewObjective)}
              className="flex-1 px-4 py-2 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter un objectif..."
            />
            <Button variant="outline" onClick={() => addItem('objectives', newObjective, setNewObjective)} aria-label="Ajouter l'objectif">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.objectives.map((objective, index) => (
              <Badge key={index || 'unknown'} variant="soft" className="gap-1.5 py-1.5">
                {objective}
                <button
                  onClick={() => removeItem('objectives', index)}
                  className="ml-1 hover:text-red-500"
                  aria-label={`Supprimer l'objectif ${objective}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Critical Processes */}
        <div>
          <label htmlFor="new-process" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Processus critiques
          </label>
          <div className="flex gap-2 mb-3">
            <input
              id="new-process"
              type="text"
              value={newProcess}
              onChange={(e) => setNewProcess(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('criticalProcesses', newProcess, setNewProcess)}
              className="flex-1 px-4 py-2 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter un processus critique..."
            />
            <Button variant="outline" onClick={() => addItem('criticalProcesses', newProcess, setNewProcess)} aria-label="Ajouter le processus critique">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.criticalProcesses.map((process, index) => (
              <Badge key={index || 'unknown'} variant="soft" className="gap-1.5 py-1.5 bg-warning-bg dark:bg-warning-bg/20 text-warning-text dark:text-warning-text">
                <AlertTriangle className="w-3 h-3" />
                {process}
                <button
                  onClick={() => removeItem('criticalProcesses', index)}
                  className="ml-1 hover:text-red-500"
                  aria-label={`Supprimer le processus ${process}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

      </div>
    </PremiumCard>
  );
};

// ============================================================================
// Regulatory Context Tab
// ============================================================================

interface RegulatoryContextTabProps {
  data: RiskContext['regulatoryContext'];
  onSave: (data: RiskContext['regulatoryContext']) => void;
  onAddRegulation: (reg: Omit<ApplicableRegulation, 'id'>) => void;
  onRemoveRegulation: (id: string) => void;
  isSaving: boolean;
}

const RegulatoryContextTab: React.FC<RegulatoryContextTabProps> = ({
  data,
  onSave,
  onAddRegulation,
  onRemoveRegulation,
  isSaving
}) => {
  const { t } = useStore();
  const [description, setDescription] = useState(data.description || '');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRegulation, setNewRegulation] = useState({
    name: '',
    framework: '',
    obligations: '',
    deadline: ''
  });

  const handleAddRegulation = () => {
    if (!newRegulation.name.trim()) return;
    onAddRegulation(newRegulation);
    setNewRegulation({ name: '', framework: '', obligations: '', deadline: '' });
    setShowAddForm(false);
  };

  return (
    <PremiumCard glass className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-3xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contexte Réglementaire</h3>
            <p className="text-sm text-slate-500">Réglementations et normes applicables à votre organisation</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
          <Button onClick={() => onSave({ ...data, description })} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Description */}
        <div>
          <label htmlFor="reg-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Vue d'ensemble réglementaire
          </label>
          <textarea
            id="reg-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez le contexte réglementaire..."
          />
        </div>

        {/* Add Regulation Form */}
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-slate-700"
          >
            <h4 className="font-medium text-slate-900 dark:text-white mb-4">Nouvelle réglementation</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm text-slate-600 dark:text-muted-foreground mb-1">Nom *</label>
                <input
                  id="reg-name"
                  type="text"
                  value={newRegulation.name}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="ex: Directive NIS2"
                />
              </div>
              <div>
                <label htmlFor="reg-framework" className="block text-sm text-slate-600 dark:text-muted-foreground mb-1">Framework</label>
                <select
                  id="reg-framework"
                  value={newRegulation.framework}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, framework: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Sélectionner...</option>
                  {FRAMEWORKS.map(fw => (
                    <option key={fw || 'unknown'} value={fw}>{fw}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-obligations" className="block text-sm text-slate-600 dark:text-muted-foreground mb-1">Obligations clés</label>
                <input
                  id="reg-obligations"
                  type="text"
                  value={newRegulation.obligations}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, obligations: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="ex: Notification incidents 24h"
                />
              </div>
              <div>
                <label htmlFor="reg-deadline" className="block text-sm text-slate-600 dark:text-muted-foreground mb-1">Échéance de conformité</label>
                <input
                  id="reg-deadline"
                  type="date"
                  value={newRegulation.deadline}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
              <Button onClick={handleAddRegulation}>{t('common.add', { defaultValue: 'Ajouter' })}</Button>
            </div>
          </motion.div>
        )}


        {/* Regulations List */}
        <div className="space-y-3">
          {data.applicableRegulations.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Aucune réglementation définie. Ajoutez les réglementations applicables à votre organisation.
            </div>
          ) : (
            data.applicableRegulations.map((reg) => (
              <div
                key={reg.id || 'unknown'}
                className="flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-slate-800/50 border border-border/40 dark:border-slate-700"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{reg.name}</span>
                    {reg.framework && (
                      <Badge variant="outline" size="sm">{reg.framework}</Badge>
                    )}
                  </div>
                  {reg.obligations && (
                    <p className="text-sm text-slate-500 dark:text-slate-300 mt-0.5">{reg.obligations}</p>
                  )}
                </div>
                {reg.deadline && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {new Date(reg.deadline).toLocaleDateString('fr-FR')}
                  </div>
                )}
                <button
                  onClick={() => onRemoveRegulation(reg.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                  aria-label={`Supprimer la réglementation ${reg.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

              </div>
            ))
          )}
        </div>
      </div>
    </PremiumCard>
  );
};

// ============================================================================
// Risk Appetite Tab
// ============================================================================

interface RiskAppetiteTabProps {
  data: RiskContext['riskAppetite'];
  onSave: (data: RiskContext['riskAppetite']) => void;
  isSaving: boolean;
}

const RiskAppetiteTab: React.FC<RiskAppetiteTabProps> = ({ data, onSave, isSaving }) => {
  const [formData, setFormData] = useState(data);

  const updateLevel = (level: keyof typeof formData.acceptableRiskLevels, value: number) => {
    setFormData(prev => ({
      ...prev,
      acceptableRiskLevels: {
        ...prev.acceptableRiskLevels,
        [level]: value
      }
    }));
  };

  const updateThreshold = (threshold: keyof typeof formData.escalationThresholds, value: number) => {
    setFormData(prev => ({
      ...prev,
      escalationThresholds: {
        ...prev.escalationThresholds,
        [threshold]: value
      }
    }));
  };

  const LEVEL_CONFIG = {
    low: { label: 'Faible', color: 'emerald', description: 'Risques acceptables sans action' },
    medium: { label: 'Modéré', color: 'amber', description: 'Risques nécessitant attention' },
    high: { label: 'Élevé', color: 'orange', description: 'Risques nécessitant action' },
    critical: { label: 'Critique', color: 'red', description: 'Risques inacceptables' },
  };

  // Static mappings for Tailwind JIT - using semantic tokens
  const LEVEL_STYLES: Record<string, {
    border: string;
    bg: string;
    dot: string;
    text: string;
  }> = {
    emerald: {
      border: 'border-success-border dark:border-success-border/50',
      bg: 'bg-success-bg/50 dark:bg-success-bg/10',
      dot: 'bg-success-text',
      text: 'text-success-text dark:text-success-text'
    },
    amber: {
      border: 'border-info-border dark:border-info-border/50',
      bg: 'bg-info-bg/50 dark:bg-info-bg/10',
      dot: 'bg-info-text',
      text: 'text-info-text dark:text-info-text'
    },
    orange: {
      border: 'border-warning-border dark:border-warning-border/50',
      bg: 'bg-warning-bg/50 dark:bg-warning-bg/10',
      dot: 'bg-warning-text',
      text: 'text-warning-text dark:text-warning-text'
    },
    red: {
      border: 'border-error-border dark:border-error-border/50',
      bg: 'bg-error-bg/50 dark:bg-error-bg/10',
      dot: 'bg-error-text',
      text: 'text-error-text dark:text-error-text'
    }
  };

  return (
    <PremiumCard glass className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-3xl bg-success-bg dark:bg-success-bg/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-success-text dark:text-success-text" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Appétit au Risque</h3>
            <p className="text-sm text-slate-500">Définissez les niveaux de risque acceptables pour votre organisation</p>
          </div>
        </div>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Description */}
        <div>
          <label htmlFor="appetite-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Déclaration d'appétit au risque
          </label>
          <textarea
            id="appetite-description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-4 py-3 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez la politique d'appétit au risque de votre organisation..."
          />
        </div>


        {/* Acceptable Risk Levels */}
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">Seuils de risque acceptables</h4>
          <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">Score de risque maximum pour chaque niveau (Probabilité x Impact, 1-25)</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(LEVEL_CONFIG) as [keyof typeof LEVEL_CONFIG, typeof LEVEL_CONFIG.low][]).map(([level, config]) => {
              const styles = LEVEL_STYLES[config.color] || LEVEL_STYLES.emerald;
              return (
                <div key={level || 'unknown'} className={`p-4 rounded-3xl border-2 ${styles.border} ${styles.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${styles.dot}`} />
                    <label htmlFor={`threshold-${level}`} className={`font-medium ${styles.text} cursor-pointer`}>{config.label}</label>
                  </div>
                  <input
                    id={`threshold-${level}`}
                    type="number"
                    min="1"
                    max="25"
                    value={formData.acceptableRiskLevels[level]}
                    onChange={(e) => updateLevel(level, parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">{config.description}</p>
                </div>

              );
            })}
          </div>
        </div>


        {/* Escalation Thresholds */}
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">Seuils d'escalade</h4>
          <p className="text-sm text-slate-500 dark:text-slate-300 mb-4">Score de risque déclenchant une escalade automatique</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-blue-500" />
                <label htmlFor="escalation-automatic" className="font-medium text-slate-900 dark:text-white cursor-pointer">Escalade automatique</label>
              </div>
              <input
                id="escalation-automatic"
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.automatic}
                onChange={(e) => updateThreshold('automatic', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">Notification automatique au responsable</p>
            </div>


            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-amber-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-amber-500" />
                <label htmlFor="escalation-management" className="font-medium text-slate-900 dark:text-white cursor-pointer">Direction</label>
              </div>
              <input
                id="escalation-management"
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.management}
                onChange={(e) => updateThreshold('management', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">Escalade à la direction générale</p>
            </div>


            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-red-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-red-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-red-500" />
                <label htmlFor="escalation-board" className="font-medium text-slate-900 dark:text-white cursor-pointer">Conseil</label>
              </div>
              <input
                id="escalation-board"
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.board}
                onChange={(e) => updateThreshold('board', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">Notification au conseil d'administration</p>
            </div>

          </div>
        </div>
      </div>
    </PremiumCard>
  );
};

// ============================================================================
// Evaluation Criteria Tab
// ============================================================================

interface EvaluationCriteriaTabProps {
  data: RiskContext['evaluationCriteria'];
  onSave: (data: RiskContext['evaluationCriteria']) => void;
  isSaving: boolean;
}

interface ScaleEditorProps {
  type: 'impactScale' | 'probabilityScale';
  title: string;
  items: ScaleDefinition[];
  onUpdate: (
    scaleType: 'impactScale' | 'probabilityScale',
    index: number,
    field: keyof ScaleDefinition,
    value: string | number | string[]
  ) => void;
}

const ScaleEditor: React.FC<ScaleEditorProps> = ({ type, title, items, onUpdate }) => (
  <div>
    <h4 className="font-medium text-slate-900 dark:text-white mb-4">{title}</h4>
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.level || 'unknown'}
          className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-border/40 dark:border-slate-700"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
              {item.level}
            </div>
            <label htmlFor={`${type}-name-${index}`} className="sr-only">Nom du niveau {item.level}</label>
            <input
              id={`${type}-name-${index}`}
              type="text"
              value={item.name}
              onChange={(e) => onUpdate(type, index, 'name', e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              placeholder="Nom du niveau"
            />
          </div>
          <label htmlFor={`${type}-desc-${index}`} className="sr-only">Description du niveau {item.level}</label>
          <textarea
            id={`${type}-desc-${index}`}
            value={item.description}
            onChange={(e) => onUpdate(type, index, 'description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none"
            placeholder="Description du niveau..."
          />

          {item.criteria && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.criteria.map((criterion, ci) => (
                <Badge key={ci || 'unknown'} variant="outline" size="sm">{criterion}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const EvaluationCriteriaTab: React.FC<EvaluationCriteriaTabProps> = ({ data, onSave, isSaving }) => {
  const [formData, setFormData] = useState(data);

  const updateScaleItem = (
    scaleType: 'impactScale' | 'probabilityScale',
    index: number,
    field: keyof ScaleDefinition,
    value: string | number | string[]
  ) => {
    setFormData(prev => ({
      ...prev,
      [scaleType]: prev[scaleType].map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  return (
    <PremiumCard glass className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-3xl bg-warning-bg dark:bg-warning-bg/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-warning-text dark:text-warning-text" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Critères d'Évaluation</h3>
            <p className="text-sm text-slate-500">Personnalisez les échelles d'impact et de probabilité</p>
          </div>
        </div>
        <Button onClick={() => onSave(formData)} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ScaleEditor
          type="impactScale"
          title="Échelle d'Impact"
          items={formData.impactScale}
          onUpdate={updateScaleItem}
        />
        <ScaleEditor
          type="probabilityScale"
          title="Échelle de Probabilité"
          items={formData.probabilityScale}
          onUpdate={updateScaleItem}
        />
      </div>
    </PremiumCard>
  );
};

export default RiskContextManager;
