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
import { AlertTriangle, AlertCircle, Info, ChevronRight, Link2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Requirement, CriticalityLevel } from '../../types/framework';

// ============================================================================
// Criticality Icons & Colors
// ============================================================================

const CRITICALITY_CONFIG: Record<CriticalityLevel, {
 icon: React.ComponentType<{ className?: string }>;
 color: string;
 bgColor: string;
 textColor: string;
}> = {
 high: {
 icon: AlertTriangle,
 color: 'text-destructive',
 bgColor: 'bg-error-bg',
 textColor: 'text-error-text',
 },
 medium: {
 icon: AlertCircle,
 color: 'text-warning',
 bgColor: 'bg-warning-bg',
 textColor: 'text-warning-text',
 },
 low: {
 icon: Info,
 color: 'text-info-text',
 bgColor: 'bg-info-bg',
 textColor: 'text-info-text',
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
 'group relative p-4 rounded-3xl cursor-pointer transition-all duration-200',
 'border backdrop-blur-sm',
 isSelected
 ? 'bg-primary/10 dark:bg-primary border-primary/40 dark:border-primary/80 shadow-md'
 : 'bg-white/40 dark:bg-white/5 dark:bg-white/5 border-border/40 hover:border-border/40 dark:hover:border-white/20 hover:shadow-sm'
 )}
 onClick={() => onClick?.(requirement)}
 whileHover={{ x: 2 }}
 whileTap={{ scale: 0.99 }}
 >
 <div className="flex items-start gap-3">
 {/* Article Reference Badge */}
 <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-muted border border-border/40">
 <span className="text-xs font-mono font-semibold text-muted-foreground">
 {requirement.articleRef}
 </span>
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-foreground text-sm leading-tight mb-1 line-clamp-2">
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
 <div className="flex items-center gap-1 text-xs text-muted-foreground">
 <Link2 className="w-3 h-3" />
 <span>
  {linkedControlsCount} {t('requirements.linkedControls', { count: linkedControlsCount })}
 </span>
 </div>
 )}

 {/* Mandatory badge */}
 {requirement.isMandatory && (
 <div className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-xs font-medium">
 {t('requirements.mandatory')}
 </div>
 )}
 </div>
 </div>

 {/* Chevron */}
 <ChevronRight className={cn(
 'w-4 h-4 flex-shrink-0 transition-transform',
 'text-muted-foreground',
 'group-hover:translate-x-1 group-hover:text-muted-foreground dark:group-hover:text-muted-foreground'
 )} />
 </div>
 </motion.div>
 );
};

export default RequirementCard;
