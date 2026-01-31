import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Layers,
  Eye,
  Flame,
  RotateCw,
  AlertTriangle,
  Clock,
  Zap,
  Search,
  X,
  Keyboard,
  HelpCircle,
  Network,
  Command,
  Activity,
  Target,
  Info,
  Shield,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useStore } from '../store';
import { useVoxels } from '../hooks/useVoxels';
import { useActiveFrameworks } from '../hooks/useFrameworks';
import { aiService } from '../services/aiService';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';

import { VoxelGuide } from '../components/VoxelGuide';
const VoxelStudio = React.lazy(() => import('../components/VoxelStudio').then(m => ({ default: m.VoxelStudio })));
import { LoadingScreen } from '../components/ui/LoadingScreen';

import { SEO } from '../components/SEO';

import { Asset, Risk, Project, Incident, AISuggestedLink, VoxelNode, DataNode, LayerType, VoxelNodeStatus, VoxelEdge } from '../types';
import { VoxelSidebar } from '../components/voxel/VoxelSidebar';
import { VoxelDetailPanel } from '../components/voxel/overlays/VoxelDetailPanel';

import { voxelStoreActions } from '../stores/voxelStore';

import { AnomalyPanel } from '../components/voxel/AnomalyPanel';
import { BlastRadiusPanel } from '../components/voxel/BlastRadiusPanel';
import { TimeMachine } from '../components/voxel/TimeMachine';
import { useBlastRadius } from '../hooks/voxel/useBlastRadius';

// ============================================================================
// Constants
// ============================================================================

const LAYER_CONFIG: { id: LayerType; label: string; color: string; bgColor: string }[] = [
  { id: 'asset', label: 'Actifs', color: '#3B82F6', bgColor: 'bg-blue-500' },
  { id: 'risk', label: 'Risques', color: '#F97316', bgColor: 'bg-orange-500' },
  { id: 'control', label: 'Contrôles', color: '#8B5CF6', bgColor: 'bg-purple-500' },
  { id: 'project', label: 'Projets', color: '#10B981', bgColor: 'bg-emerald-500' },
  { id: 'audit', label: 'Audits', color: '#06B6D4', bgColor: 'bg-cyan-500' },
  { id: 'incident', label: 'Incidents', color: '#EF4444', bgColor: 'bg-red-500' },
  { id: 'supplier', label: 'Fournisseurs', color: '#F59E0B', bgColor: 'bg-amber-500' },
];

const KEYBOARD_SHORTCUTS = [
  { key: '⌘K', action: 'Recherche rapide' },
  { key: 'Esc', action: 'Fermer / Quitter' },
  { key: '←/→', action: 'Navigation nœuds' },
  { key: 'F', action: 'Plein écran' },
  { key: 'R', action: 'Réinitialiser vue' },
  { key: 'L', action: 'Menu calques' },
  { key: 'S', action: 'Capture écran' },
];

const DETAIL_ROUTES: Record<LayerType, string> = {
  asset: '/assets',
  risk: '/risks',
  project: '/projects',
  audit: '/audits',
  incident: '/incidents',
  supplier: '/suppliers',
  control: '/compliance'
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatSafeDate = (date: unknown): string => {
  if (!date) return '—';
  try {
    if (typeof date === 'object' && date !== null && 'seconds' in date) {
      const ts = date as { seconds: number };
      return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR');
    }
    if (date instanceof Date) return date.toLocaleDateString('fr-FR');
    if (typeof date === 'string') {
      const d = new Date(date);
      return isNaN(d.getTime()) ? date : d.toLocaleDateString('fr-FR');
    }
    return String(date);
  } catch {
    return '—';
  }
};

const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if ('seconds' in value) return formatSafeDate(value);
    return JSON.stringify(value);
  }
  return String(value);
};

