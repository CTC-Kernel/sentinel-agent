import React, { useEffect, useMemo, useState } from 'react';
import { VoxelStudio } from '../components/VoxelStudio';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Asset, Risk, Project, Audit, Incident, Supplier } from '../types';
import { useStore } from '../store';
import { Skeleton } from '../components/ui/Skeleton';
import { ChevronLeft, Settings, Maximize2, RefreshCw, ArrowRight, ShieldAlert, Activity, Bell } from '../components/ui/Icons';
import { useNavigate } from 'react-router-dom';

type LayerType = 'asset' | 'risk' | 'project' | 'audit' | 'incident' | 'supplier';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const layerOptions: { id: LayerType; label: string; hint: string; color: string }[] = [
    { id: 'asset', label: 'Actifs', hint: 'Socle infrastructure', color: 'bg-blue-500' },
    { id: 'risk', label: 'Risques', hint: 'Menaces ISO 27005', color: 'bg-orange-500' },
    { id: 'project', label: 'Projets', hint: 'Programmes SSI', color: 'bg-purple-500' },
    { id: 'audit', label: 'Audits', hint: 'Contrôles et revues', color: 'bg-cyan-500' },
    { id: 'incident', label: 'Incidents', hint: 'Alertes SOC', color: 'bg-red-500' },
    { id: 'supplier', label: 'Fournisseurs', hint: 'Partenaires critiques', color: 'bg-green-500' }
  ];
  const [activeLayers, setActiveLayers] = useState<LayerType[]>(layerOptions.map(layer => layer.id));

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
        label: item.name || item.title || item.threat || 'Élément',
        meta:
          option.id === 'risk'
            ? `Score ${(item as Risk).score}`
            : option.id === 'project'
            ? `${(item as Project).progress || 0}%`
            : option.id === 'incident'
            ? (item as Incident).severity
            : (item as any).owner || (item as any).status || '',
      })),
    }));
  }, [layerOptions, assets, risks, projects, audits, incidents, suppliers]);

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
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
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

        setAssets(assetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Asset[]);
        setRisks(risksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Risk[]);
        setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Project[]);
        setAudits(auditsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Audit[]);
        setIncidents(incidentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Incident[]);
        setSuppliers(suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[]);
        
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
    setSelectedNode(node);
    setFocusedNodeId(node?.id ?? null);
  };

  const handleRefresh = () => {
    setLoading(true);
    // Refetch data
    window.location.reload();
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
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/95 backdrop-blur-xl">
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Retour aux vues
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
                  Voxel Studio
                </h1>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-900/5 dark:bg-white/10 text-slate-600 dark:text-slate-200">
                  Beta Observability
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Visualisation cartographique 3D de votre écosystème
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-slate-600 dark:text-slate-300">{assets.length} Actifs</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-slate-600 dark:text-slate-300">{risks.length} Risques</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-slate-600 dark:text-slate-300">{projects.length} Projets</span>
            </div>
          </div>

          {/* Controls */}
          <div className="hidden lg:flex gap-4">
            <div className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Risque moyen</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.avgRisk}</p>
            </div>
            <div className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Incidents critiques</p>
              <p className="text-lg font-bold text-rose-500">{summary.criticalIncidents}</p>
            </div>
            <div className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Projets en alerte</p>
              <p className="text-lg font-bold text-amber-500">{summary.overdueProjects}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => focusByOffset(-1)}
              disabled={!orderedNodes.length}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
              title="Élément précédent"
            >
              ‹
            </button>
            <button
              onClick={() => focusByOffset(1)}
              disabled={!orderedNodes.length}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
              title="Élément suivant"
            >
              ›
            </button>

            <button
              onClick={handleFullscreenToggle}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
            >
              <Maximize2 className={`h-4 w-4 text-slate-600 dark:text-slate-300 ${isFullscreen ? 'rotate-45 transition-transform' : ''}`} />
            </button>

            <button
              onClick={handleRefresh}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Actualiser les données"
            >
              <RefreshCw className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick focus chips */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/80 backdrop-blur">
        <div className="flex flex-wrap gap-2 text-xs">
          {[{
            key: 'topRisk' as const,
            label: 'Risque critique',
            icon: ShieldAlert,
            color: 'text-rose-500'
          }, {
            key: 'criticalIncident' as const,
            label: 'Incident critique',
            icon: Bell,
            color: 'text-orange-500'
          }, {
            key: 'delayedProject' as const,
            label: 'Projet en alerte',
            icon: Activity,
            color: 'text-amber-500'
          }].map(action => (
            <button
              key={action.key}
              onClick={() => handleQuickFocus(action.key)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:border-indigo-400 hover:text-indigo-500 transition"
            >
              <action.icon className={`h-3.5 w-3.5 ${action.color}`} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Voxel View */}
      <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900' : 'flex-1 relative'}`}>
        {isFullscreen && (
          <>
            <div className="absolute top-6 right-80 z-20 flex items-center gap-2">
              <span className="text-xs text-white/70 uppercase tracking-wide">Plein écran</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetView}
                  className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition"
                >
                  Réinitialiser
                </button>
                <button
                  onClick={handleFullscreenToggle}
                  className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition"
                >
                  Quitter (Esc)
                </button>
              </div>
            </div>
            <aside className="absolute inset-y-0 right-0 w-72 bg-slate-950/95 border-l border-white/10 backdrop-blur-xl z-30 p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-white">
                <p className="text-sm font-semibold">Navigation rapide</p>
                <span className="text-xs text-white/50">{orderedNodes.length} éléments</span>
              </div>
              {categorizedNodes.map(category => (
                <div key={category.id}>
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60 mb-2">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${category.color}`}></span>
                      {category.label}
                    </span>
                    <span>{category.items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {category.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => applyFocus(item.id, category.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition flex flex-col gap-0.5 ${
                          focusedNodeId === item.id
                            ? 'border-white/40 bg-white/10 text-white'
                            : 'border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5'
                        }`}
                      >
                        <span className="font-medium line-clamp-1">{item.label}</span>
                        {item.meta && <span className="text-xs text-white/60">{item.meta}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </aside>
          </>
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
          highlightCritical
          summaryStats={{
            assets: assets.length,
            risks: risks.length,
            projects: projects.length,
            incidents: incidents.length,
          }}
        />

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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Focalisation visuelle</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">{activeLayers.length} couches actives</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {layerOptions.map(option => {
                const isActive = activeLayers.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => handleLayerToggle(option.id)}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-2xl border transition ${
                      isActive
                        ? 'border-transparent text-white bg-slate-900 dark:bg-white/10'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${option.color}`}></span>
                    <div className="text-left">
                      <p className="text-sm font-semibold capitalize">{option.label}</p>
                      <p className="text-[11px] opacity-70">{option.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p className="font-medium">Légende dynamique</p>
            <div className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span>Actifs (Infrastructure)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>Risques (Menaces)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                <span>Projets (Transformations)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500 rounded-sm"></div>
                <span>Audits (Contrôles)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Incidents (Alertes)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                <span>Fournisseurs (Partenaires)</span>
              </div>
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
                <div className="p-2 rounded-xl bg-white/10">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">{selectedNode.type}</p>
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
                  <p className="mt-1 text-sm font-semibold">{(selectedNode.data as any).updatedAt || 'N/A'}</p>
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
    </div>
  );
};
