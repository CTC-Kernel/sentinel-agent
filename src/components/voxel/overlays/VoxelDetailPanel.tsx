/**
 * VoxelDetailPanel - Premium slide-in detail panel for selected nodes
 *
 * Apple-style design with glassmorphism, smooth animations, and
 * type-specific details for each entity type.
 *
 * @see Story VOX-4.6: Click Detail Panel
 * @see Story VOX-7.1: Asset Details Display
 * @see Story VOX-7.2: Risk Details Display
 * @see Story VOX-7.3: Control Details Display
 * @see Story VOX-7.4: Linked Entities Display
 * @see Story VOX-7.5: Navigation to Full Page
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Activity,
  CheckCircle2,
  ChevronRight,
  Zap,
  Lock,
  Database,
  Wifi,
} from 'lucide-react';
import type { VoxelNode, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';

// ============================================================================
// Types
// ============================================================================

export interface VoxelDetailPanelProps {
  node: VoxelNode | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (node: VoxelNode) => void;
  connectionCount?: number;
  onSelectLinkedEntity?: (nodeId: string) => void;
  nodesMap?: Map<string, VoxelNode>;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_CONFIG: Record<VoxelNodeType, { icon: React.ReactNode; label: string; color: string; gradient: string }> = {
  asset: {
    icon: <Server className="w-4 h-4" />,
    label: 'Actif',
    color: '#3B82F6',
    gradient: 'from-blue-500/20 to-blue-600/10',
  },
  risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Risque',
    color: '#EF4444',
    gradient: 'from-red-500/20 to-red-600/10',
  },
  control: {
    icon: <Shield className="w-4 h-4" />,
    label: 'Contrôle',
    color: '#8B5CF6',
    gradient: 'from-purple-500/20 to-purple-600/10',
  },
  audit: {
    icon: <ClipboardCheck className="w-4 h-4" />,
    label: 'Audit',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 to-amber-600/10',
  },
  project: {
    icon: <FolderKanban className="w-4 h-4" />,
    label: 'Projet',
    color: '#10B981',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
  },
  incident: {
    icon: <Flame className="w-4 h-4" />,
    label: 'Incident',
    color: '#F97316',
    gradient: 'from-orange-500/20 to-orange-600/10',
  },
  supplier: {
    icon: <Building2 className="w-4 h-4" />,
    label: 'Fournisseur',
    color: '#6366F1',
    gradient: 'from-brand-500/20 to-brand-600/10',
  },
};

const STATUS_CONFIG: Record<VoxelNodeStatus, { label: string; color: string; bgColor: string }> = {
  normal: { label: 'Normal', color: '#22C55E', bgColor: 'bg-emerald-500/10' },
  warning: { label: 'Attention', color: '#F59E0B', bgColor: 'bg-amber-50' },
  critical: { label: 'Critique', color: '#EF4444', bgColor: 'bg-red-50' },
  inactive: { label: 'Inactif', color: '#64748B', bgColor: 'bg-slate-500/10' },
};

// ============================================================================
// Animation Variants
// ============================================================================

const panelVariants = {
  hidden: {
    x: '100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 300,
      mass: 0.8,
    }
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 300,
    }
  }
};

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number]
    }
  }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

// ============================================================================
// Sub-components
// ============================================================================

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
      {icon}
      {label}
    </span>
    <span className="text-sm text-slate-200 font-medium">{value}</span>
  </div>
);

interface RiskScoreIndicatorProps {
  probability: number;
  impact: number;
  score: number;
}

const RiskScoreIndicator: React.FC<RiskScoreIndicatorProps> = ({ probability, impact, score }) => {
  const getScoreColor = (s: number) => {
    if (s >= 15) return { color: '#EF4444', label: 'Critique' };
    if (s >= 10) return { color: '#F59E0B', label: 'Élevé' };
    if (s >= 5) return { color: '#FBBF24', label: 'Modéré' };
    return { color: '#22C55E', label: 'Faible' };
  };

  const scoreConfig = getScoreColor(score);

  return (
    <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score de Risque</span>
        <div
          className="px-3 py-1 rounded-full text-sm font-bold"
          style={{ backgroundColor: `${scoreConfig.color}20`, color: scoreConfig.color }}
        >
          {score}
        </div>
      </div>

      {/* Risk Matrix Mini */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/30 rounded-xl p-3">
          <div className="text-xs text-slate-500 dark:text-slate-300 mb-2">Probabilité</div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex-1 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i <= probability ? '#3B82F6' : '#334155',
                }}
              />
            ))}
          </div>
          <div className="text-right text-xs text-muted-foreground mt-1">{probability}/5</div>
        </div>
        <div className="bg-slate-700/30 rounded-xl p-3">
          <div className="text-xs text-slate-500 dark:text-slate-300 mb-2">Impact</div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex-1 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: i <= impact ? '#EF4444' : '#334155',
                }}
              />
            ))}
          </div>
          <div className="text-right text-xs text-muted-foreground mt-1">{impact}/5</div>
        </div>
      </div>
    </div>
  );
};

