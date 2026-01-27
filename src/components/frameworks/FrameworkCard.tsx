/**
 * FrameworkCard Component
 *
 * Displays a regulatory framework with its details and activation status.
 * Follows Apple design system with glass morphism effects.
 *
 * @see Story EU-1.3: Créer le composant FrameworkSelector
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Calendar, Globe, Shield } from 'lucide-react';
import { cn } from '../../utils/cn';
import { appleEasing } from '../../utils/microInteractions';
import type { RegulatoryFramework, ActiveFramework } from '../../types/framework';

// ============================================================================
// Framework Icons
// ============================================================================

const FRAMEWORK_ICONS: Record<string, React.ReactNode> = {
  NIS2: <Shield className="w-6 h-6" />,
  DORA: <Shield className="w-6 h-6" />,
  RGPD: <Shield className="w-6 h-6" />,
  AI_ACT: <Shield className="w-6 h-6" />,
  ISO27001: <Shield className="w-6 h-6" />,
  ISO22301: <Shield className="w-6 h-6" />,
  SOC2: <Shield className="w-6 h-6" />,
  PCI_DSS: <Shield className="w-6 h-6" />,
  NIST_CSF: <Shield className="w-6 h-6" />,
  HDS: <Shield className="w-6 h-6" />,
  SECNUMCLOUD: <Shield className="w-6 h-6" />,
};

const FRAMEWORK_COLORS: Record<string, string> = {
  NIS2: 'from-blue-500 to-indigo-600',
  DORA: 'from-purple-500 to-violet-600',
  RGPD: 'from-emerald-500 to-teal-600',
  AI_ACT: 'from-amber-500 to-orange-600',
  ISO27001: 'from-slate-500 to-slate-700',
  ISO22301: 'from-cyan-500 to-blue-600',
  SOC2: 'from-rose-500 to-pink-600',
  PCI_DSS: 'from-red-500 to-rose-600',
  NIST_CSF: 'from-indigo-500 to-blue-600',
  HDS: 'from-green-500 to-emerald-600',
  SECNUMCLOUD: 'from-blue-600 to-indigo-700',
};

// ============================================================================
// Types
// ============================================================================

interface FrameworkCardProps {
  framework: RegulatoryFramework;
  activeFramework?: ActiveFramework;
  onActivate: (framework: RegulatoryFramework) => void;
  onDeactivate: (framework: RegulatoryFramework) => void;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const FrameworkCard: React.FC<FrameworkCardProps> = ({
  framework,
  activeFramework,
  onActivate,
  onDeactivate,
  isLoading = false,
}) => {
  const { t, i18n } = useTranslation();
  const isActive = !!activeFramework;
  const locale = i18n.language as 'en' | 'fr' | 'de';

  // Get localized name and description
  const name = framework.localizedNames?.[locale] || framework.name;
  const description = framework.localizedDescriptions?.[locale] || framework.description;

  // Format dates - map locale to Intl locale
  const intlLocale = locale === 'en' ? 'en-US' : locale === 'de' ? 'de-DE' : 'fr-FR';

  // Convert Timestamp or string to Date
  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof value === 'string') return new Date(value);
    const ts = value as { seconds?: number; toDate?: () => Date };
    if (ts.toDate) return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    return null;
  };

  const effectiveDateObj = toDate(framework.effectiveDate);
  const effectiveDate = effectiveDateObj
    ? effectiveDateObj.toLocaleDateString(intlLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const activatedDateObj = toDate(activeFramework?.activatedAt);
  const activatedDate = activatedDateObj
    ? activatedDateObj.toLocaleDateString(intlLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const gradientColor = FRAMEWORK_COLORS[framework.code] || 'from-slate-500 to-slate-700';

  const handleClick = () => {
    if (isLoading) return;
    if (isActive) {
      onDeactivate(framework);
    } else {
      onActivate(framework);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: appleEasing }}
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300',
        'backdrop-blur-xl border',
        isActive
          ? 'bg-white/90 dark:bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
          : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/50 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20',
        isLoading && 'opacity-60 pointer-events-none'
      )}
      onClick={handleClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Gradient Header */}
      <div className={cn('h-2 w-full bg-gradient-to-r', gradientColor)} />

      {/* Content */}
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg',
                gradientColor
              )}
            >
              {FRAMEWORK_ICONS[framework.code] || <Shield className="w-6 h-6" />}
            </div>

            {/* Title & Code */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">
                {framework.code}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-300 line-clamp-1">
                {name}
              </p>
            </div>
          </div>

          {/* Active Badge */}
          {isActive && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{t('frameworks.active', 'Actif')}</span>
            </motion.div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-muted-foreground">
          {/* Jurisdiction */}
          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            <span>{framework.jurisdiction}</span>
          </div>

          {/* Effective Date */}
          {effectiveDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{effectiveDate}</span>
            </div>
          )}

          {/* Requirements Count */}
          {framework.requirementCount && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="font-medium">
                {framework.requirementCount} {t('frameworks.requirements', 'exigences')}
              </span>
            </div>
          )}
        </div>

        {/* Activated Info */}
        {isActive && activatedDate && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
            <p className="text-xs text-slate-500 dark:text-muted-foreground">
              {t('frameworks.activatedOn', 'Activé le')} {activatedDate}
            </p>
          </div>
        )}

        {/* Hover Action Hint */}
        <motion.div
          className={cn(
            'absolute inset-x-0 bottom-0 py-2 text-center text-xs font-semibold transition-all',
            'opacity-0 group-hover:opacity-70 translate-y-2 group-hover:translate-y-0',
            isActive
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          )}
        >
          {isActive
            ? t('frameworks.clickToDeactivate', 'Cliquer pour désactiver')
            : t('frameworks.clickToActivate', 'Cliquer pour activer')}
        </motion.div>
      </div>
    </motion.div>
  );
};
