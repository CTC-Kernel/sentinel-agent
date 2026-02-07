import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingService } from '../services/onboardingService';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { subscribeToAgents, getAgentComplianceResults, AgentService } from '../services/AgentService';
import { SentinelAgent, AgentCheckResult } from '../types/agent';
import {
 Download, Settings, Search, LayoutGrid, List, Shield, Package, Layers, AlertTriangle, FileText
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Drawer } from '../components/ui/Drawer';
import { AgentFleetDashboard } from '../components/agents/AgentFleetDashboard';
import { AgentHealthGrid } from '../components/agents/AgentHealthGrid';
import { PageHeader } from '../components/ui/PageHeader';
import { AgentComplianceHeatmap } from '../components/agents/AgentComplianceHeatmap';
import { AgentLiveView } from '../components/agents/AgentLiveView';
import { AnomalyAlerts } from '../components/agents/AnomalyAlerts';
import { BehavioralBaseline } from '../components/agents/BehavioralBaseline';
import AgentPolicies from './AgentPolicies';
import SoftwareInventory from './SoftwareInventory';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ErrorLogger } from '../services/errorLogger';
import { AgentErrorBoundary } from '../components/agents/AgentErrorBoundary';
import { AgentComplianceReport } from '../components/reports/AgentComplianceReport';
import { FleetHealthReport } from '../components/reports/FleetHealthReport';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { hasPermission } from '../utils/permissions';
import { toast } from '@/lib/toast';

// Skeleton for loading state
const AgentsSkeleton: React.FC = () => (
 <div className="flex flex-col gap-6 animate-pulse">
 <div className="h-20 bg-muted/50 rounded-2xl" />
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[1, 2, 3, 4].map((i) => (
 <div key={i || 'unknown'} className="h-32 bg-muted/50 rounded-2xl" />
 ))}
 </div>
 <div className="h-96 bg-muted/50 rounded-2xl" />
 </div>
);


