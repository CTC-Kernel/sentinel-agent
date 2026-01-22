/**
 * VoxelDetailPanel - Slide-in detail panel for selected nodes
 *
 * Shows full information about a selected entity including
 * type-specific details, connections, and quick actions.
 *
 * @see Story VOX-4.6: Click Detail Panel
 * @see Story VOX-7.1: Asset Details Display
 * @see Story VOX-7.2: Risk Details Display
 * @see Story VOX-7.3: Control Details Display
 * @see Story VOX-7.4: Linked Entities Display
 * @see Story VOX-7.5: Navigation to Full Page
 * @see Architecture: architecture-voxel-module-2026-01-22.md
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import {
  X,
  ExternalLink,
  Link2,
  Calendar,
  Shield,
  AlertTriangle,
  Server,
  ClipboardCheck,
  FolderKanban,
  Flame,
  Building2,
  User,
  MapPin,
  Target,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { VoxelNode, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelDetailPanelProps {
  /** Node data to display */
  node: VoxelNode | null;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Navigate to entity detail page */
  onNavigate?: (node: VoxelNode) => void;
  /** Number of connected edges */
  connectionCount?: number;
  /** Callback when a linked entity is clicked */
  onSelectLinkedEntity?: (nodeId: string) => void;
  /** Map of all nodes for resolving linked entities */
  nodesMap?: Map<string, VoxelNode>;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_CONFIG: Record<VoxelNodeType, { icon: React.ReactNode; label: string; color: string }> = {
  asset: {
    icon: <Server className="w-4 h-4" />,
    label: 'Asset',
    color: '#3B82F6',
  },
  risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Risk',
    color: '#EF4444',
  },
  control: {
    icon: <Shield className="w-4 h-4" />,
    label: 'Control',
    color: '#8B5CF6',
  },
  audit: {
    icon: <ClipboardCheck className="w-4 h-4" />,
    label: 'Audit',
    color: '#F59E0B',
  },
  project: {
    icon: <FolderKanban className="w-4 h-4" />,
    label: 'Project',
    color: '#10B981',
  },
  incident: {
    icon: <Flame className="w-4 h-4" />,
    label: 'Incident',
    color: '#F97316',
  },
  supplier: {
    icon: <Building2 className="w-4 h-4" />,
    label: 'Supplier',
    color: '#6366F1',
  },
};

const STATUS_CONFIG: Record<VoxelNodeStatus, { label: string; color: string }> = {
  normal: { label: 'Normal', color: '#22C55E' },
  warning: { label: 'Warning', color: '#F59E0B' },
  inactive: { label: 'Inactive', color: '#64748B' },
  critical: { label: 'Critical', color: '#EF4444' },
};

// ============================================================================
// Helper Components
// ============================================================================

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex justify-between items-start py-2 border-b border-slate-700/50 last:border-0">
    <span className="text-slate-400 text-sm">{label}</span>
    <span className="text-slate-200 text-sm text-right max-w-[60%]">{value}</span>
  </div>
);

// ============================================================================
// Criticality Badge Component
// ============================================================================

interface CriticalityBadgeProps {
  level: string;
}

const CRITICALITY_COLORS: Record<string, string> = {
  Critique: '#EF4444',
  Élevée: '#F97316',
  Moyenne: '#F59E0B',
  Faible: '#22C55E',
};

