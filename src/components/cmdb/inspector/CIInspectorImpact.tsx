/**
 * CI Inspector Impact Tab
 *
 * Impact analysis visualization for a Configuration Item.
 * Shows blast radius, affected services, and dependency chains.
 *
 * @module components/cmdb/inspector/CIInspectorImpact
 */

import React, { useState, useMemo } from 'react';
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  Server,
  Database,
  Globe,
  Cloud,
  FileText,
  Network,
  Box,
  Loader2,
  RefreshCw,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  Target,
  Activity,
} from '../../ui/Icons';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Label } from '../../ui/label';
import { Slider } from '../../ui/slider';
import { useStore } from '@/store';
import {
  ConfigurationItem,
  CIClass,
  ImpactScenario,
  ImpactLevel,
  ImpactAssessment,
  ImpactNode,
  AffectedService,
} from '@/types/cmdb';
import { useImpactAnalysis } from '@/hooks/cmdb/useImpactAnalysis';
import { cn } from '@/lib/utils';

// =============================================================================
// PROPS
// =============================================================================

interface CIInspectorImpactProps {
  /** Current CI */
  ci: ConfigurationItem;
}

// =============================================================================
// HELPERS
// =============================================================================

const getCIClassIcon = (ciClass: CIClass | undefined): React.ElementType => {
  switch (ciClass) {
    case 'Hardware': return Server;
    case 'Software': return Database;
    case 'Service': return Globe;
    case 'Cloud': return Cloud;
    case 'Document': return FileText;
    case 'Network': return Network;
    case 'Container': return Box;
    default: return Server;
  }
};