// Main Agents View Component
export const Agents: React.FC = () => {
 const { user, t } = useStore();
 const navigate = useNavigate();
 const [agents, setAgents] = useState<SentinelAgent[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'offline' | 'error'>('all');
 const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
 const [selectedAgent, setSelectedAgent] = useState<SentinelAgent | null>(null);
 const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
 const [activeTab, setActiveTab] = useState('overview');
 const [complianceResults, setComplianceResults] = useState<Map<string, AgentCheckResult[]>>(new Map());
 const [deleteConfirm, setDeleteConfirm] = useState<{ agent: SentinelAgent } | null>(null);
 const [retryCount, setRetryCount] = useState(0);
 const [reportType, setReportType] = useState<'compliance' | 'fleet_health'>('compliance');

 // Handle agent click to open live view
 const handleAgentClick = useCallback((agent: SentinelAgent) => {
 setSelectedAgent(agent);
 setIsLiveViewOpen(true);
 }, []);

 // Handle closing live view
 const handleCloseLiveView = useCallback(() => {
 setIsLiveViewOpen(false);
 setSelectedAgent(null);
 }, []);

 // Subscribe to agents
 useEffect(() => {
 if (!user?.organizationId) return;

 const unsubscribe = subscribeToAgents(
 user.organizationId,
 (agentList) => {
 setAgents(agentList);
 setLoading(false);
 },
 (error) => {
 ErrorLogger.error(error, 'Agents.subscribeToAgents');
 setError(t('agents.loadError', { defaultValue: 'Erreur de chargement des données' }));
 setLoading(false);
 }
 );

 return unsubscribe;
 }, [user?.organizationId, retryCount, t]);

 // Load compliance results for heatmap
 useEffect(() => {
 let cancelled = false;
 if (agents.length > 0 && user?.organizationId) {
 getAgentComplianceResults(user.organizationId)
 .then(results => {
  if (!cancelled) setComplianceResults(results);
 })
 .catch(err => {
  if (!cancelled) ErrorLogger.error(err, 'Agents.loadComplianceResults');
 });
 }
 return () => { cancelled = true; };
 }, [agents.length, user?.organizationId]);

 // Start tour
 useEffect(() => {
 const timer = setTimeout(() => {
 OnboardingService.startAgentsTour();
 }, 1000);
 return () => clearTimeout(timer);
 }, []);

 // Filtered agents
 const filteredAgents = useMemo(() => {
 return agents.filter(agent => {
 const matchesSearch = !searchQuery ||
 agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 agent.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 agent.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase());

 const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;

 return matchesSearch && matchesStatus;
 });
 }, [agents, searchQuery, statusFilter]);

 // Permission gate
 const canRead = hasPermission(user, 'Agent', 'read');
 if (!canRead) {
 return <div className="p-8 text-center text-muted-foreground">{t('common.accessDenied', { defaultValue: 'Accès refusé' })}</div>;
 }

 if (loading) {
 return (
 <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-6">
 <AgentsSkeleton />
 </div>
 );
 }

 if (error) {
 return (
 <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
 <AlertTriangle className="h-12 w-12 text-destructive" />
 <p className="text-lg font-medium">{error}</p>
 <Button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }} variant="outline">
  {t('common.retry', { defaultValue: 'Réessayer' })}
 </Button>
 </div>
 );
 }

 if (agents.length === 0 && !loading && !error) {
 return (
 <>
 <MasterpieceBackground />
 <SEO
  title="Agents - Sentinel GRC"
  description="Sentinel agent fleet management"
  keywords="agents, endpoints, monitoring, compliance"
 />
 <div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
  <Shield className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-semibold mb-2">{t('agents.noAgents', { defaultValue: 'Aucun agent inscrit' })}</h3>
  <p className="text-muted-foreground max-w-md mb-6">
  {t('agents.emptyState.description', { defaultValue: 'Déployez Sentinel Agent sur vos terminaux pour démarrer la surveillance de conformité en temps réel.' })}
  </p>
  <Button onClick={() => navigate('/settings?tab=agents')}>
  <Download className="h-4 w-4 mr-2" />
  {t('agents.configureEnrollment', { defaultValue: 'Configurer l\'inscription' })}
  </Button>
 </div>
 </>
 );
 }

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <>
 <MasterpieceBackground />
 <SEO
 title="Agents - Sentinel GRC"
 description="Sentinel agent fleet management"
 keywords="agents, endpoints, monitoring, compliance"
 />

 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-6 sm:gap-8"
 >
 <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <div className="flex justify-center mb-6">
  <TabsList className="bg-muted/50 p-1 rounded-xl" data-tour="agents-tabs">
  <TabsTrigger value="overview" className="flex items-center gap-2" isLoading={loading}>
  <Layers className="h-4 w-4" />
  <span>{t('agents.tabs.supervision', { defaultValue: 'Supervision' })}</span>
  </TabsTrigger>
  <TabsTrigger value="policies" className="flex items-center gap-2" isLoading={loading}>
  <Shield className="h-4 w-4" />
  <span>{t('agents.tabs.policies', { defaultValue: 'Politiques' })}</span>
  </TabsTrigger>
  <TabsTrigger value="software" className="flex items-center gap-2" isLoading={loading}>
  <Package className="h-4 w-4" />
  <span>{t('agents.tabs.softwareInventory', { defaultValue: 'Inventaire logiciel' })}</span>
  </TabsTrigger>
  <TabsTrigger value="anomalies" className="flex items-center gap-2" isLoading={loading}>
  <AlertTriangle className="h-4 w-4" />
  <span>{t('agents.tabs.anomalies', { defaultValue: 'Anomalies' })}</span>
  </TabsTrigger>
  <TabsTrigger value="baselines" className="flex items-center gap-2" isLoading={loading}>
  <Shield className="h-4 w-4" />
  <span>{t('agents.tabs.baselines', { defaultValue: 'Lignes de base' })}</span>
  </TabsTrigger>
  <TabsTrigger value="reports" className="flex items-center gap-2" isLoading={loading}>
  <FileText className="h-4 w-4" />
  <span>{t('agents.tabs.reports', { defaultValue: 'Rapports' })}</span>
  </TabsTrigger>
  </TabsList>
  </div>

  <TabsContent value="overview" key="overview">
  <motion.div
  variants={slideUpVariants}
  className="flex flex-col gap-6 sm:gap-8"
  >
  <PageHeader
  title="Sentinel Agents"
  subtitle={t('agents.subtitle', { defaultValue: 'Gestion et déploiement de la flotte d\'agents Sentinel' })}
  icon={
   <img alt="IA"
   src="/images/IA.png"
   className="w-full h-full object-contain"
   />
  }
  actions={
   <div className="flex items-center gap-2">
   <Button
   variant="outline"
   size="sm"
   className="gap-2"
   onClick={() => navigate('/settings?tab=agents')}
   data-tour="agents-download"
   >
   <Download className="h-4 w-4" />
   <span className="hidden sm:inline">{t('agents.downloadAgent', { defaultValue: 'Télécharger l\'agent' })}</span>
   </Button>
   <Button
   variant="outline"
   size="sm"
   className="gap-2"
   onClick={() => setActiveTab('policies')}
   >
   <Settings className="h-4 w-4" />
   <span className="hidden sm:inline">{t('agents.configuration', { defaultValue: 'Paramétrage' })}</span>
   </Button>
   </div>
  }
  />

  {/* Fleet Dashboard with KPIs, OS Distribution, and Trends */}
  <div data-tour="agents-stats">
  <AgentErrorBoundary componentName="AgentFleetDashboard">
   <AgentFleetDashboard agents={agents} loading={loading} complianceResults={complianceResults} />
  </AgentErrorBoundary>
  </div>

  {/* Search, Filters, and View Mode */}
  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-tour="agents-filters">
  <div className="flex flex-col sm:flex-row gap-4 flex-1">
   <div className="relative flex-1 max-w-md">
   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
   <Input
   placeholder={t('agents.searchPlaceholder', { defaultValue: 'Rechercher un agent...' })}
   value={searchQuery}
   onChange={(e) => setSearchQuery(e.target.value)}
   className="pl-9"
   />
   </div>
   <div className="flex items-center gap-2">
   <Button
   variant={statusFilter === 'all' ? 'default' : 'outline'}
   size="sm"
   onClick={() => setStatusFilter('all')}
   aria-label={t('agents.filter.all', { defaultValue: 'Tous' })}
   >
   {t('agents.filter.all', { defaultValue: 'Tous' })}
   </Button>
   <Button
   variant={statusFilter === 'active' ? 'default' : 'outline'}
   size="sm"
   onClick={() => setStatusFilter('active')}
   className="gap-1"
   aria-label={t('agents.filter.active', { defaultValue: 'Actif' })}
   >
   <span className="w-2 h-2 rounded-full bg-success" />
   {t('agents.filter.active', { defaultValue: 'Actif' })}
   </Button>
   <Button
   variant={statusFilter === 'offline' ? 'default' : 'outline'}
   size="sm"
   onClick={() => setStatusFilter('offline')}
   className="gap-1"
   aria-label={t('agents.filter.offline', { defaultValue: 'Hors ligne' })}
   >
   <span className="w-2 h-2 rounded-full bg-muted-foreground" />
   {t('agents.filter.offline', { defaultValue: 'Hors ligne' })}
   </Button>
   <Button
   variant={statusFilter === 'error' ? 'default' : 'outline'}
   size="sm"
   onClick={() => setStatusFilter('error')}
   className="gap-1"
   aria-label={t('agents.filter.error', { defaultValue: 'Erreur' })}
   >
   <span className="w-2 h-2 rounded-full bg-destructive" />
   {t('agents.filter.error', { defaultValue: 'Erreur' })}
   </Button>
   </div>
  </div>
  {/* View Mode Toggle */}
  <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
   <Button
   variant={viewMode === 'grid' ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setViewMode('grid')}
   className="h-8 w-8 p-0"
   title={t('agents.viewMode.grid', { defaultValue: 'Vue grille' })}
   aria-label={t('agents.viewMode.grid', { defaultValue: 'Vue grille' })}
   >
   <LayoutGrid className="h-4 w-4" />
   </Button>
   <Button
   variant={viewMode === 'compact' ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setViewMode('compact')}
   className="h-8 w-8 p-0"
   title={t('agents.viewMode.compact', { defaultValue: 'Vue liste' })}
   aria-label={t('agents.viewMode.compact', { defaultValue: 'Vue liste' })}
   >
   <List className="h-4 w-4" />
   </Button>
  </div>
  </div>

  {/* Agents Health Grid */}
  <div data-tour="agents-grid">
  <AgentHealthGrid
   agents={filteredAgents}
   viewMode={viewMode}
   complianceResults={complianceResults}
   onAgentClick={handleAgentClick}
   onAgentAction={async (agent, action) => {
   switch (action) {
   case 'view':
   handleAgentClick(agent);
   ErrorLogger.debug(`Agent action: ${agent.id} view`, 'Agents');
   break;
   case 'refresh':
   if (!hasPermission(user, 'Agent', 'update')) return;
   try {
    await AgentService.updateAgentConfig(agent.organizationId, agent.id, {
    forceSync: true,
    requestedAt: new Date().toISOString(),
    } as Record<string, unknown> as Partial<import('../types/agent').AgentConfig>);
    toast.success(t('agents.syncRequested', { defaultValue: 'Synchronisation demandée' }), t('agents.syncRequestedDesc', { defaultValue: 'L\'agent "{{name}}" va se synchroniser.', name: agent.name || agent.hostname }));
    ErrorLogger.debug(`Agent action: ${agent.id} refresh`, 'Agents');
   } catch (error) {
    toast.error(t('common.error', { defaultValue: 'Erreur' }), t('agents.syncError', { defaultValue: 'Impossible de synchroniser l\'agent.' }));
    ErrorLogger.error(error as Error, 'Agents.refreshAgent');
   }
   break;
   case 'delete':
   if (!hasPermission(user, 'Agent', 'delete')) return;
   setDeleteConfirm({ agent });
   break;
   case 'configure':
   if (!hasPermission(user, 'Asset', 'update')) {
    toast.error(t('errors.permissionDenied', { defaultValue: 'Permission refusée' }));
    return;
   }
   setSelectedAgent(agent);
   setIsLiveViewOpen(true);
   ErrorLogger.debug(`Agent action: ${agent.id} configure`, 'Agents');
   break;
   }
   }}
  />
  </div>

  {filteredAgents.length === 0 && !loading && !error && agents.length > 0 && (
  <div className="flex flex-col items-center justify-center py-12 text-center glass-premium rounded-2xl border border-dashed border-border/40">
   <Search className="h-10 w-10 text-muted-foreground mb-3 opacity-30" />
   <p className="text-muted-foreground font-medium">{t('agents.noMatchingAgents', { defaultValue: 'Aucun agent ne correspond à vos filtres' })}</p>
  </div>
  )}

  {/* Compliance Heatmap - Only show when we have agents */}
  {agents.length > 0 && (
  <motion.div variants={slideUpVariants}>
   <AgentErrorBoundary componentName="AgentComplianceHeatmap">
   <AgentComplianceHeatmap
   agents={filteredAgents}
   results={complianceResults}
   onAgentClick={handleAgentClick}
   onCellClick={(agentId, checkId) => {
   // Find the agent and open live view
   const agent = agents.find(a => a.id === agentId);
   if (agent) {
    handleAgentClick(agent);
   }
   ErrorLogger.debug(`Cell clicked: ${agentId} ${checkId}`, 'Agents');
   }}
   />
   </AgentErrorBoundary>
  </motion.div>
  )}
  </motion.div>
  </TabsContent>

  <TabsContent value="policies" key="policies" className="mt-0">
  <AgentPolicies agents={agents} />
  </TabsContent>

  <TabsContent value="software" key="software" className="mt-0">
  <SoftwareInventory />
  </TabsContent>

  <TabsContent value="anomalies" key="anomalies" className="mt-0">
  {user?.organizationId && (
  <AgentErrorBoundary componentName="AnomalyAlerts">
  <AnomalyAlerts />
  </AgentErrorBoundary>
  )}
  </TabsContent>

  <TabsContent value="baselines" key="baselines" className="mt-0">
  {user?.organizationId && (
  <AgentErrorBoundary componentName="BehavioralBaseline">
  <BehavioralBaseline showAllAgents />
  </AgentErrorBoundary>
  )}
  </TabsContent>

  <TabsContent value="reports" key="reports" className="mt-0">
  <div className="flex flex-col gap-6">
  {/* Report type selector */}
  <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1 w-fit">
  <Button
   variant={reportType === 'compliance' ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setReportType('compliance')}
   className="gap-2"
  >
   <Shield className="h-4 w-4" />
   {t('agents.reports.compliance', { defaultValue: 'Conformité' })}
  </Button>
  <Button
   variant={reportType === 'fleet_health' ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setReportType('fleet_health')}
   className="gap-2"
  >
   <Layers className="h-4 w-4" />
   {t('agents.reports.fleetHealth', { defaultValue: 'Santé de flotte' })}
  </Button>
  </div>

  {/* Report content */}
  <AgentErrorBoundary componentName={reportType === 'compliance' ? 'AgentComplianceReport' : 'FleetHealthReport'}>
  {reportType === 'compliance' ? (
   <AgentComplianceReport />
  ) : (
   <FleetHealthReport />
  )}
  </AgentErrorBoundary>
  </div>
  </TabsContent>
 </Tabs>
 </motion.div>

 {/* Delete Confirmation Dialog */}
 <ConfirmModal
 isOpen={!!deleteConfirm}
 onClose={() => setDeleteConfirm(null)}
 onConfirm={async () => {
  if (!deleteConfirm) return;
  try {
  await AgentService.deleteAgent(deleteConfirm.agent.organizationId, deleteConfirm.agent.id);
  toast.success(t('agents.agentDeleted', { defaultValue: 'Agent supprimé' }), t('agents.agentDeletedDesc', { defaultValue: 'L\'agent "{{name}}" a été supprimé.', name: deleteConfirm.agent.name || deleteConfirm.agent.hostname }));
  } catch (err) {
  toast.error(t('common.error', { defaultValue: 'Erreur' }), t('agents.deleteError', { defaultValue: 'Impossible de supprimer l\'agent.' }));
  ErrorLogger.error(err as Error, 'Agents.deleteAgent');
  }
  setDeleteConfirm(null);
 }}
 type="danger"
 title={t('agents.deleteConfirm.title', { defaultValue: 'Confirmer la suppression' })}
 message={t('agents.deleteConfirm.message', { defaultValue: 'Supprimer l\'agent "{{name}}" ? Cette action est irréversible.', name: deleteConfirm?.agent.name || deleteConfirm?.agent.hostname || '' })}
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 />

 {/* Agent Live View Drawer */}
 <Drawer
 isOpen={isLiveViewOpen}
 onClose={handleCloseLiveView}
 width="max-w-4xl"
 title={selectedAgent ? (selectedAgent.name || selectedAgent.hostname || 'Agent') : 'Agent'}
 subtitle={t('agents.liveView.subtitle', { defaultValue: 'Surveillance en temps réel' })}
 >
 {selectedAgent && (
  <AgentLiveView
  agent={selectedAgent}
  onClose={handleCloseLiveView}
  className="h-full"
  />
 )}
 </Drawer>
 </>
 );
};

export default Agents;
