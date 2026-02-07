import React, { useState, useMemo, useRef } from 'react';

import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { Globe, Users, Shield, Activity, Share2, Box, LayoutDashboard, List, Network } from '../components/ui/Icons';
import { RefreshCw, Settings } from '../components/ui/Icons';
import { Menu } from '@headlessui/react';
import { MenuPortal } from '../components/ui/MenuPortal';
import { Button } from '../components/ui/button';
import { Threat } from '../types';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { ThreatDashboard } from '../components/threats/ThreatDashboard';
import { WorldThreatMap } from '../components/map/WorldThreatMap';
import { Tooltip } from 'react-tooltip';
import { ThreatPlanet } from '../components/map/ThreatPlanet';
import { ThreatCard } from '../components/threat-intel/ThreatCard';
import { ThreatDetailPanel } from '../components/threat-intel/ThreatDetailPanel';
import { CommunityTab } from '../components/threat-intel/CommunityTab';
import { SubmitThreatDrawer } from '../components/threat-intel/SubmitThreatDrawer';
import { CommunitySettingsModal } from '../components/threat-intel/CommunitySettingsModal';
import { HunterProfileModal } from '../components/threat-intel/HunterProfileModal';
import { ThreatToRiskDrawer } from '../components/threat-intel/ThreatToRiskDrawer';
import { logAction } from '../services/logger';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { useThreatIntelligence } from '../hooks/useThreatIntelligence';
import { useCommunityStats } from '../hooks/threats/useCommunityStats';
import { ErrorLogger } from '../services/errorLogger';
import { getCountryCoordinates } from '../constants/CountryCoordinates';

import { hasPermission } from '../utils/permissions';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';



