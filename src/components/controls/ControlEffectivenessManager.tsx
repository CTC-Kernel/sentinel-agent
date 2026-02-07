/**
 * Control Effectiveness Manager (ISO 27002)
 * Domain Grid and Detail Panel for control effectiveness
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumCard } from '../ui/PremiumCard';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';
import { ISO_DOMAINS, ISO_SEED_CONTROLS } from '../../data/complianceData';
import {
 AlertTriangle,
 Plus,
 ChevronRight,
 BarChart3,
} from '../ui/Icons';
import type { ControlEffectivenessAssessment, DomainScore } from '../../types/ebios';
import { useLocale } from '@/hooks/useLocale';

interface ControlEffectivenessManagerProps {
 assessments: ControlEffectivenessAssessment[];
 domainScores: DomainScore[];
 loading: boolean;
 error: string | null;
 onAssessControl: (control: { code: string; name: string }) => void;
}

export const ControlEffectivenessManager: React.FC<ControlEffectivenessManagerProps> = ({
 assessments,
 domainScores,
 loading,
 error,
 onAssessControl
}) => {
 const { t } = useLocale();
 const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

 // Group controls by domain
 const controlsByDomain = useMemo(() => {
 const grouped = new Map<string, typeof ISO_SEED_CONTROLS>();
 ISO_SEED_CONTROLS.forEach(control => {
 const domain = control.code.split('.').slice(0, 2).join('.');
 if (!grouped.has(domain)) {
 grouped.set(domain, []);
 }
 grouped.get(domain)!.push(control);
 });
 return grouped;
 }, []);

 // Get assessment for a control code
 const getControlAssessment = (code: string) => {
 return assessments.find(a => a.controlId === code);
 };

 if (loading) {
 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {[...Array(4)].map((_, i) => (
 <Skeleton key={i || 'unknown'} className="h-40" />
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Error Banner */}
 {error && (
 <div className="p-4 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 dark:border-red-900 flex items-center gap-3">
 <AlertTriangle className="w-5 h-5 text-red-500" />
 <span className="text-red-700 dark:text-red-400">{error}</span>
 </div>
 )}

 {/* Domain Maturity Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {ISO_DOMAINS.map((domain) => {
 const domainScore = domainScores.find(ds => ds.domain === domain.id);
 const controls = controlsByDomain.get(domain.id) || [];
 const assessedCount = controls.filter(c => getControlAssessment(c.code)).length;
 const maturityLevel = domainScore?.maturityLevel || 1;
 const avgEffectiveness = domainScore?.averageEffectiveness || 0;

 return (
 <motion.button
 key={domain.id || 'unknown'}
 onClick={() => setSelectedDomain(selectedDomain === domain.id ? null : domain.id)}
 aria-label={`${domain.id} - ${domain.title} - ${t('compliance.maturityLevel', { defaultValue: 'Niveau de maturité' })} ${maturityLevel}`}
 className={cn(
 "p-4 rounded-2xl border-2 text-left transition-all",
 selectedDomain === domain.id
  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
  : "border-border/40 bg-card/50 hover:border-border/40"
 )}
 whileHover={{ y: -2 }}
 whileTap={{ scale: 0.98 }}
 >
 <div className="flex items-center justify-between mb-3">
 <Badge variant="outline">{domain.id}</Badge>
 <div className={cn(
  "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
  maturityLevel >= 4 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
  maturityLevel >= 3 ? 'bg-info-bg text-info-text' :
  maturityLevel >= 2 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
  'bg-muted text-muted-foreground'
 )}>
  {maturityLevel}
 </div>
 </div>

 <h4 className="font-medium text-foreground text-sm mb-1">{domain.title}</h4>
 <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{domain.description}</p>

 <div className="flex items-center justify-between text-xs">
 <span className="text-muted-foreground">{assessedCount}/{controls.length} {t('compliance.assessed', { defaultValue: 'évalués' })}</span>
 <span className={cn(
  "font-medium",
  avgEffectiveness >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
  avgEffectiveness >= 40 ? 'text-amber-600 dark:text-amber-400' :
  'text-muted-foreground'
 )}>
  {avgEffectiveness}%
 </span>
 </div>

 {/* Progress bar */}
 <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
 <div
  className={cn(
  "h-full rounded-full transition-all",
  maturityLevel >= 4 ? 'bg-emerald-500' :
  maturityLevel >= 3 ? 'bg-blue-500' :
  maturityLevel >= 2 ? 'bg-amber-500' : 'bg-muted-foreground'
  )}
  style={{ width: `${avgEffectiveness}%` }}
 />
 </div>
 </motion.button>
 );
 })}
 </div>

 {/* Domain Detail Panel */}
 <AnimatePresence mode="popLayout">
 {selectedDomain && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 transition={{ duration: 0.2 }}
 >
 <DomainControlsPanel
 domain={selectedDomain}
 controls={controlsByDomain.get(selectedDomain) || []}
 assessments={assessments}
 onAssessControl={onAssessControl}
 />
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};

