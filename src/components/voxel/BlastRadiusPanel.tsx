/**
 * Epic 30: Story 30.4, 30.5 & 30.8 - Blast Radius Stats Panel
 *
 * Sidebar panel showing simulation results:
 * - Total affected nodes, max depth, total impact score
 * - List of affected nodes sorted by impact
 * - Breakdown by node type
 * - What-If simulation controls
 * - Export results functionality
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  Target,
  Layers,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  X,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Download,
  FileText,
  Plus,
  Minus,
  GitBranch,
  Shield,
  Server,
  Briefcase,
  Users,
  ClipboardCheck,
  Bell,
  Sliders,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VoxelNode, VoxelNodeType } from '@/types/voxel';
import type {
  AffectedNode,
  WhatIfScenario,
  WhatIfComparison,
  ExtendedBlastRadiusConfig,
} from '@/services/blastRadiusService';
import type { SimulationMode } from '@/hooks/voxel/useBlastRadius';

// ============================================================================
// Constants
// ============================================================================

const IMPACT_COLORS = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-500' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-500' },
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
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text} ${className}`}>
      {Math.round(impact * 100)}%
    </span>
  );
};

/**
 * Stats card component
 */
const StatsCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.FC<{ className?: string }>;
  color?: string;
  delta?: number;
}> = ({ label, value, icon: Icon, color = 'text-white', delta }) => (
  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs text-white/50">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      {delta !== undefined && delta !== 0 && (
        <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  </div>
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
        p-3 rounded-xl border cursor-pointer transition-all
        ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'bg-white/5 hover:bg-white/10'}
        border-white/10 hover:border-white/20
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
            <span className="text-[10px] text-white/40">{typeLabel}</span>
            <span className="text-[10px] text-white/30">|</span>
            <span className="text-[10px] text-white/40">Profondeur: {node.depth}</span>
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
    <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10">
      <div className="text-xs text-white/70 font-medium">Scenario What-If</div>

      <div className="space-y-2">
        <select
          value={scenarioType}
          onChange={(e) => setScenarioType(e.target.value as WhatIfScenario['type'])}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="remove_node">Supprimer un controle</option>
          <option value="add_node">Ajouter un controle</option>
          <option value="modify_weight">Modifier poids connexion</option>
        </select>

        {scenarioType === 'remove_node' && (
          <select
            value={selectedNodeId}
            onChange={(e) => setSelectedNodeId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Selectionner un controle...</option>
            {controlNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label || node.id.substring(0, 20)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={handleApply}
          disabled={!selectedNodeId}
          className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
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
  <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10">
    <div className="text-xs text-white/70 font-medium flex items-center gap-2">
      <Sliders className="h-4 w-4" />
      Configuration
    </div>

    <div className="space-y-2">
      <div>
        <label className="text-[10px] text-white/50 block mb-1">Profondeur max</label>
        <input
          type="range"
          min={1}
          max={10}
          value={config.maxDepth}
          onChange={(e) => onSetConfig({ maxDepth: parseInt(e.target.value, 10) })}
          className="w-full accent-indigo-500"
        />
        <div className="text-xs text-white/70 text-right">{config.maxDepth}</div>
      </div>

      <div>
        <label className="text-[10px] text-white/50 block mb-1">Seuil min impact</label>
        <input
          type="range"
          min={0}
          max={50}
          value={(config.minProbability || 0.1) * 100}
          onChange={(e) => onSetConfig({ minProbability: parseInt(e.target.value, 10) / 100 })}
          className="w-full accent-indigo-500"
        />
        <div className="text-xs text-white/70 text-right">{((config.minProbability || 0.1) * 100).toFixed(0)}%</div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-[10px] text-white/50">Bidirectionnel</label>
        <input
          type="checkbox"
          checked={config.bidirectional || false}
          onChange={(e) => onSetConfig({ bidirectional: e.target.checked })}
          className="accent-indigo-500"
        />
      </div>
    </div>
  </div>
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
  isSimulating,
  affectedNodes,
  stats,
  businessImpact,
  whatIfResult,
  whatIfScenario,
  config,
  onStartSimulation,
  onStopSimulation,
  onSetConfig,
  onApplyWhatIf,
  onClearWhatIf,
  onFocusNode,
  onClearResults,
  onSetMode,
  onExportPdf,
  onExportCsv,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
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

  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-[420px] bg-slate-950/95 border-l border-white/10 backdrop-blur-2xl z-50 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.3)]"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
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
          <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-white/50">Noeud source</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-medium text-white">{sourceNode.label || sourceNodeId}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                {NODE_TYPE_LABELS[sourceNode.type]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {affectedNodes.length > 0 && (
        <div className="p-5 border-b border-white/10 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              label="Noeuds impactes"
              value={stats.totalAffected}
              icon={Layers}
              color="text-indigo-400"
              delta={whatIfResult?.affectedNodesDelta}
            />
            <StatsCard
              label="Impact total"
              value={stats.totalImpact.toFixed(1)}
              icon={Activity}
              color="text-purple-400"
              delta={whatIfResult ? parseFloat(whatIfResult.impactDelta.toFixed(1)) : undefined}
            />
            <StatsCard
              label="Profondeur max"
              value={stats.maxDepth}
              icon={GitBranch}
              color="text-blue-400"
            />
            <div className={`rounded-xl p-3 border ${businessImpactColors.bg} ${businessImpactColors.border}`}>
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
                key={label}
                className={`flex-1 px-2 py-1.5 rounded-lg ${color.bg} ${color.border} border text-center`}
              >
                <div className={`text-lg font-bold ${color.text}`}>{count}</div>
                <div className="text-[10px] text-white/40">{label}</div>
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
                  key={type}
                  onClick={() => setFilterType(filterType === type ? 'all' : type as VoxelNodeType)}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors
                    ${filterType === type ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/5 text-white/60 hover:bg-white/10'}
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
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="impact">Impact</option>
          <option value="depth">Profondeur</option>
          <option value="type">Type</option>
        </select>

        {/* Config toggle */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/60 hover:text-white'}`}
        >
          <Sliders className="h-4 w-4" />
        </button>
      </div>

      {/* Config Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 py-3 border-b border-white/10 overflow-hidden"
          >
            <ConfigPanel config={config} onSetConfig={onSetConfig} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* What-If Toggle */}
      <div className="px-5 py-3 border-b border-white/10 shrink-0">
        <button
          onClick={() => setShowWhatIf(!showWhatIf)}
          className={`
            w-full flex items-center justify-between px-4 py-2 rounded-lg transition-colors
            ${showWhatIf ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/70 hover:bg-white/10'}
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
              <WhaitIfBuilder onApply={onApplyWhatIf} nodes={allNodes} />
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
                {sourceNodeId ? 'Aucun noeud impacte' : 'Selectionnez un noeud source'}
              </p>
              <p className="text-white/40 text-xs mt-1">
                {sourceNodeId
                  ? 'Ajustez la configuration pour etendre la simulation'
                  : 'Cliquez sur un noeud dans la vue 3D'}
              </p>
            </motion.div>
          ) : (
            filteredNodes.map((node) => (
              <AffectedNodeItem
                key={node.nodeId}
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
      <div className="p-5 border-t border-white/10 shrink-0 space-y-3">
        {/* What-If comparison summary */}
        {whatIfResult && (
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/30">
            <div className="text-xs text-indigo-400 font-medium mb-2">Comparaison What-If</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className={`text-sm font-bold ${whatIfResult.impactDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {whatIfResult.impactDelta > 0 ? '+' : ''}{whatIfResult.impactDelta.toFixed(1)}
                </div>
                <div className="text-[10px] text-white/40">Impact</div>
              </div>
              <div>
                <div className="text-sm font-bold text-yellow-400">
                  {whatIfResult.newlyAffected.length}
                </div>
                <div className="text-[10px] text-white/40">Nouveaux</div>
              </div>
              <div>
                <div className="text-sm font-bold text-green-400">
                  {whatIfResult.noLongerAffected.length}
                </div>
                <div className="text-[10px] text-white/40">Proteges</div>
              </div>
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex gap-2">
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              disabled={affectedNodes.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          )}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={affectedNodes.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-xl transition-colors border border-white/10"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
        </div>

        {/* Clear button */}
        <button
          onClick={onClearResults}
          className="w-full px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
        >
          Effacer les resultats
        </button>
      </div>
    </motion.aside>
  );
};

// Re-export with correct name
const WhaitIfBuilder = WhatIfBuilder;

export default BlastRadiusPanel;
