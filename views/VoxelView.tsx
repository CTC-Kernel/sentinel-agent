import React, { useEffect, useMemo, useState } from 'react';

import { VoxelStudio } from '../components/VoxelStudio';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Asset, Risk, Project, Audit, Incident, Supplier, AISuggestedLink, AIInsight } from '../types';
import { aiService } from '../services/aiService';
import { useStore } from '../store';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronLeft, Settings, Maximize2, RefreshCw, ArrowRight, ShieldAlert, Activity, Bell, XCircle, Sparkles, BrainCircuit, Layers, Eye, Flame, Search, RotateCw, Minimize2, CheckCheck } from '../components/ui/Icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Network } from '../components/ui/Icons';

type LayerType = 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier';

const formatSafeDate = (date: any): string => {
  if (!date) return '—';
  try {
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && 'seconds' in date) {
      return new Date(date.seconds * 1000).toLocaleDateString('fr-FR');
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
  } catch (_e) {
    return '—';
  }
};

const safeRender = (value: any): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if ('seconds' in value) return formatSafeDate(value);
    return JSON.stringify(value);
  }
  return String(value);
};

export const VoxelView: React.FC = () => {
  const { user, addToast } = useStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedNode, setSelectedNode] = useState<{ id: string; type: LayerType; data: any } | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [releaseToken, setReleaseToken] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [isDetailMinimized, setIsDetailMinimized] = useState(false);

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

  const detailRoutes: Record<LayerType, string> = {
    asset: '/assets',
    risk: '/risks',
    project: '/projects',
    audit: '/audits',
    incident: '/incidents',
    supplier: '/suppliers'
  };

  const layerOptions: { id: LayerType; label: string; hint: string; color: string }[] = [
    { id: 'asset', label: 'Actifs', hint: 'Socle infrastructure', color: 'bg-blue-500' },
    { id: 'risk', label: 'Risques', hint: 'Menaces ISO 27005', color: 'bg-orange-500' },
    { id: 'project', label: 'Projets', hint: 'Programmes SSI', color: 'bg-purple-500' },
    { id: 'audit', label: 'Audits', hint: 'Contrôles et revues', color: 'bg-cyan-500' },
    { id: 'incident', label: 'Incidents', hint: 'Alertes SOC', color: 'bg-red-500' },
    { id: 'supplier', label: 'Fournisseurs', hint: 'Partenaires critiques', color: 'bg-green-500' }
  ];
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
  const silhouetteMap: Record<LayerType, JSX.Element> = {
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
        <path d="M32 28 C26 34 26 44 32 48 C38 44 38 34 32 28" className="text-white fill-current opacity-80" />
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

  const summary = useMemo(() => {
    const avgRisk = risks.length ? (risks.reduce((acc, r) => acc + r.score, 0) / risks.length).toFixed(1) : '0.0';
    const criticalIncidents = incidents.filter(i => i.severity === 'Critique').length;
    const overdueProjects = projects.filter(p => (p as any).status === 'En retard').length;
    return { avgRisk, criticalIncidents, overdueProjects };
  }, [risks, incidents, projects]);

  const orderedNodes = useMemo(() => {
    const mapNode = (collection: any[], type: LayerType) =>
      collection.map(item => ({ id: item.id, type, label: item.name || item.title || item.threat || 'Élément' }));
    return [
      ...mapNode(assets, 'asset'),
      ...mapNode(risks, 'risk'),
      ...mapNode(projects, 'project'),
      ...mapNode(audits, 'audit'),
      ...mapNode(incidents, 'incident'),
      ...mapNode(suppliers, 'supplier')
    ];
  }, [assets, risks, projects, audits, incidents, suppliers]);

  const currentIndex = useMemo(() => orderedNodes.findIndex(node => node.id === focusedNodeId), [orderedNodes, focusedNodeId]);

  const ensureLayerActive = (layer: LayerType) => {
    setActiveLayers(prev => (prev.includes(layer) ? prev : [...prev, layer]));
  };

  const findEntityByType = (type: LayerType, id: string) => {
    const sourceMap: Record<LayerType, any[]> = {
      asset: assets,
      risk: risks,
      project: projects,
      audit: audits,
      incident: incidents,
      supplier: suppliers,
    };
    return sourceMap[type].find(item => item.id === id);
  };

  const applyFocus = (nodeId: string, type: LayerType) => {
    ensureLayerActive(type);
    setFocusedNodeId(nodeId);
    const entity = findEntityByType(type, nodeId);
    if (entity) {
      setSelectedNode({ id: nodeId, type, data: entity });
    }
  };

  const focusByOffset = (offset: number) => {
    if (!orderedNodes.length) return;
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + offset + orderedNodes.length) % orderedNodes.length;
    const target = orderedNodes[nextIndex];
    if (target) {
      applyFocus(target.id, target.type as LayerType);
      setIsDetailMinimized(false);
    }
  };

  const quickTargets = useMemo(() => {
    const highestRisk = [...risks].sort((a, b) => b.score - a.score)[0];
    const criticalIncident = incidents.find(i => i.severity === 'Critique');
    const delayedProject = projects.find(p => (p as any).status === 'En retard');
    return {
      topRisk: highestRisk ? { id: highestRisk.id, type: 'risk' as LayerType, label: highestRisk.threat || 'Risque critique' } : null,
      criticalIncident: criticalIncident ? { id: criticalIncident.id, type: 'incident' as LayerType, label: criticalIncident.title || 'Incident critique' } : null,
      delayedProject: delayedProject ? { id: delayedProject.id, type: 'project' as LayerType, label: delayedProject.name || 'Projet en alerte' } : null,
    };
  }, [risks, incidents, projects]);

  const handleQuickFocus = (key: keyof typeof quickTargets) => {
    const target = quickTargets[key];
    if (!target) {
      addToast("Aucun élément correspondant pour l'instant", 'info');
      return;
    }
    applyFocus(target.id, target.type);
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
    const sourceMap: Record<LayerType, any[]> = {
      asset: assets,
      risk: risks,
      project: projects,
      audit: audits,
      incident: incidents,
      supplier: suppliers,
    };

    return layerOptions.map(option => ({
      ...option,
      items: sourceMap[option.id].map(item => ({
        id: item.id,
        label: safeRender(item.name || item.title || item.threat || 'Élément'),
        meta:
          option.id === 'risk'
            ? `Score ${(item as Risk).score}`
            : option.id === 'project'
              ? `${(item as Project).progress || 0}%`
              : option.id === 'incident'
                ? safeRender((item as Incident).severity)
                : safeRender((item as any).owner || (item as any).status || ''),
      })).filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase())),
    }));
  }, [layerOptions, assets, risks, projects, audits, incidents, suppliers]);

  const selectedNodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    const base = {
      title: selectedNode.data.name || selectedNode.data.title || selectedNode.data.threat || 'Élément',
      type: selectedNode.type,
      owner: (selectedNode.data as any).owner || (selectedNode.data as any).responsable || '',
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
            { label: 'Responsable', value: (selectedNode.data as any).owner || '—' },
            { label: 'Statut', value: (selectedNode.data as any).status || '—' },
          ],
          meta: [
            { label: 'Jalons', value: String((selectedNode.data as any).milestones?.length || 0) },
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
            { label: 'Impact', value: (selectedNode.data as any).impact || '—' },
            { label: 'État', value: (selectedNode.data as any).status || '—' },
          ],
          meta: [
            { label: 'Détection', value: formatSafeDate((selectedNode.data as any).detectedAt) },
            { label: 'Réponse', value: (selectedNode.data as any).responseOwner || 'Non assigné' },
          ],
        };
      case 'supplier':
        return {
          ...base,
          badge: 'Fournisseur critique',
          gradient: 'from-emerald-500/90 via-lime-500/80 to-yellow-500/70',
          stats: [
            { label: 'Criticité', value: (selectedNode.data as Supplier).criticality },
            { label: 'Services', value: (selectedNode.data as any).serviceCatalog?.length ? `${(selectedNode.data as any).serviceCatalog.length} services` : '—' },
            { label: 'SLA', value: (selectedNode.data as any).sla || 'Non défini' },
          ],
          meta: [
            { label: 'Contact', value: (selectedNode.data as any).contactName || '—' },
            { label: 'Statut', value: (selectedNode.data as any).status || '—' },
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
    if (route) {
      addToast(`Navigation vers ${selectedNodeDetails?.title}`, 'info');
      navigate(route);
    }
  };

  const relatedElements = useMemo<{ id: string; type: LayerType; label: string; meta?: string }[]>(() => {
    if (!selectedNode) return [];
    const items: { id: string; type: LayerType; label: string; meta?: string }[] = [];

    if (selectedNode.type === 'risk') {
      const asset = assets.find(a => a.id === (selectedNode.data as Risk).assetId);
      if (asset) items.push({ id: asset.id, type: 'asset', label: asset.name, meta: 'Actif lié' });
      const linkedProjects = projects.filter(p => ((p as any).relatedRiskIds || []).includes(selectedNode.id));
      linkedProjects.forEach(project => items.push({ id: project.id, type: 'project', label: project.name, meta: 'Projet' }));
      const linkedIncidents = incidents.filter(incident => incident.affectedAssetId === (selectedNode.data as Risk).assetId);
      linkedIncidents.forEach(incident => items.push({ id: incident.id, type: 'incident', label: incident.title, meta: 'Incident impacté' }));
    } else if (selectedNode.type === 'asset') {
      const linkedRisks = risks.filter(risk => risk.assetId === selectedNode.id);
      linkedRisks.forEach(risk => items.push({ id: risk.id, type: 'risk', label: risk.threat, meta: `Score ${risk.score}` }));
      const linkedIncidents = incidents.filter(incident => incident.affectedAssetId === selectedNode.id);
      linkedIncidents.forEach(incident => items.push({ id: incident.id, type: 'incident', label: incident.title, meta: incident.severity }));
    } else if (selectedNode.type === 'incident') {
      const asset = assets.find(a => a.id === (selectedNode.data as Incident).affectedAssetId);
      if (asset) items.push({ id: asset.id, type: 'asset', label: asset.name, meta: 'Actif impacté' });
    } else if (selectedNode.type === 'project') {
      const relatedRisks = risks.filter(risk => ((selectedNode.data as Project).relatedRiskIds || []).includes(risk.id));
      relatedRisks.forEach(risk => items.push({ id: risk.id, type: 'risk', label: risk.threat, meta: 'Risque suivi' }));
    }

    return items;
  }, [selectedNode, assets, risks, incidents, projects]);

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
    if (selectedNode) return;
    if (!orderedNodes.length) return;
    const first = orderedNodes[0];
    applyFocus(first.id, first.type as LayerType);
  }, [loading, orderedNodes, selectedNode]);

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

  // Helper to convert Firestore Timestamps to ISO strings
  const convertTimestamps = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    // Handle Firestore Timestamp
    if (obj.seconds !== undefined && obj.nanoseconds !== undefined) {
      return new Date(obj.seconds * 1000).toISOString();
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => convertTimestamps(item));
    }

    // Handle objects recursively
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertTimestamps(obj[key]);
    }
    return converted;
  };

  useEffect(() => {
    if (!user?.organizationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const orgId = user.organizationId;

        const [
          assetsSnap,
          risksSnap,
          projectsSnap,
          auditsSnap,
          incidentsSnap,
          suppliersSnap
        ] = await Promise.all([
          getDocs(query(collection(db, 'assets'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'audits'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId))),
          getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', orgId)))
        ]);

        setAssets(assetsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Asset[]);
        setRisks(risksSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Risk[]);
        setProjects(projectsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Project[]);
        setAudits(auditsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Audit[]);
        setIncidents(incidentsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Incident[]);
        setSuppliers(suppliersSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Supplier[]);

      } catch (error) {
        console.error('Error fetching voxel data:', error);
        addToast('Erreur lors du chargement des données', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.organizationId, addToast]);

  const handleNodeClick = (node: any) => {
    if (selectedNode?.id !== node?.id) {
      setIsDetailMinimized(false);
    }
    setSelectedNode(node);
    setFocusedNodeId(node?.id ?? null);
  };

  const handleRefresh = () => {
    setLoading(true);
    // Refetch data
    window.location.reload();
  };

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    addToast("Analyse IA en cours...", "info");
    try {
      const result = await aiService.analyzeGraph({
        assets,
        risks,
        projects,
        audits,
        incidents,
        suppliers
      });

      setSuggestedLinks(result.suggestions);
      setAiInsights(result.insights);
      setShowInsights(true);
      addToast("Analyse terminée avec succès", "success");
    } catch (error) {
      console.error(error);
      addToast("Erreur lors de l'analyse IA", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-48 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 backdrop-blur">
        <PageHeader
          title="Vue 3D Intelligence"
          subtitle="Visualisation interactive de votre écosystème de sécurité."
          breadcrumbs={[
            { label: 'Voxel 3D' }
          ]}
          icon={<Network className="h-6 w-6 text-white" strokeWidth={2.5} />}
          actions={
            <div className="flex items-center gap-3">
              {/* Counters */}
              <div className="flex items-center gap-4 text-sm mr-4 px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/10">
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
                onClick={handleRefresh}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm"
                title="Actualiser"
              >
                <RefreshCw className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>

              <button
                onClick={handleAIAnalysis}
                disabled={analyzing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${analyzing
                  ? 'bg-indigo-100 text-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400 cursor-wait'
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
      </div>

      {/* Main Voxel View */}
      <div
        className={`${isFullscreen
          ? 'fixed !inset-0 !z-[9999] bg-slate-900'
          : 'relative flex-1 min-h-[500px] max-h-[760px] rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-white dark:bg-slate-950 mx-auto w-full'
          }`}
      >
        {isFullscreen && (
          <>
            <div className="absolute top-6 right-96 z-[10000] flex items-center gap-2">
              <span className="text-xs text-white/70 uppercase tracking-wide">Plein écran</span>
            </div>
          </>
        )}

        {/* Sidebar Navigation (Available in all modes) */}
        <aside className={`absolute inset-y-0 right-0 ${navCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 opacity-100'} bg-slate-950/95 border-l border-white/10 backdrop-blur-xl z-[10000] p-4 overflow-hidden transition-all duration-300 flex flex-col`}>
          <div className="flex items-center justify-between text-white mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">CTC Engine</span>
              <span className="text-xs text-white/50">{orderedNodes.length}</span>
            </div>
            <button
              onClick={() => setNavCollapsed(true)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              id="voxel-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élément..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition"
            />
          </div>

          <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {categorizedNodes.map(category => (
              <div key={category.id}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-white/40 mb-2 px-1">
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${category.color}`}></span>
                    {category.label}
                  </span>
                  <span>{category.items.length}</span>
                </div>
                <div className="space-y-1">
                  {category.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => applyFocus(item.id, category.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition flex items-center gap-3 group ${focusedNodeId === item.id
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-white shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                        : 'border-transparent text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${focusedNodeId === item.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/40 group-hover:text-white/60'}`}>
                        <span className="inline-block h-5 w-5 text-inherit">
                          {silhouetteMap[category.id]}
                        </span>
                      </span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium line-clamp-1">{item.label}</span>
                        {item.meta && <span className="text-[10px] text-white/40 group-hover:text-white/50">{item.meta}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {categorizedNodes.length === 0 && (
              <div className="text-center py-8 text-white/30 text-sm">
                Aucun résultat trouvé
              </div>
            )}
          </div>
        </aside>

        {/* Unified Command Bar (Dock) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1.5 p-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.02] hover:bg-slate-900/90">
          <button
            onClick={() => { setNavCollapsed(false); setTimeout(() => document.getElementById('voxel-search')?.focus(), 100); }}
            className={`p-3 rounded-full transition tooltip-trigger group relative ${!navCollapsed ? 'bg-white text-slate-900' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Rechercher (Cmd+K)"
          >
            <Search className="h-5 w-5" />
            {searchQuery && <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border border-slate-900"></span>}
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* Navigation buttons */}
          <button
            onClick={() => focusByOffset(-1)}
            disabled={!orderedNodes.length}
            className="p-3 rounded-full transition hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Élément précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => focusByOffset(1)}
            disabled={!orderedNodes.length}
            className="p-3 rounded-full transition hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Élément suivant"
          >
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
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
            onClick={() => setHeatmapEnabled(!heatmapEnabled)}
            className={`p-3 rounded-full transition ${heatmapEnabled ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Heatmap"
          >
            <Flame className="h-5 w-5" />
          </button>

          <button
            onClick={() => setXRayEnabled(!xRayEnabled)}
            className={`p-3 rounded-full transition ${xRayEnabled ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Mode X-Ray"
          >
            <Eye className="h-5 w-5" />
          </button>

          <button
            onClick={() => setAutoRotateEnabled(!autoRotateEnabled)}
            className={`p-3 rounded-full transition ${autoRotateEnabled ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            title="Auto-rotate"
          >
            <RotateCw className={`h-5 w-5 ${autoRotateEnabled ? 'animate-spin-slow' : ''}`} />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={handleResetView}
            className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            title="Réinitialiser la vue"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          <button
            onClick={handleFullscreenToggle}
            className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            title={isFullscreen ? "Quitter plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>

        {/* Layer Menu Popover */}
        {showLayerMenu && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[10001] w-64 p-2 rounded-2xl bg-slate-900/95 border border-white/10 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="px-3 py-2 border-b border-white/10 mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Calques actifs</span>
              <span className="text-xs text-white/50">{activeLayers.length}/{layerOptions.length}</span>
            </div>
            <div className="space-y-1">
              {layerOptions.map(option => {
                const isActive = activeLayers.includes(option.id);
                return (
                  <button
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
          onNodeClick={handleNodeClick}
          className="w-full h-full"
          visibleTypes={activeLayers}
          focusNodeId={focusedNodeId}
          highlightCritical={heatmapEnabled}
          xRayMode={xRayEnabled}
          autoRotatePreference={autoRotateEnabled}
          summaryStats={{
            assets: assets.length,
            risks: risks.length,
            projects: projects.length,
            incidents: incidents.length,
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
        />



        {/* AI Insights Panel */}
        {showInsights && aiInsights.length > 0 && (
          <div className="absolute top-24 left-6 z-[10000] w-80 max-h-[calc(100%-200px)] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-4 animate-[slideIn_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <BrainCircuit className="h-5 w-5" />
                <h3 className="font-bold text-white">Insights IA</h3>
              </div>
              <button
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
                key={preset.id}
                onClick={() => handleScenarioPreset(preset)}
                className="text-left px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">{preset.label}</p>
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
                    <p className="text-xs uppercase tracking-wide text-slate-400">{layer.label}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{layer.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
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
                key={card.title}
                onClick={() => navigate(card.route)}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition text-left"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">{card.title}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{card.value}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Insight Panel */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Insights</p>
              <h3 className="text-lg font-semibold">Vue contextuelle</h3>
            </div>
            <button
              disabled={!selectedNode}
              onClick={() => {
                if (!selectedNode) return;
                const routes: Record<string, string> = {
                  asset: '/assets',
                  risk: '/risks',
                  project: '/projects',
                  audit: '/audits',
                  incident: '/incidents',
                  supplier: '/suppliers'
                };
                const route = routes[selectedNode.type];
                if (route) {
                  addToast(`Navigation vers ${selectedNode.type}`, 'info');
                  navigate(route);
                }
              }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ouvrir la fiche <ArrowRight className="inline h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => focusByOffset(-1)}
              disabled={!orderedNodes.length}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              ◀ Précédent
            </button>
            <button
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
                  <p className="text-lg font-semibold">{(selectedNode.data as any).name || (selectedNode.data as any).title}</p>
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
                  <p className="uppercase tracking-wide text-[10px] text-slate-400">Référent</p>
                  <p className="mt-1 text-sm font-semibold">{(selectedNode.data as any).owner || 'Non renseigné'}</p>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                  <p className="uppercase tracking-wide text-[10px] text-slate-400">Dernière mise à jour</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatSafeDate((selectedNode.data as any).updatedAt)}
                  </p>
                </div>
              </div>

              {relatedElements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Liens critiques</p>
                  <div className="flex flex-wrap gap-2">
                    {relatedElements.map(item => (
                      <button
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
                  onClick={() => selectedNode && navigate('/risks')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                >
                  <Activity className="h-4 w-4" /> Explorer les dépendances
                </button>
                <button
                  onClick={() => selectedNode && navigate('/projects')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/20 hover:bg-white/10 transition"
                >
                  Voir les actions
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 space-y-4">
              <p>Sélectionnez un nœud pour afficher ses insights, alertes liées et raccourcis de navigation.</p>
              <div className="flex items-center gap-3 text-xs">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span>Les niveaux de risque sont recalculés en temps réel selon vos métriques ISO 27005.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
};
