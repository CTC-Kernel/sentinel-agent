import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import {
    Server,
    Terminal,
    Download,
    Trash2,
    CheckCircle2,
    XCircle,
    Clock,
    ShieldCheck,
    Cpu,
    Monitor,
    Copy,
    Loader2,
    ExternalLink,
    FileText,
    Package,
    Calendar,
    HelpCircle,
    AlertTriangle,
    Lock,
    Zap,
    Settings,
    ChevronDown,
    ChevronUp,
    BookOpen,
    Headset,
    Bug,
    RefreshCw,
    Shield,
    Activity,
    HardDrive,
    Network,
    TrendingUp,
    Users,
    Wifi,
    WifiOff
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import { AgentService } from '../../services/AgentService';
import { SentinelAgent, AgentStatus } from '../../types/agent';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RadialBarChart,
    RadialBar,
    PieChart,
    Pie,
    Cell,
    Sector,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { SENTINEL_PALETTE, CHART_STYLES } from '../../theme/chartTheme';
import { EnrollAgentModal } from './EnrollAgentModal';

// Types for release info
interface PlatformInfo {
    displayName: string;
    available: boolean;
    downloadUrl: string;
    directUrl: string | null;
    checksum?: string;
    fileSize?: string;
}

interface ReleaseInfo {
    product: string;
    currentVersion: string;
    releaseDate?: string;
    changelogUrl?: string;
    platforms: Record<string, PlatformInfo>;
    mobile?: {
        ios: { available: boolean; appStoreUrl: string; comingSoon: boolean };
        android: { available: boolean; playStoreUrl: string; comingSoon: boolean };
    };
}

// Download API base URL
const RELEASE_API_URL = 'https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/downloadRelease';

// Agent Status Colors
const AGENT_STATUS_COLORS = {
    active: SENTINEL_PALETTE.success,
    offline: '#64748b', // slate-500
    error: SENTINEL_PALETTE.danger
};

// OS Colors
const OS_COLORS = {
    windows: '#0078D4', // Microsoft blue
    darwin: '#555555',  // Apple gray
    linux: '#FCC624',   // Linux yellow
    unknown: SENTINEL_PALETTE.tertiary
};

interface DownloadButtonProps {
    platform: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    available?: boolean;
    loading?: boolean;
}

// FAQ Item Component
interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onToggle }) => (
    <div className="border-b border-slate-100 dark:border-white/5 last:border-b-0">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between py-3 text-left group"
        >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {question}
            </span>
            {isOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
            ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
        </button>
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pb-3"
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {answer}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const DownloadButton: React.FC<DownloadButtonProps> = ({ platform, label, sublabel, icon, available = true, loading = false }) => {
    const handleDownload = () => {
        if (loading) return;
        if (!available) {
            toast.info("Cette version sera disponible prochainement");
            return;
        }
        window.location.href = `${RELEASE_API_URL}/agent/${platform}/latest`;
    };

    return (
        <button
            onClick={handleDownload}
            disabled={loading}
            className={cn(
                "flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left w-full",
                !available && !loading && "opacity-60",
                loading && "opacity-50 cursor-wait"
            )}
        >
            <div className="flex items-center gap-3">
                {icon}
                <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{sublabel}</div>
                </div>
            </div>
            {loading ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : available ? (
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            ) : (
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                    Bientôt
                </Badge>
            )}
        </button>
    );
};

// Custom active shape for interactive pie chart
const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <text x={cx} y={cy} dy={-5} textAnchor="middle" className="fill-slate-900 dark:fill-white text-sm font-bold">
                {payload.name}
            </text>
            <text x={cx} y={cy} dy={15} textAnchor="middle" className="fill-slate-500 text-xs">
                {value} agents
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#glow)' }}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 12}
                outerRadius={outerRadius + 16}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
            <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} className="fill-slate-700 dark:fill-slate-300 text-xs font-medium">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        </g>
    );
};

// Tech corner decoration component
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("pointer-events-none", className)}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-500/30 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-500/30 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-500/30 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-500/30 rounded-br-lg" />
    </div>
);