const CriticalityBadge: React.FC<CriticalityBadgeProps> = ({ level }) => {
  const color = CRITICALITY_COLORS[level] || '#64748B';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${color}20`, color }}
    >
      {level}
    </span>
  );
};

// ============================================================================
// Risk Score Indicator
// ============================================================================

interface RiskScoreIndicatorProps {
  probability: number;
  impact: number;
  score: number;
}

const RiskScoreIndicator: React.FC<RiskScoreIndicatorProps> = ({
  probability,
  impact,
  score,
}) => {
  const getScoreColor = (s: number) => {
    if (s >= 20) return '#EF4444';
    if (s >= 12) return '#F97316';
    if (s >= 6) return '#F59E0B';
    return '#22C55E';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">Risk Score</span>
        <span
          className="text-lg font-bold"
          style={{ color: getScoreColor(score) }}
        >
          {score}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-700/30 rounded p-2">
          <div className="text-xs text-slate-500">Probability</div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{
                  background: i <= probability ? '#F59E0B' : '#334155',
                }}
              />
            ))}
          </div>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <div className="text-xs text-slate-500">Impact</div>
          <div className="flex items-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{
                  background: i <= impact ? '#EF4444' : '#334155',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Linked Entity Item
// ============================================================================

interface LinkedEntityItemProps {
  node: VoxelNode;
  onClick: () => void;
}

const LinkedEntityItem: React.FC<LinkedEntityItemProps> = ({ node, onClick }) => {
  const typeConfig = TYPE_CONFIG[node.type];
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-left group"
    >
      <div
        className="p-1 rounded"
        style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}
      >
        {typeConfig.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 truncate">{node.label}</div>
        <div className="text-xs text-slate-500">{typeConfig.label}</div>
      </div>
      <div
        className="w-2 h-2 rounded-full"
        style={{ background: statusConfig.color }}
      />
      <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely get a string value from node data
 */
const getDataString = (data: Record<string, unknown>, key: string): string | null => {
  const value = data[key];
  if (value === undefined || value === null) return null;
  return String(value);
};

/**
 * Safely get a number value from node data
 */
const getDataNumber = (data: Record<string, unknown>, key: string): number | null => {
  const value = data[key];
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// ============================================================================
// Type-Specific Detail Sections
// ============================================================================

interface TypeDetailSectionProps {
  node: VoxelNode;
}

const AssetDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const owner = getDataString(data, 'owner');
  const type = getDataString(data, 'type');
  const location = getDataString(data, 'location');
  const lifecycleStatus = getDataString(data, 'lifecycleStatus');
  const confidentiality = getDataString(data, 'confidentiality');
  const integrity = getDataString(data, 'integrity');
  const availability = getDataString(data, 'availability');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Asset Information
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {owner && (
          <DetailRow
            label="Owner"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {owner}
              </span>
            }
          />
        )}
        {type && <DetailRow label="Type" value={type} />}
        {location && (
          <DetailRow
            label="Location"
            value={
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            }
          />
        )}
        {lifecycleStatus && (
          <DetailRow label="Lifecycle" value={lifecycleStatus} />
        )}

        {/* CIA Triad */}
        {(confidentiality || integrity || availability) && (
          <div className="pt-2 border-t border-slate-700/50">
            <div className="text-xs text-slate-500 mb-2">CIA Classification</div>
            <div className="flex gap-2">
              {confidentiality && <CriticalityBadge level={confidentiality} />}
              {integrity && <CriticalityBadge level={integrity} />}
              {availability && <CriticalityBadge level={availability} />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const RiskDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const probability = getDataNumber(data, 'probability');
  const impact = getDataNumber(data, 'impact');
  const score = getDataNumber(data, 'score');
  const threat = getDataString(data, 'threat');
  const vulnerability = getDataString(data, 'vulnerability');
  const strategy = getDataString(data, 'strategy');
  const owner = getDataString(data, 'owner');
  const residualScore = getDataNumber(data, 'residualScore');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Risk Assessment
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {/* Risk Score Matrix */}
        {probability !== null && impact !== null && score !== null && (
          <RiskScoreIndicator
            probability={probability}
            impact={impact}
            score={score}
          />
        )}

        {threat && <DetailRow label="Threat" value={threat} />}
        {vulnerability && <DetailRow label="Vulnerability" value={vulnerability} />}
        {strategy && (
          <DetailRow
            label="Strategy"
            value={
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" />
                {strategy}
              </span>
            }
          />
        )}
        {owner && (
          <DetailRow
            label="Risk Owner"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {owner}
              </span>
            }
          />
        )}
        {residualScore !== null && (
          <DetailRow
            label="Residual Score"
            value={
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {residualScore}
              </span>
            }
          />
        )}
      </div>
    </section>
  );
};

const ControlDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const code = getDataString(data, 'code');
  const name = getDataString(data, 'name');
  const framework = getDataString(data, 'framework');
  const type = getDataString(data, 'type');
  const status = getDataString(data, 'status');
  const owner = getDataString(data, 'owner');
  const maturity = getDataNumber(data, 'maturity');
  const isImplemented = status === 'Implémenté' || status === 'Actif';

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Control Details
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {code && (
          <DetailRow
            label="Code"
            value={<code className="text-xs bg-slate-700/50 px-1 rounded">{code}</code>}
          />
        )}
        {name && <DetailRow label="Name" value={name} />}
        {framework && <DetailRow label="Framework" value={framework} />}
        {type && <DetailRow label="Type" value={type} />}
        {status && (
          <DetailRow
            label="Status"
            value={
              <span className="flex items-center gap-1">
                {isImplemented ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                ) : (
                  <XCircle className="w-3 h-3 text-amber-400" />
                )}
                {status}
              </span>
            }
          />
        )}
        {owner && (
          <DetailRow
            label="Owner"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {owner}
              </span>
            }
          />
        )}
        {maturity !== null && (
          <DetailRow label="Maturity Level" value={`${maturity}/5`} />
        )}
      </div>
    </section>
  );
};

const ProjectDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const manager = getDataString(data, 'manager');
  const status = getDataString(data, 'status');
  const progress = getDataNumber(data, 'progress');
  const startDate = getDataString(data, 'startDate');
  const dueDate = getDataString(data, 'dueDate');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Project Details
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {manager && (
          <DetailRow
            label="Manager"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {manager}
              </span>
            }
          />
        )}
        {status && <DetailRow label="Status" value={status} />}
        {progress !== null && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Progress</span>
              <span className="text-slate-200">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {startDate && <DetailRow label="Start Date" value={startDate} />}
        {dueDate && <DetailRow label="Due Date" value={dueDate} />}
      </div>
    </section>
  );
};

const AuditDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const type = getDataString(data, 'type');
  const framework = getDataString(data, 'framework');
  const auditor = getDataString(data, 'auditor');
  const status = getDataString(data, 'status');
  const findingsCount = getDataNumber(data, 'findingsCount');
  const dateScheduled = getDataString(data, 'dateScheduled');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Audit Details
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {type && <DetailRow label="Type" value={type} />}
        {framework && <DetailRow label="Framework" value={framework} />}
        {auditor && (
          <DetailRow
            label="Auditor"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {auditor}
              </span>
            }
          />
        )}
        {status && <DetailRow label="Status" value={status} />}
        {findingsCount !== null && (
          <DetailRow
            label="Findings"
            value={
              <span className={findingsCount > 5 ? 'text-amber-400' : 'text-slate-200'}>
                {findingsCount}
              </span>
            }
          />
        )}
        {dateScheduled && <DetailRow label="Scheduled" value={dateScheduled} />}
      </div>
    </section>
  );
};

const IncidentDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const severity = getDataString(data, 'severity');
  const category = getDataString(data, 'category');
  const status = getDataString(data, 'status');
  const reporter = getDataString(data, 'reporter');
  const dateReported = getDataString(data, 'dateReported');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Incident Details
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {severity && (
          <DetailRow
            label="Severity"
            value={<CriticalityBadge level={severity} />}
          />
        )}
        {category && <DetailRow label="Category" value={category} />}
        {status && (
          <DetailRow
            label="Status"
            value={
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {status}
              </span>
            }
          />
        )}
        {reporter && (
          <DetailRow
            label="Reporter"
            value={
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {reporter}
              </span>
            }
          />
        )}
        {dateReported && <DetailRow label="Reported" value={dateReported} />}
      </div>
    </section>
  );
};

const SupplierDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const category = getDataString(data, 'category');
  const criticality = getDataString(data, 'criticality');
  const riskLevel = getDataString(data, 'riskLevel');
  const status = getDataString(data, 'status');
  const securityScore = getDataNumber(data, 'securityScore');

  return (
    <section className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
        Supplier Details
      </h3>
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        {category && <DetailRow label="Category" value={category} />}
        {criticality && (
          <DetailRow
            label="Criticality"
            value={<CriticalityBadge level={criticality} />}
          />
        )}
        {riskLevel && <DetailRow label="Risk Level" value={riskLevel} />}
        {status && <DetailRow label="Status" value={status} />}
        {securityScore !== null && (
          <DetailRow label="Security Score" value={`${securityScore}/100`} />
        )}
      </div>
    </section>
  );
};

// ============================================================================
// Component
// ============================================================================

/**
 * VoxelDetailPanel renders a slide-in panel from the right showing
 * detailed information about the selected node.
 *
 * @example
 * ```tsx
 * <VoxelDetailPanel
 *   node={selectedNode}
 *   isOpen={!!selectedNode}
 *   onClose={() => selectNode(null)}
 * />
 * ```
 */
export const VoxelDetailPanel: React.FC<VoxelDetailPanelProps> = ({
  node,
  isOpen,
  onClose,
  onNavigate,
  connectionCount = 0,
  onSelectLinkedEntity,
  nodesMap,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNavigate = useCallback(() => {
    if (node && onNavigate) {
      onNavigate(node);
    }
  }, [node, onNavigate]);

  // Get linked entities
  const linkedEntities = useMemo(() => {
    if (!node || !nodesMap) return [];
    return node.connections
      .map((id) => nodesMap.get(id))
      .filter((n): n is VoxelNode => n !== undefined);
  }, [node, nodesMap]);

  // Render type-specific details
  const renderTypeDetails = useCallback(() => {
    if (!node) return null;
    switch (node.type) {
      case 'asset':
        return <AssetDetails node={node} />;
      case 'risk':
        return <RiskDetails node={node} />;
      case 'control':
        return <ControlDetails node={node} />;
      case 'project':
        return <ProjectDetails node={node} />;
      case 'audit':
        return <AuditDetails node={node} />;
      case 'incident':
        return <IncidentDetails node={node} />;
      case 'supplier':
        return <SupplierDetails node={node} />;
      default:
        return null;
    }
  }, [node]);

  if (!node) return null;

  const typeConfig = TYPE_CONFIG[node.type];
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <>
      {/* Backdrop (optional - for click-away) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          style={{ background: 'transparent' }}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-12 bottom-0 w-80 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.3)',
        }}
        role="dialog"
        aria-label={`Details for ${node.label}`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'rgba(148, 163, 184, 0.1)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded"
              style={{ background: `${typeConfig.color}20`, color: typeConfig.color }}
            >
              {typeConfig.icon}
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {typeConfig.label} Details
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-slate-200"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {/* Title */}
          <h2 className="text-lg font-semibold text-white mb-1">{node.label}</h2>

          {/* Status badge */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: `${statusConfig.color}20`,
                color: statusConfig.color,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: statusConfig.color }}
              />
              {statusConfig.label}
            </span>
            <span className="text-xs text-slate-500">
              {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Type-specific details */}
          {renderTypeDetails()}

          {/* Linked Entities */}
          {linkedEntities.length > 0 && (
            <section className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                <span className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Linked Entities ({linkedEntities.length})
                </span>
              </h3>
              <div className="bg-slate-800/50 rounded-lg divide-y divide-slate-700/50">
                {linkedEntities.slice(0, 10).map((linkedNode) => (
                  <LinkedEntityItem
                    key={linkedNode.id}
                    node={linkedNode}
                    onClick={() => onSelectLinkedEntity?.(linkedNode.id)}
                  />
                ))}
                {linkedEntities.length > 10 && (
                  <div className="p-2 text-center text-xs text-slate-500">
                    +{linkedEntities.length - 10} more
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section className="mb-6">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
              Timeline
            </h3>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <DetailRow
                label="Created"
                value={
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(node.createdAt).toLocaleDateString()}
                  </span>
                }
              />
              <DetailRow
                label="Updated"
                value={new Date(node.updatedAt).toLocaleDateString()}
              />
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div
          className="absolute bottom-0 left-0 right-0 p-4 border-t"
          style={{
            borderColor: 'rgba(148, 163, 184, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          {onNavigate && (
            <button
              onClick={handleNavigate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: typeConfig.color,
                color: '#FFFFFF',
              }}
            >
              <ExternalLink className="w-4 h-4" />
              View Full Details
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default VoxelDetailPanel;
