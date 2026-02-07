import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Shield,
  ShieldAlert,
  ExternalLink,
  Bell,
  BellOff,
  Activity,
  Target,
  Search,
  BookOpen,
  Users,
  FileText,
  AlertCircle,
} from '../components/ui/Icons';
import { PageHeader } from '../components/ui/PageHeader';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { SmartSummary, SmartInsight } from '../components/ui/SmartSummary';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { useAuth } from '../hooks/useAuth';
import { useRegulatoryChanges } from '../hooks/useRegulatoryChanges';
import { usePersistedState } from '../hooks/usePersistedState';
import { cn } from '../lib/utils';
import type { RegulatoryChange, RegulatoryAlert, RegulatoryAction } from '../types/regulatoryChange';

type RegTab = 'changes' | 'impact' | 'actions' | 'alerts';

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------
const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-info-bg text-info-text border-info-border',
  informational: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
  informational: 'Info',
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-semibold border',
      SEVERITY_STYLES[severity] || SEVERITY_STYLES.informational
    )}
  >
    {SEVERITY_LABELS[severity] || severity}
  </span>
);

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  'identified': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  'analyzing': 'bg-info-bg text-info-text border-info-border',
  'action-required': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'implementing': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  'compliant': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  'not-applicable': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  'identified': 'Identifie',
  'analyzing': 'En analyse',
  'action-required': 'Action requise',
  'implementing': 'En cours',
  'compliant': 'Conforme',
  'not-applicable': 'Non applicable',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-semibold border',
      STATUS_STYLES[status] || STATUS_STYLES['identified']
    )}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

// ---------------------------------------------------------------------------
// Category label
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {
  'new-regulation': 'Nouvelle reglementation',
  'amendment': 'Amendement',
  'guidance': 'Guide / Recommandation',
  'enforcement': 'Action coercitive',
  'standard-update': 'Mise a jour de norme',
};

// ---------------------------------------------------------------------------
// Action status
// ---------------------------------------------------------------------------
const ACTION_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  'in-progress': 'bg-info-bg text-info-text border-info-border',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  'in-progress': 'En cours',
  completed: 'Termine',
  overdue: 'En retard',
  cancelled: 'Annule',
};

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------
const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  low: 'bg-info-bg text-info-text border-info-border',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------
const TableSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={`skeleton-${i}`} className="h-16 rounded-xl bg-muted/20 animate-pulse border border-border/40" />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
const EmptyState: React.FC<{ title: string; description: string; icon: React.ReactNode }> = ({
  title,
  description,
  icon,
}) => (
  <motion.div
    variants={slideUpVariants}
    initial="initial"
    animate="visible"
    className="flex flex-col items-center justify-center py-16 text-center"
  >
    <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-md">{description}</p>
  </motion.div>
);

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const isOverdue = (dateStr: string | undefined): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
};