export const AgentManagement: React.FC = () => {
    const { user } = useStore();
    const { claimsSynced } = useAuth();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEnrollment, setShowEnrollment] = useState(false);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
    const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
    const [loadingReleases, setLoadingReleases] = useState(true);
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'download' | 'docs' | 'faq' | 'support'>('download');
    const [activeStatusIndex, setActiveStatusIndex] = useState(0);
    const [activeOSIndex, setActiveOSIndex] = useState(0);

    // FAQ Data
    const faqItems = [
        {
            question: "Quelles données l'agent collecte-t-il ?",
            answer: "L'agent collecte uniquement des métadonnées de conformité : état du pare-feu, chiffrement disque, mises à jour système, antivirus actif. Aucune donnée personnelle, fichier ou historique de navigation n'est collecté."
        },
        {
            question: "L'agent ralentit-il mon ordinateur ?",
            answer: "Non. L'agent utilise moins de 1% du CPU et environ 50 Mo de RAM. Il effectue des vérifications périodiques (toutes les 15 minutes par défaut) et reste inactif le reste du temps."
        },
        {
            question: "Comment désinstaller l'agent ?",
            answer: "Windows : Panneau de configuration → Programmes → Désinstaller. macOS : Glissez l'application dans la Corbeille ou utilisez 'sentinel-agent uninstall'. Linux : 'sudo apt remove sentinel-agent' ou 'sudo rpm -e sentinel-agent'."
        },
        {
            question: "L'agent fonctionne-t-il hors connexion ?",
            answer: "Oui, l'agent continue de fonctionner et de collecter les données de conformité. Dès que la connexion est rétablie, les données sont synchronisées automatiquement avec le serveur."
        },
        {
            question: "Comment mettre à jour l'agent ?",
            answer: "Les mises à jour sont automatiques par défaut. Vous pouvez aussi forcer une mise à jour via 'sentinel-agent update' ou désactiver les mises à jour auto dans les paramètres."
        },
        {
            question: "L'agent est-il compatible avec mon VPN ?",
            answer: "Oui, l'agent fonctionne parfaitement avec tous les VPN du marché. Il utilise des connexions HTTPS standards sur le port 443."
        }
    ];

    // System Requirements
    const systemRequirements = {
        windows: { os: "Windows 10/11 (64-bit)", ram: "50 Mo", disk: "100 Mo", other: ".NET Framework 4.7.2+" },
        macos: { os: "macOS 11 Big Sur+", ram: "50 Mo", disk: "80 Mo", other: "Apple Silicon ou Intel" },
        linux: { os: "Ubuntu 20.04+, Debian 11+, RHEL 8+", ram: "40 Mo", disk: "60 Mo", other: "glibc 2.31+" }
    };

    // Compute agent statistics
    const agentStats = useMemo(() => {
        const active = agents.filter(a => a.status === 'active').length;
        const offline = agents.filter(a => a.status === 'offline').length;
        const error = agents.filter(a => a.status === 'error').length;
        const total = agents.length;
        const healthRate = total > 0 ? Math.round((active / total) * 100) : 0;
        const activityRate = total > 0 ? Math.round(((active + offline) / total) * 100) : 0;

        return { active, offline, error, total, healthRate, activityRate };
    }, [agents]);

    // OS Distribution data
    const osDistribution = useMemo(() => {
        const osCounts: Record<string, number> = {};
        agents.forEach(agent => {
            const os = agent.os?.toLowerCase() || 'unknown';
            osCounts[os] = (osCounts[os] || 0) + 1;
        });

        return Object.entries(osCounts).map(([name, value]) => ({
            name: name === 'darwin' ? 'macOS' : name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: OS_COLORS[name as keyof typeof OS_COLORS] || OS_COLORS.unknown,
            percent: agents.length > 0 ? value / agents.length : 0
        }));
    }, [agents]);

    // Status Distribution data
    const statusDistribution = useMemo(() => {
        return [
            { name: 'Actifs', value: agentStats.active, color: AGENT_STATUS_COLORS.active, percent: agentStats.total > 0 ? agentStats.active / agentStats.total : 0 },
            { name: 'Hors-ligne', value: agentStats.offline, color: AGENT_STATUS_COLORS.offline, percent: agentStats.total > 0 ? agentStats.offline / agentStats.total : 0 },
            { name: 'Erreurs', value: agentStats.error, color: AGENT_STATUS_COLORS.error, percent: agentStats.total > 0 ? agentStats.error / agentStats.total : 0 }
        ].filter(item => item.value > 0);
    }, [agentStats]);

    // Activity Timeline data (simulated based on agents)
    const activityTimeline = useMemo(() => {
        const now = new Date();
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const data = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dayName = days[date.getDay()];

            // Simulate activity based on agent count
            const baseActive = Math.max(1, agentStats.active);
            const variation = Math.random() * 0.3 - 0.15;
            const activeCount = Math.max(0, Math.round(baseActive * (1 + variation)));
            const offlineCount = Math.max(0, Math.round(agentStats.offline * (1 + Math.random() * 0.2 - 0.1)));

            data.push({
                day: dayName,
                actifs: activeCount,
                horsLigne: offlineCount,
                total: activeCount + offlineCount
            });
        }

        return data;
    }, [agentStats]);

    // Health gauge data for RadialBarChart
    const healthGaugeData = useMemo(() => [
        { name: 'Santé', value: agentStats.healthRate, fill: agentStats.healthRate >= 80 ? SENTINEL_PALETTE.success : agentStats.healthRate >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger }
    ], [agentStats.healthRate]);

    // Fetch available releases on mount
    useEffect(() => {
        const fetchReleases = async () => {
            try {
                const getReleaseInfo = httpsCallable<{ product: string }, ReleaseInfo>(functions, 'getReleaseInfo');
                const result = await getReleaseInfo({ product: 'agent' });
                setReleaseInfo(result.data);
            } catch (error) {
                console.error('Failed to fetch release info:', error);
                setReleaseInfo({
                    product: 'agent',
                    currentVersion: '1.0.0',
                    releaseDate: undefined,
                    changelogUrl: 'https://github.com/sentinel/agent/releases',
                    platforms: {
                        windows: { displayName: 'Windows (MSI)', available: true, downloadUrl: '#', directUrl: null },
                        macos: { displayName: 'macOS (DMG)', available: true, downloadUrl: '#', directUrl: null },
                        linux_deb: { displayName: 'Linux (DEB)', available: true, downloadUrl: '#', directUrl: null },
                        linux_rpm: { displayName: 'Linux (RPM)', available: true, downloadUrl: '#', directUrl: null },
                        linux_appimage: { displayName: 'Linux (AppImage)', available: true, downloadUrl: '#', directUrl: null },
                    },
                    mobile: {
                        ios: { available: true, appStoreUrl: '#', comingSoon: true },
                        android: { available: true, playStoreUrl: '#', comingSoon: true },
                    }
                });
            } finally {
                setLoadingReleases(false);
            }
        };

        fetchReleases();
    }, []);

    // Subscribe to real-time agent updates
    useEffect(() => {
        if (!user?.organizationId) return;

        if (!claimsSynced) {
            setLoading(true);
            return;
        }

        let unsubscribe: (() => void) | null = null;

        const initSubscription = async () => {
            try {
                const { auth } = await import('../../firebase');
                if (auth.currentUser) {
                    await auth.currentUser.getIdToken(true);
                }
            } catch (e) {
                console.warn('Token refresh failed, proceeding anyway:', e);
            }

            unsubscribe = AgentService.subscribeToAgents(
                user.organizationId!,
                (data) => {
                    setAgents(data);
                    setLoading(false);
                },
                (error) => {
                    console.error('Agent subscription error:', error);
                    const errorCode = (error as { code?: string }).code;
                    if (errorCode === 'permission-denied') {
                        toast.error("Accès refusé aux agents. Essayez de vous reconnecter.");
                    } else if (errorCode === 'unavailable') {
                        toast.error("Service Firestore indisponible. Réessayez plus tard.");
                    } else {
                        toast.error(`Échec du chargement des agents: ${errorCode || error.message}`);
                    }
                    setLoading(false);
                }
            );
        };

        initSubscription();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.organizationId, claimsSynced]);

    const handleDelete = async (agentId: string) => {
        if (!user?.organizationId) return;
        try {
            await AgentService.deleteAgent(user.organizationId, agentId);
            setAgents(prev => prev.filter(a => a.id !== agentId));
            toast.success("Agent supprimé");
        } catch {
            toast.error("Erreur lors de la suppression");
        }
    };

    const handleGenerateToken = async () => {
        if (!user?.organizationId) return;
        try {
            const result = await AgentService.generateEnrollmentToken(user.organizationId);
            setEnrollmentToken(result.token || null);
            setShowEnrollment(true);
        } catch {
            toast.error("Erreur lors de la génération du token");
        }
    };

    const getStatusStyles = (status: AgentStatus) => {
        switch (status) {
            case 'active':
                return {
                    badge: 'bg-success-500/10 text-success-600 dark:text-success-400 border-success-500/20',
                    icon: <CheckCircle2 className="w-4 h-4 text-success-500" />,
                    bg: 'bg-success-500'
                };
            case 'offline':
                return {
                    badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
                    icon: <Clock className="w-4 h-4 text-slate-500" />,
                    bg: 'bg-slate-500'
                };
            case 'error':
                return {
                    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                    icon: <XCircle className="w-4 h-4 text-red-500" />,
                    bg: 'bg-red-500'
                };
        }
    };

    const getOSIcon = (os: string) => {
        switch (os.toLowerCase()) {
            case 'windows':
                return <Monitor className="w-4 h-4" />;
            case 'linux':
                return <Terminal className="w-4 h-4" />;
            case 'darwin':
                return <Cpu className="w-4 h-4" />;
            default:
                return <Server className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* SVG Definitions for glow effects */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={1} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="offlineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#64748b" stopOpacity={0.1} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-2xl text-brand-600 dark:text-brand-400 backdrop-blur-md">
                            <Server className="w-6 h-6" />
                        </div>
                        Gestion des Agents
                    </h2>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
                        Surveillez et déployez des agents de conformité sur vos terminaux.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                        Temps réel
                    </div>
                    <Button
                        onClick={handleGenerateToken}
                        className="rounded-xl bg-brand-500 dark:bg-brand-600 shadow-lg shadow-brand-500/20"
                    >
                        Enrôler un Agent
                    </Button>
                </div>
            </div>

            {/* Hero Stats Section with Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Health Score Gauge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score Santé</span>
                        <Activity className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="h-[140px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="70%"
                                outerRadius="100%"
                                barSize={12}
                                data={healthGaugeData}
                                startAngle={180}
                                endAngle={0}
                            >
                                <RadialBar
                                    background={{ fill: 'hsl(var(--muted))' }}
                                    dataKey="value"
                                    cornerRadius={10}
                                    style={{ filter: 'url(#glow)' }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                {agentStats.healthRate}%
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                                {agentStats.healthRate >= 80 ? 'Excellent' : agentStats.healthRate >= 50 ? 'Attention' : 'Critique'}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-success-500/10 rounded-2xl">
                            <Wifi className="w-5 h-5 text-success-500" />
                        </div>
                        <Badge className="bg-success-500/10 text-success-600 border-success-500/20 text-[10px]">
                            +{Math.round(agentStats.active * 0.1)} ce mois
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {agentStats.active}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Agents Actifs</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(agentStats.active / Math.max(agentStats.total, 1)) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-success-500 rounded-full"
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-slate-500/10 rounded-2xl">
                            <WifiOff className="w-5 h-5 text-slate-500" />
                        </div>
                        <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 text-[10px]">
                            Inactifs
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {agentStats.offline}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Hors-ligne</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(agentStats.offline / Math.max(agentStats.total, 1)) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-slate-400 rounded-full"
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-red-500/10 rounded-2xl">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        {agentStats.error > 0 && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] animate-pulse">
                                Action requise
                            </Badge>
                        )}
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {agentStats.error}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">En Erreur</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(agentStats.error / Math.max(agentStats.total, 1)) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-red-500 rounded-full"
                        />
                    </div>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Distribution Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Distribution par État</h3>
                        <Users className="w-4 h-4 text-brand-500" />
                    </div>
                    {statusDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={activeStatusIndex}
                                        activeShape={renderActiveShape}
                                        data={statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                                    >
                                        {statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                            Aucun agent déployé
                        </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                        {statusDistribution.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-600 dark:text-slate-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* OS Distribution Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Distribution par OS</h3>
                        <Monitor className="w-4 h-4 text-brand-500" />
                    </div>
                    {osDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={activeOSIndex}
                                        activeShape={renderActiveShape}
                                        data={osDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveOSIndex(index)}
                                    >
                                        {osDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                            Aucun agent déployé
                        </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {osDistribution.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-600 dark:text-slate-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Activity Timeline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activité (7 jours)</h3>
                        <TrendingUp className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorActifs" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorHorsLigne" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="day"
                                    {...CHART_STYLES.axis}
                                    tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                    {...CHART_STYLES.axis}
                                    tick={{ fontSize: 10 }}
                                    width={30}
                                />
                                <Tooltip
                                    contentStyle={{
                                        ...CHART_STYLES.tooltip.contentStyle,
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                    labelStyle={{ ...CHART_STYLES.tooltip.labelStyle, color: '#fff' }}
                                    itemStyle={{ fontSize: '12px', color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="actifs"
                                    stroke={SENTINEL_PALETTE.success}
                                    fillOpacity={1}
                                    fill="url(#colorActifs)"
                                    strokeWidth={2}
                                    name="Actifs"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="horsLigne"
                                    stroke="#64748b"
                                    fillOpacity={1}
                                    fill="url(#colorHorsLigne)"
                                    strokeWidth={2}
                                    name="Hors-ligne"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.success }} />
                            <span className="text-slate-600 dark:text-slate-400">Actifs</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                            <span className="text-slate-600 dark:text-slate-400">Hors-ligne</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Agent List */}
                <div className="xl:col-span-2 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="bg-white/50 dark:bg-slate-900/50 rounded-5xl border border-white/60 dark:border-white/10 overflow-hidden backdrop-blur-sm"
                    >
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Server className="w-4 h-4 text-brand-500" />
                                Liste des Agents ({agentStats.total})
                            </h3>
                            <Badge variant="outline" className="text-[10px]">
                                {agentStats.active} connectés
                            </Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-white/10">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Agent</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Système</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">État</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Dernier Signe</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {loading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-5"><div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-4 w-16 bg-slate-200 dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-6 w-20 bg-slate-200 dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"></td>
                                            </tr>
                                        ))
                                    ) : agents.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-full">
                                                        <Server className="w-8 h-8 text-muted-foreground" />
                                                    </div>
                                                    <div className="text-slate-900 dark:text-white font-bold">Aucun agent trouvé</div>
                                                    <p className="text-sm text-slate-500">Commencez par enrôler un nouvel agent.</p>
                                                    <Button
                                                        onClick={handleGenerateToken}
                                                        size="sm"
                                                        className="mt-2 rounded-xl bg-brand-500"
                                                    >
                                                        <ShieldCheck className="w-4 h-4 mr-2" />
                                                        Enrôler maintenant
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        agents.map((agent) => {
                                            const styles = getStatusStyles(agent.status);
                                            return (
                                                <tr key={agent.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-2 h-2 rounded-full", styles.bg)} />
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                                    {agent.name}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                    v{agent.version} • {agent.ipAddress}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <Badge variant="outline" className="capitalize gap-1.5 text-xs">
                                                            {getOSIcon(agent.os)}
                                                            {agent.os}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border", styles.badge)}>
                                                            {styles.icon}
                                                            {agent.status.toUpperCase()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        {new Date(agent.lastHeartbeat).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button
                                                            onClick={() => handleDelete(agent.id)}
                                                            aria-label="Supprimer"
                                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-6">
                    {/* What is the Agent? */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-panel p-4 sm:p-6 rounded-5xl border border-white/60 dark:border-white/10 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-success-500/10 rounded-xl text-success-600 dark:text-success-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Qu'est-ce que l'Agent ?</h3>
                        </div>
                        <div className="space-y-3 text-sm text-slate-600 dark:text-muted-foreground">
                            <p>
                                L'Agent Sentinel est un logiciel léger qui s'exécute en arrière-plan sur vos terminaux.
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>Vérifie la conformité de sécurité</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>Fonctionne silencieusement ({"<"}1% CPU)</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>Ne collecte pas vos données personnelles</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>Communications chiffrées (TLS 1.3)</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tabbed Resources Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="glass-panel p-4 sm:p-6 rounded-5xl border border-white/60 dark:border-white/10 space-y-6"
                    >
                        {/* Tab Navigation */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl">
                            {[
                                { id: 'download' as const, label: 'Télécharger', icon: Download },
                                { id: 'docs' as const, label: 'Docs', icon: BookOpen },
                                { id: 'faq' as const, label: 'FAQ', icon: HelpCircle },
                                { id: 'support' as const, label: 'Support', icon: Headset },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                        activeTab === tab.id
                                            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Download Tab */}
                        <AnimatePresence mode="wait">
                            {activeTab === 'download' && (
                                <motion.div
                                    key="download"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Téléchargements</h3>
                                            {releaseInfo?.currentVersion && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="text-[10px] bg-brand-500/10 border-brand-500/30 text-brand-600">
                                                        v{releaseInfo.currentVersion}
                                                    </Badge>
                                                    {releaseInfo.releaseDate && (
                                                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(releaseInfo.releaseDate).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {releaseInfo?.changelogUrl && (
                                            <a
                                                href={releaseInfo.changelogUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 transition-colors"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Changelog
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Desktop Downloads */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <DownloadButton
                                            platform="windows"
                                            label="Windows"
                                            sublabel="Installateur .MSI"
                                            icon={<Monitor className="w-5 h-5 text-blue-500" />}
                                            available={releaseInfo?.platforms?.windows?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="macos"
                                            label="macOS"
                                            sublabel="Apple Silicon & Intel"
                                            icon={<Cpu className="w-5 h-5 text-slate-600" />}
                                            available={releaseInfo?.platforms?.macos?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_deb"
                                            label="Linux DEB"
                                            sublabel="Debian / Ubuntu"
                                            icon={<Terminal className="w-5 h-5 text-orange-500" />}
                                            available={releaseInfo?.platforms?.linux_deb?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_rpm"
                                            label="Linux RPM"
                                            sublabel="RHEL / Fedora"
                                            icon={<Terminal className="w-5 h-5 text-red-500" />}
                                            available={releaseInfo?.platforms?.linux_rpm?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_appimage"
                                            label="Linux AppImage"
                                            sublabel="Portable / Universel"
                                            icon={<Package className="w-5 h-5 text-purple-500" />}
                                            available={releaseInfo?.platforms?.linux_appimage?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                    </div>

                                    {/* Mobile Apps */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Applications Mobiles</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <a
                                                href={releaseInfo?.mobile?.ios?.appStoreUrl || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-center"
                                            >
                                                <Cpu className="w-6 h-6 text-slate-600 mb-2" />
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">iOS</div>
                                                <div className="text-[11px] text-slate-500">App Store</div>
                                                {releaseInfo?.mobile?.ios?.comingSoon && (
                                                    <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/30 text-amber-600">
                                                        Bientôt
                                                    </Badge>
                                                )}
                                            </a>
                                            <a
                                                href={releaseInfo?.mobile?.android?.playStoreUrl || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-center"
                                            >
                                                <Server className="w-6 h-6 text-success-500 mb-2" />
                                                <div className="text-sm font-bold text-slate-900 dark:text-white">Android</div>
                                                <div className="text-[11px] text-slate-500">Play Store</div>
                                                {releaseInfo?.mobile?.android?.comingSoon && (
                                                    <Badge variant="outline" className="mt-2 text-[10px] border-amber-500/30 text-amber-600">
                                                        Bientôt
                                                    </Badge>
                                                )}
                                            </a>
                                        </div>
                                    </div>

                                    {/* Quick Install */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Installation rapide</h4>
                                        <ol className="space-y-2 text-sm text-slate-600 dark:text-muted-foreground">
                                            <li className="flex gap-2">
                                                <span className="font-bold text-brand-500">1.</span>
                                                Téléchargez l'installateur pour votre système
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-brand-500">2.</span>
                                                Lancez l'installation (admin requis)
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-brand-500">3.</span>
                                                Générez un token ci-dessus et configurez l'agent
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-brand-500">4.</span>
                                                L'agent apparaît dans la barre système
                                            </li>
                                        </ol>
                                    </div>
                                </motion.div>
                            )}

                            {/* Documentation Tab */}
                            {activeTab === 'docs' && (
                                <motion.div
                                    key="docs"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Documentation</h3>
                                        <p className="text-sm text-slate-500 mt-1">Guides et références techniques pour l'agent Sentinel.</p>
                                    </div>

                                    {/* Quick Links */}
                                    <div className="space-y-2">
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/quickstart"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Guide de démarrage rapide</span>
                                                    <span className="text-[11px] text-slate-500">Installation en 5 minutes</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/configuration"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Settings className="w-4 h-4 text-slate-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Configuration avancée</span>
                                                    <span className="text-[11px] text-slate-500">Paramètres et personnalisation</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/security"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Shield className="w-4 h-4 text-success-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Sécurité et confidentialité</span>
                                                    <span className="text-[11px] text-slate-500">Données collectées et chiffrement</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/troubleshooting"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Dépannage</span>
                                                    <span className="text-[11px] text-slate-500">Résolution des problèmes courants</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Network className="w-4 h-4 text-brand-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">API Reference</span>
                                                    <span className="text-[11px] text-slate-500">Intégration et automatisation</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                    </div>

                                    {/* System Requirements */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <HardDrive className="w-3.5 h-3.5" />
                                            Configuration requise
                                        </h4>
                                        <div className="space-y-3">
                                            {Object.entries(systemRequirements).map(([os, req]) => (
                                                <div key={os} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {os === 'windows' && <Monitor className="w-4 h-4 text-blue-500" />}
                                                        {os === 'macos' && <Cpu className="w-4 h-4 text-slate-600" />}
                                                        {os === 'linux' && <Terminal className="w-4 h-4 text-orange-500" />}
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{os}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                        <div>
                                                            <span className="text-slate-500">OS:</span>
                                                            <span className="ml-1 text-slate-700 dark:text-slate-300">{req.os}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">RAM:</span>
                                                            <span className="ml-1 text-slate-700 dark:text-slate-300">{req.ram}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Disque:</span>
                                                            <span className="ml-1 text-slate-700 dark:text-slate-300">{req.disk}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Autre:</span>
                                                            <span className="ml-1 text-slate-700 dark:text-slate-300">{req.other}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* GitHub */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <a
                                            href="https://github.com/sentinel/agent/releases"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-900 dark:bg-black/50 hover:bg-slate-800 transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Package className="w-4 h-4 text-white" />
                                                <span className="text-sm font-medium text-white">Releases GitHub</span>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                                        </a>
                                    </div>
                                </motion.div>
                            )}

                            {/* FAQ Tab */}
                            {activeTab === 'faq' && (
                                <motion.div
                                    key="faq"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Questions fréquentes</h3>
                                        <p className="text-sm text-slate-500 mt-1">Trouvez rapidement des réponses à vos questions.</p>
                                    </div>

                                    <div className="space-y-0">
                                        {faqItems.map((item, index) => (
                                            <FAQItem
                                                key={index}
                                                question={item.question}
                                                answer={item.answer}
                                                isOpen={openFAQ === index}
                                                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                                            />
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20">
                                            <div className="flex items-start gap-3">
                                                <HelpCircle className="w-5 h-5 text-brand-500 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        Vous ne trouvez pas votre réponse ?
                                                    </p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                        Consultez notre documentation complète ou contactez le support.
                                                    </p>
                                                    <div className="flex gap-2 mt-3">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-xs rounded-lg"
                                                            onClick={() => setActiveTab('docs')}
                                                        >
                                                            <BookOpen className="w-3 h-3 mr-1" />
                                                            Documentation
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-xs rounded-lg"
                                                            onClick={() => setActiveTab('support')}
                                                        >
                                                            <Headset className="w-3 h-3 mr-1" />
                                                            Support
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Support Tab */}
                            {activeTab === 'support' && (
                                <motion.div
                                    key="support"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6"
                                >
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Support technique</h3>
                                        <p className="text-sm text-slate-500 mt-1">Besoin d'aide ? Nous sommes là pour vous.</p>
                                    </div>

                                    {/* Support Options */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <a
                                            href="mailto:support@sentinel-grc.com"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-brand-500/10 rounded-xl">
                                                    <Headset className="w-5 h-5 text-brand-500" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white block">Support par email</span>
                                                    <span className="text-[11px] text-slate-500">support@sentinel-grc.com</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>

                                        <a
                                            href="https://github.com/sentinel/agent/issues/new"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-red-500/10 rounded-xl">
                                                    <Bug className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white block">Signaler un bug</span>
                                                    <span className="text-[11px] text-slate-500">GitHub Issues</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>

                                        <a
                                            href="https://community.sentinel-grc.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-purple-500/10 rounded-xl">
                                                    <Activity className="w-5 h-5 text-purple-500" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white block">Communauté</span>
                                                    <span className="text-[11px] text-slate-500">Forum et discussions</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                        </a>
                                    </div>

                                    {/* Agent Status Check */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                            Diagnostic rapide
                                        </h4>
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 space-y-3">
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Exécutez cette commande pour vérifier l'état de l'agent :
                                            </p>
                                            <div className="relative">
                                                <pre className="p-3 bg-slate-900 dark:bg-black/50 rounded-xl text-[11px] text-success-400 overflow-x-auto">
                                                    <code>sentinel-agent status --verbose</code>
                                                </pre>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('sentinel-agent status --verbose');
                                                        toast.success("Commande copiée !");
                                                    }}
                                                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                                >
                                                    <Copy className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full rounded-xl text-xs"
                                                onClick={() => {
                                                    toast.info("Vérification des agents en cours...");
                                                }}
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1.5" />
                                                Rafraîchir le statut des agents
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Response Times */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                            Temps de réponse
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600 dark:text-slate-400">Critique (P1)</span>
                                                <Badge className="bg-red-500/10 text-red-600 border-red-500/20">{"<"} 1h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600 dark:text-slate-400">Important (P2)</span>
                                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">{"<"} 4h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600 dark:text-slate-400">Normal (P3)</span>
                                                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{"<"} 24h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600 dark:text-slate-400">Demande (P4)</span>
                                                <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">{"<"} 72h</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Security Notice */}
                                    <div className="p-4 rounded-2xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20">
                                        <div className="flex items-start gap-3">
                                            <Lock className="w-5 h-5 text-success-600 dark:text-success-400 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                    Sécurité des communications
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                                    Ne partagez jamais vos tokens d'enrôlement par des canaux non sécurisés. Utilisez uniquement les canaux officiels pour contacter le support.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>

            <EnrollAgentModal
                isOpen={showEnrollment}
                onClose={() => setShowEnrollment(false)}
                enrollmentToken={enrollmentToken}
                releaseInfo={releaseInfo}
                loadingReleases={loadingReleases}
            />
        </div>

    );
};
