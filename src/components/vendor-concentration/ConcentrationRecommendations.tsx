/**
 * ConcentrationRecommendations Component
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Displays diversification recommendations with
 * priority indicators, expected risk reduction,
 * and actionable steps.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
 Lightbulb,
 ChevronRight,
 Target,
 TrendingDown,
 Clock,
 CheckCircle2,
 Circle,
 Zap,
} from '../ui/Icons';
import type {
 RecommendationsSummary,
 DiversificationRecommendation,
 RecommendedAction,
 EffortLevel,
} from '../../types/vendorConcentration';

// ============================================================================
// Types
// ============================================================================

interface ConcentrationRecommendationsProps {
 recommendations: RecommendationsSummary;
 onActionComplete?: (recommendationId: string, actionId: string) => void;
}

// ============================================================================
// Priority Badge Component
// ============================================================================

interface PriorityBadgeProps {
 priority: 'high' | 'medium' | 'low';
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
 const { t } = useTranslation();

 const styles = {
 high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
 medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
 low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
 };

 const icons = {
 high: Zap,
 medium: Target,
 low: Clock,
 };

 const Icon = icons[priority];

 return (
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[priority]}`}>
 <Icon className="h-3 w-3" />
 {t(`vendorConcentration.recommendations.priority.${priority}`)}
 </span>
 );
};

// ============================================================================
// Effort Badge Component
// ============================================================================

interface EffortBadgeProps {
 effort: EffortLevel;
}

const EffortBadge: React.FC<EffortBadgeProps> = ({ effort }) => {
 const { t } = useTranslation();

 const styles = {
 low: 'text-green-600 dark:text-green-400',
 medium: 'text-yellow-600 dark:text-yellow-400',
 high: 'text-red-600 dark:text-red-400',
 };

 const dots = {
 low: 1,
 medium: 2,
 high: 3,
 };

 return (
 <div className={`flex items-center gap-1 ${styles[effort]}`}>
 {Array.from({ length: 3 }).map((_, i) => (
 <div
 key={i || 'unknown'}
 className={`w-2 h-2 rounded-full ${
 i < dots[effort]
 ? effort === 'low'
 ? 'bg-green-500'
 : effort === 'medium'
  ? 'bg-yellow-500'
  : 'bg-red-500'
 : 'bg-muted'
 }`}
 />
 ))}
 <span className="text-xs ml-1">{t(`vendorConcentration.recommendations.effort.${effort}`)}</span>
 </div>
 );
};

// ============================================================================
// Risk Reduction Indicator
// ============================================================================

interface RiskReductionProps {
 percentage: number;
}

const RiskReduction: React.FC<RiskReductionProps> = ({ percentage }) => {
 const { t } = useTranslation();

 return (
 <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
 <TrendingDown className="h-4 w-4" />
 <span className="text-sm font-medium">-{percentage}%</span>
 <span className="text-xs text-muted-foreground ml-1">{t('vendorConcentration.recommendations.riskReduction')}</span>
 </div>
 );
};

// ============================================================================
// Action Item Component
// ============================================================================

interface ActionItemProps {
 action: RecommendedAction;
 completed?: boolean;
 onToggle?: () => void;
}

const ActionItem: React.FC<ActionItemProps> = ({ action, completed, onToggle }) => {
 return (
 <div
 className={`flex items-start gap-3 p-3 rounded-lg ${
 completed
 ? 'bg-green-50 dark:bg-green-900/20'
 : 'bg-muted/50'
 }`}
 >
 <button
 onClick={onToggle}
 className={`mt-0.5 flex-shrink-0 ${
 completed ? 'text-green-500' : 'text-muted-foreground hover:text-muted-foreground'
 }`}
 >
 {completed ? (
 <CheckCircle2 className="h-5 w-5" />
 ) : (
 <Circle className="h-5 w-5" />
 )}
 </button>
 <div className="flex-1">
 <p className={`text-sm font-medium ${
 completed
 ? 'text-green-700 dark:text-green-400 line-through'
 : 'text-foreground'
 }`}>
 {action.title}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
 <div className="flex items-center gap-3 mt-2">
 <EffortBadge effort={action.effort} />
 <span className="text-xs text-muted-foreground">•</span>
 <span className="text-xs text-muted-foreground">{action.timeline}</span>
 </div>
 </div>
 </div>
 );
};

// ============================================================================
// Recommendation Card Component
// ============================================================================

interface RecommendationCardProps {
 recommendation: DiversificationRecommendation;
 onActionComplete?: (actionId: string) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
 recommendation,
 onActionComplete,
}) => {
 const { t } = useTranslation();
 const [expanded, setExpanded] = useState(false);
 const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

 const toggleAction = (actionId: string) => {
 const newCompleted = new Set(completedActions);
 if (newCompleted.has(actionId)) {
 newCompleted.delete(actionId);
 } else {
 newCompleted.add(actionId);
 onActionComplete?.(actionId);
 }
 setCompletedActions(newCompleted);
 };

 const progress = recommendation.actions.length > 0
 ? Math.round((completedActions.size / recommendation.actions.length) * 100)
 : 0;

 const borderColor = {
 high: 'border-l-red-500',
 medium: 'border-l-yellow-500',
 low: 'border-l-blue-500',
 }[recommendation.priority];

 return (
 <div
 className={`border border-border/40 rounded-3xl overflow-hidden border-l-4 ${borderColor}`}
 >
 <button
 onClick={() => setExpanded(!expanded)}
 className="w-full p-4 hover:bg-muted/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <Lightbulb className="h-5 w-5 text-amber-500" />
 <span className="font-medium text-foreground">
 {recommendation.categoryLabel}
 </span>
 <PriorityBadge priority={recommendation.priority} />
 {recommendation.relatedSPOF && (
 <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600">
  SPOF
 </span>
 )}
 </div>
 <p className="text-sm text-foreground mb-2">
 {recommendation.recommendation}
 </p>
 <div className="flex items-center gap-4">
 <RiskReduction percentage={recommendation.expectedRiskReduction} />
 <span className="text-xs text-muted-foreground">•</span>
 <EffortBadge effort={recommendation.estimatedEffort} />
 <span className="text-xs text-muted-foreground">•</span>
 <span className="text-xs text-muted-foreground">{recommendation.estimatedTimeline}</span>
 </div>
 </div>
 <ChevronRight
 className={`h-5 w-5 text-muted-foreground transition-transform ml-4 ${expanded ? 'rotate-90' : ''}`}
 />
 </div>
 </button>

 {expanded && (
 <div className="border-t border-border/40 p-4 space-y-4">
 {/* Current vs Target State */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
 <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">
 {t('vendorConcentration.recommendations.currentState')}
 </p>
 <p className="text-sm text-red-700 dark:text-red-400">
 {recommendation.currentState}
 </p>
 </div>
 <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
 <p className="text-xs font-medium text-green-500 uppercase tracking-wide mb-1">
 {t('vendorConcentration.recommendations.targetState')}
 </p>
 <p className="text-sm text-green-700 dark:text-green-400">
 {recommendation.targetState}
 </p>
 </div>
 </div>

 {/* Rationale */}
 <div>
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
 {t('vendorConcentration.recommendations.rationale')}
 </p>
 <p className="text-sm text-muted-foreground">
 {recommendation.rationale}
 </p>
 </div>

 {/* Actions */}
 {recommendation.actions.length > 0 && (
 <div>
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
  {t('vendorConcentration.recommendations.actions')} ({completedActions.size}/{recommendation.actions.length})
 </p>
 {progress > 0 && (
  <span className="text-xs text-green-600">{progress}% {t('common.complete')}</span>
 )}
 </div>

 {/* Progress bar */}
 <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
 <div
  className="h-full bg-green-500 rounded-full transition-all duration-300"
  style={{ width: `${progress}%` }}
 />
 </div>

 <div className="space-y-2">
 {recommendation.actions.map(action => (
  <ActionItem
  key={action.id || 'unknown'}
  action={action}
  completed={completedActions.has(action.id)}
  onToggle={() => toggleAction(action.id)}
  />
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
};

// ============================================================================
// Main Component
// ============================================================================

export const ConcentrationRecommendations: React.FC<ConcentrationRecommendationsProps> = ({
 recommendations,
 onActionComplete,
}) => {
 const { t } = useTranslation();

 if (recommendations.totalRecommendations === 0) {
 return (
 <div className="text-center py-8">
 <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mx-auto mb-4">
 <CheckCircle2 className="h-8 w-8 text-green-500" />
 </div>
 <p className="text-lg font-medium text-foreground mb-1">
 {t('vendorConcentration.recommendations.noRecommendations')}
 </p>
 <p className="text-sm text-muted-foreground">
 {t('vendorConcentration.recommendations.noRecommendationsDescription')}
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Summary */}
 <div className="flex items-center gap-6 p-4 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
 <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
 <Lightbulb className="h-6 w-6 text-amber-600" />
 </div>
 <div className="flex-1">
 <p className="text-lg font-semibold text-foreground">
 {recommendations.totalRecommendations} {t('vendorConcentration.recommendations.available')}
 </p>
 <p className="text-sm text-muted-foreground">
 {t('vendorConcentration.recommendations.potentialReduction', {
 value: recommendations.estimatedTotalRiskReduction,
 })}
 </p>
 </div>
 <div className="text-right">
 <p className="text-2xl font-bold text-green-600">
 -{recommendations.estimatedTotalRiskReduction}%
 </p>
 <p className="text-xs text-muted-foreground">{t('vendorConcentration.recommendations.totalReduction')}</p>
 </div>
 </div>

 {/* Filter by priority */}
 <div className="flex items-center gap-2 text-sm">
 <span className="text-muted-foreground">{t('vendorConcentration.recommendations.byPriority')}:</span>
 <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
 {recommendations.highPriority} {t('vendorConcentration.recommendations.priority.high')}
 </span>
 <span className="px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
 {recommendations.recommendations.filter(r => r.priority === 'medium').length} {t('vendorConcentration.recommendations.priority.medium')}
 </span>
 <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-medium">
 {recommendations.recommendations.filter(r => r.priority === 'low').length} {t('vendorConcentration.recommendations.priority.low')}
 </span>
 </div>

 {/* Recommendation Cards */}
 <div className="space-y-3">
 {recommendations.recommendations.map(rec => (
 <RecommendationCard
 key={rec.id || 'unknown'}
 recommendation={rec}
 onActionComplete={(actionId) => onActionComplete?.(rec.id, actionId)}
 />
 ))}
 </div>
 </div>
 );
};

export default ConcentrationRecommendations;