// ---------------------------------------------------------------------------
// Changes table
// ---------------------------------------------------------------------------
const ChangesTab: React.FC<{
  changes: RegulatoryChange[];
  searchQuery: string;
  filterSeverity: string;
  filterStatus: string;
}> = ({ changes, searchQuery, filterSeverity, filterStatus }) => {
  const filtered = useMemo(() => {
    let result = changes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.regulation.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }
    if (filterSeverity !== 'all') {
      result = result.filter((c) => c.severity === filterSeverity);
    }
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
    }
    return result;
  }, [changes, searchQuery, filterSeverity, filterStatus]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Aucun changement reglementaire"
        description="Les changements reglementaires identifies apparaitront ici. Ajoutez votre premier changement pour commencer le suivi."
        icon={<Scale className="w-8 h-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((change) => (
        <motion.div
          key={change.id}
          variants={slideUpVariants}
          initial="initial"
          animate="visible"
          className="glass-premium border border-border/40 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 group"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground truncate">{change.title}</h3>
                {change.sourceUrl && (
                  <a
                    href={change.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors shrink-0"
                    aria-label="Voir la source"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{change.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {change.regulation}
                </span>
                <SeverityBadge severity={change.severity} />
                <StatusBadge status={change.status} />
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[change.category] || change.category}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-xs font-medium text-foreground">{change.source}</p>
              <p className="text-xs text-muted-foreground mt-2">Date effective</p>
              <p
                className={cn(
                  'text-xs font-medium',
                  isOverdue(change.effectiveDate) && change.status !== 'compliant' && change.status !== 'not-applicable'
                    ? 'text-red-500'
                    : 'text-foreground'
                )}
              >
                {formatDate(change.effectiveDate)}
              </p>
            </div>
          </div>
          {change.requiredActions && change.requiredActions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground mb-1">
                {change.requiredActions.length} action(s) requise(s) -{' '}
                {change.requiredActions.filter((a) => a.status === 'completed').length} terminee(s)
              </p>
              <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      change.requiredActions.length > 0
                        ? (change.requiredActions.filter((a) => a.status === 'completed').length /
                            change.requiredActions.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
          {change.tags && change.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {change.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-xl text-xs bg-muted/30 text-muted-foreground border border-border/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Impact tab
// ---------------------------------------------------------------------------
const ImpactTab: React.FC<{ changes: RegulatoryChange[] }> = ({ changes }) => {
  const changesWithImpact = changes.filter((c) => c.impactAssessment);

  if (changesWithImpact.length === 0) {
    return (
      <EmptyState
        title="Aucune evaluation d'impact"
        description="Les evaluations d'impact des changements reglementaires seront affichees ici une fois renseignees."
        icon={<Target className="w-8 h-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {changesWithImpact.map((change) => {
        const impact = change.impactAssessment!;
        return (
          <motion.div
            key={change.id}
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            className="glass-premium border border-border/40 rounded-2xl p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{change.title}</h3>
                <p className="text-xs text-muted-foreground">{change.regulation} - {change.source}</p>
              </div>
              <SeverityBadge severity={impact.businessImpact === 'none' ? 'informational' : impact.businessImpact} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Impact metier</p>
                <p className="text-sm font-semibold text-foreground capitalize">{impact.businessImpact}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Effort estime</p>
                <p className="text-sm font-semibold text-foreground capitalize">{impact.effortEstimate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Echeance</p>
                <p className={cn(
                  'text-sm font-semibold',
                  isOverdue(impact.deadline) ? 'text-red-500' : 'text-foreground'
                )}>
                  {formatDate(impact.deadline)}
                </p>
              </div>
              {impact.costEstimate !== undefined && impact.costEstimate > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Cout estime</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(impact.costEstimate)}
                  </p>
                </div>
              )}
            </div>

            {impact.complianceGap && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Ecart de conformite</p>
                <p className="text-sm text-foreground">{impact.complianceGap}</p>
              </div>
            )}

            {impact.riskIfNonCompliant && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Risque de non-conformite</p>
                <p className="text-sm text-foreground">{impact.riskIfNonCompliant}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {impact.affectedDepartments && impact.affectedDepartments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Departements concernes</p>
                  <div className="flex flex-wrap gap-1">
                    {impact.affectedDepartments.map((dept) => (
                      <span key={dept} className="px-2 py-0.5 rounded-xl text-xs bg-muted/30 text-muted-foreground border border-border/30">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {impact.affectedProcesses && impact.affectedProcesses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Processus impactes</p>
                  <div className="flex flex-wrap gap-1">
                    {impact.affectedProcesses.map((proc) => (
                      <span key={proc} className="px-2 py-0.5 rounded-xl text-xs bg-muted/30 text-muted-foreground border border-border/30">
                        {proc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Actions tab
// ---------------------------------------------------------------------------
const ActionsTab: React.FC<{ changes: RegulatoryChange[] }> = ({ changes }) => {
  const allActions = useMemo(() => {
    const actions: Array<RegulatoryAction & { changeTitle: string; regulation: string }> = [];
    for (const change of changes) {
      if (change.requiredActions) {
        for (const action of change.requiredActions) {
          actions.push({
            ...action,
            changeTitle: change.title,
            regulation: change.regulation,
          });
        }
      }
    }
    return actions.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    });
  }, [changes]);

  if (allActions.length === 0) {
    return (
      <EmptyState
        title="Aucune action requise"
        description="Les actions necessaires pour se conformer aux changements reglementaires seront listees ici."
        icon={<CheckCircle className="w-8 h-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {allActions.map((action) => (
        <motion.div
          key={action.id}
          variants={slideUpVariants}
          initial="initial"
          animate="visible"
          className={cn(
            'glass-premium border rounded-2xl p-4 transition-all duration-300',
            action.status === 'overdue' || (isOverdue(action.dueDate) && action.status !== 'completed' && action.status !== 'cancelled')
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-border/40'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground truncate">{action.title}</h4>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-semibold border',
                    PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.medium
                  )}
                >
                  {PRIORITY_LABELS[action.priority] || action.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{action.description}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  {action.regulation}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {action.changeTitle}
                </span>
                {action.assigneeName && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {action.assigneeName}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0 space-y-2">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-semibold border',
                  ACTION_STATUS_STYLES[action.status] || ACTION_STATUS_STYLES.pending
                )}
              >
                {ACTION_STATUS_LABELS[action.status] || action.status}
              </span>
              <p
                className={cn(
                  'text-xs font-medium',
                  isOverdue(action.dueDate) && action.status !== 'completed' && action.status !== 'cancelled'
                    ? 'text-red-500'
                    : 'text-muted-foreground'
                )}
              >
                {formatDate(action.dueDate)}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Alerts tab
// ---------------------------------------------------------------------------
const AlertsTab: React.FC<{
  alerts: RegulatoryAlert[];
  onMarkRead: (id: string) => void;
}> = ({ alerts, onMarkRead }) => {
  if (alerts.length === 0) {
    return (
      <EmptyState
        title="Aucune alerte"
        description="Les alertes reglementaires (nouvelles reglementations, echeances, actions coercitives) apparaitront ici."
        icon={<Bell className="w-8 h-8 text-muted-foreground" />}
      />
    );
  }

  const ALERT_TYPE_ICONS: Record<string, React.ReactNode> = {
    'new-regulation': <BookOpen className="w-4 h-4" />,
    'deadline-approaching': <Clock className="w-4 h-4" />,
    'enforcement-action': <ShieldAlert className="w-4 h-4" />,
    'standard-update': <FileText className="w-4 h-4" />,
  };

  const ALERT_TYPE_LABELS: Record<string, string> = {
    'new-regulation': 'Nouvelle reglementation',
    'deadline-approaching': 'Echeance proche',
    'enforcement-action': 'Action coercitive',
    'standard-update': 'Mise a jour norme',
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          variants={slideUpVariants}
          initial="initial"
          animate="visible"
          className={cn(
            'glass-premium border rounded-2xl p-4 transition-all duration-300',
            alert.read ? 'border-border/40 opacity-70' : 'border-primary/30'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={cn(
                  'p-2 rounded-xl shrink-0',
                  SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low
                )}
              >
                {ALERT_TYPE_ICONS[alert.type] || <Bell className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground truncate">{alert.title}</h4>
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {ALERT_TYPE_LABELS[alert.type] || alert.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{formatDate(alert.createdAt)}</p>
              </div>
            </div>
            {!alert.read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                aria-label="Marquer comme lue"
              >
                <BellOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Timeline view
// ---------------------------------------------------------------------------
const TimelineView: React.FC<{ changes: RegulatoryChange[] }> = ({ changes }) => {
  const sorted = useMemo(() => {
    return [...changes].sort(
      (a, b) => new Date(b.effectiveDate || b.publicationDate).getTime() - new Date(a.effectiveDate || a.publicationDate).getTime()
    );
  }, [changes]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Aucun changement a afficher"
        description="La chronologie des changements reglementaires apparaitra ici."
        icon={<Calendar className="w-8 h-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border/40" />

      {sorted.map((change) => (
        <motion.div
          key={change.id}
          variants={slideUpVariants}
          initial="initial"
          animate="visible"
          className="relative mb-6 last:mb-0"
        >
          {/* Timeline dot */}
          <div
            className={cn(
              'absolute -left-5 w-3 h-3 rounded-full border-2 border-background',
              change.severity === 'critical'
                ? 'bg-red-500'
                : change.severity === 'high'
                ? 'bg-orange-500'
                : change.severity === 'medium'
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            )}
          />

          <div className="glass-premium border border-border/40 rounded-2xl p-4 ml-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                {formatDate(change.effectiveDate || change.publicationDate)}
              </span>
              <SeverityBadge severity={change.severity} />
              <StatusBadge status={change.status} />
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-1">{change.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{change.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {change.regulation}
              </span>
              <span className="text-xs text-muted-foreground">{change.source}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ===========================================================================
// Main component
// ===========================================================================
export const RegulatoryChanges: React.FC = () => {
  const { user } = useAuth();

  // RBAC: Only admin/rssi can manage regulatory changes
  const canManageRegulatory = user?.role === 'admin' || user?.role === 'rssi' || user?.role === 'super_admin';

  const { changes, alerts, stats, loading, error, markAlertRead } = useRegulatoryChanges();

  // UI state
  const [activeTab, setActiveTab] = usePersistedState<RegTab>('regulatory-active-tab', 'changes');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = usePersistedState<'list' | 'timeline'>('regulatory-view-mode', 'list');

  // Unread alerts count
  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  // Smart insights
  const insights = useMemo<SmartInsight[]>(() => {
    if (loading) return [];
    return [
      {
        label: 'Total Changements',
        value: stats.total,
        icon: <Scale className="w-5 h-5" />,
        variant: 'primary',
      },
      {
        label: 'Actions Requises',
        value: stats.actionRequired,
        subValue: stats.overdueActions > 0 ? `${stats.overdueActions} en retard` : 'Tout est a jour',
        icon: <AlertTriangle className="w-5 h-5" />,
        variant: stats.actionRequired > 0 ? 'destructive' : 'success',
      },
      {
        label: 'Echeances Proches',
        value: stats.upcomingDeadlines,
        subValue: 'Dans les 30 prochains jours',
        icon: <Calendar className="w-5 h-5" />,
        variant: stats.upcomingDeadlines > 0 ? 'warning' : 'secondary',
      },
      {
        label: 'Taux de Conformite',
        value: `${stats.complianceRate}%`,
        subValue: 'Changements en conformite',
        icon: <Shield className="w-5 h-5" />,
        variant: stats.complianceRate >= 80 ? 'success' : stats.complianceRate >= 50 ? 'warning' : 'destructive',
      },
    ];
  }, [stats, loading]);

  // Tabs definition
  const tabs = useMemo(
    () => [
      { id: 'changes', label: 'Changements', icon: Scale },
      { id: 'impact', label: 'Impact', icon: Target },
      { id: 'actions', label: 'Actions', icon: CheckCircle, count: stats.overdueActions > 0 ? stats.overdueActions : undefined },
      { id: 'alerts', label: 'Alertes', icon: Bell, count: unreadAlerts > 0 ? unreadAlerts : undefined },
    ],
    [stats.overdueActions, unreadAlerts]
  );

  // Error state
  if (error) {
    return (
      <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
        <PageHeader title="Veille Reglementaire" subtitle="Suivi des changements reglementaires et de leur impact" icon={<Scale className="text-primary" />} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Erreur de chargement</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Impossible de charger les donnees reglementaires. Verifiez votre connexion et reessayez.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
      <PageHeader
        title="Veille Reglementaire"
        subtitle="Suivi des changements reglementaires et de leur impact sur l'organisation"
        icon={<Scale className="text-primary" />}
      />

      {/* Smart Summary */}
      <SmartSummary insights={insights} loading={loading} />

      {/* Tabs */}
      <ScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as RegTab)}
        isChanging={loading}
      />

      {/* Search & Filters - only for changes tab */}
      {activeTab === 'changes' && (
        <motion.div variants={slideUpVariants} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              aria-label="Rechercher un changement"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un changement..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Filtrer par severite"
            >
              <option value="all">Toutes severites</option>
              <option value="critical">Critique</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
              <option value="informational">Info</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Filtrer par statut"
            >
              <option value="all">Tous statuts</option>
              <option value="identified">Identifie</option>
              <option value="analyzing">En analyse</option>
              <option value="action-required">Action requise</option>
              <option value="implementing">En cours</option>
              <option value="compliant">Conforme</option>
              <option value="not-applicable">Non applicable</option>
            </select>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}
              className={cn(
                'p-2 rounded-xl border border-border text-sm transition-colors',
                'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
              )}
              aria-label={viewMode === 'list' ? 'Vue chronologique' : 'Vue liste'}
            >
              {viewMode === 'list' ? (
                <Calendar className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Activity className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab content */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={slideUpVariants} initial="initial" animate="visible" exit="exit">
            {activeTab === 'changes' && (
              viewMode === 'list' ? (
                <ChangesTab
                  changes={changes}
                  searchQuery={searchQuery}
                  filterSeverity={filterSeverity}
                  filterStatus={filterStatus}
                />
              ) : (
                <TimelineView changes={changes} />
              )
            )}
            {activeTab === 'impact' && <ImpactTab changes={changes} />}
            {activeTab === 'actions' && <ActionsTab changes={changes} />}
            {activeTab === 'alerts' && <AlertsTab alerts={alerts} onMarkRead={markAlertRead} />}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
};
