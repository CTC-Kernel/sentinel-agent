/**
 * Epic 30: Story 30.4, 30.5 & 30.8 - Blast Radius Stats Panel
 *
 * Sidebar panel showing simulation results:
 * - Total affected nodes, max depth, total impact score
 * - List of affected nodes sorted by impact
 * - Breakdown by node type
 * - What-If simulation controls
 * - Export results functionality
 *
 * Enhanced with micro-interactions for "aha moments"
 */

import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Info,
  Target,
  Layers,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Search,

  X,

  Eye,
  Download,
  FileText,

  GitBranch,
  Shield,
  Server,
  Briefcase,
  Users,
  ClipboardCheck,
  Bell,
  Sliders,
  BarChart3,
  Check,
} from '../ui/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import type {
  AffectedNode,
  WhatIfScenario,
  WhatIfComparison,
  ExtendedBlastRadiusConfig,
} from '@/services/blastRadiusService';
import type { SimulationMode } from '@/hooks/voxel/useBlastRadius';
import { appleEasing } from '@/utils/microInteractions';

// ============================================================================
// Constants
// ============================================================================

const IMPACT_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-500/30', text: 'text-red-500' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-500/30', text: 'text-yellow-500' },
  low: { bg: 'bg-green-50', border: 'border-green-500/30', text: 'text-green-500' },
};

const NODE_TYPE_ICONS: Record<VoxelNodeType, React.FC<{ className?: string }>> = {
  asset: Server,
  risk: AlertTriangle,
  control: Shield,
  incident: Bell,
  supplier: Users,
  project: Briefcase,
  audit: ClipboardCheck,
};

const NODE_TYPE_LABELS: Record<VoxelNodeType, string> = {
  asset: 'Actifs',
  risk: 'Risques',
  control: 'Controles',
  incident: 'Incidents',
  supplier: 'Fournisseurs',
  project: 'Projets',
  audit: 'Audits',
};

// ============================================================================
// Types
// ============================================================================

interface BlastRadiusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Simulation state
  sourceNodeId: string | null;
  sourceNode: VoxelNode | null;
  mode: SimulationMode;
  isSimulating: boolean;
  // Results
  affectedNodes: AffectedNode[];
  stats: {
    totalAffected: number;
    totalImpact: number;
    maxDepth: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    byType: Record<VoxelNodeType, number>;
  };
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  // What-If
  whatIfResult: WhatIfComparison | null;
  whatIfScenario: WhatIfScenario | null;
  // Configuration
  config: ExtendedBlastRadiusConfig;
  // Actions
  onStartSimulation: (nodeId: string) => void;
  onStopSimulation: () => void;
  onSetConfig: (config: Partial<ExtendedBlastRadiusConfig>) => void;
  onApplyWhatIf: (scenario: WhatIfScenario) => void;
  onClearWhatIf: () => void;
  onFocusNode: (nodeId: string) => void;
  onClearResults: () => void;
  onSetMode: (mode: SimulationMode) => void;
  onExportPdf?: () => void;
  onExportCsv?: () => void;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Impact level badge
 */
const ImpactBadge: React.FC<{ impact: number; className?: string }> = ({ impact, className }) => {
  const level = impact >= 0.75 ? 'critical' : impact >= 0.5 ? 'high' : impact >= 0.25 ? 'medium' : 'low';
  const colors = IMPACT_COLORS[level];

  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text} ${className}`}>
      {Math.round(impact * 100)}%
    </span>
  );
};

/**
 * Stats card component with animations
 */
const StatsCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  color?: string;
  delta?: number;
  delay?: number;
}> = ({ label, value, icon: Icon, color = 'text-white', delta, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.4, ease: appleEasing }}
    className="bg-white/5 rounded-3xl p-3 border border-border/40"
  >
    <div className="flex items-center gap-2 mb-1">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
      >
        <Icon className={`h-4 w-4 ${color}`} />
      </motion.div>
      <span className="text-xs text-white/50">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
        className={`text-xl font-bold tabular-nums ${color}`}
      >
        {value}
      </motion.span>
      {delta !== undefined && delta !== 0 && (
        <motion.span
          initial={{ scale: 0, x: -10 }}
          animate={{ scale: 1, x: 0 }}
          transition={{ delay: delay + 0.5, type: 'spring', stiffness: 300 }}
          className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-red-400' : 'text-green-400'}`}
        >
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}{delta}
        </motion.span>
      )}
    </div>
  </motion.div>
);

/**
 * Affected node list item
 */
