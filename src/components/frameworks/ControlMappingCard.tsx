/**
 * ControlMappingCard Component
 *
 * Displays a control with all its framework mappings,
 * showing coverage percentage per framework.
 *
 * @see Story EU-1.5: Implémenter le Cross-Framework Mapping
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Shield, ChevronRight, Link2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ControlWithMappings, RegulatoryFrameworkCode } from '../../types/framework';

// ============================================================================
// Framework Color Config
// ============================================================================

const FRAMEWORK_COLORS: Record<RegulatoryFrameworkCode, string> = {
  NIS2: 'bg-blue-500',
  DORA: 'bg-purple-500',
  RGPD: 'bg-emerald-500',
  AI_ACT: 'bg-amber-500',
  ISO27001: 'bg-slate-500',
  ISO22301: 'bg-cyan-500',
  SOC2: 'bg-rose-500',
  PCI_DSS: 'bg-red-500',
  NIST_CSF: 'bg-indigo-500',
  HDS: 'bg-green-500',
  SECNUMCLOUD: 'bg-blue-600',
};

// ============================================================================
// Types
// ============================================================================

interface ControlMappingCardProps {
  control: ControlWithMappings;
  onClick?: (control: ControlWithMappings) => void;
  isSelected?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ControlMappingCard: React.FC<ControlMappingCardProps> = ({
  control,
  onClick,
  isSelected = false,
}) => {
  const { t } = useTranslation();

  // Calculate overall coverage
  const totalRequirements = control.mappings.reduce((sum, m) => sum + m.requirementCount, 0);
  const avgCoverage = control.mappings.length > 0
    ? Math.round(control.mappings.reduce((sum, m) => sum + m.coveragePercentage, 0) / control.mappings.length)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick?.(control)}
      className={cn(
        'group relative p-4 rounded-3xl cursor-pointer transition-all duration-200',
        'border backdrop-blur-sm',
        isSelected
          ? 'bg-brand-50 dark:bg-brand-800 border-brand-300 dark:border-brand-700 shadow-md'
          : 'bg-white/60 dark:bg-slate-900/60 border-border/40 dark:border-border/40 hover:border-border/40 dark:hover:border-white/20 hover:shadow-sm'
      )}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-300" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Control code and name */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-slate-500 dark:text-muted-foreground">
              {control.controlCode}
            </span>
          </div>
          <h4 className="font-medium text-slate-900 dark:text-white text-sm leading-tight line-clamp-1">
            {control.controlName}
          </h4>

          {/* Framework badges */}
          {control.mappings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {control.mappings.map((mapping) => (
                <div
                  key={mapping.frameworkId}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800"
                >
                  <div className={cn('w-2 h-2 rounded-full', FRAMEWORK_COLORS[mapping.frameworkCode])} />
                  <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">
                    {mapping.frameworkCode}
                  </span>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">
                    {mapping.coveragePercentage}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No mappings */}
          {control.mappings.length === 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground dark:text-slate-400">
              <Link2 className="w-3 h-3" />
              <span>{t('mapping.noMappings')}</span>
            </div>
          )}
        </div>

        {/* Stats and chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {control.mappings.length > 0 && (
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {avgCoverage}%
              </div>
              <div className="text-xs text-slate-500 dark:text-muted-foreground">
                {totalRequirements} {t('mapping.reqs')}
              </div>
            </div>
          )}
          <ChevronRight className={cn(
            'w-4 h-4 transition-transform',
            'text-slate-400 dark:text-slate-400',
            'group-hover:translate-x-1 group-hover:text-slate-600 dark:group-hover:text-slate-300'
          )} />
        </div>
      </div>

      {/* Coverage bar */}
      {control.mappings.length > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${avgCoverage}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'h-full rounded-full',
              avgCoverage >= 75 ? 'bg-emerald-500' :
              avgCoverage >= 50 ? 'bg-amber-500' : 'bg-red-500'
            )}
          />
        </div>
      )}
    </motion.div>
  );
};

export default ControlMappingCard;