export const ThreatIntelligence: React.FC = () => {
 const { user, addToast, demoMode, t } = useStore();
 // hasPermission check: View accessible to all, but actions are restricted in backend or sub-components.

 // UI State
 const [activeTab, setActiveTab] = usePersistedState<'overview' | 'map' | 'feed' | 'community' | 'library'>('threat_intelligence_active_tab', 'map');

 const [tooltipContent, setTooltipContent] = useState('');
 const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
 const [isSeeding, setIsSeeding] = useState(false);

 // Filters (PremiumPageControl)
 const [searchTerm, setSearchTerm] = useState('');
 const [activeTypeFilter, setActiveTypeFilter] = useState('All'); // 'All', 'Ransomware', 'Vulnerability'
 const filterMenuButtonRef = useRef<HTMLButtonElement>(null);

 // Community Features State
 const [selectedThreatForDetail, setSelectedThreatForDetail] = useState<Threat | null>(null);
 const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
 const [isSettingsOpen, setIsSettingsOpen] = useState(false);
 const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
 const [threatForRisk, setThreatForRisk] = useState<Threat | null>(null);
 const [selectedHunter, setSelectedHunter] = useState<{ name: string; count: number; rank: number } | null>(null);
 const [isHunterModalOpen, setIsHunterModalOpen] = useState(false);

 // Business Logic from Hook
 const {
 threats,
 threatsLoading,
 myPartners,
 blockedOrgIds,
 handleTrustAction,
 confirmSighting
 } = useThreatIntelligence();

 const communityStats = useCommunityStats(threats, user);

 // Explicit loading state for async operations (audit requirement)

 const initialLoadRef = React.useRef(false);

 // Auto-seed data if empty (tries live feeds first, falls back to simulated data)
 React.useEffect(() => {
 if (!threatsLoading && threats.length === 0 && !initialLoadRef.current) {
 initialLoadRef.current = true;
 if (!hasPermission(user, 'Threat', 'create')) return;
 const orgId = user?.organizationId || 'demo';

 if (demoMode) {
 ThreatFeedService.enableSimulation();
 }

 // seedLiveThreats now handles fallback to simulated data automatically
 ThreatFeedService.seedLiveThreats(orgId)
  .then(stats => {
  if (stats.threats > 0) {
  const mode = stats.simulated ? 'SIMULATED' : 'LIVE';
  logAction(user, `AUTO_SEED_${mode}`, 'ThreatIntelligence', `Initialized with ${stats.threats} ${mode.toLowerCase()} threats`);
  if (stats.simulated) {
   addToast(t('threatIntel.toast.simulatedDataLoaded', { defaultValue: 'Flux initialisé avec des données de base' }), 'info');
  }
  }
  })
  .catch(e => {
  ErrorLogger.warn(e instanceof Error ? e.message : String(e), 'ThreatIntelligence.autoSeed');
  });
 }
 }, [threatsLoading, threats.length, user, demoMode, addToast, t]);

 const handleRefreshLiveFeed = React.useCallback(async () => {
 if (isSeeding) return;
 if (!hasPermission(user, 'Threat', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission refusée' }), 'error');
 return;
 }
 setIsSeeding(true);
 addToast(t('threatIntel.toast.refreshingFeeds', { defaultValue: "Actualisation des flux CISA et URLhaus en direct..." }), "info");
 try {
 const stats = await ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo');
 if (stats.simulated) {
 addToast(t('threatIntel.toast.simulationMode', { defaultValue: "Flux en direct indisponibles. Données de base chargées." }), "info");
 } else {
 addToast(t('threatIntel.toast.feedsUpdated', { defaultValue: "Flux mis à jour : {{count}} nouvelles menaces", count: stats.threats }), "success");
 }
 logAction(user, 'REFRESH_THREAT_FEED', 'ThreatIntelligence', `Manual feed refresh: ${stats.threats} new, ${stats.vulns} vulns, simulated=${stats.simulated}`);
 } catch (e) {
 ErrorLogger.error(e instanceof Error ? e : new Error(String(e)), 'ThreatIntelligence.seedLiveThreats');
 addToast(t('threatIntel.toast.refreshError', { defaultValue: "Erreur lors de l'actualisation des flux" }), "error");
 } finally {
 setIsSeeding(false);
 }
 }, [isSeeding, addToast, user, t]);

 const mapData = useMemo(() => {
 const countryCounts: Record<string, { value: number, iso3?: string, markers: { coordinates: [number, number]; name: string; type: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; date: string; url?: string }[] }> = {};

 threats.forEach(t => {
 const country = t.country || 'Unknown';
 if (country === 'Unknown' && !t.coordinates) return;

 // Get coordinates: Explicit threat coords OR Country Centroid
 let coords = t.coordinates;

 // Try to resolve country coordinates if no explicit threat coords
 if (!coords) {
 const resolved = getCountryCoordinates(country);
 if (resolved) coords = resolved;
 }

 // If we still have no coords, we can't map it.
 if (!coords) return;

 if (!countryCounts[country]) {
 countryCounts[country] = { value: 0, markers: [] };
 }

 // Criticality weight
 countryCounts[country].value += (t.severity === 'Critical' ? 3 : t.severity === 'High' ? 2 : 1);

 countryCounts[country].markers.push({
 coordinates: coords,
 name: t.title,
 type: t.type || 'Unknown',
 severity: t.severity,
 date: t.date,
 url: t.url
 });
 });

 return Object.entries(countryCounts).map(([country, data]) => ({
 country,
 value: data.value,
 iso3: data.iso3, // Persist ISO3 if available
 markers: data.markers
 }));
 }, [threats]);

 const filteredThreats = useMemo(() => {
 return threats.filter(t => {
 const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
 t.country?.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesType = activeTypeFilter === 'All' || t.type === activeTypeFilter;
 const isBlocked = t.organizationId && blockedOrgIds.includes(t.organizationId);
 return matchesSearch && matchesType && !isBlocked;
 });
 }, [threats, searchTerm, activeTypeFilter, blockedOrgIds]);

 const handleDownloadRule = React.useCallback((e: React.MouseEvent, threat: Threat) => {
 e.stopPropagation();
 const ruleContent = `title: ${threat.title}\nstatus: experimental\ndescription: SIGMA rule for ${threat.title}\nlogsource:\n category: process_creation\n product: windows\ndetection:\n selection:\n CommandLine|contains:\n - '${threat.title.split(' ')[0]}'\n condition: selection\nlevel: ${threat.severity === 'Critical' ? 'critical' : 'high'}`;
 const blob = new Blob([ruleContent], { type: 'text/yaml' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `SIGMA_${threat.id}.yml`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 addToast(t('threatIntel.toast.ruleDownloaded', { defaultValue: "Règle de détection téléchargée" }), "success");
 logAction(user, 'DOWNLOAD_SIGMA_RULE', 'ThreatIntelligence', `Downloaded SIGMA rule for threat ${threat.title}`, undefined, threat.id);
 }, [addToast, user, t]);

 // UI Handlers
 const handleViewChange = React.useCallback((view: string) => setActiveTab(view as 'overview' | 'map' | 'feed' | 'community' | 'library'), [setActiveTab]);
 const handleSettingsOpen = React.useCallback(() => setIsSettingsOpen(true), [setIsSettingsOpen]);
 const handleSubmitModalOpen = React.useCallback(() => setIsSubmitModalOpen(true), [setIsSubmitModalOpen]);
 const handleSearchChange = React.useCallback((q: string) => setSearchTerm(q), [setSearchTerm]);
 const handleTypeFilterChange = React.useCallback((f: string) => setActiveTypeFilter(f), [setActiveTypeFilter]);
 const handleCommunitySettingsClose = React.useCallback(() => setIsSettingsOpen(false), [setIsSettingsOpen]);
 const handleDetailPanelClose = React.useCallback(() => setSelectedThreatForDetail(null), []);
 const handleSubmitModalClose = React.useCallback(() => setIsSubmitModalOpen(false), [setIsSubmitModalOpen]);
 const handleSubmitSuccess = React.useCallback(() => {
 addToast(t('threatIntel.toast.threatReported', { defaultValue: "Menace signalée !" }), "success");
 logAction(user, 'SIGNAL_THREAT', 'ThreatIntelligence', 'User signaled a new community threat');
 }, [addToast, user, t]);
 const handleRiskModalClose = React.useCallback(() => setIsRiskModalOpen(false), [setIsRiskModalOpen]);
 const handleToggleViewMode = React.useCallback(() => setViewMode(prev => prev === '2d' ? '3d' : '2d'), [setViewMode]);
 const handleHunterClick = React.useCallback((hunter: { name: string; count: number; rank: number }) => {
 setSelectedHunter(hunter);
 setIsHunterModalOpen(true);
 logAction(user, 'VIEW_HUNTER_PROFILE', 'ThreatIntelligence', `Viewed hunter profile: ${hunter.name}`);
 }, [user]);
 const handleHunterModalClose = React.useCallback(() => {
 setIsHunterModalOpen(false);
 setSelectedHunter(null);
 }, []);

 const handleThreatSelect = React.useCallback((t: Threat) => {
 setSelectedThreatForDetail(t);
 }, []);

 const handleThreatClickById = React.useCallback((threatId: string) => {
 const found = threats.find(t => t.id === threatId);
 if (found) setSelectedThreatForDetail(found);
 }, [threats]);

 const handleConfirmSighting = React.useCallback((id: string) => {
 confirmSighting(id);
 logAction(user, 'CONFIRM_SIGHTING', 'ThreatIntelligence', `Confirmed sighting for threat ${id}`, undefined, id);
 }, [confirmSighting, user]);

 const handleCreateRisk = React.useCallback((t: Threat) => {
 setThreatForRisk(t);
 setIsRiskModalOpen(true);
 logAction(user, 'INITIATE_RISK_CREATION', 'Risks', `Initiated risk creation from threat ${t.title}`, undefined, t.id);
 }, [user]);

 const viewOptions = React.useMemo(() => [
 { id: 'overview', label: t('threats.globalView', { defaultValue: 'Vue globale' }), icon: LayoutDashboard },
 { id: 'map', label: t('threats.liveMap', { defaultValue: 'Carte en direct' }), icon: Globe },
 { id: 'feed', label: t('threats.threatFeed', { defaultValue: 'Flux de menaces' }), icon: List },
 { id: 'community', label: t('threats.community', { defaultValue: 'Communauté' }), icon: Users },
 ], [t]);

 const filterOptions = React.useMemo(() => ['All', 'Ransomware', 'Vulnerability', 'Malware'], []);

 return (
 <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
 <MasterpieceBackground />
 <SEO title={t('threats.seoTitle', { defaultValue: 'Renseignement collaboratif sur les menaces' })} description={t('threats.seoDescription', { defaultValue: 'Carte des menaces en temps réel et flux collaboratif.' })} />

 <PageHeader
 title="Threat Intelligence"
 subtitle={t('threats.subtitle', { defaultValue: 'Intelligence collaborative et cartographie mondiale' })}
 icon={
  <img alt={t('threats.operationsAlt', { defaultValue: 'Opérations' })}
  src="/images/operations.png"
  className="w-full h-full object-contain"
  />
 }
 actions={
  <div className="flex gap-2">
  <Button
  aria-label="Refresh threat feeds"
  onClick={handleRefreshLiveFeed}
  className="bg-muted/50 hover:bg-muted text-foreground border border-border/40 p-2.5 h-auto rounded-xl backdrop-blur-md shadow-sm"
  title={t('threats.refreshFeeds', { defaultValue: 'Actualiser les flux' })}
  >
  <RefreshCw className={`h-5 w-5 ${isSeeding ? 'animate-spin text-primary/70' : 'text-muted-foreground/60'}`} />
  </Button>

  {hasPermission(user, 'Threat', 'create') && (
  <Button
  aria-label="Share new threat"
  onClick={handleSubmitModalOpen}
  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 h-auto rounded-xl shadow-lg shadow-primary/20"
  title={t('common.share', { defaultValue: 'Partager' })}
  >
  <Share2 className="h-4 w-4 mr-2" /> {t('common.share', { defaultValue: 'Partager' })}
  </Button>
  )}

  {hasPermission(user, 'Threat', 'manage') && (
  <Button
  aria-label="Community settings"
  onClick={handleSettingsOpen}
  className="bg-muted/50 hover:bg-muted text-foreground p-2.5 h-auto rounded-xl border border-border/40 shadow-sm"
  title={t('threats.communitySettings', { defaultValue: 'Paramètres de la communauté' })}
  >
  <Settings className="h-5 w-5 text-muted-foreground/60" />
  </Button>
  )}
  </div>
 }
 />

 <PremiumPageControl
 activeView={activeTab}
 onViewChange={handleViewChange}
 viewOptions={viewOptions}
 searchQuery={searchTerm}
 onSearchChange={handleSearchChange}
 searchPlaceholder={t('threats.searchPlaceholder', { defaultValue: 'Rechercher une menace...' })}
 actions={
  activeTab === 'feed' && (
  <Menu as="div" className="relative inline-block text-left">
  {({ open }) => (
  <>
  <Menu.Button ref={filterMenuButtonRef} className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-xl hover:bg-muted/50 transition-colors text-sm font-medium" aria-label="Filter threats" title="Filter threats">
  <Network className="h-4 w-4 text-muted-foreground" />
  <span className="hidden md:inline">{t('threats.filter', { defaultValue: 'Filtrer' })}:</span> <span className="font-bold ml-1">{activeTypeFilter}</span>
  </Menu.Button>
  <MenuPortal buttonRef={filterMenuButtonRef} open={open} width={192}>
  <div className="p-1">
   {filterOptions.map(f => (
   <Menu.Item key={f || 'unknown'}>
   {({ active }) => (
   <button aria-label={`Filter by ${f}`} onClick={() => handleTypeFilterChange(f)} className={`${active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'} group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`} title={`Filter by ${f}`}>
    {f}
   </button>
   )}
   </Menu.Item>
   ))}
  </div>
  </MenuPortal>
  </>
  )}
  </Menu>
  )
 }
 />

 <CommunitySettingsModal isOpen={isSettingsOpen} onClose={handleCommunitySettingsClose} partners={myPartners} onTrustAction={handleTrustAction} />
 <HunterProfileModal isOpen={isHunterModalOpen} onClose={handleHunterModalClose} hunterName={selectedHunter?.name || ''} />
 <ThreatDetailPanel
  isOpen={!!selectedThreatForDetail}
  onClose={handleDetailPanelClose}
  threat={selectedThreatForDetail}
  threats={threats}
  onConfirmSighting={handleConfirmSighting}
  onDownloadRule={handleDownloadRule}
  onCreateRisk={handleCreateRisk}
 />
 <SubmitThreatDrawer isOpen={isSubmitModalOpen} onClose={handleSubmitModalClose} onSuccess={handleSubmitSuccess} />
 <ThreatToRiskDrawer isOpen={isRiskModalOpen} threat={threatForRisk} onClose={handleRiskModalClose} />

 {
 activeTab === 'overview' && (
  <motion.div key="overview" variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="space-y-6">
  <ThreatDashboard threats={threats} />
  </motion.div>
 )
 }

 {/* MAP TAB */}
 {
 activeTab === 'map' && (
  <motion.div key="map" variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="relative h-[70vh] min-h-[500px] w-full bg-card rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
  <div className="absolute top-6 right-6 z-decorator flex gap-3">
  <Button
  aria-label="Toggle 2D/3D view"
  onClick={handleToggleViewMode}
  className="bg-card/80 hover:bg-card text-foreground px-4 py-2 h-auto rounded-full text-sm font-bold backdrop-blur-md border border-border/40 shadow-lg"
  title="Toggle 2D/3D view"
  >
  {viewMode === '2d' ? <Box className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
  {viewMode === '2d' ? t('threats.view3D', { defaultValue: 'Vue 3D' }) : t('threats.view2D', { defaultValue: 'Vue 2D' })}
  </Button>
  <div className="bg-error-text/90 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md flex items-center shadow-lg shadow-error-bg/50 animate-pulse">
  <Activity className="h-3 w-3 mr-2" /> LIVE
  </div>
  </div>

  {viewMode === '2d' ? (
  <>
  <WorldThreatMap data={mapData} setTooltipContent={setTooltipContent} />
  <Tooltip id="rsm-tooltip" isOpen={!!tooltipContent} content={tooltipContent} />
  </>
  ) : (
  <div className="w-full h-full relative">
  <ThreatPlanet data={mapData} />
  </div>
  )}
  </motion.div>
 )
 }

 {/* FEED TAB */}
 {
 activeTab === 'feed' && (
  <motion.div key="feed" variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="space-y-6">

  <div className="grid grid-cols-1 gap-4">
  {threatsLoading ? (
  <div className="text-center py-20"><LoadingScreen /></div>
  ) : filteredThreats.length === 0 ? (
  <EmptyState
   icon={Shield}
   title={t('threats.emptyFeed', { defaultValue: 'Le flux de menaces est vide' })}
   description={t('threats.emptyFeedDescription', { defaultValue: 'Aucune menace en direct détectée. Cliquez pour actualiser les flux.' })}
   actionLabel={isSeeding ? t('threats.refreshing', { defaultValue: 'Actualisation...' }) : t('threats.refreshLiveFeeds', { defaultValue: 'Actualiser les flux en direct' })}
   onAction={handleRefreshLiveFeed}
  />
  ) : (
  filteredThreats.map((threat) => (
   <ThreatCard
   key={threat.id || 'unknown'}
   threat={threat}
   onSelect={handleThreatSelect}
   onConfirmSighting={handleConfirmSighting}
   onDownloadRule={handleDownloadRule}
   onCreateRisk={handleCreateRisk}
   />
  ))
  )}
  </div>
  </motion.div>
 )
 }

 {/* COMMUNITY TAB */}
 {
 activeTab === 'community' && (
  <motion.div key="community" variants={slideUpVariants} initial="initial" animate="visible" exit="exit">
  <CommunityTab
   stats={communityStats}
   currentUserName={user?.displayName}
   onHunterClick={handleHunterClick}
   onThreatClick={handleThreatClickById}
   /* validate */ onSubmitThreat={handleSubmitModalOpen}
  />
  </motion.div>
 )
 }


 </motion.div >
 );
};