// ============================================================================
// Domain Controls Panel
// ============================================================================

interface DomainControlsPanelProps {
 domain: string;
 controls: { code: string; name: string }[];
 assessments: ControlEffectivenessAssessment[];
 onAssessControl: (control: { code: string; name: string }) => void;
}

const DomainControlsPanel: React.FC<DomainControlsPanelProps> = ({
 domain,
 controls,
 assessments,
 onAssessControl
}) => {
 const { t, config: localeConfig } = useLocale();
 const domainInfo = ISO_DOMAINS.find(d => d.id === domain);

 const getControlAssessment = (code: string) => {
 return assessments.find(a => a.controlId === code);
 };

 return (
 <PremiumCard glass className="p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-3xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
 <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
 </div>
 <div>
 <h3 className="text-lg font-semibold text-foreground">{domain} - {domainInfo?.title}</h3>
 <p className="text-sm text-muted-foreground">{controls.length} {t('compliance.controls', { defaultValue: 'contrôles' })}</p>
 </div>
 </div>
 </div>

 <div className="space-y-2">
 {controls.map((control) => {
 const assessment = getControlAssessment(control.code);
 const hasAssessment = !!assessment;
 const score = assessment?.effectivenessScore || 0;

 return (
 <div
 key={control.code || 'unknown'}
 className={cn(
 "flex items-center gap-4 p-3 rounded-3xl border transition-all",
 hasAssessment
  ? "border-border/40 bg-card/50"
  : "border-dashed border-border/40 bg-muted/30"
 )}
 >
 <div className="w-16 flex-shrink-0">
 <Badge variant="outline" size="sm">{control.code}</Badge>
 </div>

 <div className="flex-1 min-w-0">
 <span className={cn(
  "text-sm",
  hasAssessment ? "text-foreground" : "text-muted-foreground"
 )}>
  {control.name}
 </span>
 </div>

 {hasAssessment ? (
 <div className="flex items-center gap-3">
  <div className="text-right">
  <div className={cn(
  "text-lg font-bold",
  score >= 60 ? 'text-emerald-600 dark:text-emerald-400' :
  score >= 40 ? 'text-amber-600 dark:text-amber-400' :
  'text-red-600 dark:text-red-400'
  )}>
  {score}%
  </div>
  <div className="text-xs text-muted-foreground">
  {new Date(assessment.assessmentDate).toLocaleDateString(localeConfig.intlLocale)}
  </div>
  </div>
  <ChevronRight className="w-4 h-4 text-muted-foreground" />
 </div>
 ) : (
 <Button
  size="sm"
  variant="outline"
  onClick={() => onAssessControl(control)}
 >
  <Plus className="w-3 h-3 mr-1" />
  {t('compliance.assess', { defaultValue: 'Évaluer' })}
 </Button>
 )}
 </div>
 );
 })}
 </div>
 </PremiumCard>
 );
};

export default ControlEffectivenessManager;
