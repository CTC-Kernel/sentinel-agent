import React, { useState, useMemo } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { Globe, AlertOctagon, Users, MessageSquare, ThumbsUp, Shield, Activity, Share2, Box, LayoutDashboard, List, Network } from '../components/ui/Icons';
import { RefreshCw, Settings } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Threat } from '../types';
import { ThreatFeedService } from '../services/ThreatFeedService';
import { ThreatDashboard } from '../components/threats/ThreatDashboard';
import { WorldThreatMap } from '../components/map/WorldThreatMap';
import { Tooltip } from 'react-tooltip';
import { Badge } from '../components/ui/Badge';
import { ThreatPlanet } from '../components/map/ThreatPlanet';
import { ThreatDiscussion } from '../components/threat-intel/ThreatDiscussion';
import { SubmitThreatModal } from '../components/threat-intel/SubmitThreatModal';
import { CommunitySettingsModal } from '../components/threat-intel/CommunitySettingsModal';
import { ThreatToRiskModal } from '../components/threat-intel/ThreatToRiskModal';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { orderBy, updateDoc, doc, increment, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAction } from '../services/logger';
import { useStore } from '../store';
import { TrustRelationship } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';

import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';

export const ThreatIntelligence: React.FC = () => {
    const { user, addToast } = useStore();

    // UI State
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'map' | 'feed' | 'community'>('threat_intelligence_active_tab', 'overview');


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

    // Filter relationships
    const myOrgId = user?.organizationId || 'demo';
    const { data: partners } = useFirestoreCollection<TrustRelationship>('relationships', [], { realtime: true });
    const myPartners = useMemo(() => partners.filter(p => p.sourceOrgId === myOrgId), [partners, myOrgId]);

    const handleTrustAction = async (id: string, action: 'trust' | 'block' | 'remove') => {
        try {
            if (action === 'remove') {
                await deleteDoc(doc(db, 'relationships', id));
                addToast("Relation supprimée", "info");
            } else {
                await updateDoc(doc(db, 'relationships', id), { status: action === 'trust' ? 'trusted' : 'blocked' });
                addToast(action === 'trust' ? "Partenaire ajouté aux cercles de confiance" : "Organisation bloquée", "success");
            }
        } catch (e) {
            console.error("Error updating relationship", e);
            addToast("Erreur lors de la mise à jour", "error");
        }
    };

    const blockedOrgIds = useMemo(() => myPartners.filter(p => p.status === 'blocked').map(p => p.targetOrgId), [myPartners]);

    // Data
    const { data: threats, loading: threatsLoading } = useFirestoreCollection<Threat>('threats', [orderBy('timestamp', 'desc')], { realtime: true });
    const initialLoadRef = React.useRef(false);

    // Seeding logic
    React.useEffect(() => {
        if (!threatsLoading && threats.length === 0 && !initialLoadRef.current) {
            initialLoadRef.current = true;
            ThreatFeedService.seedThreatsAndVulnerabilities(user?.organizationId || 'demo').then(stats => {
                logAction(user, 'SEED_DATA', 'ThreatIntelligence', `Seeding complete: ${stats.threats} threats`);
            }).catch(console.warn);
        }
    }, [threatsLoading, threats.length, user]);

    // Derived Map Data
    const mapData = useMemo(() => {
        const countryCounts: Record<string, { value: number, markers: { coordinates: [number, number]; name: string }[] }> = {};
        const baseCountries = ['China', 'Russia', 'Brazil', 'United States', 'Germany', 'France', 'India'];
        const countryCoords: Record<string, [number, number]> = {
            'United States': [-95.7129, 37.0902], 'Germany': [10.4515, 51.1657], 'France': [2.2137, 46.2276],
            'India': [78.9629, 20.5937], 'China': [104.1954, 35.8617], 'Russia': [105.3188, 61.5240], 'Brazil': [-51.9253, -14.2350]
        };

        baseCountries.forEach(c => { countryCounts[c] = { value: Math.floor(Math.random() * 5) + 2, markers: [] }; });

        threats.forEach(t => {
            if (!countryCounts[t.country]) countryCounts[t.country] = { value: 0, markers: [] };
            countryCounts[t.country].value += (t.severity === 'Critical' ? 3 : t.severity === 'High' ? 2 : 1);
            if (countryCoords[t.country]) {
                countryCounts[t.country].markers.push({ coordinates: countryCoords[t.country], name: t.title });
            }
        });

        return Object.entries(countryCounts).map(([country, data]) => ({ country, value: data.value, markers: data.markers }));
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

    // Actions
    const handleConfirmSighting = async (e: React.MouseEvent, threatId: string) => {
        e.stopPropagation();
        if (!user) return;
        try {
            await updateDoc(doc(db, 'threats', threatId), { votes: increment(1) });
            logAction(user, 'CONFIRM_SIGHTING', 'ThreatIntelligence', `Confirmed sighting ${threatId}`);
            addToast("Observation confirmée (+1)", "success");
        } catch { addToast("Action non autorisée (Mode Démo)", "info"); }
    };

    const handleDownloadRule = (e: React.MouseEvent, threat: Threat) => {
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
    };

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8 pb-20">
            <MasterpieceBackground />
            <SEO title="Threat Intelligence Collaboratif" description="Carte des menaces en temps réel et flux collaboratif." />

            <PageHeader
                title="Threat Intelligence"
                subtitle="Veille collaborative et cartographie mondiale"
                icon={<Globe className="h-6 w-6 text-white" />}
                breadcrumbs={[{ label: 'Pilotage' }, { label: 'Threat Intel' }]}
                actions={
                    <div className="flex gap-2">
                        <button onClick={async () => {
                            if (isSeeding) return;
                            setIsSeeding(true);
                            addToast("Mise à jour...", "info");
                            try {
                                const stats = await ThreatFeedService.seedThreatsAndVulnerabilities(user?.organizationId || 'demo');
                                addToast(`Mis à jour: ${stats.threats} menaces`, "success");
                            } catch (e) { console.error(e); } finally { setIsSeeding(false); }
                        }} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 p-2 rounded-xl backdrop-blur-md transition-all">
                            <RefreshCw className={`h-5 w-5 ${isSeeding ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => setIsSubmitModalOpen(true)} className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl flex items-center text-sm font-bold shadow-lg shadow-brand-500/20">
                            <Share2 className="h-4 w-4 mr-2" /> Partager
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl border border-white/10">
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                }
            />

            <PremiumPageControl
                activeView={activeTab}
                onViewChange={(view) => setActiveTab(view as 'overview' | 'map' | 'feed' | 'community')}
                viewOptions={[
                    { id: 'overview', label: 'Vue Globale', icon: LayoutDashboard },
                    { id: 'map', label: 'Carte Live', icon: Globe },
                    { id: 'feed', label: 'Flux Menaces', icon: List },
                    { id: 'community', label: 'Communauté', icon: Users },
                ]}
                searchQuery={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Rechercher une menace..."
                actions={
                    activeTab === 'feed' && (
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-sm font-medium">
                                <Network className="h-4 w-4 text-slate-500" />
                                <span className="hidden md:inline">Filtre:</span> <span className="font-bold ml-1">{activeTypeFilter}</span>
                            </Menu.Button>
                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" />
                            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                <div className="p-1">
                                    {['All', 'Ransomware', 'Vulnerability', 'Malware'].map(f => (
                                        <Menu.Item key={f}>
                                            {({ active }) => (
                                                <button onClick={() => setActiveTypeFilter(f)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
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

            <CommunitySettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} partners={myPartners} onTrustAction={handleTrustAction} />
            <ThreatDiscussion threatId={selectedThreatId || ''} threatTitle={selectedThreatTitle} isOpen={!!selectedThreatId} onClose={() => setSelectedThreatId(null)} />
            <SubmitThreatModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} onSuccess={() => addToast("Menace signalée !", "success")} />
            <ThreatToRiskModal isOpen={isRiskModalOpen} threat={threatForRisk} onClose={() => setIsRiskModalOpen(false)} />

            {activeTab === 'overview' && (
                <motion.div variants={slideUpVariants} className="space-y-6">
                    <ThreatDashboard threats={threats} />
                </motion.div>
            )}

            {/* MAP TAB */}
            {activeTab === 'map' && (
                <motion.div variants={slideUpVariants} className="relative h-[70vh] min-h-[500px] w-full bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
                    <div className="absolute top-6 right-6 z-10 flex gap-2">
                        <button onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md flex items-center border border-white/10 transition-all">
                            {viewMode === '2d' ? <Box className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                            {viewMode === '2d' ? 'Vue 3D' : 'Vue 2D'}
                        </button>
                        <div className="bg-red-500/80 text-white px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md flex items-center animate-pulse">
                            <Activity className="h-4 w-4 mr-2" /> Live
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
            )}

            {/* FEED TAB */}
            {activeTab === 'feed' && (
                <motion.div variants={slideUpVariants} className="space-y-6">


                    <div className="grid grid-cols-1 gap-4">
                        {threatsLoading ? (
                            <div className="text-center py-20"><LoadingScreen /></div>
                        ) : filteredThreats.length === 0 ? (
                            <EmptyState icon={Shield} title="Aucune menace trouvée" description="Modifiez vos filtres ou actualisez le flux." />
                        ) : (
                            filteredThreats.map((threat) => (
                                <motion.div
                                    key={threat.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => { setSelectedThreatId(threat.id); setSelectedThreatTitle(threat.title); }}
                                    className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-brand-500/30 transition-all group relative cursor-pointer"
                                >
                                    <div className="absolute top-6 right-6 flex items-center gap-3">
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
                                                <button onClick={(e) => handleConfirmSighting(e, threat.id)} className="flex items-center text-xs font-bold text-slate-500 hover:text-brand-500 transition-colors">
                                                    <ThumbsUp className="h-4 w-4 mr-1.5" /> {threat.votes} Confirmations
                                                </button>
                                                <button className="flex items-center text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors">
                                                    <MessageSquare className="h-4 w-4 mr-1.5" /> {threat.comments || 0} Discussions
                                                </button>
                                                <div className="ml-auto flex gap-2">
                                                    <button onClick={(e) => handleDownloadRule(e, threat)} className="text-xs font-bold text-emerald-600 hover:text-emerald-500 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg transition-colors">
                                                        SIGMA Rule
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setThreatForRisk(threat); setIsRiskModalOpen(true); }} className="text-xs font-bold text-orange-600 hover:text-orange-500 px-3 py-1 bg-orange-50 dark:bg-orange-900/10 rounded-lg transition-colors">
                                                        Créer Risque
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>
            )}

            {/* COMMUNITY TAB */}
            {activeTab === 'community' && (
                <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gradient-to-br from-brand-900 to-purple-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10"><Globe className="h-64 w-64" /></div>
                        <h3 className="text-2xl font-black mb-2 relative z-10">Communauté Sentinel</h3>
                        <p className="text-white/80 text-lg mb-8 relative z-10 max-w-sm">Rejoignez 12,000 experts en cybersécurité pour partager et valider les menaces en temps réel.</p>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md">
                                <div className="text-4xl font-black">12k</div>
                                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">Experts Actifs</div>
                            </div>
                            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md">
                                <div className="text-4xl font-black">850</div>
                                <div className="text-xs uppercase tracking-wider opacity-70 mt-1">Alertes / Jour</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-200 dark:border-white/5 p-8 backdrop-blur-xl">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Top Contributeurs</h3>
                        <div className="space-y-6">
                            {topContributors.map((c, i) => (
                                <div key={c.name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-700' : 'bg-brand-500'}`}>
                                            {i < 3 ? i + 1 : c.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                                            <div className="text-sm text-slate-500">{c.count} Signalements</div>
                                        </div>
                                    </div>
                                    {i < 3 && <Shield className={`h-5 w-5 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : 'text-orange-700'}`} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

        </motion.div>
    );
};