const getImpactColor = (level: ImpactLevel): string => {
  switch (level) {
    case 'Critical': return 'bg-destructive text-destructive-foreground';
    case 'High': return 'bg-orange-500 text-white';
    case 'Medium': return 'bg-warning text-warning-foreground';
    case 'Low': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getImpactBorderColor = (level: ImpactLevel): string => {
  switch (level) {
    case 'Critical': return 'border-destructive/50';
    case 'High': return 'border-orange-500/50';
    case 'Medium': return 'border-warning/50';
    case 'Low': return 'border-border';
    default: return 'border-border';
  }
};

const getScenarioLabel = (scenario: ImpactScenario): string => {
  switch (scenario) {
    case 'down': return 'Panne';
    case 'maintenance': return 'Maintenance';
    case 'decommission': return 'Décommissionnement';
    default: return scenario;
  }
};

// =============================================================================
// IMPACT SUMMARY CARD
// =============================================================================

interface ImpactSummaryCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'destructive' | 'warning' | 'success' | 'info' | 'muted';
  suffix?: string;
}

const ImpactSummaryCard: React.FC<ImpactSummaryCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  suffix,
}) => {
  const colorClasses = {
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    info: 'bg-primary/10 text-primary',
    muted: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-xl', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">
            {value}{suffix}
          </p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// AFFECTED CI ROW
// =============================================================================

interface AffectedCIRowProps {
  node: ImpactNode;
  expanded: boolean;
  onToggle: () => void;
}

const AffectedCIRow: React.FC<AffectedCIRowProps> = ({ node, expanded, onToggle }) => {
  const Icon = getCIClassIcon(node.ci.ciClass);

  return (
    <div className={cn(
      'border rounded-xl transition-all',
      getImpactBorderColor(node.impactLevel)
    )}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors rounded-xl"
      >
        {/* Expand indicator */}
        {node.path.length > 1 ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}

        {/* CI Icon */}
        <div className="p-2 rounded-lg bg-muted/50 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* CI Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{node.ci.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{node.ci.ciClass}</span>
            <span>•</span>
            <span>{node.ci.environment}</span>
          </div>
        </div>

        {/* Hop distance */}
        <Badge variant="outline" className="shrink-0">
          {node.hop} hop{node.hop > 1 ? 's' : ''}
        </Badge>

        {/* Impact level */}
        <Badge className={cn('shrink-0', getImpactColor(node.impactLevel))}>
          {node.impactLevel}
        </Badge>
      </button>

      {/* Expanded path */}
      {expanded && node.path.length > 1 && (
        <div className="px-4 pb-4 pt-0">
          <div className="pl-8 border-l-2 border-dashed border-border/40 ml-2 py-2">
            <p className="text-xs text-muted-foreground">
              Chemin: {node.path.join(' → ')}
            </p>
            {node.relationship && (
              <p className="text-xs text-muted-foreground mt-1">
                Relation: {node.relationship.relationshipType}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// AFFECTED SERVICES
// =============================================================================

interface AffectedServicesProps {
  services: AffectedService[];
}

const AffectedServices: React.FC<AffectedServicesProps> = ({ services }) => {
  const { t } = useStore();

  if (services.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
        <p className="text-sm">
          {t('cmdb.impact.noServicesAffected', { defaultValue: 'Aucun service affecté' })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {services.map((svc) => (
        <div
          key={svc.service.id}
          className="flex items-center gap-3 p-4 bg-orange-500/5 rounded-xl border border-orange-500/20"
        >
          <Globe className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{svc.service.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{svc.criticality}</span>
              {svc.estimatedUsers && (
                <>
                  <span>•</span>
                  <Users className="h-3 w-3" />
                  <span>{svc.estimatedUsers} utilisateurs</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">
            {svc.hopDistance} hop{svc.hopDistance > 1 ? 's' : ''}
          </Badge>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// BLAST RADIUS VISUALIZATION
// =============================================================================

interface BlastRadiusProps {
  center: ConfigurationItem;
  directCount: number;
  indirectCount: number;
}

const BlastRadius: React.FC<BlastRadiusProps> = ({ center, directCount, indirectCount }) => {
  const CenterIcon = getCIClassIcon(center.ciClass);

  return (
    <div className="relative flex items-center justify-center py-8">
      {/* Outer ring (indirect) */}
      {indirectCount > 0 && (
        <div className="absolute w-48 h-48 rounded-full border-2 border-dashed border-warning/30 animate-pulse" />
      )}

      {/* Inner ring (direct) */}
      {directCount > 0 && (
        <div className="absolute w-32 h-32 rounded-full border-2 border-destructive/40" />
      )}

      {/* Center CI */}
      <div className="relative z-10 p-4 bg-destructive/10 rounded-full border-2 border-destructive">
        <CenterIcon className="h-8 w-8 text-destructive" />
      </div>

      {/* Labels */}
      {directCount > 0 && (
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-destructive/40" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Direct: {directCount}
            </span>
          </div>
        </div>
      )}

      {indirectCount > 0 && (
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-full">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Indirect: {indirectCount}
            </span>
            <div className="w-8 h-0.5 bg-warning/40" />
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const CIInspectorImpact: React.FC<CIInspectorImpactProps> = ({ ci }) => {
  const { t } = useStore();

  // Analysis parameters
  const [scenario, setScenario] = useState<ImpactScenario>('down');
  const [depth, setDepth] = useState(3);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Fetch impact analysis
  const { data: assessment, isLoading, error, refetch } = useImpactAnalysis(
    ci.id,
    scenario,
    depth
  );

  // Toggle node expansion
  const toggleNode = (ciId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(ciId)) {
        next.delete(ciId);
      } else {
        next.add(ciId);
      }
      return next;
    });
  };

  // All affected nodes
  const allNodes = useMemo(() => {
    if (!assessment) return [];
    return [...assessment.directImpact, ...assessment.indirectImpact];
  }, [assessment]);

  return (
    <div className="space-y-8">
      {/* Analysis Controls */}
      <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
          <Target className="h-4 w-4" />
          {t('cmdb.impact.parameters', { defaultValue: 'Paramètres d\'Analyse' })}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scenario */}
          <div className="space-y-2">
            <Label>{t('cmdb.impact.scenario', { defaultValue: 'Scénario' })}</Label>
            <Select value={scenario} onValueChange={(v) => setScenario(v as ImpactScenario)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="down">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Panne
                  </div>
                </SelectItem>
                <SelectItem value="maintenance">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Maintenance
                  </div>
                </SelectItem>
                <SelectItem value="decommission">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Décommissionnement
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Depth */}
          <div className="space-y-2">
            <Label>{t('cmdb.impact.depth', { defaultValue: 'Profondeur' })}: {depth}</Label>
            <Slider
              value={[depth]}
              onValueChange={([v]) => setDepth(v)}
              min={1}
              max={5}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              {depth} niveau{depth > 1 ? 'x' : ''} de dépendances
            </p>
          </div>

          {/* Refresh */}
          <div className="flex items-end">
            <Button onClick={() => refetch()} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('cmdb.impact.analyze', { defaultValue: 'Analyser' })}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-sm text-destructive">
            {t('cmdb.impact.error', { defaultValue: 'Erreur lors de l\'analyse' })}
          </p>
        </div>
      )}

      {/* Results */}
      {assessment && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ImpactSummaryCard
              title={t('cmdb.impact.totalAffected', { defaultValue: 'CIs Affectés' })}
              value={assessment.summary.totalAffectedCIs}
              icon={Server}
              color={assessment.summary.totalAffectedCIs > 0 ? 'destructive' : 'success'}
            />
            <ImpactSummaryCard
              title={t('cmdb.impact.critical', { defaultValue: 'Critiques' })}
              value={assessment.summary.criticalCount}
              icon={AlertTriangle}
              color={assessment.summary.criticalCount > 0 ? 'destructive' : 'muted'}
            />
            <ImpactSummaryCard
              title={t('cmdb.impact.users', { defaultValue: 'Utilisateurs' })}
              value={assessment.summary.estimatedAffectedUsers}
              icon={Users}
              color={assessment.summary.estimatedAffectedUsers > 0 ? 'warning' : 'muted'}
            />
            <ImpactSummaryCard
              title={t('cmdb.impact.downtime', { defaultValue: 'Indisponibilité' })}
              value={assessment.summary.estimatedDowntimeMinutes || 0}
              icon={Clock}
              color={assessment.summary.estimatedDowntimeMinutes ? 'warning' : 'muted'}
              suffix=" min"
            />
          </div>

          {/* Blast Radius Visualization */}
          <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {t('cmdb.impact.blastRadius', { defaultValue: 'Rayon d\'Impact' })}
            </h3>
            <BlastRadius
              center={ci}
              directCount={assessment.directImpact.length}
              indirectCount={assessment.indirectImpact.length}
            />
          </div>

          {/* Affected Services */}
          {assessment.affectedServices.length > 0 && (
            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('cmdb.impact.affectedServices', { defaultValue: 'Services Affectés' })}
                <Badge variant="secondary" className="ml-2">
                  {assessment.affectedServices.length}
                </Badge>
              </h3>
              <AffectedServices services={assessment.affectedServices} />
            </div>
          )}

          {/* Affected CIs List */}
          {allNodes.length > 0 && (
            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <Server className="h-4 w-4" />
                {t('cmdb.impact.affectedCIs', { defaultValue: 'CIs Impactés' })}
                <Badge variant="secondary" className="ml-2">{allNodes.length}</Badge>
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allNodes.map((node) => (
                  <AffectedCIRow
                    key={node.ciId}
                    node={node}
                    expanded={expandedNodes.has(node.ciId)}
                    onToggle={() => toggleNode(node.ciId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No impact */}
          {assessment.summary.totalAffectedCIs === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-success/10 mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <p className="font-medium">
                {t('cmdb.impact.noImpact', { defaultValue: 'Aucun impact détecté' })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('cmdb.impact.noImpactDescription', {
                  defaultValue: 'Ce CI n\'a pas de dépendances critiques',
                })}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CIInspectorImpact;
