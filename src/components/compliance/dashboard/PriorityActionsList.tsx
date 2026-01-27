/**
 * PriorityActionsList Component
 *
 * Displays prioritized action recommendations for improving compliance score.
 * Actions are sorted by impact (criticality × gap_size).
 *
 * @see Story EU-2.4: Créer le composant ActionsList
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, TrendingUp, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { Control } from '../../../types';

// ============================================================================
// Types
// ============================================================================

interface PriorityAction {
  id: string;
  controlId: string;
  controlCode: string;
  controlName: string;
  currentStatus: string;
  category: string;
  impactScore: number;
  potentialImprovement: number;
  criticality: 'high' | 'medium' | 'low';
  actionType: 'implement' | 'complete' | 'add_evidence';
  description: string;
}

interface PriorityActionsListProps {
  /** Controls to analyze for priority actions */
  controls: Control[];
  /** Current framework for context */
  currentFramework?: string;
  /** Maximum number of actions to display */
  maxActions?: number;
  /** Callback when an action is clicked */
  onActionClick?: (control: Control) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Priority Calculation
// ============================================================================

/**
 * Calculate criticality based on control category/domain
 * Controls in security-critical domains get higher priority
 */
function getCriticality(control: Control): 'high' | 'medium' | 'low' {
  const code = control.code?.toUpperCase() || '';

  // High criticality domains (A.5 Organizational, A.8 Technological)
  if (code.includes('A.5.') || code.includes('A.8.') || code.includes('A.12.')) {
    return 'high';
  }

  // Medium criticality (A.6 People, A.7 Physical)
  if (code.includes('A.6.') || code.includes('A.7.')) {
    return 'medium';
  }

  // Also check for framework-specific critical controls
  if (control.framework === 'NIS2' || control.framework === 'DORA') {
    // NIS2/DORA controls related to incident response or risk management
    const name = control.name?.toLowerCase() || '';
    if (name.includes('incident') || name.includes('risk') || name.includes('continuity')) {
      return 'high';
    }
  }

  return 'low';
}

/**
 * Calculate gap score based on current status
 * Higher gap = more room for improvement
 */
function getGapScore(status: string): number {
  switch (status) {
    case 'Non commencé':
    case 'Non applicable':
      return 100;
    case 'En cours':
    case 'Planifié':
      return 60;
    case 'Partiel':
      return 30;
    case 'Implémenté':
      return 0;
    default:
      return 50;
  }
}

/**
 * Determine action type based on control status
 */
function getActionType(control: Control): 'implement' | 'complete' | 'add_evidence' {
  if (control.status === 'Implémenté') {
    // Check if evidence is missing
    if (!control.evidenceIds || control.evidenceIds.length === 0) {
      return 'add_evidence';
    }
    return 'complete';
  }
  if (control.status === 'Partiel' || control.status === 'En cours') {
    return 'complete';
  }
  return 'implement';
}

/**
 * Generate priority actions from controls
 */
function generatePriorityActions(
  controls: Control[],
  maxActions: number
): PriorityAction[] {
  // Filter out fully implemented controls with evidence
  const actionableControls = controls.filter(c => {
    if (c.status === 'Implémenté') {
      // Include if missing evidence
      return !c.evidenceIds || c.evidenceIds.length === 0;
    }
    // All non-implemented controls are actionable
    return true;
  });

  // Calculate impact score for each control
  const scored = actionableControls.map(control => {
    const criticality = getCriticality(control);
    const gapScore = getGapScore(control.status || '');
    const criticalityMultiplier = criticality === 'high' ? 3 : criticality === 'medium' ? 2 : 1;
    const impactScore = gapScore * criticalityMultiplier;

    // Estimate potential score improvement (simplified)
    const potentialImprovement = Math.round(gapScore * 0.1 * criticalityMultiplier);

    const actionType = getActionType(control);

    return {
      id: `action-${control.id}`,
      controlId: control.id,
      controlCode: control.code || '',
      controlName: control.name || '',
      currentStatus: control.status || 'Non commencé',
      category: control.framework || '',
      impactScore,
      potentialImprovement,
      criticality,
      actionType,
      description: control.description || '',
    };
  });

  // Sort by impact score (highest first) and take top N
  return scored
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, maxActions);
}