const isValidRoute = (path: string): boolean => {
  const allowedRoutes = ['/assets', '/risks', '/projects', '/audits', '/incidents', '/suppliers', '/library', '/compliance'];
  return allowedRoutes.some(allowed => path.startsWith(allowed));
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number | string;
  disabled?: boolean;
  compact?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, label, onClick, active, badge, disabled, compact }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative transition - all duration - 200
      ${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'}
      ${active
        ? 'bg-white/15 text-white shadow-lg'
        : 'text-white/60 hover:text-white hover:bg-white/10'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
`}
    title={label}
    aria-label={label}
  >
    {icon}
    {badge !== undefined && (
      <span className={`absolute - top - 0.5 - right - 0.5 flex items - center justify - center rounded - full bg - brand - 500 font - bold text - white ${compact ? 'min-w-[14px] h-[14px] text-[11px] px-0.5' : 'min-w-[16px] h-[16px] text-[11px] px-1'} `}>
        {badge}
      </span>
    )}
  </button>
);

interface StatusBarProps {
  totalNodes: number;
  activeLayers: number;
  selectedNode: DataNode | null;
  isFullscreen: boolean;
  criticalCount: number;
  warningCount: number;
  connectionCount: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ totalNodes, activeLayers, selectedNode, isFullscreen, criticalCount, warningCount, connectionCount }) => (
  <motion.div
    initial={{ y: 40 }}
    animate={{ y: 0 }}
    className="absolute bottom-0 left-0 right-0 h-10 z-[100000] flex items-center justify-between px-3 sm:px-4 lg:px-6 bg-slate-900/90 backdrop-blur-2xl border-t border-white/5"
  >
    {/* Left - Stats (compact) */}
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="flex items-center gap-1.5">
        <Network className="w-3.5 h-3.5 text-white/50" />
        <span className="text-xs font-medium text-white">{totalNodes}</span>
        <span className="text-xs text-white/40 hidden sm:inline">nœuds</span>
      </div>

      <div className="w-px h-4 bg-white/10 hidden sm:block" />

      <div className="flex items-center gap-1.5 hidden sm:flex">
        <Layers className="w-3.5 h-3.5 text-white/50" />
        <span className="text-xs font-medium text-white">{activeLayers}/7</span>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-medium text-red-400">{criticalCount}</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[11px] font-medium text-amber-400">{warningCount}</span>
        </div>
      )}
    </div>

    {/* Center - Selected Node (hidden on small screens) */}
    <AnimatePresence mode="wait">
      {selectedNode && (
        <motion.div
          key={selectedNode.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r from-brand-500/20 to-violet-500/20 border border-brand-300"
        >
          <span className="w-2 h-2 rounded-full bg-brand-400" />
          <span className="text-xs text-white/90 font-medium max-w-[150px] truncate">
            {safeRender((selectedNode.data as { name?: string; title?: string; threat?: string }).name || (selectedNode.data as { title?: string }).title || (selectedNode.data as { threat?: string }).threat)}
          </span>
          <span className="text-[11px] text-white/40 capitalize">{selectedNode.type}</span>
          {connectionCount > 0 && (
            <span className="text-[11px] text-brand-400">{connectionCount}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>

    {/* Right - Controls hint (compact) */}
    <div className="flex items-center gap-2 sm:gap-3 text-[11px] text-white/30">
      {isFullscreen && (
        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/50">ESC</span>
      )}
      <span className="hidden lg:inline">Scroll: zoom</span>
      <span className="hidden lg:inline">Drag: orbite</span>
      <span className="flex items-center gap-0.5">
        <Command className="w-2.5 h-2.5" />K
      </span>
    </div>
  </motion.div>
);

// ============================================================================
// Main Component
// ============================================================================

export const VoxelView: React.FC = () => {
  const { user } = useAuth();
  const { addToast, activeFramework, setActiveFramework, t } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Frameworks
  const { data: activeFrameworks } = useActiveFrameworks({ realtime: true });
  // Ensure activeFramework is set if not already, using the first available framework
  useEffect(() => {
    if (!activeFramework && activeFrameworks && activeFrameworks.length > 0) {
      setActiveFramework(activeFrameworks[0].frameworkId); // Changed af.id to af.frameworkId
    }
  }, [activeFramework, activeFrameworks, setActiveFramework]);

  // Data
  const { loading, assets, risks, projects, audits, incidents, suppliers, controls, refresh } = useVoxels();

  // UI State
  const [selectedNode, setSelectedNode] = useState<DataNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [releaseToken, _setReleaseToken] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('voxel_navCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Visualization Settings
  const [heatmapEnabled, setHeatmapEnabled] = useState(() => JSON.parse(localStorage.getItem('voxel_heatmapEnabled') || 'true'));
  const [xRayEnabled, setXRayEnabled] = useState(() => JSON.parse(localStorage.getItem('voxel_xRayEnabled') || 'false'));
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => JSON.parse(localStorage.getItem('voxel_autoRotateEnabled') || 'true'));
  const [activeLayers, setActiveLayers] = useState<LayerType[]>(() => {
    try {
      const saved = localStorage.getItem('voxel_activeLayers');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : LAYER_CONFIG.map(l => l.id);
    } catch {
      return LAYER_CONFIG.map(l => l.id);
    }
  });

  // UI Panels
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [isAnomalyPanelOpen, setIsAnomalyPanelOpen] = useState(false);
  const [isBlastRadiusPanelOpen, setIsBlastRadiusPanelOpen] = useState(false);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);

  // AI
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestedLinks, setSuggestedLinks] = useState<AISuggestedLink[]>([]);

  // Guide
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('voxel_guide_seen') === null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');

  // Legend
  const [showLegend, setShowLegend] = useState(false);

  // Screenshot
  const [isCapturing, setIsCapturing] = useState(false);

  // Blast Radius
  const blastRadius = useBlastRadius();

  const isInitialized = useRef(false);

  // Persistence
  useEffect(() => { localStorage.setItem('voxel_navCollapsed', JSON.stringify(navCollapsed)); }, [navCollapsed]);
  useEffect(() => { localStorage.setItem('voxel_heatmapEnabled', JSON.stringify(heatmapEnabled)); }, [heatmapEnabled]);
  useEffect(() => { localStorage.setItem('voxel_xRayEnabled', JSON.stringify(xRayEnabled)); }, [xRayEnabled]);
  useEffect(() => { localStorage.setItem('voxel_autoRotateEnabled', JSON.stringify(autoRotateEnabled)); }, [autoRotateEnabled]);
  useEffect(() => { localStorage.setItem('voxel_activeLayers', JSON.stringify(activeLayers)); }, [activeLayers]);

  // ============================================================================
  // Derived Data
  // ============================================================================

  const orderedNodes = useMemo(() => {
    const getLabel = (item: DataNode['data']): string => {
      if ('name' in item && item.name) return String(item.name);
      if ('title' in item && item.title) return String(item.title);
      if ('threat' in item && item.threat) return String(item.threat);
      return 'Élément';
    };
    const mapNodes = (collection: DataNode['data'][] | undefined | null, type: LayerType) =>
      (collection || []).map(item => ({ id: item.id, type, label: getLabel(item) }));
    return [
      ...mapNodes(assets, 'asset'),
      ...mapNodes(risks, 'risk'),
      ...mapNodes(controls, 'control'),
      ...mapNodes(projects, 'project'),
      ...mapNodes(audits, 'audit'),
      ...mapNodes(incidents, 'incident'),
      ...mapNodes(suppliers, 'supplier'),
    ];
  }, [assets, risks, controls, projects, audits, incidents, suppliers]);

  const categorizedNodes = useMemo(() => {
    const sourceMap: Record<LayerType, DataNode['data'][]> = {
      asset: assets, risk: risks, project: projects, audit: audits,
      incident: incidents, supplier: suppliers, control: controls,
    };
    return LAYER_CONFIG.map(option => ({
      ...option,
      hint: '',
      items: (sourceMap[option.id] || []).map(item => {
        let label = 'Élément';
        if ('name' in item) label = item.name;
        else if ('title' in item) label = item.title;
        else if ('threat' in item) label = item.threat;
        let meta = '';
        if (option.id === 'risk') meta = `Score ${(item as Risk).score} `;
        else if (option.id === 'project') meta = `${(item as Project).progress || 0}% `;
        else if (option.id === 'incident') meta = safeRender((item as Incident).severity);
        return { id: item.id, label: safeRender(label), meta };
      }).filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    }));
  }, [assets, risks, projects, audits, incidents, suppliers, controls, searchQuery]);

  const voxelNodesForPanel = useMemo(() => {
    const nodes: VoxelNode[] = [];
    const now = new Date();

    const getStatusFromAsset = (asset: Asset): VoxelNodeStatus => {
      const values = [asset.confidentiality, asset.integrity, asset.availability];
      const hasCritical = values.some(v => v === 'Critique');
      const hasHigh = values.some(v => v === 'Élevée');
      return hasCritical ? 'critical' : hasHigh ? 'warning' : 'normal';
    };

    assets.forEach(asset => {
      nodes.push({
        id: asset.id, type: 'asset', label: asset.name || 'Asset',
        status: getStatusFromAsset(asset), position: { x: 0, y: 0, z: 0 }, size: 1,
        data: asset as unknown as Record<string, unknown>, connections: [],
        createdAt: now, updatedAt: now
      });
    });

    risks.forEach(risk => {
      const score = Number.isFinite(risk.score) ? risk.score : 0;
      nodes.push({
        id: risk.id, type: 'risk', label: risk.threat || 'Risk',
        status: score >= 15 ? 'critical' : score >= 10 ? 'warning' : 'normal',
        position: { x: 0, y: 0, z: 0 }, size: 1,
        data: risk as unknown as Record<string, unknown>,
        connections: risk.assetId ? [risk.assetId] : [],
        createdAt: now, updatedAt: now
      });
    });

    controls.forEach(c => {
      nodes.push({
        id: c.id, type: 'control', label: c.name || 'Control', status: 'normal',
        position: { x: 0, y: 0, z: 0 }, size: 1,
        data: c as unknown as Record<string, unknown>,
        connections: [...(Array.isArray(c.relatedAssetIds) ? c.relatedAssetIds : []), ...(Array.isArray(c.relatedRiskIds) ? c.relatedRiskIds : [])],
        createdAt: now, updatedAt: now
      });
    });

    projects.forEach(p => {
      nodes.push({
        id: p.id, type: 'project', label: p.name || 'Project',
        status: (p.status || '').toLowerCase().includes('retard') ? 'warning' : 'normal',
        position: { x: 0, y: 0, z: 0 }, size: 1,
        data: p as unknown as Record<string, unknown>,
        connections: Array.isArray(p.relatedRiskIds) ? p.relatedRiskIds : [],
        createdAt: now, updatedAt: now
      });
    });

    audits.forEach(a => {
      nodes.push({
        id: a.id, type: 'audit', label: a.name || 'Audit', status: 'normal',
        position: { x: 0, y: 0, z: 0 }, size: 1,
        data: a as unknown as Record<string, unknown>,
        connections: [...(Array.isArray(a.relatedAssetIds) ? a.relatedAssetIds : []), ...(Array.isArray(a.relatedRiskIds) ? a.relatedRiskIds : []), ...(Array.isArray(a.relatedProjectIds) ? a.relatedProjectIds : [])],
        createdAt: now, updatedAt: now
      });
    });

    incidents.forEach(i => {
      nodes.push({
        id: i.id, type: 'incident', label: i.title || 'Incident',
        status: i.severity === 'Critique' ? 'critical' : i.severity === 'Élevée' ? 'warning' : 'normal',
        position: { x: 0, y: 0, z: 0 }, size: i.severity === 'Critique' ? 1.5 : 1,
        data: i as unknown as Record<string, unknown>,
        connections: i.affectedAssetId ? [i.affectedAssetId] : [],
        createdAt: now, updatedAt: now
      });
    });

    suppliers.forEach(s => {
      nodes.push({
        id: s.id, type: 'supplier', label: s.name || 'Supplier', status: 'normal',
        position: { x: 0, y: 0, z: 0 }, size: 1,
        data: s as unknown as Record<string, unknown>,
        connections: [...(Array.isArray(s.relatedAssetIds) ? s.relatedAssetIds : []), ...(Array.isArray(s.relatedProjectIds) ? s.relatedProjectIds : [])],
        createdAt: now, updatedAt: now
      });
    });

    return nodes;
  }, [assets, risks, controls, projects, audits, incidents, suppliers]);

  const nodesMap = useMemo(() => new Map(voxelNodesForPanel.map(n => [n.id, n])), [voxelNodesForPanel]);

  const voxelEdgesForStore = useMemo(() => {
    const edges: VoxelEdge[] = [];
    let edgeId = 0;
    voxelNodesForPanel.forEach(node => {
      node.connections.forEach(targetId => {
        if (nodesMap.has(targetId)) {
          edges.push({ id: `edge - ${edgeId++} `, source: node.id, target: targetId, type: 'dependency', weight: 1 });
        }
      });
    });
    return edges;
  }, [voxelNodesForPanel, nodesMap]);

  // Sync to store
  useEffect(() => {
    if (voxelNodesForPanel.length > 0) {
      voxelStoreActions.setNodes(voxelNodesForPanel);
    }
  }, [voxelNodesForPanel]);

  useEffect(() => {
    if (voxelEdgesForStore.length > 0) {
      voxelStoreActions.setEdges(voxelEdgesForStore);
    }
  }, [voxelEdgesForStore]);

  const selectedVoxelNode = useMemo(() => selectedNode ? nodesMap.get(selectedNode.id) || null : null, [selectedNode, nodesMap]);

  const selectedNodeConnectionCount = useMemo(() => {
    if (!selectedVoxelNode) return 0;
    return selectedVoxelNode.connections.length + voxelNodesForPanel.filter(n => n.connections.includes(selectedVoxelNode.id)).length;
  }, [selectedVoxelNode, voxelNodesForPanel]);

  // Stats for status bar
  const { criticalCount, warningCount } = useMemo(() => {
    let critical = 0;
    let warning = 0;
    voxelNodesForPanel.forEach(n => {
      if (n.status === 'critical') critical++;
      else if (n.status === 'warning') warning++;
    });
    return { criticalCount: critical, warningCount: warning };
  }, [voxelNodesForPanel]);

  // Command palette filtered results
  const commandPaletteResults = useMemo(() => {
    if (!commandSearch.trim()) return orderedNodes.slice(0, 8);
    const query = commandSearch.toLowerCase();
    return orderedNodes
      .filter(n => n.label.toLowerCase().includes(query) || n.type.toLowerCase().includes(query))
      .slice(0, 10);
  }, [orderedNodes, commandSearch]);

  const blastRadiusSourceNode = useMemo(() => blastRadius.sourceNodeId ? nodesMap.get(blastRadius.sourceNodeId) || null : null, [blastRadius.sourceNodeId, nodesMap]);
  const blastRadiusAffectedNodes = useMemo(() => blastRadius.blastRadiusResult?.affectedNodes || [], [blastRadius.blastRadiusResult]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const findEntityByType = useCallback((type: LayerType, id: string) => {
    const sourceMap: Record<LayerType, DataNode['data'][]> = {
      asset: assets, risk: risks, project: projects, audit: audits,
      incident: incidents, supplier: suppliers, control: controls,
    };
    return sourceMap[type].find(item => item.id === id);
  }, [assets, risks, projects, audits, incidents, suppliers, controls]);

  const applyFocus = useCallback((nodeId: string, type: LayerType) => {
    setActiveLayers(prev => prev.includes(type) ? prev : [...prev, type]);
    setFocusedNodeId(nodeId);
    const entity = findEntityByType(type, nodeId);
    if (entity) {
      setSelectedNode({ id: nodeId, type, data: entity } as DataNode);
      setIsDetailPanelOpen(true);
    }
  }, [findEntityByType]);

  const focusByOffset = useCallback((offset: number) => {
    if (!orderedNodes.length) return;
    const currentIndex = orderedNodes.findIndex(n => n.id === focusedNodeId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + offset + orderedNodes.length) % orderedNodes.length;
    const target = orderedNodes[nextIndex];
    if (target) applyFocus(target.id, target.type as LayerType);
  }, [orderedNodes, focusedNodeId, applyFocus]);

  const handleLayerToggle = useCallback((layer: LayerType) => {
    setActiveLayers(prev => {
      if (prev.includes(layer) && prev.length === 1) return prev;
      return prev.includes(layer) ? prev.filter(id => id !== layer) : [...prev, layer];
    });
  }, []);

  const handleResetView = useCallback(() => {
    setFocusedNodeId(null);
    setSelectedNode(null);
    setActiveLayers(LAYER_CONFIG.map(l => l.id));
    setIsFullscreen(false);
    setHeatmapEnabled(true);
    setXRayEnabled(false);
    setAutoRotateEnabled(true);
    setIsDetailPanelOpen(false);
  }, []);

  const handleNodeClick = useCallback((node: VoxelNode | null) => {
    setSelectedNode(node as DataNode | null);
    setFocusedNodeId(node?.id ?? null);
    if (node) setIsDetailPanelOpen(true);
  }, []);

  const handleDetailPanelNavigate = useCallback((node: VoxelNode) => {
    const route = DETAIL_ROUTES[node.type];
    if (route && isValidRoute(route)) {
      addToast(t('voxel.toast.navigatingTo', { defaultValue: `Navigation vers ${node.label}`, label: node.label }), 'info');
      navigate(`${route}?id = ${node.id} `, { state: { fromVoxel: true, nodeId: node.id } });
    }
  }, [addToast, navigate, t]);

  const handleSelectLinkedEntity = useCallback((nodeId: string) => {
    const node = nodesMap.get(nodeId);
    if (node) applyFocus(nodeId, node.type as LayerType);
  }, [nodesMap, applyFocus]);

  const handleStartBlastRadius = useCallback((nodeId: string) => {
    blastRadius.startSimulation(nodeId);
    setIsBlastRadiusPanelOpen(true);
  }, [blastRadius]);

  const handleAIAnalysis = async () => {
    if (!user || !hasPermission(user, 'CTCEngine', 'read')) {
      addToast(t('voxel.toast.permissionDenied', { defaultValue: "Permission refusée" }), "error");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await aiService.analyzeGraph({ assets, risks, projects, audits, incidents, suppliers, controls });
      setSuggestedLinks(result.suggestions);
      addToast(t('voxel.toast.aiAnalysisComplete', { defaultValue: "Analyse IA terminée" }), "success");
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'VoxelView.handleAIAnalysis', 'UNKNOWN_ERROR');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScreenshot = useCallback(async () => {
    if (isCapturing || !containerRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = containerRef.current.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `ctc - engine - ${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        addToast(t('voxel.toast.captureSaved', { defaultValue: "Capture sauvegardée" }), "success");
      }
    } catch {
      addToast(t('voxel.toast.captureError', { defaultValue: "Erreur lors de la capture" }), "error");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, addToast, t]);

  const handleCommandSelect = useCallback((node: { id: string; type: string }) => {
    applyFocus(node.id, node.type as LayerType);
    setShowCommandPalette(false);
    setCommandSearch('');
  }, [applyFocus]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Fullscreen body class
  useEffect(() => {
    document.body.classList.toggle('voxel-fullscreen', isFullscreen);
    document.body.classList.toggle('overflow-hidden', isFullscreen);
    return () => {
      document.body.classList.remove('voxel-fullscreen', 'overflow-hidden');
    };
  }, [isFullscreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette shortcut (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }

      // Close command palette on Escape
      if (e.key === 'Escape' && showCommandPalette) {
        setShowCommandPalette(false);
        setCommandSearch('');
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'Escape':
          if (isFullscreen) setIsFullscreen(false);
          else if (isDetailPanelOpen) setIsDetailPanelOpen(false);
          else if (showLegend) setShowLegend(false);
          break;
        case 'ArrowLeft':
          focusByOffset(-1);
          break;
        case 'ArrowRight':
          focusByOffset(1);
          break;
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) setIsFullscreen(prev => !prev);
          break;
        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) handleResetView();
          break;
        case 'l':
        case 'L':
          if (!e.metaKey && !e.ctrlKey) setShowLayerMenu(prev => !prev);
          break;
        case 's':
        case 'S':
          if (!e.metaKey && !e.ctrlKey) handleScreenshot();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isDetailPanelOpen, showCommandPalette, showLegend, focusByOffset, handleResetView, handleScreenshot]);

  // Initial focus
  useEffect(() => {
    if (loading || isInitialized.current || !orderedNodes.length) return;
    const first = orderedNodes[0];
    applyFocus(first.id, first.type as LayerType);
    isInitialized.current = true;
  }, [loading, orderedNodes, applyFocus]);

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return <LoadingScreen message="Chargement du CTC Engine..." />;
  }

  return (
    <div className="relative w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] h-[calc(100vh-4.5rem)] bg-slate-950 overflow-hidden -mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-24">
      <SEO title="CTC Engine" description="Visualisation 3D de l'écosystème de sécurité" />

      {/* Main 3D Container */}
      <div ref={containerRef} className="absolute inset-0">
        <React.Suspense fallback={<LoadingScreen message="Chargement 3D..." />}>
          <VoxelStudio
            assets={assets}
            risks={risks}
            projects={projects}
            audits={audits}
            incidents={incidents}
            suppliers={suppliers}
            controls={controls}
            onNodeClick={handleNodeClick}
            className="w-full h-full"
            visibleTypes={activeLayers}
            focusNodeId={focusedNodeId}
            highlightCritical={heatmapEnabled}
            xRayMode={xRayEnabled}
            autoRotatePreference={autoRotateEnabled}
            presentationMode={false}
            releaseToken={releaseToken}
            suggestedLinks={suggestedLinks}
            impactMode={false}
          />
        </React.Suspense>
      </div>

      {/* Top Bar - Compact & Responsive */}
      <motion.div
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        className="absolute top-0 left-0 right-0 z-[100000] px-2 sm:px-3 lg:px-4 pt-2 sm:pt-3"
      >
        <div className="flex items-center justify-between h-12 px-2 sm:px-3 lg:px-4 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl">
          {/* Left - Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 ring-1 ring-white/10 shadow-lg relative overflow-hidden group">
                <img
                  src="/images/tableau-de-bord.png"
                  alt="VOXEL"
                  className="w-6 h-6 object-contain relative z-10 transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white tracking-tight">CTC Engine</h1>
                <p className="text-[11px] text-white/40 hidden lg:block">Cyber Threat Cartography</p>
              </div>
            </div>
          </div>

          {/* Center - Health Indicators (hidden on small) */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            {criticalCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-500/30"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-xs font-medium text-red-400">{criticalCount}</span>
                <span className="text-[11px] text-red-400/70 hidden lg:inline">critiques</span>
              </motion.div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-amber-400">{warningCount}</span>
                <span className="text-[11px] text-amber-400/70 hidden lg:inline">alertes</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/15 border border-success/30">
              <Activity className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-medium text-success">{orderedNodes.length}</span>
              <span className="text-[11px] text-success/70 hidden lg:inline">nœuds</span>
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Search Button */}
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200 group"
            >
              <Search className="w-4 h-4" />
              <kbd className="hidden sm:flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/10 text-[11px] font-medium text-white/40 group-hover:text-white/60">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
            </button>

            {/* Framework Selector */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
              <Shield className="w-3.5 h-3.5 text-brand-400" />
              <select
                value={activeFramework || ''}
                onChange={(e) => setActiveFramework(e.target.value || null)}
                className="bg-transparent text-[11px] font-medium text-white outline-none cursor-pointer border-none focus:ring-0 px-1"
                aria-label="Sélectionner un framework"
              >
                <option value="" className="bg-slate-900">Tous les frameworks</option>
                {activeFrameworks?.map(af => (
                  <option key={af.frameworkId} value={af.frameworkCode} className="bg-slate-900">
                    {af.frameworkCode}
                  </option>
                ))}
              </select>
            </div>

            {/* AI Analysis */}
            <button
              onClick={handleAIAnalysis}
              disabled={analyzing}
              className={`flex items - center gap - 1.5 px - 2.5 py - 1.5 rounded - lg font - medium text - xs transition - all duration - 200 ${analyzing
                ? 'bg-brand-100 text-brand-300 cursor-wait'
                : 'bg-gradient-to-r from-brand-500 to-violet-600 text-white hover:shadow-lg hover:shadow-brand-500/30'
                } `}
            >
              {analyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{analyzing ? 'Analyse...' : 'IA'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={refresh}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-200 hover:rotate-180"
              title="Actualiser"
            >
              <RefreshCw className="w-4 h-4 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Left Sidebar */}
      <VoxelSidebar
        navCollapsed={navCollapsed}
        setNavCollapsed={setNavCollapsed}
        orderedNodesLength={orderedNodes.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categorizedNodes={categorizedNodes}
        selectedNodeId={focusedNodeId}
        onNodeSelect={applyFocus}
        activeLayers={activeLayers}
        onLayerToggle={handleLayerToggle}
      />

      {/* Right Toolbar - Vertical */}
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="absolute top-20 right-3 z-[100000] flex flex-col gap-1.5"
      >
        {/* Navigation */}
        <div className="flex flex-col gap-0.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
          <ToolButton icon={<ChevronLeft className="w-4 h-4" />} label="Précédent" onClick={() => focusByOffset(-1)} compact />
          <ToolButton icon={<ChevronRight className="w-4 h-4" />} label="Suivant" onClick={() => focusByOffset(1)} compact />
        </div>

        {/* Layers */}
        <div className="relative">
          <div className="flex flex-col p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
            <ToolButton
              icon={<Layers className="w-4 h-4" />}
              label="Calques"
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              active={showLayerMenu}
              badge={activeLayers.length}
              compact
            />
          </div>
          {/* Layer Dropdown */}
          <AnimatePresence>
            {showLayerMenu && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="absolute right-10 top-0 w-44 p-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl"
              >
                <div className="flex items-center justify-between px-2 py-1 mb-0.5">
                  <span className="text-[11px] font-medium text-white/60">Calques</span>
                  <span className="text-[11px] text-white/40">{activeLayers.length}/7</span>
                </div>
                {LAYER_CONFIG.map(layer => {
                  const isActive = activeLayers.includes(layer.id);
                  const count = categorizedNodes.find(c => c.id === layer.id)?.items.length || 0;
                  return (
                    <button
                      key={layer.id}
                      onClick={() => handleLayerToggle(layer.id)}
                      className={`w - full flex items - center justify - between px - 2 py - 1 rounded - lg text - [11px] transition ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        } `}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w - 2 h - 2 rounded - full ${layer.bgColor} `} />
                        <span>{layer.label}</span>
                      </div>
                      <span className="text-[11px] text-white/40">{count}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Visualization */}
        <div className="flex flex-col gap-0.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
          <ToolButton icon={<Flame className="w-4 h-4" />} label="Heatmap" onClick={() => setHeatmapEnabled(!heatmapEnabled)} active={heatmapEnabled} compact />
          <ToolButton icon={<Eye className="w-4 h-4" />} label="X-Ray" onClick={() => setXRayEnabled(!xRayEnabled)} active={xRayEnabled} compact />
          <ToolButton icon={<RotateCw className="w-4 h-4" />} label="Auto-rotation" onClick={() => setAutoRotateEnabled(!autoRotateEnabled)} active={autoRotateEnabled} compact />
        </div>

        {/* Analysis */}
        <div className="flex flex-col gap-0.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
          <ToolButton icon={<AlertTriangle className="w-4 h-4" />} label="Anomalies" onClick={() => setIsAnomalyPanelOpen(!isAnomalyPanelOpen)} active={isAnomalyPanelOpen} compact />
          <ToolButton icon={<Zap className="w-4 h-4" />} label="Blast Radius" onClick={() => setIsBlastRadiusPanelOpen(!isBlastRadiusPanelOpen)} active={isBlastRadiusPanelOpen} compact />
          <ToolButton icon={<Clock className="w-4 h-4" />} label="Time Machine" onClick={() => setIsTimeMachineOpen(!isTimeMachineOpen)} active={isTimeMachineOpen} compact />
        </div>

        {/* View */}
        <div className="flex flex-col gap-0.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
          <ToolButton icon={<RefreshCw className="w-4 h-4" />} label="Réinitialiser (R)" onClick={handleResetView} compact />
          <ToolButton
            icon={isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            label={isFullscreen ? "Quitter plein écran (F)" : "Plein écran (F)"}
            onClick={() => setIsFullscreen(!isFullscreen)}
            active={isFullscreen}
            compact
          />
        </div>

        {/* Help */}
        <div className="flex flex-col gap-0.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/10">
          <ToolButton icon={<Info className="w-4 h-4" />} label="Légende" onClick={() => setShowLegend(!showLegend)} active={showLegend} compact />
          <ToolButton icon={<Keyboard className="w-4 h-4" />} label="Raccourcis" onClick={() => setShowShortcuts(!showShortcuts)} active={showShortcuts} compact />
          <ToolButton icon={<HelpCircle className="w-4 h-4" />} label="Guide" onClick={() => setShowGuide(true)} compact />
        </div>
      </motion.div>

      {/* Legend Panel */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-16 z-[100000] w-48 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Légende</span>
              <button onClick={() => setShowLegend(false)} className="p-0.5 hover:bg-white/10 rounded transition">
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>

            {/* Node Types */}
            <div className="mb-2">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wide">Types</span>
              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
                {LAYER_CONFIG.map(layer => (
                  <div key={layer.id} className="flex items-center gap-1 py-0.5">
                    <span className={`w - 2 h - 2 rounded - full ${layer.bgColor} `} />
                    <span className="text-[11px] text-white/80 truncate">{layer.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="mb-2 pt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wide">États</span>
              <div className="mt-1 flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] text-red-400">{criticalCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[11px] text-amber-400">{warningCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  <span className="text-[11px] text-success">{orderedNodes.length - criticalCount - warningCount}</span>
                </div>
              </div>
            </div>

            {/* Connections */}
            <div className="pt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-white/40 uppercase tracking-wide">Liens</span>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-brand-500 to-violet-500 rounded" />
                  <span className="text-[11px] text-white/70">Dépendance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded" />
                  <span className="text-[11px] text-white/70">Impact</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Panel */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-16 z-[100000] w-44 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white">Raccourcis</span>
              <button onClick={() => setShowShortcuts(false)} className="p-0.5 hover:bg-white/10 rounded">
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
            <div className="space-y-1">
              {KEYBOARD_SHORTCUTS.map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60">{action}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette (Spotlight Search) */}
      <AnimatePresence>
        {showCommandPalette && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCommandPalette(false); setCommandSearch(''); }}
              className="fixed inset-0 z-[100002] bg-black/60 backdrop-blur-sm"
            />
            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[100003] w-full max-w-xl"
            >
              <div className="mx-4 overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                  <Search className="w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                    placeholder="Rechercher un nœud..."
                    className="flex-1 bg-transparent text-white text-lg placeholder:text-white/30 outline-none"
                  />
                  <kbd className="px-2 py-1 rounded bg-white/10 text-xs text-white/40">ESC</kbd>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto p-2">
                  {commandPaletteResults.length === 0 ? (
                    <div className="py-8 text-center text-white/40">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-60" />
                      <p>Aucun résultat trouvé</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {commandPaletteResults.map((node, index) => {
                        const layer = LAYER_CONFIG.find(l => l.id === node.type);
                        return (
                          <button
                            key={node.id}
                            onClick={() => handleCommandSelect(node)}
                            className={`w - full flex items - center gap - 3 px - 3 py - 2.5 rounded - xl text - left transition - all duration - 150 ${index === 0 ? 'bg-brand-100 border border-brand-300' : 'hover:bg-white/5'
                              } `}
                          >
                            <span className={`w - 3 h - 3 rounded - full ${layer?.bgColor || 'bg-slate-500'} `} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-white truncate block">{node.label}</span>
                              <span className="text-xs text-white/40 capitalize">{layer?.label || node.type}</span>
                            </div>
                            {index === 0 && (
                              <kbd className="px-2 py-0.5 rounded bg-white/10 text-[11px] text-white/50">↵</kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <ChevronUp className="w-3 h-3" />
                      <ChevronDown className="w-3 h-3" />
                      naviguer
                    </span>
                    <span className="flex items-center gap-1">↵ sélectionner</span>
                  </div>
                  <span>{commandPaletteResults.length} résultats</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <StatusBar
        totalNodes={orderedNodes.length}
        activeLayers={activeLayers.length}
        selectedNode={selectedNode}
        isFullscreen={isFullscreen}
        criticalCount={criticalCount}
        warningCount={warningCount}
        connectionCount={selectedNodeConnectionCount}
      />

      {/* Panels */}
      <VoxelDetailPanel
        node={selectedVoxelNode}
        isOpen={isDetailPanelOpen && !!selectedVoxelNode}
        onClose={() => setIsDetailPanelOpen(false)}
        onNavigate={handleDetailPanelNavigate}
        connectionCount={selectedNodeConnectionCount}
        onSelectLinkedEntity={handleSelectLinkedEntity}
        nodesMap={nodesMap}
      />

      <AnomalyPanel
        isOpen={isAnomalyPanelOpen}
        onClose={() => setIsAnomalyPanelOpen(false)}
        onFocusNode={handleSelectLinkedEntity}
      />

      <BlastRadiusPanel
        isOpen={isBlastRadiusPanelOpen}
        onClose={() => setIsBlastRadiusPanelOpen(false)}
        sourceNodeId={blastRadius.sourceNodeId}
        sourceNode={blastRadiusSourceNode}
        mode={blastRadius.mode}
        isSimulating={blastRadius.isSimulating}
        affectedNodes={blastRadiusAffectedNodes}
        stats={blastRadius.stats}
        businessImpact={blastRadius.blastRadiusResult?.businessImpact || 'low'}
        whatIfResult={blastRadius.whatIfResult}
        whatIfScenario={blastRadius.whatIfScenario}
        config={blastRadius.config}
        onStartSimulation={handleStartBlastRadius}
        onStopSimulation={blastRadius.stopSimulation}
        onSetConfig={blastRadius.setConfig}
        onApplyWhatIf={blastRadius.applyWhatIfScenario}
        onClearWhatIf={blastRadius.clearWhatIfScenario}
        onFocusNode={handleSelectLinkedEntity}
        onClearResults={blastRadius.clearResults}
        onSetMode={blastRadius.setMode}
      />

      <TimeMachine
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
      />

      <VoxelGuide isOpen={showGuide} onClose={() => { setShowGuide(false); localStorage.setItem('voxel_guide_seen', 'true'); }} />
    </div>
  );
};
