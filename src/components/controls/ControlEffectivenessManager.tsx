/**
 * Control Effectiveness Manager (ISO 27002)
 * Dashboard for managing control effectiveness assessments and domain maturity
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useControlEffectiveness, MATURITY_THRESHOLDS } from '../../hooks/controls/useControlEffectiveness';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';
import { ISO_DOMAINS, ISO_SEED_CONTROLS } from '../../data/complianceData';
import {
  Shield,
  TrendingDown,
  AlertTriangle,
  Clock,
  Plus,
  ChevronRight,
  BarChart3,
  Target,
  X,
  Save,
  Calendar,
} from 'lucide-react';
import type { ControlEffectivenessAssessment } from '../../types/ebios';

const ASSESSMENT_METHODS = [
  { value: 'documentation', label: 'Revue documentaire' },
  { value: 'interview', label: 'Entretien' },
  { value: 'testing', label: 'Test technique' },
  { value: 'observation', label: 'Observation' },
  { value: 'audit', label: 'Audit interne' },
];

export const ControlEffectivenessManager: React.FC = () => {
  const {
    assessments,
    domainScores,
    loading,
    error,
    createAssessment,
    getOverallMaturity,
    getLowEffectivenessControls,
    getAssessmentsDueForReview,
  } = useControlEffectiveness();

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [selectedControl, setSelectedControl] = useState<{ code: string; name: string } | null>(null);

  const overallMaturity = getOverallMaturity();
  const lowEffectivenessControls = getLowEffectivenessControls();
  const dueForReview = getAssessmentsDueForReview();

  // Group controls by domain
  const controlsByDomain = useMemo(() => {
    const grouped = new Map<string, typeof ISO_SEED_CONTROLS>();
    ISO_SEED_CONTROLS.forEach(control => {
      const domain = control.code.split('.').slice(0, 2).join('.');
      if (!grouped.has(domain)) {
        grouped.set(domain, []);
      }
      grouped.get(domain)!.push(control);
    });
    return grouped;
  }, []);

  // Get assessment for a control code
  const getControlAssessment = (code: string) => {
    return assessments.find(a => a.controlId === code);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Overall Maturity Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Maturité Globale ISO 27002</h3>
              <p className="text-sm text-slate-500">{assessments.length} contrôles évalués sur {ISO_SEED_CONTROLS.length}</p>
            </div>
            <Button onClick={() => setShowAssessmentForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle évaluation
            </Button>
          </div>

          {/* Maturity Gauge */}
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <svg className="w-48 h-48" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-200 dark:text-slate-700"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(overallMaturity.score / 100) * 251.2} 251.2`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  className={cn(
                    overallMaturity.level >= 4 ? 'text-emerald-500' :
                      overallMaturity.level >= 3 ? 'text-blue-500' :
                        overallMaturity.level >= 2 ? 'text-amber-500' : 'text-red-500'
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">{overallMaturity.score}%</span>
                <span className={cn(
                  "text-sm font-medium",
                  overallMaturity.level >= 4 ? 'text-emerald-600 dark:text-emerald-400' :
                    overallMaturity.level >= 3 ? 'text-blue-600 dark:text-blue-400' :
                      overallMaturity.level >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                )}>
                  Niveau {overallMaturity.level}
                </span>
                <span className="text-xs text-slate-500">
                  {MATURITY_THRESHOLDS[overallMaturity.level].label}
                </span>
              </div>
            </div>
          </div>

          {/* Maturity Scale Legend */}
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  level === 5 ? 'bg-emerald-500' :
                    level === 4 ? 'bg-blue-500' :
                      level === 3 ? 'bg-cyan-500' :
                        level === 2 ? 'bg-amber-500' : 'bg-red-500'
                )} />
                <span className="text-xs text-slate-500">{MATURITY_THRESHOLDS[level].label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Alerts Sidebar */}
        <div className="space-y-4">
          {/* Low Effectiveness */}
          {lowEffectivenessControls.length > 0 && (
            <GlassCard className="p-4 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {lowEffectivenessControls.length} contrôles faibles
                </span>
              </div>
              <div className="space-y-2">
                {lowEffectivenessControls.slice(0, 3).map((a) => (
                  <div key={a.id} className="text-sm text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>{a.controlId}</span>
                    <Badge variant="outline" size="sm">{a.effectivenessScore}%</Badge>
                  </div>
                ))}
                {lowEffectivenessControls.length > 3 && (
                  <span className="text-xs text-amber-500">+{lowEffectivenessControls.length - 3} autres</span>
                )}
              </div>
            </GlassCard>
          )}

          {/* Due for Review */}
          {dueForReview.length > 0 && (
            <GlassCard className="p-4 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-400">
                  {dueForReview.length} évaluations à revoir
                </span>
              </div>
              <div className="space-y-2">
                {dueForReview.slice(0, 3).map((a) => (
                  <div key={a.id} className="text-sm text-blue-600 dark:text-blue-400">
                    {a.controlId}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Empty State */}
          {assessments.length === 0 && (
            <GlassCard className="p-4 text-center">
              <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune évaluation</p>
              <p className="text-xs text-slate-400">Commencez à évaluer vos contrôles</p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Domain Maturity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ISO_DOMAINS.map((domain) => {
          const domainScore = domainScores.find(ds => ds.domain === domain.id);
          const controls = controlsByDomain.get(domain.id) || [];
          const assessedCount = controls.filter(c => getControlAssessment(c.code)).length;
          const maturityLevel = domainScore?.maturityLevel || 1;
          const avgEffectiveness = domainScore?.averageEffectiveness || 0;

          return (
            <motion.button
              key={domain.id}
              onClick={() => setSelectedDomain(selectedDomain === domain.id ? null : domain.id)}
              className={cn(
                "p-4 rounded-2xl border-2 text-left transition-all",
                selectedDomain === domain.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300"
              )}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline">{domain.id}</Badge>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                  maturityLevel >= 4 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                    maturityLevel >= 3 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                      maturityLevel >= 2 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                )}>
                  {maturityLevel}
                </div>
              </div>

              <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1">{domain.title}</h4>
              <p className="text-xs text-slate-500 mb-3 line-clamp-1">{domain.description}</p>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{assessedCount}/{controls.length} évalués</span>
                <span className={cn(
                  "font-medium",
                  avgEffectiveness >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
                    avgEffectiveness >= 40 ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-500'
                )}>
                  {avgEffectiveness}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    maturityLevel >= 4 ? 'bg-emerald-500' :
                      maturityLevel >= 3 ? 'bg-blue-500' :
                        maturityLevel >= 2 ? 'bg-amber-500' : 'bg-slate-400'
                  )}
                  style={{ width: `${avgEffectiveness}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Domain Detail Panel */}
      <AnimatePresence mode="wait">
        {selectedDomain && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DomainControlsPanel
              domain={selectedDomain}
              controls={controlsByDomain.get(selectedDomain) || []}
              assessments={assessments}
              onAssessControl={(control) => {
                setSelectedControl(control);
                setShowAssessmentForm(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assessment Form Modal */}
      <AnimatePresence>
        {showAssessmentForm && (
          <AssessmentFormModal
            control={selectedControl}
            controls={ISO_SEED_CONTROLS}
            onClose={() => {
              setShowAssessmentForm(false);
              setSelectedControl(null);
            }}
            onSubmit={async (data) => {
              await createAssessment(data);
              setShowAssessmentForm(false);
              setSelectedControl(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Domain Controls Panel
// ============================================================================

interface DomainControlsPanelProps {
  domain: string;
  controls: { code: string; name: string }[];
  assessments: ControlEffectivenessAssessment[];
  onAssessControl: (control: { code: string; name: string }) => void;
}

const DomainControlsPanel: React.FC<DomainControlsPanelProps> = ({
  domain,
  controls,
  assessments,
  onAssessControl
}) => {
  const domainInfo = ISO_DOMAINS.find(d => d.id === domain);

  const getControlAssessment = (code: string) => {
    return assessments.find(a => a.controlId === code);
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{domain} - {domainInfo?.title}</h3>
            <p className="text-sm text-slate-500">{controls.length} contrôles</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {controls.map((control) => {
          const assessment = getControlAssessment(control.code);
          const hasAssessment = !!assessment;
          const score = assessment?.effectivenessScore || 0;

          return (
            <div
              key={control.code}
              className={cn(
                "flex items-center gap-4 p-3 rounded-xl border transition-all",
                hasAssessment
                  ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
                  : "border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30"
              )}
            >
              <div className="w-16 flex-shrink-0">
                <Badge variant="outline" size="sm">{control.code}</Badge>
              </div>

              <div className="flex-1 min-w-0">
                <span className={cn(
                  "text-sm",
                  hasAssessment ? "text-slate-900 dark:text-white" : "text-slate-500"
                )}>
                  {control.name}
                </span>
              </div>

              {hasAssessment ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={cn(
                      "text-lg font-bold",
                      score >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
                        score >= 40 ? 'text-amber-600 dark:text-amber-400' :
                          'text-red-600 dark:text-red-400'
                    )}>
                      {score}%
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(assessment.assessmentDate).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAssessControl(control)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Évaluer
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};

// ============================================================================
// Assessment Form Modal
// ============================================================================

interface AssessmentFormModalProps {
  control: { code: string; name: string } | null;
  controls: { code: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: {
    controlId: string;
    controlCode: string;
    effectivenessScore: number;
    assessmentMethod: string;
    evidence?: string[];
    notes?: string;
    nextAssessmentDate?: string;
  }) => Promise<void>;
}

const AssessmentFormModal: React.FC<AssessmentFormModalProps> = ({
  control,
  controls,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    controlCode: control?.code || '',
    effectivenessScore: 50,
    assessmentMethod: 'documentation',
    notes: '',
    nextAssessmentDate: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.controlCode) return;

    setIsSaving(true);
    try {
      await onSubmit({
        controlId: formData.controlCode,
        controlCode: formData.controlCode,
        effectivenessScore: formData.effectivenessScore,
        assessmentMethod: formData.assessmentMethod,
        notes: formData.notes || undefined,
        nextAssessmentDate: formData.nextAssessmentDate || undefined
      });
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg"
      >
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Évaluation d'efficacité
                </h3>
                <p className="text-sm text-slate-500">ISO 27002</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Control Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Contrôle *
              </label>
              <select
                value={formData.controlCode}
                onChange={(e) => setFormData(prev => ({ ...prev, controlCode: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              >
                <option value="">Sélectionner un contrôle...</option>
                {ISO_DOMAINS.map(domain => (
                  <optgroup key={domain.id} label={`${domain.id} - ${domain.title}`}>
                    {controls.filter(c => c.code.startsWith(domain.id)).map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Effectiveness Score */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Score d'efficacité: <span className={cn(
                  "font-bold",
                  formData.effectivenessScore >= 60 ? 'text-emerald-600' :
                    formData.effectivenessScore >= 40 ? 'text-amber-600' : 'text-red-600'
                )}>{formData.effectivenessScore}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.effectivenessScore}
                onChange={(e) => setFormData(prev => ({ ...prev, effectivenessScore: parseInt(e.target.value) }))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0%</span>
                <span>20%</span>
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Assessment Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Méthode d'évaluation
              </label>
              <select
                value={formData.assessmentMethod}
                onChange={(e) => setFormData(prev => ({ ...prev, assessmentMethod: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {ASSESSMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Notes / Observations
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                placeholder="Observations et constats de l'évaluation..."
              />
            </div>

            {/* Next Assessment Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Prochaine évaluation
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={formData.nextAssessmentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextAssessmentDate: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving || !formData.controlCode}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};

export default ControlEffectivenessManager;
