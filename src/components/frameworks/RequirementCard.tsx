/**
 * RequirementCard Component
 *
 * Displays a regulatory requirement with its details and compliance status.
 * Uses Apple design system with glass morphism effects.
 *
 * @see Story EU-1.4: Créer la vue RequirementsList
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FileText, AlertTriangle, AlertCircle, Info, ChevronRight, Link2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Requirement, CriticalityLevel } from '../../types/framework';

// ============================================================================
// Criticality Icons & Colors
// ============================================================================

const CRITICALITY_CONFIG: Record<CriticalityLevel, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  high: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-400',
  },
  medium: {
    icon: AlertCircle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  low: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
};

// ============================================================================
// Types
// ============================================================================

interface RequirementCardProps {
  requirement: Requirement;
  onClick?: (requirement: Requirement) => void;
  linkedControlsCount?: number;
  isSelected?: boolean;
  locale?: 'en' | 'fr' | 'de';
}

// ============================================================================
// Component
// ============================================================================

export const RequirementCard: React.FC<RequirementCardProps> = ({
  requirement,
  onClick,
  linkedControlsCount = 0,
  isSelected = false,
  locale = 'fr',
}) => {
  const { t } = useTranslation();
  const critConfig = CRITICALITY_CONFIG[requirement.criticality];
  const CritIcon = critConfig.icon;

  // Get localized title
  const title = requirement.localizedTitles?.[locale] || requirement.title;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative p-4 rounded-xl cursor-pointer transition-all duration-200',
        'border backdrop-blur-sm',
        isSelected
          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 shadow-md'
          : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/50 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm'
      )}
      onClick={() => onClick?.(requirement)}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        {/* Article Reference Badge */}
        <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10">
          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
            {requirement.articleRef}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">
            {title}
          </h4>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2">
            {/* Criticality badge */}
            <div className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              critConfig.bgColor,
              critConfig.textColor
            )}>
              <CritIcon className="w-3 h-3" />
              <span>{t(`requirements.criticality.${requirement.criticality}`)}</span>
            </div>

            {/* Linked controls count */}
            {linkedControlsCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Link2 className="w-3 h-3" />
                <span>
                  {linkedControlsCount} {t('requirements.linkedControls', { count: linkedControlsCount })}
                </span>
              </div>
            )}

            {/* Mandatory badge */}
            {requirement.isMandatory && (
              <div className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium">
                {t('requirements.mandatory')}
              </div>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className={cn(
          'w-4 h-4 flex-shrink-0 transition-transform',
          'text-slate-400 dark:text-slate-500',
          'group-hover:translate-x-1 group-hover:text-slate-600 dark:group-hover:text-slate-300'
        )} />
      </div>
    </motion.div>
  );
};

export default RequirementCard;