interface LinkedEntityItemProps {
  node: VoxelNode;
  onClick: () => void;
}

const LinkedEntityItem: React.FC<LinkedEntityItemProps> = ({ node, onClick }) => {
  const typeConfig = TYPE_CONFIG[node.type];
  const statusConfig = STATUS_CONFIG[node.status];

  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group"
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="p-2 rounded-xl transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${typeConfig.color}15`, color: typeConfig.color }}
      >
        {typeConfig.icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm text-white font-medium truncate">{node.label}</div>
        <div className="text-xs text-slate-500">{typeConfig.label}</div>
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: statusConfig.color }}
      />
      <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-70 transition-opacity" />
    </motion.button>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

const getDataString = (data: Record<string, unknown>, key: string): string | null => {
  const value = data[key];
  if (value === undefined || value === null) return null;
  return String(value);
};

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
    <div className="space-y-4">
      {/* Main Info Card */}
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Server className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {owner && <DetailRow label="Propriétaire" value={owner} icon={<User className="w-3 h-3" />} />}
          {type && <DetailRow label="Type" value={type} icon={<Database className="w-3 h-3" />} />}
          {location && <DetailRow label="Localisation" value={location} icon={<MapPin className="w-3 h-3" />} />}
          {lifecycleStatus && <DetailRow label="Cycle de vie" value={lifecycleStatus} icon={<Activity className="w-3 h-3" />} />}
        </div>
      </div>

      {/* CIA Triad */}
      {(confidentiality || integrity || availability) && (
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Classification CIA
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {confidentiality && (
              <div className="text-center p-3 rounded-xl bg-slate-700/30">
                <Lock className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                <div className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Conf.</div>
                <div className="text-xs font-medium text-slate-200 mt-0.5">{confidentiality}</div>
              </div>
            )}
            {integrity && (
              <div className="text-center p-3 rounded-xl bg-slate-700/30">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-green-400" />
                <div className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Intég.</div>
                <div className="text-xs font-medium text-slate-200 mt-0.5">{integrity}</div>
              </div>
            )}
            {availability && (
              <div className="text-center p-3 rounded-xl bg-slate-700/30">
                <Wifi className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                <div className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Disp.</div>
                <div className="text-xs font-medium text-slate-200 mt-0.5">{availability}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RiskDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const probability = getDataNumber(data, 'probability') || 0;
  const impact = getDataNumber(data, 'impact') || 0;
  const score = getDataNumber(data, 'score') || 0;
  const threat = getDataString(data, 'threat');
  const treatment = getDataString(data, 'treatment');
  const owner = getDataString(data, 'owner');

  return (
    <div className="space-y-4">
      {/* Risk Score */}
      <RiskScoreIndicator probability={probability} impact={impact} score={score} />

      {/* Risk Info */}
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Détails du Risque
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {threat && <DetailRow label="Menace" value={threat} />}
          {treatment && <DetailRow label="Traitement" value={treatment} />}
          {owner && <DetailRow label="Propriétaire" value={owner} icon={<User className="w-3 h-3" />} />}
        </div>
      </div>
    </div>
  );
};

const ControlDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const status = getDataString(data, 'status');
  const effectiveness = getDataNumber(data, 'effectiveness');
  const owner = getDataString(data, 'owner');
  const framework = getDataString(data, 'framework');

  const getStatusColor = (s: string | null) => {
    if (!s) return '#64748B';
    const lower = s.toLowerCase();
    if (lower.includes('implémenté') || lower.includes('actif')) return '#22C55E';
    if (lower.includes('partiel') || lower.includes('en cours')) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="space-y-4">
      {/* Effectiveness Gauge */}
      {effectiveness !== null && (
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Efficacité</span>
            <span className="text-lg font-bold text-white">{effectiveness}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${effectiveness}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                background: effectiveness >= 80 ? '#22C55E' : effectiveness >= 50 ? '#F59E0B' : '#EF4444'
              }}
            />
          </div>
        </div>
      )}

      {/* Control Info */}
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {status && (
            <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <span className="text-xs text-muted-foreground">Statut</span>
              <span
                className="text-sm font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${getStatusColor(status)}20`, color: getStatusColor(status) }}
              >
                {status}
              </span>
            </div>
          )}
          {framework && <DetailRow label="Framework" value={framework} />}
          {owner && <DetailRow label="Propriétaire" value={owner} icon={<User className="w-3 h-3" />} />}
        </div>
      </div>
    </div>
  );
};

const ProjectDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const status = getDataString(data, 'status');
  const progress = getDataNumber(data, 'progress');
  const owner = getDataString(data, 'owner');
  const budget = getDataNumber(data, 'budget');
  const deadline = getDataString(data, 'deadline');

  return (
    <div className="space-y-4">
      {/* Progress */}
      {progress !== null && (
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avancement</span>
            <span className="text-lg font-bold text-white">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>
        </div>
      )}

      {/* Project Info */}
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <FolderKanban className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {status && <DetailRow label="Statut" value={status} />}
          {owner && <DetailRow label="Responsable" value={owner} icon={<User className="w-3 h-3" />} />}
          {budget && <DetailRow label="Budget" value={`${budget.toLocaleString()} €`} />}
          {deadline && <DetailRow label="Échéance" value={deadline} icon={<Calendar className="w-3 h-3" />} />}
        </div>
      </div>
    </div>
  );
};

const AuditDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const status = getDataString(data, 'status');
  const auditor = getDataString(data, 'auditor');
  const scope = getDataString(data, 'scope');
  const findingsCount = getDataNumber(data, 'findingsCount');

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <ClipboardCheck className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {status && <DetailRow label="Statut" value={status} />}
          {auditor && <DetailRow label="Auditeur" value={auditor} icon={<User className="w-3 h-3" />} />}
          {scope && <DetailRow label="Périmètre" value={scope} />}
          {findingsCount !== null && <DetailRow label="Constats" value={findingsCount} />}
        </div>
      </div>
    </div>
  );
};

const IncidentDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const severity = getDataString(data, 'severity');
  const status = getDataString(data, 'status');
  const assignee = getDataString(data, 'assignee');
  const source = getDataString(data, 'source');

  const getSeverityColor = (s: string | null) => {
    if (!s) return '#64748B';
    const lower = s.toLowerCase();
    if (lower.includes('critique')) return '#EF4444';
    if (lower.includes('élevé') || lower.includes('haute')) return '#F97316';
    if (lower.includes('moyen') || lower.includes('modéré')) return '#F59E0B';
    return '#22C55E';
  };

  return (
    <div className="space-y-4">
      {/* Severity Badge */}
      {severity && (
        <div
          className="rounded-2xl p-4 border"
          style={{
            backgroundColor: `${getSeverityColor(severity)}10`,
            borderColor: `${getSeverityColor(severity)}30`
          }}
        >
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6" style={{ color: getSeverityColor(severity) }} />
            <div>
              <div className="text-xs text-muted-foreground uppercase">Sévérité</div>
              <div className="text-lg font-bold" style={{ color: getSeverityColor(severity) }}>{severity}</div>
            </div>
          </div>
        </div>
      )}

      {/* Incident Info */}
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Flame className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {status && <DetailRow label="Statut" value={status} />}
          {assignee && <DetailRow label="Assigné à" value={assignee} icon={<User className="w-3 h-3" />} />}
          {source && <DetailRow label="Source" value={source} />}
        </div>
      </div>
    </div>
  );
};

