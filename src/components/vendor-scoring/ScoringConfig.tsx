/**
 * Scoring Configuration Component
 * Allows configuring section weights and critical questions
 * Story 37-3: Automated Vendor Scoring
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 TemplateScoringConfig,
 normalizeSectionWeights,
 RISK_LEVEL_CONFIGS,
} from '../../types/vendorScoring';
import { QuestionnaireSection } from '../../types/business';
import { Button } from '../ui/button';
import {
 AlertTriangle,
 CheckCircle,
 Save,
 RotateCcw,
 Sliders,
} from '../ui/Icons';

interface ScoringConfigProps {
 templateId: string;
 sections: QuestionnaireSection[];
 existingConfig?: TemplateScoringConfig;
 onSave: (config: Omit<TemplateScoringConfig, 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
 onCancel: () => void;
}

interface SectionWeight {
 sectionId: string;
 title: string;
 weight: number;
 questionCount: number;
}

export const ScoringConfig: React.FC<ScoringConfigProps> = ({
 templateId,
 sections,
 existingConfig,
 onSave,
 onCancel,
}) => {
 const { t } = useTranslation();

 // Initialize weights from existing config or defaults
 const [sectionWeights, setSectionWeights] = useState<SectionWeight[]>(() =>
 sections.map((s) => ({
 sectionId: s.id,
 title: s.title,
 weight: existingConfig?.sections.find((cs) => cs.sectionId === s.id)?.weight ?? s.weight,
 questionCount: s.questions.length,
 }))
 );

 const [criticalQuestions, setCriticalQuestions] = useState<Set<string>>(() => {
 const set = new Set<string>();
 existingConfig?.sections.forEach((s) => {
 s.questions.forEach((q) => {
 if (q.isCritical) set.add(q.questionId);
 });
 });
 return set;
 });

 const [_isDirty, setIsDirty] = useState(false);

 // Calculate total weight
 const totalWeight = sectionWeights.reduce((sum, s) => sum + s.weight, 0);
 const isValidWeight = Math.abs(totalWeight - 100) < 0.1;

 // Handle weight change
 const handleWeightChange = (sectionId: string, newWeight: number) => {
 setSectionWeights((prev) =>
 prev.map((s) =>
 s.sectionId === sectionId ? { ...s, weight: Math.max(0, Math.min(100, newWeight)) } : s
 )
 );
 setIsDirty(true);
 };

 // Normalize weights to 100
 const handleNormalize = () => {
 const normalized = normalizeSectionWeights(sectionWeights);
 setSectionWeights((prev) =>
 prev.map((s, idx) => ({ ...s, weight: Math.round(normalized[idx]) }))
 );
 setIsDirty(true);
 };

 // Reset to defaults
 const handleReset = () => {
 setSectionWeights(
 sections.map((s) => ({
 sectionId: s.id,
 title: s.title,
 weight: s.weight,
 questionCount: s.questions.length,
 }))
 );
 setCriticalQuestions(new Set());
 setIsDirty(true);
 };

 // Save configuration
 const handleSave = () => {
 const config: Omit<TemplateScoringConfig, 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
 templateId,
 sections: sectionWeights.map((sw) => ({
 sectionId: sw.sectionId,
 weight: sw.weight,
 questions: sections
 .find((s) => s.id === sw.sectionId)!
 .questions.map((q) => ({
 questionId: q.id,
 isCritical: criticalQuestions.has(q.id),
 })),
 })),
 };
 onSave(config);
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-3xl bg-primary/15 dark:bg-primary flex items-center justify-center">
 <Sliders className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="font-semibold text-foreground">
 {t('vendorScoring.configTitle', 'Scoring Configuration')}
 </h3>
 <p className="text-sm text-muted-foreground">
 {t('vendorScoring.configDescription', 'Adjust section weights and mark critical questions')}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Button variant="ghost" size="sm" onClick={handleReset}>
 <RotateCcw className="w-4 h-4 mr-1" />
 {t('common.reset', 'Reset')}
 </Button>
 <Button variant="ghost" size="sm" onClick={handleNormalize}>
 {t('vendorScoring.normalize', 'Normalize to 100%')}
 </Button>
 </div>
 </div>

 {/* Weight validation */}
 {!isValidWeight && (
 <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
 <AlertTriangle className="w-4 h-4 shrink-0" />
 {t('vendorScoring.weightWarning', 'Section weights should total 100%. Current: {{total}}%', {
 total: Math.round(totalWeight),
 })}
 </div>
 )}

 {/* Section weights */}
 <div className="space-y-4">
 <h4 className="font-medium text-foreground">
 {t('vendorScoring.sectionWeights', 'Section Weights')}
 </h4>

 {sectionWeights.map((section) => (
 <div
 key={section.sectionId || 'unknown'}
 className="flex items-center gap-4 p-4 bg-muted/50 rounded-3xl"
 >
 <div className="flex-1">
 <p className="font-medium text-foreground">
 {section.title}
 </p>
 <p className="text-xs text-muted-foreground">
 {section.questionCount} {t('vendorScoring.questions', 'questions')}
 </p>
 </div>

 <div className="flex items-center gap-3">
 <input
 type="range"
 min="0"
 max="100"
 value={section.weight}
 onChange={(e) => handleWeightChange(section.sectionId, parseInt(e.target.value))}
 className="w-32 accent-brand-500"
 />
 <div className="w-16 flex items-center">
 <input
  type="number"
  min="0"
  max="100"
  value={section.weight}
  onChange={(e) => handleWeightChange(section.sectionId, parseInt(e.target.value) || 0)}
  className="w-12 px-2 py-1 text-center text-sm border border-border/40 rounded bg-card"
 />
 <span className="text-sm text-muted-foreground ml-1">%</span>
 </div>
 </div>
 </div>
 ))}

 {/* Total */}
 <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
 <span className="text-sm text-muted-foreground">
 {t('vendorScoring.total', 'Total')}:
 </span>
 <span
 className={`font-bold ${isValidWeight ? 'text-green-600' : 'text-red-600'}`}
 >
 {Math.round(totalWeight)}%
 </span>
 {isValidWeight && <CheckCircle className="w-4 h-4 text-green-500" />}
 </div>
 </div>

 {/* Risk thresholds info */}
 <div className="p-4 bg-muted/50 rounded-3xl">
 <h4 className="font-medium text-foreground mb-3">
 {t('vendorScoring.riskThresholds', 'Risk Thresholds')}
 </h4>
 <div className="grid grid-cols-4 gap-2">
 {RISK_LEVEL_CONFIGS.map((config) => (
 <div
 key={config.level || 'unknown'}
 className={`p-2 rounded-lg text-center ${config.bgColor}`}
 >
 <p className={`font-medium text-sm ${config.color}`}>{config.level}</p>
 <p className="text-xs text-muted-foreground">
 {config.minScore}-{config.maxScore}%
 </p>
 </div>
 ))}
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
 <Button variant="ghost" onClick={onCancel}>
 {t('common.cancel', 'Cancel')}
 </Button>
 <Button onClick={handleSave} disabled={!isValidWeight}>
 <Save className="w-4 h-4 mr-2" />
 {t('vendorScoring.saveConfig', 'Save Configuration')}
 </Button>
 </div>
 </div>
 );
};

export default ScoringConfig;
