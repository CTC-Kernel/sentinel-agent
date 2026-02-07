/**
 * CrossFrameworkMatrix
 *
 * Visual matrix showing how agent checks map to multiple frameworks.
 * Displays coverage status and evidence for each check-framework combination.
 * Apple-style design with glassmorphism and smooth interactions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import {
 Check,
 X,
 Minus,
 AlertTriangle,
 Shield,
 ShieldCheck,
 ShieldAlert,
 Clock,
 Filter,
 ChevronDown,
 ChevronUp,
 RefreshCw,
 Info,
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { useStore } from '../../store';
import { AutoPopulationService } from '../../services/AutoPopulationService';
import { RegulatoryFrameworkCode } from '../../types/framework';
import { CrossFrameworkEntry } from '../../types/autoPopulation';
import { AGENT_CHECK_DEFINITIONS, AgentCheckId } from '../../types/agentEvidence';
import { getLocaleConfig, type SupportedLocale } from '../../config/localeConfig';
import i18n from '../../i18n';
import { useLocale } from '../../hooks/useLocale';
import { ErrorLogger } from '../../services/errorLogger';

interface CrossFrameworkMatrixProps {
 className?: string;
 onCellClick?: (checkId: AgentCheckId, frameworkCode: RegulatoryFrameworkCode) => void;
}

// Framework display info
const FRAMEWORK_ABBREV: Record<RegulatoryFrameworkCode, string> = {
 NIS2: 'NIS2',
 DORA: 'DORA',
 ISO27001: 'ISO 27001',
 ISO22301: 'ISO 22301',
 SOC2: 'SOC2',
 RGPD: 'RGPD',
 AI_ACT: 'AI Act',
 HDS: 'HDS',
 PCI_DSS: 'PCI DSS',
 NIST_CSF: 'NIST',
 SECNUMCLOUD: 'SecNum',
};

// Category icons and colors - labels will be translated at runtime
const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; labelKey: string }> = {
 access_control: { icon: '🔐', color: 'text-primary', labelKey: 'compliance.category.accessControl' },
 data_protection: { icon: '🔒', color: 'text-purple-500', labelKey: 'compliance.category.dataProtection' },
 network_security: { icon: '🌐', color: 'text-blue-500', labelKey: 'compliance.category.networkSecurity' },
 system_integrity: { icon: '⚙️', color: 'text-orange-500', labelKey: 'compliance.category.systemIntegrity' },
 monitoring: { icon: '👁️', color: 'text-teal-500', labelKey: 'compliance.category.monitoring' },
};

// Format relative time - returns key for translation
const formatRelativeTime = (dateStr: string, t: (key: string, options?: Record<string, unknown>) => string): string => {
 const date = new Date(dateStr);
 const now = new Date();
 const diff = now.getTime() - date.getTime();
 const hours = Math.floor(diff / 3600000);
 const days = Math.floor(diff / 86400000);

 if (hours < 1) return t('compliance.time.justNow', { defaultValue: 'À l\'instant' });
 if (hours < 24) return t('compliance.time.hoursAgo', { defaultValue: '{{hours}}h', hours });
 if (days < 7) return t('compliance.time.daysAgo', { defaultValue: '{{days}}j', days });
 return date.toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, { day: '2-digit', month: 'short' });
};

// Status cell component
interface StatusCellProps {
 hasEvidence: boolean;
 evidenceStatus?: 'pass' | 'fail' | 'mixed';
 coverageType: 'full' | 'partial';
 weight: number;
 lastVerified?: string;
 articleReference: string;
 onClick?: () => void;
 t: (key: string, options?: Record<string, unknown>) => string;
}

const StatusCell: React.FC<StatusCellProps> = ({
 hasEvidence,
 evidenceStatus,
 coverageType,
 weight,
 lastVerified,
 articleReference,
 onClick,
 t
}) => {
 const getStatusIcon = () => {
 if (!hasEvidence) {
 return <Minus className="h-3 w-3 text-muted-foreground" />;
 }
 switch (evidenceStatus) {
 case 'pass':
 return <Check className="h-3 w-3 text-success" />;
 case 'fail':
 return <X className="h-3 w-3 text-destructive" />;
 case 'mixed':
 return <AlertTriangle className="h-3 w-3 text-warning" />;
 default:
 return <Minus className="h-3 w-3 text-muted-foreground" />;
 }
 };

 const getStatusBg = () => {
 if (!hasEvidence) return 'bg-muted/20';
 switch (evidenceStatus) {
 case 'pass':
 return 'bg-success/10 hover:bg-success/20';
 case 'fail':
 return 'bg-destructive/10 hover:bg-destructive/20';
 case 'mixed':
 return 'bg-warning/10 hover:bg-warning/20';
 default:
 return 'bg-muted/20';
 }
 };

 const tooltipContent = (
 <div className="text-xs space-y-1">
 <div className="font-medium">{articleReference}</div>
 <div className="text-muted-foreground">
 {t('compliance.coverage', { defaultValue: 'Couverture' })}: {coverageType === 'full' ? t('compliance.coverageFull', { defaultValue: 'Totale' }) : t('compliance.coveragePartial', { defaultValue: 'Partielle' })} ({weight}%)
 </div>
 {hasEvidence && lastVerified && (
 <div className="text-muted-foreground flex items-center gap-1">
  <Clock className="h-3 w-3" />
  {t('compliance.verified', { defaultValue: 'Vérifié' })}: {formatRelativeTime(lastVerified, t)}
 </div>
 )}
 {!hasEvidence && (
 <div className="text-muted-foreground">
  {t('compliance.noAgentEvidence', { defaultValue: 'Pas de preuve agent' })}
 </div>
 )}
 </div>
 );

 return (
 <Tooltip content={tooltipContent} position="top">
 <motion.div
 whileHover={{ scale: 1.1 }}
 whileTap={{ scale: 0.95 }}
 onClick={onClick}
 className={cn(
  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
  getStatusBg(),
  coverageType === 'partial' && hasEvidence && 'border border-dashed border-current/30'
 )}
 >
 {getStatusIcon()}
 </motion.div>
 </Tooltip>
 );
};

// Check row component
interface CheckRowProps {
 entry: CrossFrameworkEntry;
 frameworkCodes: RegulatoryFrameworkCode[];
 isExpanded: boolean;
 onToggleExpand: () => void;
 onCellClick?: (frameworkCode: RegulatoryFrameworkCode) => void;
 t: (key: string, options?: Record<string, unknown>) => string;
}

const CheckRow: React.FC<CheckRowProps> = ({
 entry,
 frameworkCodes,
 isExpanded,
 onToggleExpand,
 onCellClick,
 t
}) => {
 const checkDef = AGENT_CHECK_DEFINITIONS[entry.checkId];
 const categoryConfig = CATEGORY_CONFIG[entry.checkCategory] || {
 icon: '📋',
 color: 'text-muted-foreground',
 labelKey: entry.checkCategory
 };

 // Get translated category label
 const getCategoryLabel = () => {
 if (categoryConfig.labelKey.startsWith('compliance.')) {
  const defaultLabels: Record<string, string> = {
  'compliance.category.accessControl': 'Contrôle d\'accès',
  'compliance.category.dataProtection': 'Protection données',
  'compliance.category.networkSecurity': 'Sécurité réseau',
  'compliance.category.systemIntegrity': 'Intégrité système',
  'compliance.category.monitoring': 'Surveillance',
  };
  return t(categoryConfig.labelKey, { defaultValue: defaultLabels[categoryConfig.labelKey] || categoryConfig.labelKey });
 }
 return categoryConfig.labelKey;
 };

 // Get status badge
 const getStatusBadge = () => {
 switch (entry.overallStatus) {
 case 'verified':
 return <Badge status="success" className="text-xs">{t('compliance.statusVerified', { defaultValue: 'Vérifié' })}</Badge>;
 case 'partial':
 return <Badge status="warning" className="text-xs">{t('compliance.statusPartial', { defaultValue: 'Partiel' })}</Badge>;
 case 'missing':
 return <Badge status="neutral" className="text-xs">{t('compliance.statusMissing', { defaultValue: 'Manquant' })}</Badge>;
 }
 };

 // Map framework codes to cells
 const frameworkCells = useMemo(() => {
 const cells: Map<RegulatoryFrameworkCode, CrossFrameworkEntry['frameworkMappings'][0] | null> = new Map();

 for (const code of frameworkCodes) {
 const mapping = entry.frameworkMappings.find(m => m.frameworkCode === code);
 cells.set(code, mapping || null);
 }

 return cells;
 }, [entry.frameworkMappings, frameworkCodes]);

 return (
 <motion.div
 variants={slideUpVariants}
 className="group"
 >
 <div className={cn(
 'flex items-center gap-2 p-2 rounded-3xl transition-colors',
 isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
 )}>
 {/* Check info */}
 <div className="flex items-center gap-2 min-w-[200px] flex-shrink-0">
  <Button
  variant="ghost"
  size="sm"
  onClick={onToggleExpand}
  className="h-6 w-6 p-0"
  >
  {isExpanded ? (
  <ChevronUp className="h-4 w-4" />
  ) : (
  <ChevronDown className="h-4 w-4" />
  )}
  </Button>
  <span className="text-lg">{categoryConfig.icon}</span>
  <div className="flex-1 min-w-0">
  <div className="font-medium text-sm truncate">
  {checkDef?.name || entry.checkName}
  </div>
  <div className="text-xs text-muted-foreground truncate">
  {getCategoryLabel()}
  </div>
  </div>
 </div>

 {/* Status badge */}
 <div className="w-20 flex-shrink-0">
  {getStatusBadge()}
 </div>

 {/* Framework cells */}
 <div className="flex items-center gap-1 flex-1 justify-center">
  {frameworkCodes.map(code => {
  const mapping = frameworkCells.get(code);
  if (!mapping) {
  return (
  <div
   key={code || 'unknown'}
   className="w-8 h-8 rounded-lg bg-muted/10 flex items-center justify-center"
  >
   <span className="text-xs text-muted-foreground">-</span>
  </div>
  );
  }
  return (
  <StatusCell
  key={code || 'unknown'}
  hasEvidence={mapping.hasEvidence}
  evidenceStatus={mapping.evidenceStatus}
  coverageType={mapping.coverageType}
  weight={mapping.weight}
  lastVerified={mapping.lastVerified}
  articleReference={mapping.requirementReference}
  onClick={() => onCellClick?.(code)}
  t={t}
  />
  );
  })}
 </div>
 </div>

 {/* Expanded details */}
 <AnimatePresence>
 {isExpanded && (
  <motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: 'auto' }}
  exit={{ opacity: 0, height: 0 }}
  transition={{ duration: 0.2 }}
  className="overflow-hidden"
  >
  <div className="ml-10 p-3 space-y-2">
  <p className="text-sm text-muted-foreground">
  {checkDef?.description || t('compliance.noDescriptionAvailable', { defaultValue: 'Aucune description disponible.' })}
  </p>
  <div className="flex flex-wrap gap-2">
  {entry.frameworkMappings.map(mapping => (
   <div
   key={`${mapping.frameworkCode || 'unknown'}-${mapping.requirementId}`}
   className={cn(
   'flex items-center gap-2 px-2 py-1 rounded-lg text-xs',
   mapping.hasEvidence && mapping.evidenceStatus === 'pass'
   ? 'bg-success/10 text-success'
   : mapping.hasEvidence && mapping.evidenceStatus === 'fail'
    ? 'bg-destructive/10 text-destructive'
    : 'bg-muted/30 text-muted-foreground'
   )}
   >
   <span className="font-medium">
   {FRAMEWORK_ABBREV[mapping.frameworkCode]}
   </span>
   <span className="opacity-60">
   {mapping.requirementReference}
   </span>
   {mapping.hasEvidence ? (
   mapping.evidenceStatus === 'pass' ? (
   <ShieldCheck className="h-3 w-3" />
   ) : mapping.evidenceStatus === 'fail' ? (
   <ShieldAlert className="h-3 w-3" />
   ) : (
   <AlertTriangle className="h-3 w-3" />
   )
   ) : (
   <Shield className="h-3 w-3 opacity-60" />
   )}
   </div>
  ))}
  </div>
  </div>
  </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 );
};

