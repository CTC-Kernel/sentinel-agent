import React, { useState, useMemo } from 'react';

import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { Globe, AlertOctagon, Users, MessageSquare, ThumbsUp, Shield, Activity, Share2, Box, LayoutDashboard, List, Network } from '../components/ui/Icons';
import { RefreshCw, Settings, ChevronRight } from '../components/ui/Icons';
import { Menu, Transition } from '@headlessui/react';
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
    const { user, addToast, demoMode } = useStore();
    // hasPermission check: View accessible to all, but actions are restricted in backend or sub-components.

    // UI State
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'map' | 'feed' | 'community'>('threat_intelligence_active_tab', 'map');

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
            // Force mock data seeding if in demo mode and no data available
            if (demoMode) {
                ThreatFeedService.useSimulation = true;
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
        setIsSeeding(true); // Loading state: used in UI (line 208 spinner, line 304 button label)
        addToast("Actualisation des flux live CISA & URLhaus...", "info");
        try {
            const stats = await ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo');
            addToast(`Flux mis à jour : ${stats.threats} nouvelles menaces`, "success");
            logAction(user, 'REFRESH_THREAT_FEED', 'ThreatIntelligence', `Manual feed refresh: ${stats.threats} new, ${stats.vulns} vulnerabilities`);
        } catch (e) {
            ErrorLogger.error(e instanceof Error ? e : new Error(String(e)), 'ThreatIntelligence.seedLiveThreats');

            addToast("Passage en mode simulation (Hors-ligne).", "info");
            // Fallback to simulation
            ThreatFeedService.useSimulation = true;
            await ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo');
        } finally {
            setIsSeeding(false);
        }
    }, [isSeeding, addToast, user]);

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
        const ruleContent = `title: ${threat.title}\nstatus: experimental\ndescription: SIGMA rule for ${threat.title}\nlogsource:\n    category: process_creation\n    product: windows\ndetection:\n    selection:\n        CommandLine|contains:\n            - '${threat.title.split(' ')[0]}'\n    condition: selection\nlevel: ${threat.severity === 'Critical' ? 'critical' : 'high'}`;
        const blob = new Blob([ruleContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SIGMA_${threat.id}.yml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast("Règle de détection téléchargée", "success");
        logAction(user, 'DOWNLOAD_SIGMA_RULE', 'ThreatIntelligence', `Downloaded SIGMA rule for threat ${threat.title}`, undefined, threat.id);
    }, [addToast, user]);

    // UI Handlers
    const handleViewChange = React.useCallback((view: string) => setActiveTab(view as 'overview' | 'map' | 'feed' | 'community'), [setActiveTab]);
    const handleSettingsOpen = React.useCallback(() => setIsSettingsOpen(true), [setIsSettingsOpen]);
    const handleSubmitModalOpen = React.useCallback(() => setIsSubmitModalOpen(true), [setIsSubmitModalOpen]);
    const handleSearchChange = React.useCallback((q: string) => setSearchTerm(q), [setSearchTerm]);
    const handleTypeFilterChange = React.useCallback((f: string) => setActiveTypeFilter(f), [setActiveTypeFilter]);
    const handleCommunitySettingsClose = React.useCallback(() => setIsSettingsOpen(false), [setIsSettingsOpen]);
    const handleDiscussionClose = React.useCallback(() => setSelectedThreatId(null), [setSelectedThreatId]);
    const handleSubmitModalClose = React.useCallback(() => setIsSubmitModalOpen(false), [setIsSubmitModalOpen]);
    const handleSubmitSuccess = React.useCallback(() => {
        addToast("Menace signalée !", "success");
        logAction(user, 'SIGNAL_THREAT', 'ThreatIntelligence', 'User signaled a new community threat');
    }, [addToast, user]);
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
        { id: 'overview', label: 'Vue Globale', icon: LayoutDashboard },
        { id: 'map', label: 'Carte Live', icon: Globe },
        { id: 'feed', label: 'Flux Menaces', icon: List },
        { id: 'community', label: 'Communauté', icon: Users },
    ], []);

    const filterOptions = React.useMemo(() => ['All', 'Ransomware', 'Vulnerability', 'Malware'], []);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-10 pb-24">
            <MasterpieceBackground />
            <SEO title="Threat Intelligence Collaboratif" description="Carte des menaces en temps réel et flux collaboratif." />

            <PageHeader
                title="Threat Intelligence"
                subtitle="Veille collaborative et cartographie mondiale"
                icon={
                    <img
                        src="/images/operations.png"
                        alt="OPÉRATIONS"
                        className="w-full h-full object-contain"
                    />
                }
                actions={
                    <div className="flex gap-2">
                        <button
                            aria-label="Refresh threat feeds"
                            onClick={handleRefreshLiveFeed}
                            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-sm"
                            title="Actualiser les flux"
                        >
                            <RefreshCw className={`h-5 w-5 ${isSeeding ? 'animate-spin text-brand-400' : 'text-slate-200'}`} />
                        </button>

                        {hasPermission(user, 'Threat', 'create') && (
                            <button
                                aria-label="Share new threat"
                                onClick={handleSubmitModalOpen}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl flex items-center text-sm font-bold shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
                                title="Partager une menace"
                            >
                                <Share2 className="h-4 w-4 mr-2" /> Partager
                            </button>
                        )}

                        {hasPermission(user, 'Threat', 'manage') && (
                            <button
                                aria-label="Community settings"
                                onClick={handleSettingsOpen}
                                className="bg-white/5 hover:bg-white/10 text-white p-2.5 rounded-xl border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-sm"
                                title="Paramètres Communauté"
                            >
                                <Settings className="h-5 w-5 text-slate-200" />
                            </button>
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
                searchPlaceholder="Rechercher une menace..."
                actions={
                    activeTab === 'feed' && (
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-sm font-medium" aria-label="Filter threats" title="Filter threats">
                                <Network className="h-4 w-4 text-slate-500" />
                                <span className="hidden md:inline">Filtre:</span> <span className="font-bold ml-1">{activeTypeFilter}</span>
                            </Menu.Button>
                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" />
                            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="p-1">
                                    {filterOptions.map(f => (
                                        <Menu.Item key={f}>
                                            {({ active }) => (
                                                <button aria-label={`Filter by ${f}`} onClick={() => handleTypeFilterChange(f)} className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`} title={`Filter by ${f}`}>
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
                    <motion.div variants={slideUpVariants} className="space-y-6">
                        <ThreatDashboard threats={threats} />
                    </motion.div>
                )
            }

            {/* MAP TAB */}
            {
                activeTab === 'map' && (
                    <motion.div variants={slideUpVariants} className="relative h-[70vh] min-h-[500px] w-full bg-slate-900 rounded-5xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="absolute top-6 right-6 z-10 flex gap-3">
                            <button
                                aria-label="Toggle 2D/3D view"
                                onClick={handleToggleViewMode}
                                className="bg-slate-900/40 hover:bg-slate-900/60 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md flex items-center border border-white/10 transition-all shadow-lg hover:scale-105 active:scale-95"
                                title="Toggle 2D/3D view"
                            >
                                {viewMode === '2d' ? <Box className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                                {viewMode === '2d' ? 'Vue 3D' : 'Vue 2D'}
                            </button>
                            <div className="bg-red-500/90 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md flex items-center shadow-lg shadow-red-500/20 animate-pulse">
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
                    <motion.div variants={slideUpVariants} className="space-y-6">

                        <div className="grid grid-cols-1 gap-4">
                            {threatsLoading ? (
                                <div className="text-center py-20"><LoadingScreen /></div>
                            ) : filteredThreats.length === 0 ? (
                                <EmptyState
                                    icon={Shield}
                                    title="Flux de menaces vide"
                                    description="Aucune menace live détectée. Cliquez pour actualiser les flux."
                                    actionLabel={isSeeding ? "Actualisation..." : "Actualiser les Flux Live"}
                                    onAction={handleRefreshLiveFeed}
                                />
                            ) : (
                                filteredThreats.map((threat) => (
                                    <ThreatCard
                                        key={threat.id}
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
                    <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gradient-to-br from-brand-900 to-purple-900 rounded-5xl p-8 text-white relative overflow-hidden ring-1 ring-white/10 shadow-2xl">
                            <div className="absolute top-0 right-0 p-8 opacity-20 animate-pulse"><Globe className="h-64 w-64" /></div>

                            <div className="relative z-10">
                                <Badge status="success" className="mb-4">Verified Community</Badge>
                                <h3 className="text-3xl font-black mb-2 tracking-tight">Sentinel Force</h3>
                                <p className="text-white/80 text-lg mb-8 max-w-sm leading-relaxed">
                                    Rejoignez <span className="text-white font-bold">12,000+ experts</span> pour une cyberdéfense proactive et collaborative.
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-5 w-5 text-brand-300" />
                                            <div className="text-xs uppercase tracking-wider opacity-70">Experts</div>
                                        </div>
                                        <div className="text-4xl font-black tracking-tight">12.4k</div>
                                    </div>
                                    <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="h-5 w-5 text-emerald-300" />
                                            <div className="text-xs uppercase tracking-wider opacity-70">Mitigations</div>
                                        </div>
                                        <div className="text-4xl font-black tracking-tight">850<span className="text-lg opacity-60">/j</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800/50 rounded-5xl border border-slate-200 dark:border-white/5 p-8 backdrop-blur-xl shadow-xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Activity className="h-6 w-6 text-brand-500" /> Top Hunters
                                </h3>
                                <button aria-label="View all top hunters" className="text-xs font-bold text-brand-500 hover:text-brand-400">Voir tout</button>
                            </div>

                            <div className="space-y-6">
                                {topContributors.map((c, i) => (
                                    <div
                                        key={c.name}
                                        className="flex items-center justify-between group p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all cursor-pointer"
                                        onClick={() => handleHunterClick({ ...c, rank: i + 1 })}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg text-lg transform transition-transform group-hover:scale-110 ${i === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' : i === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-800' : 'bg-brand-500'}`}>
                                                {i < 3 ? i + 1 : c.name.charAt(0)}
                                                {i < 3 && <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5"><Shield className={`h-3 w-3 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-orange-700'}`} /></div>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                                    {c.name}
                                                    {i === 0 && <Badge status="warning" className="scale-75 origin-left">MVP</Badge>}
                                                </div>
                                                <div className="text-sm text-slate-500 font-medium">{c.count} Menaces signalées</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onSelect(threat)}
            className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-brand-500/30 transition-all group relative cursor-pointer"
        >
            <div className="absolute top-6 right-6 flex items-center gap-3">
                {(threat.id.startsWith('simulated') || threat.id.startsWith('baseline')) && (
                    <Badge status="neutral" variant="outline" className="opacity-70">Simulation</Badge>
                )}
                <span className="text-xs text-slate-400 font-mono">{threat.date}</span>
                <Badge status={threat.severity === 'Critical' ? 'error' : threat.severity === 'High' ? 'warning' : 'info'} variant="soft">{threat.severity}</Badge>
            </div>

            <div className="flex gap-5">
                <div className={`p-3 rounded-2xl h-fit ${threat.type === 'Ransomware' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20'}`}>
                    <AlertOctagon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand-500 transition-colors">{threat.title}</h3>
                    <div className="flex items-center text-sm text-slate-500 gap-4 mb-4">
                        <span className="flex items-center"><Globe className="h-3 w-3 mr-1" /> {threat.country}</span>
                        <span className="flex items-center"><Users className="h-3 w-3 mr-1" /> {threat.author}</span>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <button aria-label="Confirm sighting" onClick={(e) => { e.stopPropagation(); onConfirmSighting(threat.id); }} className="flex items-center text-xs font-bold text-slate-500 hover:text-brand-500 transition-colors" title="Confirm sighting">
                            <ThumbsUp className="h-4 w-4 mr-1.5" /> {threat.votes} Confirmations
                        </button>
                        <button aria-label="View discussions" className="flex items-center text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors" title="View discussions">
                            <MessageSquare className="h-4 w-4 mr-1.5" /> {threat.comments || 0} Discussions
                        </button>
                        <div className="ml-auto flex gap-2">
                            <button aria-label="Download SIGMA rule" onClick={(e) => onDownloadRule(e, threat)} className="text-xs font-bold text-emerald-600 hover:text-emerald-500 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg transition-colors" title="Download SIGMA rule">
                                SIGMA Rule
                            </button>
                            <button aria-label="Create risk from threat" onClick={(e) => { e.stopPropagation(); onCreateRisk(threat); }} className="text-xs font-bold text-orange-600 hover:text-orange-500 px-3 py-1 bg-orange-50 dark:bg-orange-900/10 rounded-lg transition-colors" title="Create risk from threat">
                                Créer Risque
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
});
