import React, { useState, useMemo } from 'react';

import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { Globe, AlertOctagon, Users, MessageSquare, ThumbsUp, Shield, Activity, Share2, Box, LayoutDashboard, List, Network } from '../components/ui/Icons';
import { RefreshCw, Settings, ChevronRight } from '../components/ui/Icons';
import { Menu, Transition } from '@headlessui/react';
import { Button } from '../components/ui/button';
import { Threat } from '../types';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { ThreatDashboard } from '../components/threats/ThreatDashboard';
import { WorldThreatMap } from '../components/map/WorldThreatMap';
import { Tooltip } from 'react-tooltip';
import { Badge } from '../components/ui/Badge';
import { ThreatPlanet } from '../components/map/ThreatPlanet';
import { ThreatDiscussion } from '../components/threat-intel/ThreatDiscussion';
import { SubmitThreatDrawer } from '../components/threat-intel/SubmitThreatDrawer';
import { CommunitySettingsModal } from '../components/threat-intel/CommunitySettingsModal';
import { HunterProfileModal } from '../components/threat-intel/HunterProfileModal';
import { ThreatToRiskDrawer } from '../components/threat-intel/ThreatToRiskDrawer';
import { logAction } from '../services/logger';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { useThreatIntelligence } from '../hooks/useThreatIntelligence';
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

 // Community Features State
 const [selectedThreatId, setSelectedThreatId] = useState<string | null>(null);
 const [selectedThreatTitle, setSelectedThreatTitle] = useState('');
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

 // Explicit loading state for async operations (audit requirement)

 const initialLoadRef = React.useRef(false);

 // Auto-seed LIVE data if empty (Production Behavior)
 React.useEffect(() => {
 if (!threatsLoading && threats.length === 0 && !initialLoadRef.current) {
 initialLoadRef.current = true;
 if (!hasPermission(user, 'Threat', 'create')) return;
 // Force mock data seeding if in demo mode and no data available
 if (demoMode) {
 ThreatFeedService.enableSimulation();
 ThreatFeedService.seedSimulatedData(user?.organizationId || 'demo')
  .then(stats => {
  if (stats.threats > 0) logAction(user, 'AUTO_SEED_MOCK', 'ThreatIntelligence', `Initialized with ${stats.threats} mock threats`);
  })
  .catch(e => {
  ErrorLogger.warn(e instanceof Error ? e.message : String(e), 'ThreatIntelligence.seedSimulatedData.autoSeed');
  });
 } else {
 // Silent background fetch to populate module
 ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo')
  .then(stats => {
  if (stats.threats > 0) logAction(user, 'AUTO_SEED_LIVE', 'ThreatIntelligence', `Initialized with ${stats.threats} live threats`);
  })
  .catch(e => {
  ErrorLogger.warn(e instanceof Error ? e.message : String(e), 'ThreatIntelligence.seedLiveThreats.autoSeed');
  });
 }
 }
 }, [threatsLoading, threats.length, user, demoMode]);

 const handleRefreshLiveFeed = React.useCallback(async () => {
 if (isSeeding) return;
 if (!hasPermission(user, 'Threat', 'create')) {
 addToast(t('common.permissionDenied', { defaultValue: 'Permission refusée' }), 'error');
 return;
 }
 setIsSeeding(true); // Loading state: used in UI (line 208 spinner, line 304 button label)
 addToast(t('threatIntel.toast.refreshingFeeds', { defaultValue: "Actualisation des flux CISA et URLhaus en direct..." }), "info");
 try {
 const stats = await ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo');
 addToast(t('threatIntel.toast.feedsUpdated', { defaultValue: "Flux mis à jour : {{count}} nouvelles menaces", count: stats.threats }), "success");
 logAction(user, 'REFRESH_THREAT_FEED', 'ThreatIntelligence', `Manual feed refresh: ${stats.threats} new, ${stats.vulns} vulnerabilities`);
 } catch (e) {
 ErrorLogger.error(e instanceof Error ? e : new Error(String(e)), 'ThreatIntelligence.seedLiveThreats');

 addToast(t('threatIntel.toast.simulationMode', { defaultValue: "Passage en mode simulation (Hors ligne)." }), "info");
 // Fallback to simulation for offline/demo mode
 ThreatFeedService.enableSimulation();
 await ThreatFeedService.seedSimulatedData(user?.organizationId || 'demo');
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

 const topContributors = useMemo(() => {
 const counts: Record<string, number> = {};
 threats.forEach(t => {
 const author = t.author || 'Unknown';
 if (['URLhaus', 'CISA KEV'].includes(author)) return;
 counts[author] = (counts[author] || 0) + 1;
 });
 return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count], i) => ({ name, count, rank: i + 1 }));
 }, [threats]);

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
 const handleDiscussionClose = React.useCallback(() => setSelectedThreatId(null), [setSelectedThreatId]);
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
 setSelectedThreatId(t.id);
 setSelectedThreatTitle(t.title);
 }, [setSelectedThreatId, setSelectedThreatTitle]);

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
  <img
  src="/images/operations.png"
  alt={t('threats.operationsAlt', { defaultValue: 'Opérations' })}
  className="w-full h-full object-contain"
  />
 }
 actions={
  <div className="flex gap-2">
  <Button
  aria-label="Refresh threat feeds"
  onClick={handleRefreshLiveFeed}
  className="bg-white/5 hover:bg-muted text-white border border-white/10 p-2.5 h-auto rounded-xl backdrop-blur-md shadow-sm"
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
  className="bg-white/5 hover:bg-muted text-white p-2.5 h-auto rounded-xl border border-white/10 shadow-sm"
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
  <Menu.Button className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-xl hover:bg-muted/50 transition-colors text-sm font-medium" aria-label="Filter threats" title="Filter threats">
  <Network className="h-4 w-4 text-muted-foreground" />
  <span className="hidden md:inline">{t('threats.filter', { defaultValue: 'Filtrer' })}:</span> <span className="font-bold ml-1">{activeTypeFilter}</span>
  </Menu.Button>
  <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" />
  <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-border/50 rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none z-dropdown">
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
  </Menu.Items>
  </Menu>
  )
 }
 />

 <CommunitySettingsModal isOpen={isSettingsOpen} onClose={handleCommunitySettingsClose} partners={myPartners} onTrustAction={handleTrustAction} />
 <HunterProfileModal isOpen={isHunterModalOpen} onClose={handleHunterModalClose} hunterName={selectedHunter?.name || ''} />
 <ThreatDiscussion threatId={selectedThreatId || ''} threatTitle={selectedThreatTitle} isOpen={!!selectedThreatId} onClose={handleDiscussionClose} />
 <SubmitThreatDrawer isOpen={isSubmitModalOpen} onClose={handleSubmitModalClose} onSuccess={handleSubmitSuccess} />
 <ThreatToRiskDrawer isOpen={isRiskModalOpen} threat={threatForRisk} onClose={handleRiskModalClose} />
 {/* FocusTrap and keyboard navigation are handled internally by Headless UI's Dialog/Drawer components */}

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
  <div className="absolute top-6 right-6 z-10 flex gap-3">
  <Button
  aria-label="Toggle 2D/3D view"
  onClick={handleToggleViewMode}
  className="bg-card/40 hover:bg-card/60 text-white px-4 py-2 h-auto rounded-full text-sm font-bold backdrop-blur-md border border-white/10 shadow-lg"
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
  <motion.div key="community" variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="grid grid-cols-1 md:grid-cols-2 gap-8">
  <div className="bg-gradient-to-br from-primary to-violet-900 rounded-3xl p-8 text-white relative overflow-hidden ring-1 ring-white/10 shadow-2xl">
  <div className="absolute top-0 right-0 p-8 opacity-20 animate-pulse"><Globe className="h-64 w-64" /></div>

  <div className="relative z-10">
  <Badge status="success" className="mb-4">Verified Community</Badge>
  <h3 className="text-3xl font-black mb-2 tracking-tight">Sentinel Force</h3>
  <p className="text-white/80 text-lg mb-8 max-w-sm leading-relaxed">
   {t('threats.communityDescription', { defaultValue: 'Join' })} <span className="text-white font-bold">12,000+ {t('threats.experts', { defaultValue: 'experts' })}</span> {t('threats.communityDescriptionEnd', { defaultValue: 'for proactive and collaborative cyber defense.' })}
  </p>

  <div className="grid grid-cols-2 gap-4">
   <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10 hover:bg-muted transition-colors">
   <div className="flex items-center gap-2 mb-2">
   <Users className="h-5 w-5 text-primary/50" />
   <div className="text-xs uppercase tracking-wider opacity-70">Experts</div>
   </div>
   <div className="text-4xl font-black tracking-tight">12.4k</div>
   </div>
   <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10 hover:bg-muted transition-colors">
   <div className="flex items-center gap-2 mb-2">
   <Shield className="h-5 w-5 text-success-text" />
   <div className="text-xs uppercase tracking-wider opacity-70">Mitigations</div>
   </div>
   <div className="text-4xl font-black tracking-tight">850<span className="text-lg opacity-60">/{t('common.daysShort', { defaultValue: 'd' })}</span></div>
   </div>
  </div>
  </div>
  </div>

  <div className="bg-card/50 rounded-3xl border border-border dark:border-white/5 p-8 backdrop-blur-xl shadow-xl">
  <div className="flex items-center justify-between mb-8">
  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
   <Activity className="h-6 w-6 text-primary" /> Top Hunters
  </h3>
  <Button variant="ghost" aria-label="View all top hunters" className="text-xs font-bold text-primary hover:text-primary/70 p-0 h-auto hover:bg-transparent">{t('common.viewAll', { defaultValue: 'Voir tout' })}</Button>
  </div>

  <div className="space-y-6">
  {topContributors.map((c, i) => (
   <div
   key={c.name || 'unknown'}
   role="button"
   tabIndex={0}
   className="flex items-center justify-between group p-3 hover:bg-muted/50 dark:hover:bg-muted/50 rounded-2xl transition-all cursor-pointer"
   onClick={() => handleHunterClick({ ...c, rank: i + 1 })}
   onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   handleHunterClick({ ...c, rank: i + 1 });
   }
   }}
   >
   <div className="flex items-center gap-4">
   <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg text-lg transform transition-transform group-hover:scale-110 ${i === 0 ? 'bg-gradient-to-br from-warning-text to-warning-text/80' : i === 1 ? 'bg-gradient-to-br from-muted-foreground/30 to-muted/500' : i === 2 ? 'bg-gradient-to-br from-warning-text/70 to-warning-text' : 'bg-primary'}`}>
   {i < 3 ? i + 1 : c.name.charAt(0)}
   {i < 3 && <div className="absolute -top-1 -right-1 bg-card rounded-full p-0.5"><Shield className={`h-3 w-3 ${i === 0 ? 'text-warning-text' : i === 1 ? 'text-muted-foreground' : 'text-warning-text/80'}`} /></div>}
   </div>
   <div>
   <div className="font-bold text-foreground text-lg flex items-center gap-2">
    {c.name}
    {i === 0 && <Badge status="warning" className="scale-75 origin-left">MVP</Badge>}
   </div>
   <div className="text-sm text-muted-foreground font-medium">{c.count} {t('threats.threatsReported', { defaultValue: 'Menaces signalées' })}</div>
   </div>
   </div>
   <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
   </div>
  ))}
  </div>
  </div>
  </motion.div>
 )
 }


 </motion.div >
 );
};

const ThreatCard = React.memo(({
 threat,
 onSelect,
 onConfirmSighting,
 onDownloadRule,
 onCreateRisk
}: {
 threat: Threat,
 onSelect: (t: Threat) => void,
 onConfirmSighting: (id: string) => void,
 onDownloadRule: (e: React.MouseEvent, t: Threat) => void,
 onCreateRisk: (t: Threat) => void
}) => {
 const { t } = useStore();
 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 role="button"
 tabIndex={0}
 onClick={() => onSelect(threat)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
  e.preventDefault();
  onSelect(threat);
 }
 }}
 className="bg-card/50 p-6 rounded-2xl border border-border dark:border-white/5 hover:border-primary/40 transition-all group relative cursor-pointer"
 >
 <div className="absolute top-6 right-6 flex items-center gap-3">
 {(threat.id.startsWith('simulated') || threat.id.startsWith('baseline')) && (
  <Badge status="neutral" variant="outline" className="opacity-70">Simulation</Badge>
 )}
 <span className="text-xs text-muted-foreground font-mono">{threat.date}</span>
 <Badge status={threat.severity === 'Critical' ? 'error' : threat.severity === 'High' ? 'warning' : 'info'} variant="soft">{threat.severity}</Badge>
 </div>

 <div className="flex gap-5">
 <div className={`p-3 rounded-2xl h-fit ${threat.type === 'Ransomware' ? 'bg-error-bg text-error-text' : 'bg-primary/10 text-primary dark:bg-primary'}`}>
  <AlertOctagon className="h-6 w-6" />
 </div>
 <div className="flex-1">
  <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{threat.title}</h3>
  <div className="flex items-center text-sm text-muted-foreground gap-4 mb-4">
  <span className="flex items-center"><Globe className="h-3 w-3 mr-1" /> {threat.country}</span>
  <span className="flex items-center"><Users className="h-3 w-3 mr-1" /> {threat.author}</span>
  </div>

  <div className="flex items-center gap-4 pt-4 border-t border-border/60 dark:border-white/5">
  <Button variant="ghost" aria-label="Confirm sighting" onClick={(e) => { e.stopPropagation(); onConfirmSighting(threat.id); }} className="flex items-center text-xs font-bold text-muted-foreground hover:text-primary h-auto p-0 hover:bg-transparent" title="Confirm sighting">
  <ThumbsUp className="h-4 w-4 mr-1.5" /> {threat.votes} Confirmations
  </Button>
  <Button variant="ghost" aria-label="View discussions" className="flex items-center text-xs font-bold text-muted-foreground hover:text-primary h-auto p-0 hover:bg-transparent" title="View discussions">
  <MessageSquare className="h-4 w-4 mr-1.5" /> {threat.comments || 0} Discussions
  </Button>
  <div className="ml-auto flex gap-2">
  <Button aria-label="Download SIGMA rule" onClick={(e) => onDownloadRule(e, threat)} className="text-xs font-bold text-success-text px-3 py-1 h-auto bg-success-bg rounded-lg hover:bg-success-bg/80" title="Download SIGMA rule">
  SIGMA Rule
  </Button>
  <Button aria-label="Create risk from threat" onClick={(e) => { e.stopPropagation(); onCreateRisk(threat); }} className="text-xs font-bold text-warning-text px-3 py-1 h-auto bg-warning-bg rounded-lg hover:bg-warning-bg/80" title="Create risk from threat">
  {t('threats.createRisk', { defaultValue: 'Créer un risque' })}
  </Button>
  </div>
  </div>
 </div>
 </div>
 </motion.div>
 );
});