// ============================================================================
// Sub-Components
// ============================================================================

const CRITICALITY_CONFIG = {
  high: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  low: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
};

const ActionCard: React.FC<{
  action: PriorityAction;
  onClick: () => void;
  index: number;
}> = ({ action, onClick, index }) => {
  const { t } = useTranslation();
  const config = CRITICALITY_CONFIG[action.criticality];

  const actionLabel = {
    implement: t('actions.implement', 'Implémenter'),
    complete: t('actions.complete', 'Finaliser'),
    add_evidence: t('actions.addEvidence', 'Ajouter preuves'),
  }[action.actionType];

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl border transition-all',
        'bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10',
        'border-white/60 dark:border-white/10 hover:border-brand-300 dark:hover:border-brand-700',
        'group cursor-pointer text-left'
      )}
    >
      {/* Priority badge */}
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
        config.bgColor
      )}>
        <span className={cn('text-sm font-bold', config.color)}>
          #{index + 1}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-muted-foreground">
            {action.controlCode}
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            config.bgColor,
            config.color
          )}>
            {actionLabel}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1">
          {action.controlName}
        </p>
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
          {t('actions.currentStatus', 'Statut')}: {action.currentStatus}
        </p>
      </div>

      {/* Impact indicator */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-bold">+{action.potentialImprovement}%</span>
        </div>
        <span className="text-xs text-muted-foreground dark:text-slate-500">
          {t('actions.potentialGain', 'gain potentiel')}
        </span>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
    </motion.button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const PriorityActionsList: React.FC<PriorityActionsListProps> = ({
  controls,
  currentFramework: _currentFramework,
  maxActions = 5,
  onActionClick,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const priorityActions = useMemo(
    () => generatePriorityActions(controls, maxActions),
    [controls, maxActions]
  );

  const handleActionClick = (action: PriorityAction) => {
    const control = controls.find(c => c.id === action.controlId);
    if (control) {
      if (onActionClick) {
        onActionClick(control);
      } else {
        // Navigate to compliance page with control selected
        navigate(`/compliance?id=${action.controlId}&tab=controls`);
      }
    }
  };

  if (priorityActions.length === 0) {
    return (
      <div className={cn(
        'glass-premium p-6 md:p-8 rounded-4xl relative overflow-hidden',
        className
      )}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-4xl" />
        <div className="relative z-10 flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {t('actions.allComplete', 'Excellent travail !')}
          </h4>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            {t('actions.noActions', 'Tous vos contrôles sont implémentés et documentés.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'glass-premium p-6 md:p-8 rounded-4xl relative group hover:shadow-apple overflow-hidden',
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-4xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('actions.priorityActions', 'Actions Prioritaires')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-muted-foreground">
              {t('actions.subtitle', 'Maximisez votre score de conformité')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
          <AlertTriangle className="w-4 h-4" />
          {priorityActions.length} {t('actions.pending', 'actions')}
        </div>
      </div>

      {/* Actions list */}
      <div className="space-y-3 relative z-10">
        <AnimatePresence mode="popLayout">
          {priorityActions.map((action, index) => (
            <ActionCard
              key={action.id}
              action={action}
              index={index}
              onClick={() => handleActionClick(action)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      <div className="mt-4 pt-4 border-t border-white/20 dark:border-white/5 relative z-10">
        <p className="text-xs text-muted-foreground dark:text-slate-500 text-center">
          {t('actions.hint', 'Cliquez sur une action pour commencer')}
        </p>
      </div>
    </div>
  );
};

export default PriorityActionsList;
