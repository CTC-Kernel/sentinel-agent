
import React from 'react';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { cn } from '../../../utils/cn';
import { ISO_SEED_CONTROLS } from '../../../data/complianceData';
import {
 Shield,
 TrendingDown,
 Clock,
 Plus,
} from '../../ui/Icons';
import { useControlEffectiveness, MATURITY_THRESHOLDS } from '../../../hooks/controls/useControlEffectiveness';
import { ScoreGauge } from '../../ui/ScoreGauge';

interface ControlEffectivenessDashboardProps {
 onAssessClick: () => void;
}

export const ControlEffectivenessDashboard: React.FC<ControlEffectivenessDashboardProps> = ({ onAssessClick }) => {
 const {
 assessments,
 loading,
 getOverallMaturity,
 getLowEffectivenessControls,
 getAssessmentsDueForReview,
 } = useControlEffectiveness();

 const overallMaturity = getOverallMaturity();
 const lowEffectivenessControls = getLowEffectivenessControls();
 const dueForReview = getAssessmentsDueForReview();

 if (loading) {
 return null;
 }

 return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <PremiumCard glass className="p-6 lg:col-span-2">
 <div className="flex items-center justify-between mb-6">
  <div>
  <h3 className="text-lg font-semibold text-foreground">Maturité Globale ISO 27002</h3>
  <p className="text-sm text-muted-foreground">{assessments.length} contrôles évalués sur {ISO_SEED_CONTROLS.length}</p>
  </div>
  <Button onClick={onAssessClick}>
  <Plus className="w-4 h-4 mr-2" />
  Nouvelle évaluation
  </Button>
 </div>

 {/* Maturity Gauge */}
 <div className="flex flex-col items-center justify-center py-8">
  <ScoreGauge
  score={overallMaturity.score}
  size="lg"
  showAnimation
  showLabel
  showTrend={false} // No trend data available in hook yet
  ariaLabel={`Score de maturité global: ${overallMaturity.score}%`}
  />

  <div className="text-center mt-4">
  <span className={cn(
  "text-lg font-medium",
  overallMaturity.level >= 4 ? 'text-emerald-600 dark:text-emerald-400' :
  overallMaturity.level >= 3 ? 'text-blue-600 dark:text-blue-400' :
   overallMaturity.level >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  )}>
  Niveau {overallMaturity.level}
  </span>
  <p className="text-sm text-muted-foreground">
  {MATURITY_THRESHOLDS[overallMaturity.level].label}
  </p>
  </div>
 </div>

 {/* Maturity Scale Legend */}
 <div className="flex justify-center gap-4 mt-6 flex-wrap">
  {([1, 2, 3, 4, 5] as const).map((level) => (
  <div key={level || 'unknown'} className="flex items-center gap-1.5">
  <div className={cn(
  "w-3 h-3 rounded-full",
  level === 5 ? 'bg-emerald-500' :
   level === 4 ? 'bg-blue-500' :
   level === 3 ? 'bg-cyan-500' :
   level === 2 ? 'bg-amber-500' : 'bg-red-500'
  )} />
  <span className="text-xs text-muted-foreground">{MATURITY_THRESHOLDS[level].label}</span>
  </div>
  ))}
 </div>
 </PremiumCard>

 {/* Alerts Sidebar */}
 <div className="space-y-4">
 {/* Low Effectiveness */}
 {lowEffectivenessControls.length > 0 && (
  <PremiumCard glass className="p-4 border-amber-200 dark:border-amber-800 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-50 dark:bg-amber-900">
  <div className="flex items-center gap-2 mb-3">
  <TrendingDown className="w-5 h-5 text-amber-500" />
  <span className="font-medium text-amber-700 dark:text-amber-400">
  {lowEffectivenessControls.length} contrôles faibles
  </span>
  </div>
  <div className="space-y-2">
  {lowEffectivenessControls.slice(0, 3).map((a: { controlId: string; id: string; effectivenessScore: number; }) => (
  <div key={a.id || 'unknown'} className="text-sm text-amber-600 dark:text-amber-400 flex items-center justify-between">
   <span>{a.controlId}</span>
   <Badge variant="outline" size="sm">{a.effectivenessScore}%</Badge>
  </div>
  ))}
  {lowEffectivenessControls.length > 3 && (
  <span className="text-xs text-amber-500">+{lowEffectivenessControls.length - 3} autres</span>
  )}
  </div>
  </PremiumCard>
 )}

 {/* Due for Review */}
 {dueForReview.length > 0 && (
  <PremiumCard glass className="p-4 border-blue-200 dark:border-blue-800 dark:border-blue-900 bg-blue-500 dark:bg-blue-900/30 dark:bg-blue-900">
  <div className="flex items-center gap-2 mb-3">
  <Clock className="w-5 h-5 text-blue-500" />
  <span className="font-medium text-blue-700 dark:text-blue-400">
  {dueForReview.length} évaluations à revoir
  </span>
  </div>
  <div className="space-y-2">
  {dueForReview.slice(0, 3).map((a: { id: string; controlId: string; }) => (
  <div key={a.id || 'unknown'} className="text-sm text-blue-600 dark:text-blue-400">
   {a.controlId}
  </div>
  ))}
  </div>
  </PremiumCard>
 )}

 {/* Empty State */}
 {assessments.length === 0 && (
  <PremiumCard glass className="p-4 text-center">
  <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
  <p className="text-sm text-muted-foreground">Aucune évaluation</p>
  <p className="text-xs text-muted-foreground">Commencez à évaluer vos contrôles</p>
  </PremiumCard>
 )}
 </div>
 </div>
 );
};