const SupplierDetails: React.FC<TypeDetailSectionProps> = ({ node }) => {
  const data = node.data || {};
  const status = getDataString(data, 'status');
  const riskLevel = getDataString(data, 'riskLevel');
  const contact = getDataString(data, 'contact');
  const category = getDataString(data, 'category');

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          Informations
        </h3>
        <div className="space-y-1 divide-y divide-slate-700/30">
          {status && <DetailRow label="Statut" value={status} />}
          {category && <DetailRow label="Catégorie" value={category} />}
          {riskLevel && <DetailRow label="Niveau de risque" value={riskLevel} />}
          {contact && <DetailRow label="Contact" value={contact} icon={<User className="w-3 h-3" />} />}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const VoxelDetailPanel: React.FC<VoxelDetailPanelProps> = ({
  node,
  isOpen,
  onClose,
  onNavigate,
  connectionCount = 0,
  onSelectLinkedEntity,
  nodesMap,
}) => {
  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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

    const linked: VoxelNode[] = [];

    // Direct connections
    node.connections.forEach(connId => {
      const connNode = nodesMap.get(connId);
      if (connNode) linked.push(connNode);
    });

    // Nodes that connect TO this node
    nodesMap.forEach((n) => {
      if (n.id !== node.id && n.connections.includes(node.id)) {
        if (!linked.find(l => l.id === n.id)) {
          linked.push(n);
        }
      }
    });

    return linked;
  }, [node, nodesMap]);

  // Render type-specific details
  const renderTypeDetails = useMemo(() => {
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
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[100000] bg-black/40 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            className="fixed right-0 top-0 bottom-0 w-96 z-[100001] flex flex-col"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4), -2px 0 8px rgba(0, 0, 0, 0.2)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Détails de ${node.label}`}
          >
            {/* Header with gradient */}
            <div className={`relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.gradient} opacity-60`} />
              <motion.div
                className="relative p-5"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="p-2.5 rounded-xl shrink-0"
                      style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                    >
                      {typeConfig.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-0.5">
                        {typeConfig.label}
                      </div>
                      <h2 className="text-lg font-semibold text-white truncate">{node.label}</h2>
                    </div>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-white shrink-0"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Status & Connections */}
                <div className="flex items-center gap-3 mt-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor}`}
                    style={{ color: statusConfig.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: statusConfig.color }}
                    />
                    {statusConfig.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {connectionCount} connexion{connectionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Scrollable Content */}
            <motion.div
              className="flex-1 overflow-y-auto p-5 space-y-5"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Type-specific details */}
              {renderTypeDetails}

              {/* Linked Entities */}
              {linkedEntities.length > 0 && (
                <div className="bg-slate-800/80 rounded-2xl border border-slate-700/50 overflow-hidden">
                  <div className="p-4 border-b border-slate-700/50">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5" />
                      Entités liées ({linkedEntities.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-700/30">
                    {linkedEntities.slice(0, 8).map((linkedNode) => (
                      <LinkedEntityItem
                        key={linkedNode.id}
                        node={linkedNode}
                        onClick={() => onSelectLinkedEntity?.(linkedNode.id)}
                      />
                    ))}
                    {linkedEntities.length > 8 && (
                      <div className="p-3 text-center text-xs text-slate-500">
                        +{linkedEntities.length - 8} autres
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Historique
                </h3>
                <div className="space-y-1 divide-y divide-slate-700/30">
                  <DetailRow
                    label="Création"
                    value={new Date(node.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  />
                  <DetailRow
                    label="Modification"
                    value={new Date(node.updatedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  />
                </div>
              </div>
            </motion.div>

            {/* Footer with CTA */}
            {onNavigate && (
              <div className="p-5 border-t border-white/5 bg-slate-900/50">
                <motion.button
                  onClick={handleNavigate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${typeConfig.color}, ${typeConfig.color}CC)`,
                    boxShadow: `0 4px 14px ${typeConfig.color}40`,
                  }}
                  whileHover={{ scale: 1.02, boxShadow: `0 6px 20px ${typeConfig.color}50` }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Voir tous les détails
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default VoxelDetailPanel;