const AffectedNodeItem: React.FC<{
  node: AffectedNode;
  isSelected: boolean;
  onSelect: () => void;
  onFocus: () => void;
}> = ({ node, isSelected, onSelect, onFocus }) => {
  const Icon = NODE_TYPE_ICONS[node.node.type];
  const typeLabel = NODE_TYPE_LABELS[node.node.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`
        p-3 rounded-3xl border cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-brand-500 bg-brand-50' : 'bg-white/5 hover:bg-white/10'}
        border-border/40 hover:border-white/20
      `}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-white/70" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {node.node.label || node.nodeId.substring(0, 12)}
            </span>
            <ImpactBadge impact={node.impact} />
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-white/40">{typeLabel}</span>
            <span className="text-[11px] text-white/30">|</span>
            <span className="text-[11px] text-white/40">Profondeur: {node.depth}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onFocus();
          }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          title="Voir dans la vue 3D"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

/**
 * What-If scenario builder
 */
const WhatIfBuilder: React.FC<{
  onApply: (scenario: WhatIfScenario) => void;
  nodes: Map<string, VoxelNode>;
}> = ({ onApply, nodes }) => {
  const [scenarioType, setScenarioType] = useState<WhatIfScenario['type']>('remove_node');
  const [selectedNodeId, setSelectedNodeId] = useState('');

  const controlNodes = useMemo(() => {
    return Array.from(nodes.values()).filter((n) => n.type === 'control');
  }, [nodes]);

  const handleApply = () => {
    if (!selectedNodeId) return;

    switch (scenarioType) {
      case 'remove_node':
        onApply({ type: 'remove_node', nodeId: selectedNodeId });
        break;
      // Add more cases as needed
    }
  };

  return (
    <div className="space-y-3 p-3 bg-white/5 rounded-3xl border border-border/40">
      <div className="text-xs text-white/70 font-medium">Scenario What-If</div>

      <div className="space-y-2">
        <select
          value={scenarioType}
          onChange={(e) => setScenarioType(e.target.value as WhatIfScenario['type'])}
          className="w-full bg-white/5 border border-border/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="remove_node">Supprimer un controle</option>
          <option value="add_node">Ajouter un controle</option>
          <option value="modify_weight">Modifier poids connexion</option>
        </select>

        {scenarioType === 'remove_node' && (
          <select
            value={selectedNodeId}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className="w-full bg-white/5 border border-border/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">Sélectionner un contrôle...</option>
            {controlNodes.map((node) => (
              <option key={node.id || 'unknown'} value={node.id}>
                {node.label || node.id.substring(0, 20)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleApply}
          disabled={!selectedNodeId}
          className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Appliquer le scenario
        </button>
      </div>
    </div>
  );
};

/**
 * Configuration panel
 */
const ConfigPanel: React.FC<{
  config: ExtendedBlastRadiusConfig;
  onSetConfig: (config: Partial<ExtendedBlastRadiusConfig>) => void;
}> = ({ config, onSetConfig }) => (
  <div className="space-y-3 p-3 bg-white/5 rounded-3xl border border-border/40">
    <div className="text-xs text-white/70 font-medium flex items-center gap-2">
      <Sliders className="h-4 w-4" />
      Configuration
    </div>

    <div className="space-y-2">
      <div>
        <label htmlFor="max-depth" className="text-[11px] text-white/50 block mb-1">Profondeur max</label>
        <input
          id="max-depth"
          type="range"
          min={1}
          max={10}
          value={config.maxDepth}
          onChange={(e) => onSetConfig({ maxDepth: parseInt(e.target.value, 10) })}
          className="w-full accent-brand-500"
        />
        <div className="text-xs text-white/70 text-right">{config.maxDepth}</div>
      </div>

      <div>
        <label htmlFor="min-impact" className="text-[11px] text-white/50 block mb-1">Seuil min impact</label>
        <input
          id="min-impact"
          type="range"
          min={0}
          max={50}
          value={(config.minProbability || 0.1) * 100}
          onChange={(e) => onSetConfig({ minProbability: parseInt(e.target.value, 10) / 100 })}
          className="w-full accent-brand-500"
        />
        <div className="text-xs text-white/70 text-right">{((config.minProbability || 0.1) * 100).toFixed(0)}%</div>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor="bidirectional" className="text-[11px] text-white/50">Bidirectionnel</label>
        <input
          id="bidirectional"
          type="checkbox"
          checked={config.bidirectional || false}
          onChange={(e) => onSetConfig({ bidirectional: e.target.checked })}
          className="accent-brand-500"
        />
      </div>
    </div>
  </div>
);

// ============================================================================
// Help Content Component
// ============================================================================

const BlastRadiusHelpContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    className="px-5 py-4 bg-gradient-to-r from-purple-500/10 to-brand-500/10 border-b border-border/40"
  >
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Info className="w-4 h-4 text-purple-400" />
        Guide Blast Radius
      </h3>
      <button onClick={onClose} className="text-white/40 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="space-y-3 text-xs text-white/70">
      <div className="flex gap-2">
        <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">1</span>
        <p><strong className="text-white">Simulation d'impact</strong> - Cliquez sur un noeud dans la vue 3D pour voir tous les elements qui seraient affectes en cas de defaillance.</p>
      </div>
      <div className="flex gap-2">
        <span className="w-5 h-5 rounded bg-brand-100 flex items-center justify-center text-brand-400 shrink-0">2</span>
        <p><strong className="text-white">Statistiques</strong> - Visualisez le nombre de noeuds impactes, la profondeur de propagation et l'impact metier global.</p>
      </div>
      <div className="flex gap-2">
        <span className="w-5 h-5 rounded bg-info/20 flex items-center justify-center text-info shrink-0">3</span>
        <p><strong className="text-white">Scenario What-If</strong> - Simulez la suppression d'un controle pour evaluer l'impact sur votre posture de securite.</p>
      </div>
      <div className="flex gap-2">
        <span className="w-5 h-5 rounded bg-slate-500/20 flex items-center justify-center text-slate-400 shrink-0">4</span>
        <p><strong className="text-white">Configuration</strong> - Ajustez la profondeur max et le seuil minimum d'impact pour affiner vos analyses.</p>
      </div>
      <div className="flex gap-2">
        <span className="w-5 h-5 rounded bg-success/20 flex items-center justify-center text-success shrink-0">5</span>
        <p><strong className="text-white">Export</strong> - Generez des rapports PDF ou CSV pour partager vos analyses avec votre equipe.</p>
      </div>
    </div>
  </motion.div>
);

// ============================================================================
// Main BlastRadiusPanel Component
// ============================================================================

export const BlastRadiusPanel: React.FC<BlastRadiusPanelProps> = ({
  isOpen,
  onClose,
  sourceNodeId,
  sourceNode,
  mode,
  affectedNodes,
  stats,
  businessImpact,
  whatIfResult,
  whatIfScenario,
  config,
  onSetConfig,
  onApplyWhatIf,
  onClearWhatIf,
  onFocusNode,
  onClearResults,
  onExportPdf,
  onExportCsv,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'impact' | 'depth' | 'type'>('impact');
  const [filterType, setFilterType] = useState<VoxelNodeType | 'all'>('all');

  // Filtered and sorted nodes
  const filteredNodes = useMemo(() => {
    let result = [...affectedNodes];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.node.label?.toLowerCase().includes(query) ||
          n.nodeId.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((n) => n.node.type === filterType);
    }

    // Sort
    switch (sortBy) {
      case 'impact':
        result.sort((a, b) => b.impact - a.impact);
        break;
      case 'depth':
        result.sort((a, b) => a.depth - b.depth);
        break;
      case 'type':
        result.sort((a, b) => a.node.type.localeCompare(b.node.type));
        break;
    }

    return result;
  }, [affectedNodes, searchQuery, sortBy, filterType]);

  // Node map for What-If builder
  const allNodes = useMemo(() => {
    const map = new Map<string, VoxelNode>();
    affectedNodes.forEach((n) => map.set(n.nodeId, n.node));
    return map;
  }, [affectedNodes]);

  // Business impact color
  const businessImpactColors = IMPACT_COLORS[businessImpact];

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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[100000]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="absolute inset-y-0 right-0 w-[420px] z-[100001] flex flex-col"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4), -2px 0 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Header */}
            <div className="p-5 border-b border-border/40 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-purple-500 to-brand-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Blast Radius</h2>
                    <p className="text-xs text-white/50">
                      {mode === 'blast-radius' ? 'Simulation d\'impact' : mode === 'root-cause' ? 'Analyse cause racine' : 'Scenario What-If'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Source node info */}
              {sourceNode && (
                <div className="mt-4 p-3 bg-white/5 rounded-3xl border border-border/40">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-400" />
                    <span className="text-xs text-white/50">Noeud source</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{sourceNode.label || sourceNodeId}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                      {NODE_TYPE_LABELS[sourceNode.type]}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            {affectedNodes.length > 0 && (
              <div className="p-5 border-b border-border/40 shrink-0">
                <div className="grid grid-cols-2 gap-3">
                  <StatsCard
                    label="Noeuds impactes"
                    value={stats.totalAffected}
                    icon={Layers}
                    color="text-brand-400"
                    delta={whatIfResult?.affectedNodesDelta}
                    delay={0}
                  />
                  <StatsCard
                    label="Impact total"
                    value={stats.totalImpact.toFixed(1)}
                    icon={Activity}
                    color="text-purple-400"
                    delta={whatIfResult ? parseFloat(whatIfResult.impactDelta.toFixed(1)) : undefined}
                    delay={0.1}
                  />
                  <StatsCard
                    label="Profondeur max"
                    value={stats.maxDepth}
                    icon={GitBranch}
                    color="text-info"
                    delay={0.2}
                  />
                  <div className={`rounded-3xl p-3 border ${businessImpactColors.bg} ${businessImpactColors.border}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className={`h-4 w-4 ${businessImpactColors.text}`} />
                      <span className="text-xs text-white/50">Impact metier</span>
                    </div>
                    <span className={`text-xl font-bold uppercase ${businessImpactColors.text}`}>
                      {businessImpact}
                    </span>
                  </div>
                </div>

                {/* Impact distribution */}
                <div className="mt-3 flex gap-2">
                  {[
                    { label: 'Critique', count: stats.criticalCount, color: IMPACT_COLORS.critical },
                    { label: 'Eleve', count: stats.highCount, color: IMPACT_COLORS.high },
                    { label: 'Moyen', count: stats.mediumCount, color: IMPACT_COLORS.medium },
                    { label: 'Faible', count: stats.lowCount, color: IMPACT_COLORS.low },
                  ].map(({ label, count, color }) => (
                    <div
                      key={label || 'unknown'}
                      className={`flex-1 px-2 py-1.5 rounded-lg ${color.bg} ${color.border} border text-center`}
                    >
                      <div className={`text-lg font-bold ${color.text}`}>{count}</div>
                      <div className="text-[11px] text-white/40">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Type breakdown */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(stats.byType).map(([type, count]) => {
                    if (count === 0) return null;
                    const Icon = NODE_TYPE_ICONS[type as VoxelNodeType];
                    return (
                      <button
                        key={type || 'unknown'}
                        onClick={() => setFilterType(filterType === type ? 'all' : type as VoxelNodeType)}
                        className={`
                    flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors
                    ${filterType === type ? 'bg-brand-100 text-brand-300' : 'bg-white/5 text-white/60 hover:bg-white/10'}
                  `}
                      >
                        <Icon className="h-3 w-3" />
                        {NODE_TYPE_LABELS[type as VoxelNodeType]}: {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2 shrink-0">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-white/5 border border-border/40 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-white/5 border border-border/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="impact">Impact</option>
                <option value="depth">Profondeur</option>
                <option value="type">Type</option>
              </select>

              {/* Help toggle */}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={`p-2 rounded-lg transition-colors ${showHelp ? 'bg-brand-100 text-brand-400' : 'bg-white/5 text-white/60 hover:text-white'}`}
                title="Aide"
              >
                <Info className="h-4 w-4" />
              </button>

              {/* Config toggle */}
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-brand-100 text-brand-400' : 'bg-white/5 text-white/60 hover:text-white'}`}
              >
                <Sliders className="h-4 w-4" />
              </button>
            </div>

            {/* Help Content */}
            <AnimatePresence>
              {showHelp && <BlastRadiusHelpContent onClose={() => setShowHelp(false)} />}
            </AnimatePresence>

            {/* Config Panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 py-3 border-b border-border/40 overflow-hidden"
                >
                  <ConfigPanel config={config} onSetConfig={onSetConfig} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* What-If Toggle */}
            <div className="px-5 py-3 border-b border-border/40 shrink-0">
              <button
                onClick={() => setShowWhatIf(!showWhatIf)}
                className={`
            w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors
            ${showWhatIf ? 'bg-brand-100 text-brand-400' : 'bg-white/5 text-white/70 hover:bg-white/10'}
          `}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4" />
                  Scenario What-If
                </span>
                {showWhatIf ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <AnimatePresence>
                {showWhatIf && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <WhatIfBuilder onApply={onApplyWhatIf} nodes={allNodes} />
                    {whatIfScenario && (
                      <button
                        onClick={onClearWhatIf}
                        className="mt-2 w-full px-3 py-2 text-xs text-white/60 hover:text-white bg-white/5 rounded-lg"
                      >
                        Effacer le scenario
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Affected Nodes List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredNodes.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Activity className="h-8 w-8 text-white/30" />
                    </div>
                    <p className="text-white/60 text-sm">
                      {sourceNodeId ? 'Aucun nœud impacté' : 'Sélectionnez un nœud source'}
                    </p>
                    <p className="text-white/40 text-xs mt-1">
                      {sourceNodeId
                        ? 'Ajustez la configuration pour étendre la simulation'
                        : 'Cliquez sur un nœud dans la vue 3D'}
                    </p>
                  </motion.div>
                ) : (
                  filteredNodes.map((node) => (
                    <AffectedNodeItem
                      key={node.nodeId || 'unknown'}
                      node={node}
                      isSelected={selectedNodeId === node.nodeId}
                      onSelect={() => setSelectedNodeId(selectedNodeId === node.nodeId ? null : node.nodeId)}
                      onFocus={() => onFocusNode(node.nodeId)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-border/40 shrink-0 space-y-3">
              {/* What-If comparison summary with animations */}
              {whatIfResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className={`p-4 rounded-3xl border ${whatIfResult.impactDelta < 0
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-500/30'
                    : 'bg-brand-50 border-brand-300'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                    >
                      {whatIfResult.impactDelta < 0 ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      )}
                    </motion.div>
                    <span className={`text-xs font-medium ${whatIfResult.impactDelta < 0 ? 'text-green-400' : 'text-brand-400'
                      }`}>
                      {whatIfResult.impactDelta < 0 ? 'Amelioration detectee !' : 'Comparaison What-If'}
                    </span>
                  </div>

                  {/* Main delta display */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center justify-center gap-3 mb-3"
                  >
                    <motion.div
                      animate={whatIfResult.impactDelta < 0 ? { rotate: [0, -10, 0] } : {}}
                      transition={{ delay: 0.5, duration: 0.5 }}
                    >
                      {whatIfResult.impactDelta < 0 ? (
                        <TrendingDown className="h-8 w-8 text-green-400" />
                      ) : (
                        <TrendingUp className="h-8 w-8 text-red-400" />
                      )}
                    </motion.div>
                    <div className="text-center">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className={`text-2xl font-bold ${whatIfResult.impactDelta < 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                      >
                        {whatIfResult.impactDelta > 0 ? '+' : ''}
                        {(Math.abs(whatIfResult.impactDelta) * 100).toFixed(0)}%
                      </motion.div>
                      <div className="text-[11px] text-white/50">
                        {whatIfResult.impactDelta < 0 ? 'Reduction d\'impact' : 'Augmentation d\'impact'}
                      </div>
                    </div>
                  </motion.div>

                  {/* Details grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="p-2 bg-white/5 rounded-lg"
                    >
                      <div className={`text-sm font-bold ${whatIfResult.impactDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {whatIfResult.impactDelta > 0 ? '+' : ''}{whatIfResult.impactDelta.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-white/40">Impact</div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="p-2 bg-white/5 rounded-lg"
                    >
                      <div className="text-sm font-bold text-yellow-400">
                        {whatIfResult.newlyAffected.length}
                      </div>
                      <div className="text-[11px] text-white/40">Nouveaux</div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="p-2 bg-white/5 rounded-lg"
                    >
                      <div className="text-sm font-bold text-green-400">
                        {whatIfResult.noLongerAffected.length}
                      </div>
                      <div className="text-[11px] text-white/40">Proteges</div>
                    </motion.div>
                  </div>

                  {/* Success message for significant improvements */}
                  {whatIfResult.impactDelta < -0.2 && whatIfResult.noLongerAffected.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ delay: 0.8 }}
                      className="mt-3 p-2 bg-green-500/20 rounded-lg flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-300">
                        Excellente mitigation ! {whatIfResult.noLongerAffected.length} elements proteges.
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Export buttons */}
              <div className="flex gap-2">
                {onExportPdf && (
                  <button
                    onClick={onExportPdf}
                    disabled={affectedNodes.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-3xl transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </button>
                )}
                {onExportCsv && (
                  <button
                    onClick={onExportCsv}
                    disabled={affectedNodes.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-3xl transition-colors border border-border/40"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                )}
              </div>

              {/* Clear button */}
              <button
                onClick={onClearResults}
                className="w-full px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-3xl transition-colors"
              >
                Effacer les resultats
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default BlastRadiusPanel;