// Main component
export const CrossFrameworkMatrix: React.FC<CrossFrameworkMatrixProps> = ({
 className,
 onCellClick
}) => {
 const { user } = useStore();
 const { t } = useLocale();
 const [entries, setEntries] = useState<CrossFrameworkEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [expandedCheckIds, setExpandedCheckIds] = useState<Set<AgentCheckId>>(new Set());

 // Filter state
 const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'partial' | 'missing'>('all');
 const [filterCategory, setFilterCategory] = useState<string | 'all'>('all');

 // Load matrix data
 useEffect(() => {
 const organizationId = user?.organizationId;
 if (!organizationId) return;

 // Note: loading is initialized to true, error is initialized to null

 const loadMatrix = async () => {
 try {
 const data = await AutoPopulationService.getCrossFrameworkMatrix(organizationId);
 setEntries(data);
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'CrossFrameworkMatrix');
 setError((err as Error).message);
 } finally {
 setLoading(false);
 }
 };

 loadMatrix();
 }, [user?.organizationId]);

 // Get unique framework codes from entries
 const frameworkCodes = useMemo(() => {
 const codes = new Set<RegulatoryFrameworkCode>();
 for (const entry of entries) {
 for (const mapping of entry.frameworkMappings) {
 codes.add(mapping.frameworkCode);
 }
 }
 return Array.from(codes);
 }, [entries]);

 // Get unique categories
 const categories = useMemo(() => {
 const cats = new Set<string>();
 for (const entry of entries) {
 cats.add(entry.checkCategory);
 }
 return Array.from(cats);
 }, [entries]);

 // Filtered entries
 const filteredEntries = useMemo(() => {
 return entries.filter(entry => {
 if (filterStatus !== 'all' && entry.overallStatus !== filterStatus) return false;
 if (filterCategory !== 'all' && entry.checkCategory !== filterCategory) return false;
 return true;
 });
 }, [entries, filterStatus, filterCategory]);

 // Stats
 const stats = useMemo(() => {
 const total = entries.length;
 const verified = entries.filter(e => e.overallStatus === 'verified').length;
 const partial = entries.filter(e => e.overallStatus === 'partial').length;
 const missing = entries.filter(e => e.overallStatus === 'missing').length;

 return { total, verified, partial, missing };
 }, [entries]);

 // Toggle expansion
 const toggleExpand = (checkId: AgentCheckId) => {
 setExpandedCheckIds(prev => {
 const next = new Set(prev);
 if (next.has(checkId)) {
 next.delete(checkId);
 } else {
 next.add(checkId);
 }
 return next;
 });
 };

 if (loading) {
 return (
 <Card className={cn('p-6', className)}>
 <div className="flex items-center justify-center gap-3 py-12">
  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
  <span className="text-muted-foreground">{t('compliance.loadingMatrix', { defaultValue: 'Chargement de la matrice...' })}</span>
 </div>
 </Card>
 );
 }

 if (error) {
 return (
 <Card className={cn('p-6', className)}>
 <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
  <AlertTriangle className="h-8 w-8 text-destructive" />
  <div>
  <p className="font-medium text-destructive">{t('compliance.loadingError', { defaultValue: 'Erreur de chargement' })}</p>
  <p className="text-sm text-muted-foreground">{error}</p>
  </div>
 </div>
 </Card>
 );
 }

 if (entries.length === 0) {
 return (
 <Card className={cn('p-6', className)}>
 <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
  <Shield className="h-12 w-12 text-muted-foreground" />
  <div>
  <p className="font-medium">{t('compliance.noDataAvailable', { defaultValue: 'Aucune donnée disponible' })}</p>
  <p className="text-sm text-muted-foreground">
  {t('compliance.deployAgentsForEvidence', { defaultValue: 'Déployez des agents pour collecter des preuves de conformité.' })}
  </p>
  </div>
 </div>
 </Card>
 );
 }

 // Helper to get category label
 const getCategoryLabelForFilter = (categoryKey: string) => {
 const config = CATEGORY_CONFIG[categoryKey];
 if (config?.labelKey?.startsWith('compliance.')) {
  const defaultLabels: Record<string, string> = {
  'compliance.category.accessControl': 'Contrôle d\'accès',
  'compliance.category.dataProtection': 'Protection données',
  'compliance.category.networkSecurity': 'Sécurité réseau',
  'compliance.category.systemIntegrity': 'Intégrité système',
  'compliance.category.monitoring': 'Surveillance',
  };
  return t(config.labelKey, { defaultValue: defaultLabels[config.labelKey] || categoryKey });
 }
 return categoryKey;
 };

 return (
 <Card className={cn('overflow-hidden', className)}>
 {/* Header with stats */}
 <div className="p-4 border-b border-border/50">
 <div className="flex items-center justify-between mb-4">
  <div>
  <h3 className="font-semibold">{t('compliance.crossFrameworkMatrix', { defaultValue: 'Matrice Cross-Framework' })}</h3>
  <p className="text-sm text-muted-foreground">
  {t('compliance.crossFrameworkMatrixDesc', { defaultValue: 'Vue d\'ensemble des mappings checks-frameworks' })}
  </p>
  </div>
  <Tooltip content={t('compliance.crossFrameworkMatrixTooltip', { defaultValue: 'Cette matrice montre comment chaque check agent se mappe aux différents référentiels de conformité.' })}>
  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
  </Tooltip>
 </div>

 {/* Stats bar */}
 <div className="flex items-center gap-6 text-sm">
  <div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-success" />
  <span className="text-muted-foreground">{t('compliance.statusVerified', { defaultValue: 'Vérifié' })}:</span>
  <span className="font-medium">{stats.verified}</span>
  </div>
  <div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-warning" />
  <span className="text-muted-foreground">{t('compliance.statusPartial', { defaultValue: 'Partiel' })}:</span>
  <span className="font-medium">{stats.partial}</span>
  </div>
  <div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-muted" />
  <span className="text-muted-foreground">{t('compliance.statusMissing', { defaultValue: 'Manquant' })}:</span>
  <span className="font-medium">{stats.missing}</span>
  </div>
 </div>
 </div>

 {/* Filters */}
 <div className="p-4 border-b border-border/30 bg-muted/20">
 <div className="flex items-center gap-4">
  <div className="flex items-center gap-2">
  <Filter className="h-4 w-4 text-muted-foreground" />
  <span className="text-sm text-muted-foreground">{t('compliance.filters', { defaultValue: 'Filtres' })}:</span>
  </div>
  <div className="flex gap-1">
  {(['all', 'verified', 'partial', 'missing'] as const).map(status => (
  <Button
  key={status || 'unknown'}
  variant={filterStatus === status ? 'default' : 'ghost'}
  size="sm"
  onClick={() => setFilterStatus(status)}
  className="h-7 px-2 text-xs"
  >
  {status === 'all' ? t('compliance.filterAll', { defaultValue: 'Tous' }) :
   status === 'verified' ? t('compliance.statusVerified', { defaultValue: 'Vérifié' }) :
   status === 'partial' ? t('compliance.statusPartial', { defaultValue: 'Partiel' }) : t('compliance.statusMissing', { defaultValue: 'Manquant' })}
  </Button>
  ))}
  </div>
  <div className="w-px h-6 bg-border" />
  <div className="flex gap-1">
  <Button
  variant={filterCategory === 'all' ? 'default' : 'ghost'}
  size="sm"
  onClick={() => setFilterCategory('all')}
  className="h-7 px-2 text-xs"
  >
  {t('compliance.allCategories', { defaultValue: 'Toutes catégories' })}
  </Button>
  {categories.map(cat => {
  const config = CATEGORY_CONFIG[cat];
  return (
  <Button
   key={cat || 'unknown'}
   variant={filterCategory === cat ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setFilterCategory(cat)}
   className="h-7 px-2 text-xs gap-1"
  >
   {config?.icon}
   {getCategoryLabelForFilter(cat)}
  </Button>
  );
  })}
  </div>
 </div>
 </div>

 {/* Matrix header */}
 <div className="p-4 border-b border-border/30">
 <div className="flex items-center gap-2">
  <div className="min-w-[200px] flex-shrink-0" />
  <div className="w-20 flex-shrink-0 text-xs font-medium text-muted-foreground text-center">
  {t('compliance.status', { defaultValue: 'Statut' })}
  </div>
  <div className="flex items-center gap-1 flex-1 justify-center">
  {frameworkCodes.map(code => (
  <div
  key={code || 'unknown'}
  className="w-8 text-center"
  >
  <Tooltip content={FRAMEWORK_ABBREV[code]}>
   <span className="text-xs font-medium text-muted-foreground">
   {code.slice(0, 3)}
   </span>
  </Tooltip>
  </div>
  ))}
  </div>
 </div>
 </div>

 {/* Matrix body */}
 <div className="p-4">
 {filteredEntries.length === 0 ? (
  <div className="text-center py-8">
  <p className="text-sm text-muted-foreground">
  {t('compliance.noChecksMatchFilters', { defaultValue: 'Aucun check ne correspond aux filtres sélectionnés.' })}
  </p>
  </div>
 ) : (
  <motion.div
  variants={staggerContainerVariants}
  initial="initial"
  animate="visible"
  className="space-y-1"
  >
  {filteredEntries.map(entry => (
  <CheckRow
  key={entry.checkId || 'unknown'}
  entry={entry}
  frameworkCodes={frameworkCodes}
  isExpanded={expandedCheckIds.has(entry.checkId)}
  onToggleExpand={() => toggleExpand(entry.checkId)}
  onCellClick={(code) => onCellClick?.(entry.checkId, code)}
  t={t}
  />
  ))}
  </motion.div>
 )}
 </div>

 {/* Legend */}
 <div className="p-4 border-t border-border/30 bg-muted/10">
 <div className="flex items-center gap-6 text-xs text-muted-foreground">
  <span className="font-medium">{t('compliance.legend', { defaultValue: 'Légende' })}:</span>
  <div className="flex items-center gap-1">
  <div className="w-5 h-5 rounded bg-success/10 flex items-center justify-center">
  <Check className="h-3 w-3 text-success" />
  </div>
  <span>{t('compliance.compliant', { defaultValue: 'Conforme' })}</span>
  </div>
  <div className="flex items-center gap-1">
  <div className="w-5 h-5 rounded bg-destructive/10 flex items-center justify-center">
  <X className="h-3 w-3 text-destructive" />
  </div>
  <span>{t('compliance.nonCompliant', { defaultValue: 'Non conforme' })}</span>
  </div>
  <div className="flex items-center gap-1">
  <div className="w-5 h-5 rounded bg-warning/10 flex items-center justify-center">
  <AlertTriangle className="h-3 w-3 text-warning" />
  </div>
  <span>{t('compliance.mixed', { defaultValue: 'Mixte' })}</span>
  </div>
  <div className="flex items-center gap-1">
  <div className="w-5 h-5 rounded bg-muted/20 flex items-center justify-center">
  <Minus className="h-3 w-3 text-muted-foreground" />
  </div>
  <span>{t('compliance.noEvidence', { defaultValue: 'Pas de preuve' })}</span>
  </div>
  <div className="flex items-center gap-1">
  <div className="w-5 h-5 rounded bg-success/10 border border-dashed border-success/30 flex items-center justify-center">
  <Check className="h-3 w-3 text-success" />
  </div>
  <span>{t('compliance.partialCoverage', { defaultValue: 'Couverture partielle' })}</span>
  </div>
 </div>
 </div>
 </Card>
 );
};

export default CrossFrameworkMatrix;
