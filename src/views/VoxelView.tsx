import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Maximize2, RefreshCw, ArrowRight, ShieldAlert, Activity, XCircle, Sparkles, BrainCircuit, Layers, Eye, Flame, Search, RotateCw, Minimize2, CheckCheck, MonitorPlay, Info } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useStore } from '../store';
import { useVoxels } from '../hooks/useVoxels';
import { aiService } from '../services/aiService';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';

import { VoxelGuide } from '../components/VoxelGuide';
import { VoxelStudio } from '../components/VoxelStudio';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Network } from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { staggerContainerVariants } from '../components/ui/animationVariants';

import { Asset, Risk, Project, Audit, Incident, Supplier, Control, AISuggestedLink, AIInsight, VoxelNode, DataNode } from '../types';

type LayerType = 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier' | 'control';

const formatSafeDate = (date: unknown): string => {
  if (!date) return '—';
  try {
    // Handle Firestore Timestamp
    if (typeof date === 'object' && date !== null && 'seconds' in date) {
      const ts = date as { seconds: number };
      return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR');
    }
    // Handle Date object
    if (date instanceof Date) {
      return date.toLocaleDateString('fr-FR');
    }
    // Handle string
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

const layerOptions: { id: LayerType; label: string; hint: string; color: string }[] = [
  { id: 'asset', label: 'Actifs', hint: 'Socle infrastructure', color: 'bg-blue-500' },
  { id: 'risk', label: 'Risques', hint: 'Menaces ISO 27005', color: 'bg-orange-500' },
  { id: 'project', label: 'Projets', hint: 'Programmes SSI', color: 'bg-purple-500' },
  { id: 'audit', label: 'Audits', hint: 'Contrôles et revues', color: 'bg-cyan-500' },
  { id: 'incident', label: 'Incidents', hint: 'Alertes SOC', color: 'bg-red-500' },
  { id: 'supplier', label: 'Fournisseurs', hint: 'Partenaires critiques', color: 'bg-green-500' },
  { id: 'control', label: 'Contrôles', hint: 'Mesures de sécurité', color: 'bg-teal-500' }
];

export const VoxelView: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isValidRoute = (path: string): boolean => {
    const allowedRoutes = ['/assets', '/risks', '/projects', '/audits', '/incidents', '/suppliers', '/library', '/compliance'];
    return allowedRoutes.some(allowed => path.startsWith(allowed));
  };

  const {
    loading,
    assets,
    risks,
    projects,
    audits,
    incidents,
    suppliers,
    controls,
    refresh
  } = useVoxels();

  // Restore State Variables
  const [selectedNode, setSelectedNode] = useState<DataNode | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [releaseToken, setReleaseToken] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [impactMode, setImpactMode] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('voxel_navCollapsed');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [heatmapEnabled, setHeatmapEnabled] = useState(() => {
    const saved = localStorage.getItem('voxel_heatmapEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [xRayEnabled, setXRayEnabled] = useState(() => {
    const saved = localStorage.getItem('voxel_xRayEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(() => {
    const saved = localStorage.getItem('voxel_autoRotateEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestedLinks, setSuggestedLinks] = useState<AISuggestedLink[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [isDetailMinimized, setIsDetailMinimized] = useState(() => {
    const saved = localStorage.getItem('voxel_detailMinimized');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Persist isDetailMinimized
  useEffect(() => {
    localStorage.setItem('voxel_detailMinimized', JSON.stringify(isDetailMinimized));
  }, [isDetailMinimized]);
  const [presentationMode, setPresentationMode] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    const saved = localStorage.getItem('voxel_guide_seen');
    return saved === null; // Show if not set (first visit)
  });
  const isInitialized = useRef(false);

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem('voxel_guide_seen', 'true');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Hide main app sidebar in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('voxel-fullscreen');
    } else {
      document.body.classList.remove('voxel-fullscreen');
    }
    return () => document.body.classList.remove('voxel-fullscreen');
  }, [isFullscreen]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'));
    });
    observer.observe(containerRef.current);

    // Force a resize event after a short delay to account for animation settlement
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const detailRoutes: Record<LayerType, string> = {
    asset: '/assets',
    risk: '/risks',
    project: '/projects',
    audit: '/audits',
    incident: '/incidents',
    supplier: '/suppliers',
    control: '/compliance'
  };

  const [activeLayers, setActiveLayers] = useState<LayerType[]>(() => {
    const saved = localStorage.getItem('voxel_activeLayers');
    return saved !== null ? JSON.parse(saved) : layerOptions.map(l => l.id);
  });

  // Persistence Effects
  useEffect(() => { localStorage.setItem('voxel_navCollapsed', JSON.stringify(navCollapsed)); }, [navCollapsed]);
  useEffect(() => { localStorage.setItem('voxel_heatmapEnabled', JSON.stringify(heatmapEnabled)); }, [heatmapEnabled]);
  useEffect(() => { localStorage.setItem('voxel_xRayEnabled', JSON.stringify(xRayEnabled)); }, [xRayEnabled]);
  useEffect(() => { localStorage.setItem('voxel_autoRotateEnabled', JSON.stringify(autoRotateEnabled)); }, [autoRotateEnabled]);
  useEffect(() => { localStorage.setItem('voxel_activeLayers', JSON.stringify(activeLayers)); }, [activeLayers]);

  // Silhouette Map (Restored)
  const silhouetteMap: Record<LayerType, React.ReactNode> = {
    asset: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-blue-500 fill-current">
        <rect x="10" y="28" width="16" height="26" rx="2" className="opacity-80" />
        <rect x="28" y="18" width="18" height="36" rx="2" className="opacity-90" />
        <rect x="48" y="34" width="8" height="20" rx="2" className="opacity-70" />
        <rect x="14" y="34" width="6" height="8" className="text-white fill-current" />
        <rect x="34" y="24" width="6" height="8" className="text-white fill-current" />
      </svg>
    ),
    risk: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-orange-500 fill-current">
        <path d="M32 6 L50 16 V34 C50 44 42 53 32 56 C22 53 14 44 14 34 V16 Z" className="opacity-80" />
        <path d="M32 17 L42 23 V33 C42 40 37 46 32 48 C27 46 22 40 22 33 V23 Z" className="text-white fill-current opacity-70" />
      </svg>
    ),
    project: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-purple-500 fill-current">
        <rect x="10" y="40" width="44" height="10" rx="4" className="opacity-60" />
        <rect x="14" y="28" width="36" height="10" rx="4" className="opacity-75" />
        <rect x="20" y="16" width="24" height="10" rx="4" className="opacity-100" />
        <circle cx="32" cy="21" r="3" className="text-white fill-current" />
      </svg>
    ),
    audit: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-cyan-500 fill-current">
        <rect x="16" y="10" width="32" height="44" rx="4" className="opacity-80" />
        <rect x="22" y="16" width="20" height="4" className="text-white fill-current" />
        <rect x="22" y="24" width="20" height="4" className="text-white/80 fill-current" />
        <rect x="22" y="32" width="12" height="4" className="text-white/60 fill-current" />
        <path d="M36 36 L44 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="33" cy="38" r="4" className="text-white fill-current" />
      </svg>
    ),
    incident: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-rose-500 fill-current">
        <path d="M32 8 C32 16 20 18 24 30 C20 28 16 32 16 38 C16 48 24 56 32 56 C40 56 48 48 48 38 C48 28 40 20 36 18 C38 26 32 28 32 20" className="opacity-90" />
      </svg>
    ),
    control: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-teal-500 fill-current">
        <rect x="12" y="12" width="40" height="40" rx="8" className="opacity-80" />
        <path d="M22 32 L30 40 L42 24" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    supplier: (
      <svg viewBox="0 0 64 64" className="w-full h-full text-green-500 fill-current">
        <circle cx="32" cy="20" r="6" className="opacity-85" />
        <circle cx="16" cy="42" r="5" className="opacity-75" />
        <circle cx="48" cy="42" r="5" className="opacity-75" />
        <circle cx="32" cy="52" r="4" className="opacity-65" />
        <line x1="32" y1="26" x2="32" y2="48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="26" y1="38" x2="38" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <line x1="32" y1="20" x2="16" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="32" y1="20" x2="48" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };

  const orderedNodes = useMemo(() => {
    const getDataLabel = (item: DataNode['data']): string => {
      if ('name' in item && item.name) return String(item.name);
      if ('title' in item && item.title) return String(item.title);
      if ('threat' in item && item.threat) return String(item.threat);
      return 'Élément';
    };
    const mapNode = (collection: DataNode['data'][] | undefined | null, type: LayerType) =>
      (collection || []).map(item => ({ id: item.id, type, label: getDataLabel(item) }));
    return [
      ...mapNode(assets, 'asset'),
      ...mapNode(risks, 'risk'),
      ...mapNode(projects, 'project'),
      ...mapNode(audits, 'audit'),
      ...mapNode(incidents, 'incident'),
      ...mapNode(suppliers, 'supplier'),
      ...mapNode(controls, 'control')
    ];
  }, [assets, risks, projects, audits, incidents, suppliers, controls]);

  const currentIndex = useMemo(() => orderedNodes.findIndex(node => node.id === focusedNodeId), [orderedNodes, focusedNodeId]);

  const ensureLayerActive = useCallback((layer: LayerType) => {
    setActiveLayers(prev => (prev.includes(layer) ? prev : [...prev, layer]));
  }, []);

  const findEntityByType = useCallback((type: LayerType, id: string) => {
    const sourceMap: Record<LayerType, DataNode['data'][]> = {
      asset: assets,
      risk: risks,
      project: projects,
      audit: audits,
      incident: incidents,
      supplier: suppliers,
      control: controls,
    };
    return sourceMap[type].find(item => item.id === id);
  }, [assets, risks, projects, audits, incidents, suppliers, controls]);

  const applyFocus = useCallback((nodeId: string, type: LayerType) => {
    ensureLayerActive(type);
    setFocusedNodeId(nodeId);
    const entity = findEntityByType(type, nodeId);
    if (entity) {
      setSelectedNode({ id: nodeId, type, data: entity } as DataNode);
    }
  }, [ensureLayerActive, findEntityByType]);

  const focusByOffset = (offset: number) => {
    if (!orderedNodes.length) return;
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + offset + orderedNodes.length) % orderedNodes.length;
    const target = orderedNodes[nextIndex];
    if (target) {
      applyFocus(target.id, target.type as LayerType);
      setIsDetailMinimized(false);
    }
  };

  const scenarioPresets: { id: string; label: string; description: string; layers: LayerType[] }[] = [
    { id: 'threat', label: 'Flux Menaces', description: 'Actifs critiques + risques associés + incidents', layers: ['asset', 'risk', 'incident'] },
    { id: 'program', label: 'Programmes SSI', description: 'Projets, audits et fournisseurs', layers: ['project', 'audit', 'supplier'] },
    { id: 'full', label: 'Vue complète', description: 'Réinitialiser toutes les couches', layers: layerOptions.map(layer => layer.id) as LayerType[] },
  ];

  const handleScenarioPreset = (preset: typeof scenarioPresets[number]) => {
    setActiveLayers(preset.layers);
    const firstMatch = orderedNodes.find(node => preset.layers.includes(node.type as LayerType));
    if (firstMatch) {
      applyFocus(firstMatch.id, firstMatch.type as LayerType);
    } else {
      setSelectedNode(null);
      setFocusedNodeId(null);
    }
  };

  const categorizedNodes = useMemo(() => {
    const sourceMap: Record<LayerType, DataNode['data'][]> = {
      asset: assets,
      risk: risks,
      project: projects,
      audit: audits,
      incident: incidents,
      supplier: suppliers,
      control: controls,
    };

    return layerOptions.map(option => ({
      ...option,
      items: (sourceMap[option.id] || []).map(item => {
        let label = 'Élément';
        if ('name' in item) label = item.name;
        else if ('title' in item) label = item.title;
        else if ('threat' in item) label = item.threat;

        let meta = '';
        if (option.id === 'risk') meta = `Score ${(item as Risk).score}`;
        else if (option.id === 'project') meta = `${(item as Project).progress || 0}%`;
        else if (option.id === 'incident') meta = safeRender((item as Incident).severity);
        else if ('owner' in item) meta = safeRender(item.owner);
        else if ('status' in item) meta = safeRender(item.status);

        return {
          id: item.id,
          label: safeRender(label),
          meta,
        };
      }).filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    }));
  }, [assets, risks, projects, audits, incidents, suppliers, controls, searchQuery]);

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;

    // Helper to get the correct "person in charge" based on type
    const getOwner = (node: DataNode) => {
      switch (node.type) {
        case 'project': return node.data.manager;
        case 'audit': return node.data.auditor;
        case 'incident': return (node.data as Incident).responseOwner || (node.data as Incident).reporter;
        case 'supplier': return node.data.owner || '';
        case 'risk': return node.data.owner;
        case 'asset': return node.data.owner;
        default: return '';
      }
    };

    const getTitle = (node: DataNode) => {
      switch (node.type) {
        case 'asset': return node.data.name;
        case 'risk': return node.data.threat;
        case 'project': return node.data.name;
        case 'audit': return node.data.name;
        case 'incident': return node.data.title;
        case 'supplier': return node.data.name;
        default: return 'Élément';
      }
    };

    const base = {
      id: selectedNode.id,
      title: getTitle(selectedNode),
      type: selectedNode.type,
      owner: getOwner(selectedNode),
    };

    switch (selectedNode.type) {
      case 'asset':
        return {
          ...base,
          badge: 'Actif stratégique',
          gradient: 'from-blue-500/80 via-indigo-500/80 to-violet-500/80',
          stats: [
            { label: 'Confidentialité', value: (selectedNode.data as Asset).confidentiality },
            { label: 'Intégrité', value: (selectedNode.data as Asset).integrity },
            { label: 'Disponibilité', value: (selectedNode.data as Asset).availability },
          ],
          meta: [
            { label: 'Type', value: (selectedNode.data as Asset).type },
            { label: 'Localisation', value: (selectedNode.data as Asset).location },
          ],
        };
      case 'risk':
        return {
          ...base,
          badge: 'Risque ISO 27005',
          gradient: 'from-orange-500/90 via-red-500/80 to-pink-500/70',
          stats: [
            { label: 'Score', value: String((selectedNode.data as Risk).score) },
            { label: 'Probabilité', value: String((selectedNode.data as Risk).probability) },
            { label: 'Impact', value: String((selectedNode.data as Risk).impact) },
          ],
          meta: [
            { label: 'Stratégie', value: (selectedNode.data as Risk).strategy },
            { label: 'Statut', value: (selectedNode.data as Risk).status },
          ],
        };
      case 'project':
        return {
          ...base,
          badge: 'Programme SSI',
          gradient: 'from-purple-500/90 via-fuchsia-500/80 to-pink-500/70',
          stats: [
            { label: 'Progression', value: `${(selectedNode.data as Project).progress ?? 0}%` },
            { label: 'Responsable', value: (selectedNode.data as Project).manager || '—' },
            { label: 'Statut', value: (selectedNode.data as Project).status || '—' },
          ],
          meta: [
            { label: 'Jalons', value: String((selectedNode.data as Project).milestones?.length || 0) },
            { label: 'Risques liés', value: String(((selectedNode.data as Project).relatedRiskIds || []).length) },
          ],
        };
      case 'audit':
        return {
          ...base,
          badge: 'Audit & conformité',
          gradient: 'from-cyan-500/90 via-sky-500/80 to-blue-500/70',
          stats: [
            { label: 'Type', value: (selectedNode.data as Audit).type },
            { label: 'Date', value: formatSafeDate((selectedNode.data as Audit).dateScheduled) },
            { label: 'Statut', value: (selectedNode.data as Audit).status },
          ],
          meta: [
            { label: 'Auditeur', value: (selectedNode.data as Audit).auditor },
            { label: 'Constats', value: String((selectedNode.data as Audit).findingsCount) },
          ],
        };
      case 'incident':
        return {
          ...base,
          badge: 'Incident SOC',
          gradient: 'from-rose-500/90 via-orange-500/80 to-amber-500/70',
          stats: [
            { label: 'Sévérité', value: (selectedNode.data as Incident).severity },
            { label: 'Impact', value: (selectedNode.data as Incident).impact || '—' },
            { label: 'État', value: (selectedNode.data as Incident).status || '—' },
          ],
          meta: [
            { label: 'Détection', value: formatSafeDate((selectedNode.data as Incident).detectedAt) },
            { label: 'Réponse', value: (selectedNode.data as Incident).responseOwner || 'Non assigné' },
          ],
        };
      case 'supplier':
        return {
          ...base,
          badge: 'Fournisseur critique',
          gradient: 'from-emerald-500/90 via-lime-500/80 to-yellow-500/70',
          stats: [
            { label: 'Criticité', value: (selectedNode.data as Supplier).criticality },
            { label: 'Services', value: (selectedNode.data as Supplier).serviceCatalog?.length ? `${(selectedNode.data as Supplier).serviceCatalog?.length || 0} services` : '—' },
            { label: 'SLA', value: (selectedNode.data as Supplier).sla || 'Non défini' },
          ],
          meta: [
            { label: 'Contact', value: (selectedNode.data as Supplier).contactName || '—' },
            { label: 'Statut', value: (selectedNode.data as Supplier).status || '—' },
          ],
        };
      case 'control':
        return {
          ...base,
          badge: 'Contrôle Sécurité',
          gradient: 'from-teal-500/90 via-emerald-500/80 to-green-500/70',
          stats: [
            { label: 'Type', value: (selectedNode.data as Control).type || '—' },
            { label: 'Statut', value: (selectedNode.data as Control).status },
            { label: 'Applicabilité', value: (selectedNode.data as Control).applicability || '—' },
          ],
          meta: [
            { label: 'Dernière MàJ', value: formatSafeDate((selectedNode.data as Control).lastUpdated) },
            { label: 'Preuves', value: String((selectedNode.data as Control).evidenceIds?.length || 0) },
          ],
        };
      default:
        return null;
    }
  }, [selectedNode]);

  const handleSelectionClear = () => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    setReleaseToken(Date.now());
  };

  const handleOpenSelected = () => {
    if (!selectedNode) return;
    const route = detailRoutes[selectedNode.type];
    if (route && isValidRoute(route)) {
      addToast(`Navigation vers ${selectedNodeDetails?.title}`, 'info');
      isValidRoute(route);
      navigate(route, { // validateUrl validation check
        state: {
          fromVoxel: true,
          nodeId: selectedNode.id
        }
      });
    }
  };

  const relatedElements = useMemo<{ id: string; type: LayerType; label: string; meta?: string }[]>(() => {
    if (!selectedNode) return [];
    const items: { id: string; type: LayerType; label: string; meta?: string }[] = [];

    if (selectedNode.type === 'risk') {
      const asset = assets.find(a => a.id === (selectedNode.data as Risk).assetId);
      if (asset) items.push({ id: asset.id, type: 'asset', label: asset.name, meta: 'Actif lié' });
      const linkedProjects = projects.filter(p => ((p as Project).relatedRiskIds || []).includes(selectedNode.id));
      linkedProjects.forEach(project => items.push({ id: project.id, type: 'project', label: project.name, meta: 'Projet' }));
      const linkedIncidents = incidents.filter(incident => incident.affectedAssetId === (selectedNode.data as Risk).assetId);
      linkedIncidents.forEach(incident => items.push({ id: incident.id, type: 'incident', label: incident.title, meta: 'Incident impacté' }));
      const linkedControls = controls.filter(c => (c.relatedRiskIds || []).includes(selectedNode.id));
      linkedControls.forEach(c => items.push({ id: c.id, type: 'control', label: c.name, meta: c.status }));
    } else if (selectedNode.type === 'asset') {
      const linkedRisks = risks.filter(risk => risk.assetId === selectedNode.id);
      linkedRisks.forEach(risk => items.push({ id: risk.id, type: 'risk', label: risk.threat, meta: `Score ${risk.score}` }));
      const linkedIncidents = incidents.filter(incident => incident.affectedAssetId === selectedNode.id);
      linkedIncidents.forEach(incident => items.push({ id: incident.id, type: 'incident', label: incident.title, meta: incident.severity }));
      controls.forEach(c => {
        if ((c.relatedAssetIds || []).includes(selectedNode.id)) {
          items.push({ id: c.id, type: 'control', label: c.name, meta: c.status });
        }
      });
    } else if (selectedNode.type === 'incident') {
      const asset = assets.find(a => a.id === (selectedNode.data as Incident).affectedAssetId);
      if (asset) items.push({ id: asset.id, type: 'asset', label: asset.name, meta: 'Actif impacté' });
    } else if (selectedNode.type === 'project') {
      const relatedRisks = risks.filter(risk => ((selectedNode.data as Project).relatedRiskIds || []).includes(risk.id));
      relatedRisks.forEach(risk => items.push({ id: risk.id, type: 'risk', label: risk.threat, meta: 'Risque suivi' }));
    } else if (selectedNode.type === 'control') {
      const control = selectedNode.data as Control;
      if (control.relatedAssetIds) {
        control.relatedAssetIds.forEach(id => {
          const asset = assets.find(a => a.id === id);
          if (asset) items.push({ id: asset.id, type: 'asset', label: asset.name, meta: 'Actif couvert' });
        });
      }
      if (control.relatedRiskIds) {
        control.relatedRiskIds.forEach(id => {
          const risk = risks.find(r => r.id === id);
          if (risk) items.push({ id: risk.id, type: 'risk', label: risk.threat, meta: 'Risque traité' });
        });
      }
    }

    return items;
  }, [selectedNode, assets, risks, incidents, projects, controls]);

  const handleLayerToggle = (layer: LayerType) => {
    setActiveLayers(prev => {
      const isActive = prev.includes(layer);
      if (isActive && prev.length === 1) return prev; // garder au moins une couche
      if (isActive) return prev.filter(id => id !== layer);
      return [...prev, layer];
    });
  };

  useEffect(() => {
    if (loading) return;
    if (isInitialized.current) return;
    if (focusedNodeId) {
      isInitialized.current = true;
      return;
    }
    if (!orderedNodes.length) return;

    // Only focus first node on initial load
    const first = orderedNodes[0];
    applyFocus(first.id, first.type as LayerType);
    isInitialized.current = true;
  }, [loading, orderedNodes, focusedNodeId, applyFocus]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('overflow-hidden', isFullscreen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [isFullscreen]);

  const handleFullscreenToggle = () => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
  };

  const handleResetView = () => {
    setFocusedNodeId(null);
    setSelectedNode(null);
    setActiveLayers(layerOptions.map(layer => layer.id));
    setIsFullscreen(false);
    setHeatmapEnabled(true);
    setXRayEnabled(false);
    setAutoRotateEnabled(true);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
  };

  const handleNodeClick = (node: VoxelNode | null) => {
    if (selectedNode?.id !== node?.id) {
      setIsDetailMinimized(false);
    }
    setSelectedNode(node);
    setFocusedNodeId(node?.id ?? null);
  };

  const handleSearchButtonClick = () => {
    setNavCollapsed(false);
    setTimeout(() => document.getElementById('voxel-search')?.focus(), 100);
  };

  const handleRefresh = () => {
    refresh();
    // Force a resize event after refresh
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
  };

  const handleAIAnalysis = async () => {
    if (!user || !hasPermission(user, 'CTCEngine', 'read')) {
      addToast("Vous n'avez pas la permission d'effectuer cette action.", "error");
      return;
    }

    setAnalyzing(true);
    addToast("Analyse IA en cours...", "info");
    try {
      const result = await aiService.analyzeGraph({
        assets,
        risks,
        projects,
        audits,
        incidents,

        suppliers,
        controls
      });

      setSuggestedLinks(result.suggestions);
      setAiInsights(result.insights);
      setShowInsights(true);
      addToast("Analyse terminée avec succès", "success");
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'VoxelView.handleAIAnalysis', 'UNKNOWN_ERROR');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="flex flex-col flex-1 space-y-8 h-full"
    >
      <MasterpieceBackground />
      <SEO
        title="CTC Engine"
        description="Visualisation interactive de votre écosystème de sécurité."
        keywords="3D, Cartographie, Cybersécurité, ISO 27005, Risques"
      />

      <PageHeader
        title="CTC Engine"
        subtitle="Visualisation interactive de votre écosystème de sécurité."
        breadcrumbs={[
          { label: 'Opérations' },
          { label: 'CTC Engine' }
        ]}
        icon={
                    <img 
                        src="/images/operations.png" 
                        alt="OPÉRATIONS" 
                        className="w-full h-full object-contain"
                    />
                }
        actions={
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {/* Counters */}
            <div className="flex items-center gap-4 text-sm mr-0 md:mr-4 px-4 py-2 bg-slate-500/10 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/10 max-w-full overflow-x-auto backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 font-semibold">{assets.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 font-semibold">{risks.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-300 font-semibold">{projects.length}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              aria-label="Actualiser"
              onClick={handleRefresh}
              className="p-2.5 bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 hover:bg-slate-500/10 dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm backdrop-blur-sm"
              title="Actualiser"
            >
              <RefreshCw className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>

            <button
              aria-label={analyzing ? 'Analyse en cours' : 'Lancer l\'analyse IA'}
              onClick={handleAIAnalysis}
              disabled={analyzing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${analyzing
                ? 'bg-indigo-100 text-indigo-400 dark:bg-slate-900/30 dark:text-indigo-400 cursor-wait'
                : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                }`}
            >
              {analyzing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>{analyzing ? 'Analyse...' : 'Analyser IA'}</span>
            </button>
          </div>
        }
      />

      {/* Main Voxel View */}
      <div
        ref={containerRef}
        className={`${isFullscreen
          ? 'fixed !inset-0 !z-50 bg-slate-900'
          : 'relative flex-1 min-h-[500px] rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-950 mx-auto w-full'

          }`}
      >
        {isFullscreen && (
          <>
            <div className="absolute top-6 right-96 z-50 flex items-center gap-2">
              <span className="text-xs text-white/70 uppercase tracking-wide">Plein écran</span>
            </div>
          </>
        )}

        {/* Sidebar Navigation (Available in all modes) */}
        <aside aria-label="Navigation latérale" className={`absolute inset-y-0 right-0 ${navCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 opacity-100'} bg-slate-950/80 border-l border-white/10 backdrop-blur-2xl z-50 p-5 overflow-hidden transition-all duration-500 ease-custom-ease flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.3)]`}>
          <div className="flex items-center justify-between text-white mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Network className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight block">CTC Engine</span>
                <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">{orderedNodes.length} Éléments</span>
              </div>
            </div>
            <button
              onClick={() => setNavCollapsed(true)}
              aria-label="Fermer le menu"
              className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mb-6 shrink-0 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-indigo-400 transition-colors" />
            <input value={searchQuery}
              aria-label="Rechercher"
              id="voxel-search"
              type="text"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {categorizedNodes.map(category => (
              <div key={category.id} className="animate-[fadeIn_0.5s_ease-out]">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 mb-3 px-1">
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${category.color} shadow-[0_0_8px_currentColor]`}></span>
                    {category.label}
                  </span>
                  <span className="bg-white/5 px-1.5 py-0.5 rounded text-white/30">{category.items.length}</span>
                </div>
                <div className="space-y-1">
                  {category.items.map(item => (
                    <button
                      aria-label={item.label}
                      key={item.id}
                      onClick={() => applyFocus(item.id, category.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all duration-200 flex items-center gap-3 group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${focusedNodeId === item.id
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                        : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {focusedNodeId === item.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-50" />
                      )}
                      <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${focusedNodeId === item.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/40 group-hover:text-white/60 group-hover:bg-white/10'}`}>
                        <span className="inline-block h-5 w-5 text-inherit">
                          {silhouetteMap[category.id]}
                        </span>
                      </span>
                      <div className="flex flex-col flex-1 min-w-0 relative z-10">
                        <span className="font-medium line-clamp-1">{item.label}</span>
                        {item.meta && <span className="text-[10px] text-white/40 group-hover:text-white/50 transition-colors">{item.meta}</span>}
                      </div>
                      {focusedNodeId === item.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_currentColor]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {categorizedNodes.length === 0 && (
              <div className="text-center py-12 text-white/30 text-sm flex flex-col items-center gap-3">
                <Search className="h-8 w-8 opacity-20" />
                <p>Aucun résultat trouvé</p>
              </div>
            )}
          </div>
        </aside>

        {/* Unified Command Bar (Dock) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02] hover:bg-slate-900/90">
          <button
            aria-label="Guide du module"
            onClick={() => setShowGuide(true)}
            className="p-3 rounded-full hover:bg-white/10 text-indigo-400 hover:text-white transition tooltip-trigger group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Guide du module"
          >
            <Info className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            aria-label="Rechercher (Cmd+K)"
            onClick={handleSearchButtonClick}
            className={`p-3 rounded-full transition tooltip-trigger group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${!navCollapsed ? 'bg-white text-slate-900' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Rechercher (Cmd+K)"
          >
            <Search className="h-5 w-5" />
            {searchQuery && <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border border-slate-900"></span>}
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Navigation buttons */}
          <button
            aria-label="Élément précédent"
            onClick={() => focusByOffset(-1)}
            disabled={!orderedNodes.length}
            className="p-3 rounded-full transition hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Élément précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Élément suivant"
            onClick={() => focusByOffset(1)}
            disabled={!orderedNodes.length}
            className="p-3 rounded-full transition hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Élément suivant"
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            aria-label="Calques"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`p-3 rounded-full transition relative ${showLayerMenu ? 'bg-white text-slate-900' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Calques"
          >
            <Layers className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white border border-slate-900">
              {activeLayers.length}
            </span>
          </button>

          <button
            aria-label="Heatmap"
            onClick={() => setHeatmapEnabled(!heatmapEnabled)}
            className={`p-3 rounded-full transition ${heatmapEnabled ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Heatmap"
          >
            <Flame className="h-5 w-5" />
          </button>

          <button
            aria-label="Mode X-Ray"
            onClick={() => setXRayEnabled(!xRayEnabled)}
            className={`p-3 rounded-full transition ${xRayEnabled ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Mode X-Ray"
          >
            <Eye className="h-5 w-5" />
          </button>

          <button
            aria-label="Auto-rotate"
            onClick={() => setAutoRotateEnabled(!autoRotateEnabled)}
            className={`p-3 rounded-full transition ${autoRotateEnabled ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Auto-rotate"
          >
            <RotateCw className={`h-5 w-5 ${autoRotateEnabled ? 'animate-spin-slow' : ''}`} />
          </button>

          <button
            aria-label="Mode Présentation (Auto-Pilot)"
            onClick={() => setPresentationMode(!presentationMode)}
            className={`p-3 rounded-full transition ${presentationMode ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Mode Présentation (Auto-Pilot)"
          >
            <MonitorPlay className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            aria-label="Réinitialiser la vue"
            onClick={handleResetView}
            className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            title="Réinitialiser la vue"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          <button
            aria-label={isFullscreen ? "Quitter plein écran" : "Plein écran"}
            onClick={handleFullscreenToggle}
            className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>

        {/* Layer Menu Popover */}
        {showLayerMenu && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-64 p-2 rounded-2xl bg-slate-900/95 border border-white/10 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="px-3 py-2 border-b border-white/10 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Calques actifs</span>
              <span className="text-xs text-white/50">{activeLayers.length}/{layerOptions.length}</span>
            </div>
            <div className="space-y-1">
              {layerOptions.map(option => {
                const isActive = activeLayers.includes(option.id);
                return (
                  <button
                    aria-label={option.label}
                    key={option.id}
                    onClick={() => handleLayerToggle(option.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${option.color}`}></span>
                      <span>{option.label}</span>
                    </div>
                    {isActive && <CheckCheck className="h-3.5 w-3.5 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
          presentationMode={presentationMode}
          summaryStats={{
            assets: assets.length,
            risks: risks.length,
            projects: projects.length,
            incidents: incidents.length,
            controls: controls.length,
          }}

          releaseToken={releaseToken}
          suggestedLinks={suggestedLinks}

          // Overlay props
          selectedNodeDetails={selectedNodeDetails}
          isDetailMinimized={isDetailMinimized}
          setIsDetailMinimized={setIsDetailMinimized}
          handleSelectionClear={handleSelectionClear}
          relatedElements={relatedElements}
          applyFocus={applyFocus}
          handleOpenSelected={handleOpenSelected}
          impactMode={impactMode}
          setImpactMode={setImpactMode}
        />

        {/* AI Insights Panel */}
        {showInsights && aiInsights.length > 0 && (
          <div className="absolute top-24 left-6 z-50 w-80 max-h-[calc(100%-200px)] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-4 animate-[slideIn_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <BrainCircuit className="h-5 w-5" />
                <h3 className="font-bold text-white">Insights IA</h3>
              </div>
              <button
                aria-label="Fermer"
                onClick={() => setShowInsights(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {aiInsights.map((insight) => (
                <div key={insight.id} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${insight.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      insight.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                      {insight.type}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">{safeRender(insight.title)}</h4>
                  <p className="text-xs text-white/70 leading-relaxed">{safeRender(insight.description)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading overlay for refresh */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
            <div className="text-white text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Actualisation des données...</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 border-t border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/95 backdrop-blur-xl p-6">
        <div className="col-span-2 space-y-6">
          <div className="grid md:grid-cols-3 gap-3">
            {scenarioPresets.map(preset => (
              <button
                aria-label={preset.label}
                key={preset.id}
                onClick={() => handleScenarioPreset(preset)}
                className="text-left px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{preset.label}</p>
                <p className="text-sm text-slate-600 dark:text-slate-200">{preset.description}</p>
              </button>
            ))}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-medium">Légende dynamique</p>
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {layerOptions.map(layer => (
                <div key={layer.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-white/5">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/60">
                    {silhouetteMap[layer.id]}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{layer.label}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{layer.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Cliquez sur un nœud pour ouvrir ses détails</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Scroll: zoomer / drag: orbiter</span>
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">Ctrl + drag: panoramique</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            {[
              { title: 'Inventaire actuels', value: `${assets.length} actifs`, route: '/assets' },
              { title: 'Risques ouverts', value: `${risks.filter(r => r.status !== 'Fermé').length}`, route: '/risks' },
              { title: 'Incidents actifs', value: `${incidents.length}`, route: '/incidents' }
            ].map(card => (
              <button
                aria-label={card.title}
                key={card.title}
                onClick={() => {
                  if (isValidRoute(card.route)) {
                    navigate(card.route); // validateUrl check
                  }
                }}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{card.title}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{card.value}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Insight Panel */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Insights</p>
              <h3 className="text-lg font-semibold">Vue contextuelle</h3>
            </div>
            <button
              aria-label="Ouvrir la fiche"
              disabled={!selectedNode}
              onClick={() => {
                if (!selectedNode) return;
                const routes: Record<string, string> = {
                  asset: '/assets',
                  risk: '/risks',
                  project: '/projects',
                  audit: '/audits',
                  incident: '/incidents',

                  supplier: '/suppliers',
                  control: '/library'
                };
                const route = routes[selectedNode.type];
                if (route && isValidRoute(route)) {
                  addToast(`Navigation vers ${selectedNode.type}`, 'info');
                  navigate(route); // validateUrl check
                }
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              Ouvrir la fiche <ArrowRight className="inline h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Précédent"
              onClick={() => focusByOffset(-1)}
              disabled={!orderedNodes.length}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              ◀ Précédent
            </button>
            <button
              aria-label="Suivant"
              onClick={() => focusByOffset(1)}
              disabled={!orderedNodes.length}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              Suivant ▶
            </button>
          </div>

          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 w-12 h-12 flex items-center justify-center shrink-0">
                  {silhouetteMap[selectedNode.type]}
                </div>
                <div>
                  <p className="text-sm text-slate-300 capitalize">{selectedNode.type}</p>
                  <p className="text-lg font-semibold">{selectedNodeDetails?.title}</p>
                </div>
              </div>

              {selectedNode.type === 'risk' && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-200/20">
                  <div className="flex items-center gap-2 text-rose-100 text-sm font-medium">
                    <ShieldAlert className="h-3.5 w-3.5" /> Score {(selectedNode.data as Risk).score}
                  </div>
                  <p className="text-xs text-rose-200 mt-1">Stratégie: {(selectedNode.data as Risk).strategy}</p>
                </div>
              )}

              {selectedNode.type === 'project' && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-200/20 text-amber-100">
                  Progression {(selectedNode.data as Project).progress}% - {(selectedNode.data as Project).status}
                </div>
              )}

              {selectedNode.type === 'incident' && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-200/20 text-rose-100">
                  Gravité {(selectedNode.data as Incident).severity}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <p className="uppercase tracking-wide text-[10px] text-slate-500">Référent</p>
                  <p className="mt-1 text-sm font-semibold">{selectedNodeDetails?.owner || 'Non renseigné'}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <p className="uppercase tracking-wide text-[10px] text-slate-500">Dernière mise à jour</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatSafeDate((selectedNode.data as { updatedAt?: string }).updatedAt || (selectedNode.data as { createdAt?: string }).createdAt)}
                  </p>
                </div>
              </div>

              {relatedElements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Liens critiques</p>
                  <div className="flex flex-wrap gap-2">
                    {relatedElements.map(item => (
                      <button
                        aria-label={item.label}
                        key={item.id}
                        onClick={() => applyFocus(item.id, item.type)}
                        className="px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-xs"
                      >
                        {item.label}
                        {item.meta && <span className="ml-2 text-white/50">• {item.meta}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  aria-label="Explorer les dépendances"
                  onClick={() => selectedNode && navigate('/risks')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                >
                  <Activity className="h-4 w-4" /> Explorer les dépendances
                </button>
                <button
                  aria-label="Voir les actions"
                  onClick={() => selectedNode && navigate('/projects')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/20 hover:bg-white/10 transition"
                >
                  Voir les actions
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 space-y-4">
              <p>Sélectionnez un nœud pour afficher ses insights, alertes liées et raccourcis de navigation.</p>
              <div className="flex items-center gap-3 text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span>Les niveaux de risque sont recalculés en temps réel selon vos métriques ISO 27005.</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <VoxelGuide isOpen={showGuide} onClose={handleCloseGuide} />
    </motion.div >
  );
};
