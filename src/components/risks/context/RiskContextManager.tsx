/**
 * Risk Context Manager (ISO 27005)
 * Main component for managing organizational risk context including
 * business context, regulatory context, risk appetite, and evaluation criteria.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRiskContext } from '../../../hooks/risks/useRiskContext';
import { GlassCard } from '../../ui/GlassCard';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { cn } from '../../../utils/cn';
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
} from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState<TabId>('business');
  const [isSaving, setIsSaving] = useState(false);

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
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                isActive
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
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
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Description générale
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez le contexte business de votre organisation..."
          />
        </div>

        {/* Activities */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Activités principales
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newActivity}
              onChange={(e) => setNewActivity(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('activities', newActivity, setNewActivity)}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter une activité..."
            />
            <Button variant="outline" onClick={() => addItem('activities', newActivity, setNewActivity)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.activities.map((activity, index) => (
              <Badge key={index} variant="soft" className="gap-1.5 py-1.5">
                {activity}
                <button onClick={() => removeItem('activities', index)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Objectives */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Objectifs stratégiques
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('objectives', newObjective, setNewObjective)}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter un objectif..."
            />
            <Button variant="outline" onClick={() => addItem('objectives', newObjective, setNewObjective)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.objectives.map((objective, index) => (
              <Badge key={index} variant="soft" className="gap-1.5 py-1.5">
                {objective}
                <button onClick={() => removeItem('objectives', index)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Critical Processes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Processus critiques
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newProcess}
              onChange={(e) => setNewProcess(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem('criticalProcesses', newProcess, setNewProcess)}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              placeholder="Ajouter un processus critique..."
            />
            <Button variant="outline" onClick={() => addItem('criticalProcesses', newProcess, setNewProcess)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.criticalProcesses.map((process, index) => (
              <Badge key={index} variant="soft" className="gap-1.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {process}
                <button onClick={() => removeItem('criticalProcesses', index)} className="ml-1 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
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
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Vue d'ensemble réglementaire
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez le contexte réglementaire..."
          />
        </div>

        {/* Add Regulation Form */}
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
          >
            <h4 className="font-medium text-slate-900 dark:text-white mb-4">Nouvelle réglementation</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Nom *</label>
                <input
                  type="text"
                  value={newRegulation.name}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="ex: Directive NIS2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Framework</label>
                <select
                  value={newRegulation.framework}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, framework: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">Sélectionner...</option>
                  {FRAMEWORKS.map(fw => (
                    <option key={fw} value={fw}>{fw}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Obligations clés</label>
                <input
                  type="text"
                  value={newRegulation.obligations}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, obligations: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="ex: Notification incidents 24h"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Échéance de conformité</label>
                <input
                  type="date"
                  value={newRegulation.deadline}
                  onChange={(e) => setNewRegulation(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
              <Button onClick={handleAddRegulation}>Ajouter</Button>
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
                key={reg.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{reg.name}</span>
                    {reg.framework && (
                      <Badge variant="outline" size="sm">{reg.framework}</Badge>
                    )}
                  </div>
                  {reg.obligations && (
                    <p className="text-sm text-slate-500 mt-0.5">{reg.obligations}</p>
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
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </GlassCard>
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

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
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

      <div className="space-y-8">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Déclaration d'appétit au risque
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
            placeholder="Décrivez la politique d'appétit au risque de votre organisation..."
          />
        </div>

        {/* Acceptable Risk Levels */}
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">Seuils de risque acceptables</h4>
          <p className="text-sm text-slate-500 mb-4">Score de risque maximum pour chaque niveau (Probabilité x Impact, 1-25)</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(LEVEL_CONFIG) as [keyof typeof LEVEL_CONFIG, typeof LEVEL_CONFIG.low][]).map(([level, config]) => (
              <div key={level} className={`p-4 rounded-xl border-2 border-${config.color}-200 dark:border-${config.color}-900 bg-${config.color}-50/50 dark:bg-${config.color}-900/10`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full bg-${config.color}-500`} />
                  <span className={`font-medium text-${config.color}-700 dark:text-${config.color}-400`}>{config.label}</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={formData.acceptableRiskLevels[level]}
                  onChange={(e) => updateLevel(level, parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
                />
                <p className="text-xs text-slate-500 mt-2">{config.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation Thresholds */}
        <div>
          <h4 className="font-medium text-slate-900 dark:text-white mb-4">Seuils d'escalade</h4>
          <p className="text-sm text-slate-500 mb-4">Score de risque déclenchant une escalade automatique</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-slate-900 dark:text-white">Escalade automatique</span>
              </div>
              <input
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.automatic}
                onChange={(e) => updateThreshold('automatic', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 mt-2">Notification automatique au responsable</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-amber-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-amber-500" />
                <span className="font-medium text-slate-900 dark:text-white">Direction</span>
              </div>
              <input
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.management}
                onChange={(e) => updateThreshold('management', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 mt-2">Escalade à la direction générale</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="w-4 h-4 text-red-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-red-500" />
                <ChevronRight className="-ml-3 w-4 h-4 text-red-500" />
                <span className="font-medium text-slate-900 dark:text-white">Conseil</span>
              </div>
              <input
                type="number"
                min="1"
                max="25"
                value={formData.escalationThresholds.board}
                onChange={(e) => updateThreshold('board', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-bold"
              />
              <p className="text-xs text-slate-500 mt-2">Notification au conseil d'administration</p>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
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
          key={item.level}
          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
              {item.level}
            </div>
            <input
              type="text"
              value={item.name}
              onChange={(e) => onUpdate(type, index, 'name', e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              placeholder="Nom du niveau"
            />
          </div>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(type, index, 'description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none"
            placeholder="Description du niveau..."
          />
          {item.criteria && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.criteria.map((criterion, ci) => (
                <Badge key={ci} variant="outline" size="sm">{criterion}</Badge>
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
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
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
    </GlassCard>
  );
};

export default RiskContextManager;
