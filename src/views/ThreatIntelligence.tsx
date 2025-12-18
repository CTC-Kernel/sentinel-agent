import React, { useState, useMemo } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { Globe, AlertOctagon, TrendingUp, Users, MessageSquare, ThumbsUp, Shield, Activity, Share2, Box } from '../components/ui/Icons';
import { WorldThreatMap } from '../components/map/WorldThreatMap';
import { Tooltip } from 'react-tooltip';
import { Badge } from '../components/ui/Badge';
import { ThreatPlanet } from '../components/map/ThreatPlanet';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { orderBy, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { logAction } from '../services/logger';
import { useStore } from '../store';

// Initial Seed Data for Demo Mode (Production Ready: stored in DB)
const INITIAL_THREATS = [
    { title: 'Ransomware "BlackCat" Variant Detected', type: 'Ransomware', severity: 'Critical', country: 'United States', date: '2h ago', votes: 124, comments: 45, author: 'Sentinel Team', timestamp: Date.now() },
    { title: 'Zero-day in popular CI/CD tool', type: 'Vulnerability', severity: 'High', country: 'Germany', date: '5h ago', votes: 89, comments: 12, author: 'Community', timestamp: Date.now() - 18000000 },
    { title: 'Phishing Campaign targeting Finance', type: 'Phishing', severity: 'Medium', country: 'France', date: '1d ago', votes: 56, comments: 8, author: 'CyberAlliance', timestamp: Date.now() - 86400000 },
    { title: 'DDoS attacks on Healthcare sector', type: 'DDoS', severity: 'High', country: 'India', date: '1d ago', votes: 230, comments: 67, author: 'Sentinel Team', timestamp: Date.now() - 90000000 },
];

interface Threat {
    id: string;
    title: string;
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    country: string;
    date: string;
    votes: number;
    comments: number;
    author: string;
    coordinates?: [number, number]; // Optional for map mapping
}

export const ThreatIntelligence: React.FC = () => {
    const { user } = useStore();
    const [tooltipContent, setTooltipContent] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

    // Real Data Integration
    const { data: threats, loading } = useFirestoreCollection<Threat>('threats', [orderBy('timestamp', 'desc')], { realtime: true });
    const initialLoadRef = React.useRef(false);

    React.useEffect(() => {
        if (!loading && threats.length === 0 && !initialLoadRef.current) {
            initialLoadRef.current = true;
            const seedData = async () => {
                logAction(user, 'SEED_DATA', 'ThreatIntelligence', `Seeding ${INITIAL_THREATS.length} initial threats`);
                for (const threat of INITIAL_THREATS) {
                    await addDoc(collection(db, 'threats'), threat);
                }
            };
            seedData();
        }
    }, [loading, threats.length]);

    // Derive Map Data from Threats (Dynamic)
    const mapData = useMemo(() => {
        // Basic mapping of countries to threats
        // In a real app, we'd have a geometric center mapping for every country.
        // For this "Demo/Production" mix, we'll map a few key ones or just use the country name match if we had a geo-lookup.
        // To keep it simple and working: we'll simulate the "value" aggregation based on threat count per country.

        const countryCounts: Record<string, { value: number, markers: any[] }> = {};

        // Default some countries to show activity even if no threats (for aesthetics)
        // or just rely on threats. Let's rely on threats + some baseline noise for "World Map" feel.
        const baseCountries = ['China', 'Russia', 'Brazil']; // Add some background noise
        baseCountries.forEach(c => {
            countryCounts[c] = { value: Math.floor(Math.random() * 5) + 2, markers: [] };
        });

        const countryCoords: Record<string, [number, number]> = {
            'United States': [-95.7129, 37.0902],
            'Germany': [10.4515, 51.1657],
            'France': [2.2137, 46.2276],
            'India': [78.9629, 20.5937],
            'China': [104.1954, 35.8617],
            'Russia': [105.3188, 61.5240],
            'Brazil': [-51.9253, -14.2350]
        };

        threats.forEach(t => {
            if (!countryCounts[t.country]) {
                countryCounts[t.country] = { value: 0, markers: [] };
            }
            countryCounts[t.country].value += (t.severity === 'Critical' ? 3 : t.severity === 'High' ? 2 : 1);
            if (countryCoords[t.country]) {
                countryCounts[t.country].markers.push({
                    coordinates: countryCoords[t.country], // In reality, we'd jitter this or use specific coords
                    name: t.title
                });
            }
        });

        return Object.entries(countryCounts).map(([country, data]) => ({
            country,
            value: data.value,
            markers: data.markers
        }));
    }, [threats]);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8 pb-20">
            <MasterpieceBackground />
            <SEO title="Threat Intelligence Collaboratif" description="Carte des menaces en temps réel et flux collaboratif." />

            <PageHeader
                title="Threat Intelligence"
                subtitle="Veille collaborative et cartographie mondiale des menaces."
                icon={<Globe className="h-6 w-6 text-white" />}
                breadcrumbs={[{ label: 'Pilotage' }, { label: 'Threat Intel' }]}
                actions={
                    <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl flex items-center text-sm font-bold backdrop-blur-md">
                        <Share2 className="h-4 w-4 mr-2" />
                        Partager une observation
                    </button>
                }
            />

            {/* Map Section */}
            <motion.div variants={slideUpVariants} className="relative">
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <button
                        onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
                        className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center border border-white/10 transition-all"
                    >
                        {viewMode === '2d' ? <Box className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                        {viewMode === '2d' ? 'Vue Voxel 3D' : 'Vue Carte 2D'}
                    </button>
                    <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center">
                        <Activity className="h-3 w-3 mr-1 text-red-500 animate-pulse" /> Live Feed
                    </div>
                </div>
                {viewMode === '2d' ? (
                    <>
                        <WorldThreatMap data={mapData} setTooltipContent={setTooltipContent} />
                        <Tooltip id="my-tooltip" content={tooltipContent} />
                        {/* Tooltip handling simplified */}
                        <Tooltip id="rsm-tooltip" isOpen={!!tooltipContent} content={tooltipContent} />
                    </>
                ) : (
                    <div className="w-full h-[500px] bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/5 overflow-hidden text-white relative">
                        <ThreatPlanet data={mapData} />
                    </div>
                )}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center text-slate-900 dark:text-white">
                            <TrendingUp className="h-5 w-5 mr-2 text-brand-500" />
                            Flux de Menaces (Global)
                        </h2>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            {['All', 'Ransomware', 'Vulnerability'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeFilter === f ? 'bg-white dark:bg-slate-700 shadow text-brand-600' : 'text-slate-500'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {threats.filter(t => activeFilter === 'All' || t.type === activeFilter).map((threat) => (
                            <motion.div
                                key={threat.id}
                                variants={slideUpVariants}
                                className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-brand-500/30 transition-all group relative cursor-pointer"
                            >
                                <div className="absolute top-5 right-5 flex items-center space-x-2">
                                    <span className="text-xs text-slate-400">{threat.date}</span>
                                    <Badge status={threat.severity === 'Critical' ? 'error' : 'warning'} variant="soft">{threat.severity}</Badge>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${threat.type === 'Ransomware' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'} dark:bg-white/5`}>
                                        <AlertOctagon className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{threat.title}</h3>
                                        <div className="flex items-center text-sm text-slate-500 space-x-3 mb-3">
                                            <span className="flex items-center"><Globe className="h-3 w-3 mr-1" /> {threat.country}</span>
                                            <span className="flex items-center"><Users className="h-3 w-3 mr-1" /> {threat.author}</span>
                                        </div>

                                        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                            <button className="flex items-center text-xs font-bold text-slate-500 hover:text-brand-500 transition-colors">
                                                <ThumbsUp className="h-4 w-4 mr-1.5" />
                                                {threat.votes} Confirmations
                                            </button>
                                            <button className="flex items-center text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors">
                                                <MessageSquare className="h-4 w-4 mr-1.5" />
                                                {threat.comments} Discussions
                                            </button>
                                            <button className="flex items-center text-xs font-bold text-slate-500 hover:text-green-500 transition-colors ml-auto">
                                                <Shield className="h-4 w-4 mr-1.5" />
                                                Créer une règle de détection
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right Col: Community Stats & Top Contributors */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-brand-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Globe className="h-32 w-32" /></div>
                        <h3 className="text-lg font-bold mb-2">Communauté Sentinel</h3>
                        <p className="text-white/80 text-sm mb-6">Rejoignez 12,000 experts en cybersécurité pour partager et valider les menaces en temps réel.</p>
                        <div className="flex justify-between items-center bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="text-center">
                                <div className="text-2xl font-bold">12k</div>
                                <div className="text-[10px] uppercase tracking-wider opacity-70">Experts</div>
                            </div>
                            <div className="h-8 w-px bg-white/20"></div>
                            <div className="text-center">
                                <div className="text-2xl font-bold">850</div>
                                <div className="text-[10px] uppercase tracking-wider opacity-70">Menaces/Jour</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 p-6 backdrop-blur-xl">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Top Contributeurs</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs">U{i}</div>
                                        <div>
                                            <div className="text-sm font-bold dark:text-white">User_{i}</div>
                                            <div className="text-xs text-slate-500">Level {10 - i} Analyst</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-green-500">
                                        Top 1%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
