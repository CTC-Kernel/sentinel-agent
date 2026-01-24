/**
 * RequirementInspector Component
 *
 * Detail panel for viewing a requirement's full information
 * including description, linked controls, and metadata.
 *
 * @see Story EU-1.4: Créer la vue RequirementsList
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Link2,
  ExternalLink,
  Shield,
  Tag,
  Calendar,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { appleEasing } from '../../utils/microInteractions';
import type { Requirement, CriticalityLevel } from '../../types/framework';

// ============================================================================
// Criticality Config
// ============================================================================

const CRITICALITY_CONFIG: Record<CriticalityLevel, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  high: {
    icon: AlertTriangle,
    label: 'Haute',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800/50',
  },
  medium: {
    icon: AlertCircle,
    label: 'Moyenne',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
  },
  low: {
    icon: Info,
    label: 'Basse',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
  },
};

// ============================================================================
// Types
// ============================================================================

interface LinkedControl {
  id: string;
  code: string;
  name: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';
  coveragePercentage?: number;
}

interface RequirementInspectorProps {
  requirement: Requirement | null;
  isOpen: boolean;
  onClose: () => void;
  linkedControls?: LinkedControl[];
  onNavigateToControl?: (controlId: string) => void;
  locale?: 'en' | 'fr' | 'de';
}

// ============================================================================
// Component
// ============================================================================

export const RequirementInspector: React.FC<RequirementInspectorProps> = ({
  requirement,
  isOpen,
  onClose,
  linkedControls = [],
  onNavigateToControl,
  locale = 'fr',
}) => {
  const { t } = useTranslation();

  if (!requirement) return null;

  const critConfig = CRITICALITY_CONFIG[requirement.criticality];
  const CritIcon = critConfig.icon;

  // Get localized content
  const title = requirement.localizedTitles?.[locale] || requirement.title;
  const description = requirement.localizedDescriptions?.[locale] || requirement.description;

  // Status color helper
  const getStatusColor = (status: LinkedControl['status']) => {
    switch (status) {
      case 'compliant':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
      case 'partial':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
      case 'non_compliant':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: appleEasing }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Article Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 mb-3">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="font-mono font-semibold text-sm text-slate-700 dark:text-muted-foreground">
                      {requirement.articleRef}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {title}
                  </h2>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {/* Criticality */}
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border',
                  critConfig.bgColor,
                  critConfig.borderColor
                )}>
                  <CritIcon className={cn('w-4 h-4', critConfig.color)} />
                  <span className={cn('text-sm font-medium', critConfig.color)}>
                    {t(`requirements.criticality.${requirement.criticality}`)}
                  </span>
                </div>

                {/* Mandatory */}
                {requirement.isMandatory && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50">
                    <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {t('requirements.mandatory')}
                    </span>
                  </div>
                )}

                {/* Linked controls count */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10">
                  <Link2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
                    {linkedControls.length} {t('requirements.controls')}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Description Section */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('requirements.description')}
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {description}
                  </p>
                </div>
              </div>

              {/* Keywords Section */}
              {requirement.keywords && requirement.keywords.length > 0 && (
                <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {t('requirements.keywords')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {requirement.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300"
                      >
                        <Tag className="w-3 h-3" />
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Controls Section */}
              <div className="px-6 py-5">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  {t('requirements.linkedControls')} ({linkedControls.length})
                </h3>

                {linkedControls.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Link2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-muted-foreground">
                      {t('requirements.noLinkedControls')}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-slate-500 mt-1">
                      {t('requirements.noLinkedControlsHint')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedControls.map((control) => (
                      <motion.button
                        key={control.id}
                        onClick={() => onNavigateToControl?.(control.id)}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all text-left group"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-muted-foreground">
                                {control.code}
                              </span>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                getStatusColor(control.status)
                              )}>
                                {t(`controls.status.${control.status}`)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {control.name}
                            </p>
                            {control.coveragePercentage !== undefined && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className="h-full bg-brand-500 rounded-full transition-all"
                                    style={{ width: `${control.coveragePercentage}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-500 dark:text-muted-foreground">
                                  {control.coveragePercentage}%
                                </span>
                              </div>
                            )}
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex-shrink-0 ml-3 transition-colors" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t('requirements.frameworkId')}: {requirement.frameworkId}</span>
                </div>
                {requirement.order !== undefined && (
                  <span>#{requirement.order}</span>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RequirementInspector;
