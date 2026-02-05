/**
 * MappingCell Component
 *
 * A cell in the cross-framework mapping matrix showing
 * coverage status between a control and a framework.
 *
 * @see Story EU-1.5: Implémenter le Cross-Framework Mapping
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Minus, X, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { CoverageStatus } from '../../types/framework';

// ============================================================================
// Coverage Status Config
// ============================================================================

const COVERAGE_CONFIG: Record<CoverageStatus, {
 icon: React.ComponentType<{ className?: string }>;
 bgColor: string;
 textColor: string;
 borderColor: string;
 label: string;
}> = {
 full: {
 icon: Check,
 bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
 textColor: 'text-emerald-600 dark:text-emerald-400',
 borderColor: 'border-emerald-300 dark:border-emerald-700',
 label: 'Complète',
 },
 partial: {
 icon: Minus,
 bgColor: 'bg-amber-100 dark:bg-amber-900/30',
 textColor: 'text-amber-600 dark:text-amber-400',
 borderColor: 'border-amber-300 dark:border-amber-700',
 label: 'Partielle',
 },
 none: {
 icon: X,
 bgColor: 'bg-red-100 dark:bg-red-900/30',
 textColor: 'text-red-600 dark:text-red-400',
 borderColor: 'border-red-300 dark:border-red-700',
 label: 'Aucune',
 },
 not_assessed: {
 icon: AlertCircle,
 bgColor: 'bg-muted',
 textColor: 'text-muted-foreground',
 borderColor: 'border-border/40',
 label: 'Non évalué',
 },
};

// ============================================================================
// Types
// ============================================================================

interface MappingCellProps {
 coverageStatus: CoverageStatus;
 coveragePercentage: number;
 requirementCount: number;
 requirements?: { id: string; articleRef: string; title: string }[];
 onClick?: () => void;
 onHover?: (isHovered: boolean) => void;
 isHighlighted?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const MappingCell: React.FC<MappingCellProps> = ({
 coverageStatus,
 coveragePercentage,
 requirementCount,
 requirements = [],
 onClick,
 onHover,
 isHighlighted = false,
}) => {
 const { t } = useTranslation();
 const [isHovered, setIsHovered] = useState(false);
 const config = COVERAGE_CONFIG[coverageStatus];
 const Icon = config.icon;

 const handleMouseEnter = () => {
 setIsHovered(true);
 onHover?.(true);
 };

 const handleMouseLeave = () => {
 setIsHovered(false);
 onHover?.(false);
 };

 return (
 <div className="relative">
 <motion.button
 onClick={onClick}
 onMouseEnter={handleMouseEnter}
 onMouseLeave={handleMouseLeave}
 className={cn(
 'w-full h-16 flex flex-col items-center justify-center rounded-lg border transition-all',
 'cursor-pointer hover:shadow-md',
 config.bgColor,
 config.borderColor,
 isHighlighted && 'ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900'
 )}
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 >
 <Icon className={cn('w-5 h-5 mb-0.5', config.textColor)} />
 {coverageStatus !== 'not_assessed' && (
 <span className={cn('text-xs font-semibold', config.textColor)}>
 {coveragePercentage}%
 </span>
 )}
 </motion.button>

 {/* Tooltip */}
 <AnimatePresence>
 {isHovered && requirementCount > 0 && (
 <motion.div
 initial={{ opacity: 0, y: 5, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 5, scale: 0.95 }}
 transition={{ duration: 0.15 }}
 className="absolute z-popover left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 rounded-3xl bg-card shadow-xl border border-border/40"
 >
 {/* Arrow */}
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-l border-t border-border/40 rotate-45" />

 <div className="relative">
 {/* Header */}
 <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40 dark:border-white/5">
 <span className={cn('text-sm font-semibold', config.textColor)}>
  {t(`mapping.coverage.${coverageStatus}`)}
 </span>
 <span className="text-xs text-muted-foreground">
  {requirementCount} {t('mapping.requirements', { count: requirementCount })}
 </span>
 </div>

 {/* Requirements list */}
 <div className="space-y-1.5 max-h-32 overflow-y-auto">
 {requirements.slice(0, 5).map((req) => (
  <div key={req.id || 'unknown'} className="flex items-start gap-2 text-xs">
  <span className="font-mono font-semibold text-muted-foreground flex-shrink-0">
  {req.articleRef}
  </span>
  <span className="text-foreground line-clamp-1">
  {req.title}
  </span>
  </div>
 ))}
 {requirements.length > 5 && (
  <div className="text-xs text-muted-foreground pt-1">
  +{requirements.length - 5} {t('mapping.more')}
  </div>
 )}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};

export default MappingCell;
