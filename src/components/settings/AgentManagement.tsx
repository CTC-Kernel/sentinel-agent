import React, { useId, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
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
import { SentinelAgent, AgentStatus, AgentEnrollmentToken } from '../../types/agent';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorLogger } from '../../services/errorLogger';
import {
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
import { AgentDetailsModal } from './AgentDetailsModal';
import { useLocale } from '@/hooks/useLocale';
import { SentinelPieActiveShapeProps } from '../../types/charts';

// Types for release info
import { ReleaseInfo } from '../../types/release';

// Download API base URL
// Agent Status Colors
const AGENT_STATUS_COLORS = {
    active: SENTINEL_PALETTE.success,
    offline: SENTINEL_PALETTE.tertiary, // Harmonized slate-blue for offline
    error: SENTINEL_PALETTE.danger
};

// OS Colors
const OS_COLORS = {
    windows: SENTINEL_PALETTE.primary, // Blue
    darwin: SENTINEL_PALETTE.secondary, // Purple/Gray distinction
    linux: SENTINEL_PALETTE.warning, // Amber/Yellow
    unknown: SENTINEL_PALETTE.info
};

interface DownloadButtonProps {
    platform: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    href?: string;
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
    <div className="border-b border-border/40 dark:border-white/5 last:border-b-0">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between py-3 text-left group"
        >
            <span className="text-sm font-medium text-foreground group-hover:text-foreground dark:group-hover:text-foreground transition-colors">
                {question}
            </span>
            {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {answer}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const DownloadButton: React.FC<DownloadButtonProps> = ({ platform, label, sublabel, icon, href, available = true, loading = false }) => {
    const { t } = useStore();
    // Use href prop if provided (from releaseInfo), otherwise fallback to cloud function endpoint
    const getDownloadUrl = (platform: string) => {
        switch (platform) {
            case 'windows': return '/releases/agent/windows/latest';
            case 'macos': return '/releases/agent/macos/latest';
            case 'linux_deb': return '/releases/agent/linux_deb/latest';
            case 'linux_rpm': return '/releases/agent/linux_rpm/latest';
            default: return '#';
        }
    };

    const downloadUrl = href || getDownloadUrl(platform);

    const content = (
        <>
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {icon}
                <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{label}</div>
                    <div className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider truncate">{sublabel}</div>
                </div>
            </div>
            {loading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : available ? (
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground transition-colors" />
            ) : (
                <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-600">
                    {t('settings.agents.comingSoon', { defaultValue: 'Bientôt' })}
                </Badge>
            )}
        </>
    );

    const baseClasses = cn(
        "flex items-center justify-between p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group text-left w-full",
        !available && !loading && "opacity-60",
        loading && "opacity-60 cursor-wait"
    );

    if (available && !loading) {
        return (
            <a
                href={downloadUrl}
                className={baseClasses}
                target="_blank"
                rel="noopener noreferrer" // Best practice for downloads from external domains
                download // Hint to browser
            >
                {content}
            </a>
        );
    }

    return (
        <button
            disabled={true} // Always disabled if not available or loading (we don't want click events)
            className={baseClasses}
            onClick={() => {
                if (!available) toast.info(t('agents.versionComingSoon') || "Cette version sera disponible prochainement");
            }}
        >
            {content}
        </button>
    );
};

// Tech corner decoration component
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("pointer-events-none", className)}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
    </div>
);

// Format token expiration as relative time
const formatTokenExpiry = (expiresAt: string | Date, t: (key: string, opts?: { defaultValue: string }) => string): string => {
    const date = new Date(expiresAt);
    const now = Date.now();
    const diff = date.getTime() - now;
    if (diff < 0) return t('settings.agents.expired', { defaultValue: 'Expiré' });
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return t('settings.agents.expiresInHours', { defaultValue: `Expire dans ${hours}h` });
    const days = Math.floor(hours / 24);
    return t('settings.agents.expiresInDays', { defaultValue: `Expire dans ${days}j` });
};

export const AgentManagement: React.FC = () => {
    const uid = useId();
    const glowId = `glow-${uid}`;
    const healthGradientId = `healthGradient-${uid}`;

    const renderActiveShape = (props: SentinelPieActiveShapeProps) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
        const cxValue = cx ?? 0;
        const cyValue = cy ?? 0;
        const innerR = innerRadius ?? 0;
        const outerR = outerRadius ?? 0;
        const midA = midAngle ?? 0;
        const totalValue = value ?? payload.value ?? 0;
        const percentValue = percent ?? payload.percent ?? 0;

        const RADIAN = Math.PI / 180;
        const sin = Math.sin(-RADIAN * midA);
        const cos = Math.cos(-RADIAN * midA);
        const sx = cxValue + (outerR + 10) * cos;
        const sy = cyValue + (outerR + 10) * sin;
        const mx = cxValue + (outerR + 30) * cos;
        const my = cyValue + (outerR + 30) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 22;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';

        return (
            <g>
                <text x={cxValue} y={cyValue} dy={-5} textAnchor="middle" className="fill-foreground dark:fill-white text-sm font-bold">
                    {payload.name}
                </text>
                <text x={cxValue} y={cyValue} dy={15} textAnchor="middle" className="fill-muted-foreground text-xs">
                    {totalValue} agents
                </text>
                <Sector
                    cx={cxValue}
                    cy={cyValue}
                    innerRadius={innerR}
                    outerRadius={outerR + 8}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                    style={{ filter: `url(#${glowId})` }}
                />
                <Sector
                    cx={cxValue}
                    cy={cyValue}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={outerR + 12}
                    outerRadius={outerR + 16}
                    fill={fill}
                />
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
                <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} className="fill-foreground dark:fill-muted-foreground text-xs font-medium">
                    {`${(percentValue * 100).toFixed(0)}%`}
                </text>
            </g>
        );
    };

    const { user, t } = useStore();
    const { config } = useLocale();
    const { claimsSynced } = useAuth();
    const navigate = useNavigate();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEnrollment, setShowEnrollment] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
    const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
    const [loadingReleases, setLoadingReleases] = useState(true);
    const [generatingToken, setGeneratingToken] = useState(false);
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'download' | 'docs' | 'faq' | 'support'>('download');
    const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
    const [activeOSIndex, setActiveOSIndex] = useState<number | null>(null);
    const [enrollmentTokens, setEnrollmentTokens] = useState<AgentEnrollmentToken[]>([]);
    const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
    const [revealedTokenId, setRevealedTokenId] = useState<string | null>(null);
    const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

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

            // Use current snapshot (no historical data available)
            data.push({
                day: dayName,
                actifs: agentStats.active,
                horsLigne: agentStats.offline,
                total: agentStats.active + agentStats.offline
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
                const data = await AgentService.getReleaseInfo('agent');
                setReleaseInfo(data);
            } catch (error) {
                ErrorLogger.error(error, 'AgentManagement.fetchReleases');
                setReleaseInfo({
                    product: 'agent',
                    currentVersion: '2.0.0',
                    releaseDate: '2026-02-02',
                    changelogUrl: 'https://github.com/CTC-Kernel/sentinel-agent/releases',
                    platforms: {
                        windows: { displayName: 'Windows (MSI)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/windows/SentinelAgentSetup-2.0.0.msi', directUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/windows/SentinelAgentSetup-2.0.0.msi' },
                        macos: { displayName: 'macOS (PKG)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-2.0.0.pkg', directUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-2.0.0.pkg' },
                        linux_deb: { displayName: 'Linux (DEB)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_deb/sentinel-agent_2.0.0-1_amd64.deb', directUrl: null },
                        linux_rpm: { displayName: 'Linux (RPM)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_rpm/sentinel-agent-2.0.0-1.x86_64.rpm', directUrl: null },
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
                ErrorLogger.warn('Token refresh failed, proceeding anyway', 'AgentManagement', { metadata: { error: e } });
            }

            unsubscribe = AgentService.subscribeToAgents(
                user.organizationId!,
                (data) => {
                    setAgents(data);
                    setLoading(false);
                },
                (error) => {
                    ErrorLogger.error(error, 'AgentManagement.subscribeToAgents');
                    const errorCode = (error as { code?: string }).code;
                    if (errorCode === 'permission-denied') {
                        toast.error(t('agents.accessDenied') || "Accès refusé aux agents. Essayez de vous reconnecter.");
                    } else if (errorCode === 'unavailable') {
                        toast.error(t('agents.serviceUnavailable') || "Service Firestore indisponible. Réessayez plus tard.");
                    } else {
                        toast.error(t('agents.loadFailed') || "Échec du chargement des agents");
                    }
                    setLoading(false);
                }
            );
        };

        initSubscription();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user?.organizationId, claimsSynced, t]);

    // Subscribe to enrollment tokens
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = AgentService.subscribeToTokens(
            user.organizationId,
            (tokens) => {
                setEnrollmentTokens(tokens);
            },
            (error) => {
                ErrorLogger.error(error, 'AgentManagement.subscribeToTokens');
            }
        );

        return () => unsubscribe();
    }, [user?.organizationId]);

    const handleRevokeToken = async (tokenId: string) => {
        if (!user?.organizationId) return;
        setRevokingTokenId(tokenId);
        try {
            await AgentService.revokeEnrollmentToken(user.organizationId, tokenId);
            toast.success(t('agents.tokenRevoked') || "Token revoque avec succes");
        } catch {
            toast.error(t('agents.tokenRevocationFailed') || "Erreur lors de la revocation du token");
        } finally {
            setRevokingTokenId(null);
        }
    };

    const handleDelete = async (agentId: string) => {
        if (!user?.organizationId) return;
        try {
            await AgentService.deleteAgent(user.organizationId, agentId);
            setAgents(prev => prev.filter(a => a.id !== agentId));
            toast.success(t('agents.agentDeletedSuccess') || "Agent supprimé");
        } catch {
            toast.error(t('errors.deletionFailed') || "Erreur lors de la suppression");
        }
    };

    const handleGenerateToken = async () => {
        if (!user?.organizationId) return;
        setGeneratingToken(true);
        try {
            const result = await AgentService.generateEnrollmentToken(user.organizationId);
            setEnrollmentToken(result.token || null);
            setShowEnrollment(true);
            toast.success(t('agents.tokenGenerated') || 'Token d\'enrôlement généré', t('agents.tokenGeneratedDesc') || 'Copiez le token et utilisez-le pour enrôler un nouvel agent.');
        } catch {
            toast.error(t('agents.tokenGenerationFailed') || "Erreur lors de la génération du token");
        } finally {
            setGeneratingToken(false);
        }
    };

    const getStatusStyles = (status: AgentStatus) => {
        switch (status) {
            case 'active':
                return {
                    badge: 'bg-success-bg text-success-600 dark:text-success-400 border-success-500/20',
                    icon: <CheckCircle2 className="w-4 h-4 text-success-500" />,
                    bg: 'bg-success-500'
                };
            case 'offline':
                return {
                    badge: 'bg-muted/500/10 text-muted-foreground border-border/400/20',
                    icon: <Clock className="w-4 h-4 text-muted-foreground" />,
                    bg: 'bg-muted/500'
                };
            case 'error':
                return {
                    badge: 'bg-red-50 text-red-600 dark:text-red-400 border-red-500/20',
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

    const handleCopyToken = async (tokenId: string, tokenValue: string) => {
        try {
            await navigator.clipboard.writeText(tokenValue);
            setCopiedTokenId(tokenId);
            toast.success(t('agents.tokenCopied') || "Token copié dans le presse-papier");
            setTimeout(() => setCopiedTokenId(null), 2000);
        } catch (err) {
            ErrorLogger.error(err, 'AgentManagement.handleCopyToken');
            toast.error(t('agents.copyFailed') || "Échec de la copie");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* SVG Definitions for glow effects */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id={healthGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={1} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="offlineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={AGENT_STATUS_COLORS.offline} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={AGENT_STATUS_COLORS.offline} stopOpacity={0.1} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl text-primary backdrop-blur-md">
                            <Server className="w-6 h-6" />
                        </div>
                        {t('settings.agents.title', { defaultValue: 'Gestion des Agents' })}
                    </h2>
                    <p className="mt-1 text-muted-foreground text-sm">
                        {t('settings.agents.description', { defaultValue: 'Surveillez et déployez des agents de conformité sur vos terminaux.' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
                        {t('settings.agents.realTime', { defaultValue: 'Temps réel' })}
                    </div>
                    <Button
                        onClick={handleGenerateToken}
                        disabled={generatingToken}
                        className="rounded-3xl bg-primary dark:bg-primary shadow-lg shadow-primary/20"
                    >
                        {generatingToken ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {generatingToken ? t('settings.agents.generating', { defaultValue: 'Génération...' }) : t('settings.agents.enrollAgent', { defaultValue: 'Enrôler un Agent' })}
                    </Button>
                </div>
            </div>

            {/* Hero Stats Section with Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Health Score Gauge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('settings.agents.healthScore', { defaultValue: 'Score Santé' })}</span>
                        <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div className="h-[140px] relative">
                        <ResponsiveContainer width="100%" height="100%" >
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <Pie
                                    data={healthGaugeData}
                                    cx="50%"
                                    cy="85%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius="75%"
                                    outerRadius="105%"
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={10}
                                    paddingAngle={0}
                                >
                                    {healthGaugeData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.fill}
                                            style={{ filter: `url(#${glowId})` }}
                                        />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-foreground">
                                {agentStats.healthRate}%
                            </span>
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                                {agentStats.healthRate >= 80 ? t('settings.agents.excellent', { defaultValue: 'Excellent' }) : agentStats.healthRate >= 50 ? t('settings.agents.attention', { defaultValue: 'Attention' }) : t('settings.agents.critical', { defaultValue: 'Critique' })}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-premium p-5 rounded-3xl border border-border/40 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-success-bg rounded-2xl">
                            <Wifi className="w-5 h-5 text-success-500" />
                        </div>
                        <Badge className="bg-success-bg text-success-600 border-success-500/20 text-[11px]">
                            +{Math.round(agentStats.active * 0.1)} {t('settings.agents.thisMonth', { defaultValue: 'ce mois' })}
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {agentStats.active}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{t('settings.agents.activeAgents', { defaultValue: 'Agents Actifs' })}</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
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
                    className="glass-premium p-5 rounded-3xl border border-border/40 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-muted/500/10 rounded-2xl">
                            <WifiOff className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <Badge className="bg-muted/500/10 text-muted-foreground border-border/400/20 text-[11px]">
                            {t('settings.agents.inactive', { defaultValue: 'Inactifs' })}
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {agentStats.offline}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{t('settings.agents.offline', { defaultValue: 'Hors-ligne' })}</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(agentStats.offline / Math.max(agentStats.total, 1)) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-muted-foreground rounded-full"
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-premium p-5 rounded-3xl border border-border/40 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-red-50 rounded-2xl">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        {agentStats.error > 0 && (
                            <Badge className="bg-red-50 text-red-600 dark:text-red-400 border-red-500/20 text-[11px] animate-pulse">
                                {t('settings.agents.actionRequired', { defaultValue: 'Action requise' })}
                            </Badge>
                        )}
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {agentStats.error}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{t('settings.agents.inError', { defaultValue: 'En Erreur' })}</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
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
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground">{t('settings.agents.distributionByStatus', { defaultValue: 'Distribution par État' })}</h3>
                        <Users className="w-4 h-4 text-primary" />
                    </div>
                    {statusDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" >
                                <PieChart>
                                    <Pie
                                        data={statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                        activeIndex={activeStatusIndex !== null ? activeStatusIndex : undefined}
                                        activeShape={renderActiveShape as any}
                                        onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                                        onMouseLeave={() => setActiveStatusIndex(null)}
                                    >
                                        {statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            {t('settings.agents.noAgentDeployed', { defaultValue: 'Aucun agent déployé' })}
                        </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4">
                        {statusDistribution.map((entry, index) => (
                            <div key={index || 'unknown'} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* OS Distribution Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground">{t('settings.agents.distributionByOS', { defaultValue: 'Distribution par OS' })}</h3>
                        <Monitor className="w-4 h-4 text-primary" />
                    </div>
                    {osDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" >
                                <PieChart>
                                    <Pie
                                        data={osDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                        activeIndex={activeOSIndex !== null ? activeOSIndex : undefined}
                                        activeShape={renderActiveShape as any}
                                        onMouseEnter={(_, index) => setActiveOSIndex(index)}
                                        onMouseLeave={() => setActiveOSIndex(null)}
                                    >
                                        {osDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            {t('settings.agents.noAgentDeployed', { defaultValue: 'Aucun agent déployé' })}
                        </div>
                    )}
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {osDistribution.map((entry, index) => (
                            <div key={index || 'unknown'} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Activity Timeline */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground">{t('settings.agents.activity7days', { defaultValue: 'Activité (7 jours)' })}</h3>
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%" >
                            <AreaChart data={activityTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorActifs" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorHorsLigne" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
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
                                    stroke="hsl(var(--muted-foreground))"
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
                            <span className="text-muted-foreground">{t('settings.agents.active', { defaultValue: 'Actifs' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-muted/500" />
                            <span className="text-muted-foreground">{t('settings.agents.offlineLabel', { defaultValue: 'Hors-ligne' })}</span>
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
                        className="bg-card/50 rounded-3xl border border-border/40 overflow-hidden backdrop-blur-sm"
                    >
                        <div className="px-6 py-4 border-b border-border/40 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Server className="w-4 h-4 text-primary" />
                                {t('settings.agents.agentList', { defaultValue: 'Liste des Agents' })} ({agentStats.total})
                            </h3>
                            <Badge variant="outline" className="text-[11px]">
                                {agentStats.active} {t('settings.agents.connected', { defaultValue: 'connectés' })}
                            </Badge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border/40">
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.agent', { defaultValue: 'Agent' })}</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.system', { defaultValue: 'Système' })}</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.status', { defaultValue: 'État' })}</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.lastSeen', { defaultValue: 'Dernier Signe' })}</th>
                                        <th className="px-6 py-4 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border dark:divide-white/5">
                                    {loading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <tr key={i || 'unknown'} className="animate-pulse">
                                                <td className="px-6 py-5"><div className="h-4 w-32 bg-muted dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-4 w-16 bg-muted dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-6 w-20 bg-muted dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"><div className="h-4 w-24 bg-muted dark:bg-white/10 rounded-full" /></td>
                                                <td className="px-6 py-5"></td>
                                            </tr>
                                        ))
                                    ) : agents.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-4 bg-muted rounded-full">
                                                        <Server className="w-8 h-8 text-muted-foreground" />
                                                    </div>
                                                    <div className="text-foreground font-bold">{t('settings.agents.noAgentFound', { defaultValue: 'Aucun agent trouvé' })}</div>
                                                    <p className="text-sm text-muted-foreground">{t('settings.agents.startByEnrolling', { defaultValue: 'Commencez par enrôler un nouvel agent.' })}</p>
                                                    <Button
                                                        onClick={handleGenerateToken}
                                                        size="sm"
                                                        className="mt-2 rounded-3xl bg-primary"
                                                    >
                                                        <ShieldCheck className="w-4 h-4 mr-2" />
                                                        {t('settings.agents.enrollNow', { defaultValue: 'Enrôler maintenant' })}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        agents.map((agent) => {
                                            const styles = getStatusStyles(agent.status);
                                            return (
                                                <tr
                                                    key={agent.id || 'unknown'}
                                                    onClick={() => setSelectedAgentId(agent.id)}
                                                    className="group hover:bg-muted/50 dark:hover:bg-muted/50 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-2 h-2 rounded-full", styles.bg)} />
                                                            <div>
                                                                <div className="font-bold text-foreground text-sm">
                                                                    {agent.name}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
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
                                                    <td className="px-6 py-5 text-xs text-muted-foreground font-medium">
                                                        {new Date(agent.lastHeartbeat).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(agent.id);
                                                            }}
                                                            aria-label={t('common.delete', { defaultValue: 'Supprimer' })}
                                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-50 dark:hover:bg-red-900/30 rounded-3xl transition-all opacity-0 group-hover:opacity-70"
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

                    {/* Enrollment Tokens Management */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.38 }}
                        className="bg-card/50 rounded-3xl border border-border/40 overflow-hidden backdrop-blur-sm"
                    >
                        <div className="px-6 py-4 border-b border-border/40 dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" />
                                {t('settings.agents.enrollmentTokens', { defaultValue: "Tokens d'enrôlement" })} ({enrollmentTokens.length})
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border/40">
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.token', { defaultValue: 'Token' })}</th>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('settings.agents.tokenStatus', { defaultValue: 'Statut' })}</th>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">{t('settings.agents.uses', { defaultValue: 'Utilisations' })}</th>
                                        <th className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:table-cell">{t('settings.agents.expiration', { defaultValue: 'Expiration' })}</th>
                                        <th className="px-4 py-2.5 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border dark:divide-white/5">
                                    {enrollmentTokens.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                                                {t('settings.agents.noEnrollmentTokens', { defaultValue: "Aucun token d'enrôlement" })}
                                            </td>
                                        </tr>
                                    ) : (
                                        enrollmentTokens.map((token) => (
                                            <tr key={token.id || 'unknown'} className="hover:bg-muted/30 dark:hover:bg-white/5 transition-colors group/row">
                                                <td className="px-4 py-3">
                                                    <div
                                                        className="cursor-pointer group/token"
                                                        onClick={() => {
                                                            if (token.token) {
                                                                if (revealedTokenId === token.id) {
                                                                    handleCopyToken(token.id, token.token);
                                                                } else {
                                                                    setRevealedTokenId(token.id);
                                                                }
                                                            } else {
                                                                toast.error(t('settings.agents.tokenNotAvailable', { defaultValue: 'Token non disponible' }));
                                                            }
                                                        }}
                                                    >
                                                        <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                                            {token.name || 'Token'}
                                                            {copiedTokenId === token.id ? (
                                                                <CheckCircle2 className="w-3 h-3 text-success-500 animate-in zoom-in duration-300" />
                                                            ) : (revealedTokenId === token.id && token.token) ? (
                                                                <Copy className="w-3 h-3 text-primary opacity-0 group-hover/token:opacity-100 transition-opacity" />
                                                            ) : null}
                                                        </div>
                                                        <div className={cn(
                                                            "text-[10px] font-mono mt-0.5 transition-all duration-300 flex items-center gap-2",
                                                            revealedTokenId === token.id ? "text-primary font-bold" : "text-muted-foreground/60"
                                                        )}>
                                                            {revealedTokenId === token.id ? (token.token || '---') : (token.tokenPreview || '••••••••••••••••')}
                                                            {!revealedTokenId && token.token && <Zap className="w-2.5 h-2.5 text-primary/40 animate-pulse" />}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] h-5 px-2 font-bold",
                                                            token.status === 'active' && 'bg-success-bg text-success-600 border-success-500/20',
                                                            token.status === 'expired' && 'bg-muted/500/10 text-muted-foreground border-border/400/20',
                                                            token.status === 'revoked' && 'bg-red-50 text-red-600 border-red-500/20',
                                                            token.status === 'exhausted' && 'bg-amber-50 text-amber-600 border-amber-500/20'
                                                        )}
                                                    >
                                                        {token.status === 'active' ? t('settings.agents.statusActive', { defaultValue: 'Actif' }) :
                                                            token.status === 'expired' ? t('settings.agents.statusExpired', { defaultValue: 'Expiré' }) :
                                                                token.status === 'revoked' ? t('settings.agents.statusRevoked', { defaultValue: 'Révoqué' }) : t('settings.agents.statusExhausted', { defaultValue: 'Épuisé' })}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground hidden sm:table-cell">
                                                    {token.usedCount}{token.maxUses ? ` / ${token.maxUses}` : ''}
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground hidden md:table-cell">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className={cn(
                                                            'font-medium',
                                                            new Date(token.expiresAt).getTime() < Date.now() ? 'text-destructive' : 'text-foreground'
                                                        )}>
                                                            {formatTokenExpiry(token.expiresAt, t)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {token.status === 'active' && (
                                                        <button
                                                            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all opacity-0 group-hover/row:opacity-100"
                                                            onClick={() => handleRevokeToken(token.id)}
                                                            disabled={revokingTokenId === token.id}
                                                            title={t('settings.agents.revoke', { defaultValue: 'Révoquer' })}
                                                        >
                                                            {revokingTokenId === token.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
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
                        className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-success-bg rounded-3xl text-success-600 dark:text-success-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{t('settings.agents.whatIsAgent', { defaultValue: "Qu'est-ce que l'Agent ?" })}</h3>
                        </div>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                {t('settings.agents.agentDescription', { defaultValue: "L'Agent Sentinel est un logiciel léger qui s'exécute en arrière-plan sur vos terminaux." })}
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>{t('settings.agents.checksCompliance', { defaultValue: 'Vérifie la conformité de sécurité' })}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>{t('settings.agents.runsSilently', { defaultValue: 'Fonctionne silencieusement (<1% CPU)' })}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>{t('settings.agents.noPersonalData', { defaultValue: 'Ne collecte pas vos données personnelles' })}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-success-500 mt-0.5 flex-shrink-0" />
                                    <span>{t('settings.agents.encryptedComms', { defaultValue: 'Communications chiffrées (TLS 1.3)' })}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tabbed Resources Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 space-y-6"
                    >
                        {/* Tab Navigation */}
                        <div className="flex items-center gap-1 p-1 bg-muted rounded-2xl overflow-x-auto scrollbar-none no-scrollbar">
                            {[
                                { id: 'download' as const, label: t('settings.agents.tabs.download', { defaultValue: 'Télécharger' }), icon: Download },
                                { id: 'docs' as const, label: t('settings.agents.tabs.docs', { defaultValue: 'Docs' }), icon: BookOpen },
                                { id: 'faq' as const, label: t('settings.agents.tabs.faq', { defaultValue: 'FAQ' }), icon: HelpCircle },
                                { id: 'support' as const, label: t('settings.agents.tabs.support', { defaultValue: 'Support' }), icon: Headset },
                            ].map((tab) => (
                                <button
                                    key={tab.id || 'unknown'}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-3xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                                        activeTab === tab.id
                                            ? "bg-card text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="sm:hidden">{tab.id === 'download' ? 'DL' : tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Download Tab */}
                        <AnimatePresence mode="popLayout">
                            {activeTab === 'download' && (
                                <motion.div
                                    key="download"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-6"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-foreground truncate">{t('settings.agents.downloads', { defaultValue: 'Téléchargements' })}</h3>
                                            {releaseInfo?.currentVersion && (
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <Badge variant="outline" className="text-[11px] bg-primary/10 border-primary/40 text-primary whitespace-nowrap">
                                                        v{releaseInfo.currentVersion}
                                                    </Badge>
                                                    {releaseInfo.releaseDate && (
                                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(releaseInfo.releaseDate).toLocaleDateString(config.intlLocale)}
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
                                                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary transition-colors whitespace-nowrap self-start sm:self-center"
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
                                            href={releaseInfo?.platforms?.windows?.directUrl || releaseInfo?.platforms?.windows?.downloadUrl}
                                            available={releaseInfo?.platforms?.windows?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="macos"
                                            label="macOS"
                                            sublabel="Apple Silicon & Intel (PKG)"
                                            icon={<Cpu className="w-5 h-5 text-muted-foreground" />}
                                            href={releaseInfo?.platforms?.macos?.directUrl || releaseInfo?.platforms?.macos?.downloadUrl}
                                            available={releaseInfo?.platforms?.macos?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_deb"
                                            label="Linux DEB"
                                            sublabel="Debian / Ubuntu"
                                            icon={<Terminal className="w-5 h-5 text-orange-500" />}
                                            href={releaseInfo?.platforms?.linux_deb?.directUrl || releaseInfo?.platforms?.linux_deb?.downloadUrl}
                                            available={releaseInfo?.platforms?.linux_deb?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                        <DownloadButton
                                            platform="linux_rpm"
                                            label="Linux RPM"
                                            sublabel="RHEL / Fedora"
                                            icon={<Terminal className="w-5 h-5 text-red-500" />}
                                            href={releaseInfo?.platforms?.linux_rpm?.directUrl || releaseInfo?.platforms?.linux_rpm?.downloadUrl}
                                            available={releaseInfo?.platforms?.linux_rpm?.available ?? false}
                                            loading={loadingReleases}
                                        />
                                    </div>

                                    {/* Mobile Apps */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Applications Mobiles</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <a
                                                href={releaseInfo?.mobile?.ios?.appStoreUrl || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group text-center"
                                            >
                                                <Cpu className="w-6 h-6 text-muted-foreground mb-2" />
                                                <div className="text-sm font-bold text-foreground">iOS</div>
                                                <div className="text-[11px] text-muted-foreground">App Store</div>
                                                {releaseInfo?.mobile?.ios?.comingSoon && (
                                                    <Badge variant="outline" className="mt-2 text-[11px] border-amber-500/30 text-amber-600">
                                                        Bientôt
                                                    </Badge>
                                                )}
                                            </a>
                                            <a
                                                href={releaseInfo?.mobile?.android?.playStoreUrl || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col items-center p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group text-center"
                                            >
                                                <Server className="w-6 h-6 text-success-500 mb-2" />
                                                <div className="text-sm font-bold text-foreground">Android</div>
                                                <div className="text-[11px] text-muted-foreground">Play Store</div>
                                                {releaseInfo?.mobile?.android?.comingSoon && (
                                                    <Badge variant="outline" className="mt-2 text-[11px] border-amber-500/30 text-amber-600">
                                                        Bientôt
                                                    </Badge>
                                                )}
                                            </a>
                                        </div>
                                    </div>

                                    {/* Quick Install */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Installation rapide</h4>
                                        <ol className="space-y-2 text-sm text-muted-foreground">
                                            <li className="flex gap-2">
                                                <span className="font-bold text-primary">1.</span>
                                                Téléchargez l'installateur pour votre système
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-primary">2.</span>
                                                Lancez l'installation (admin requis)
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-primary">3.</span>
                                                Générez un token ci-dessus et configurez l'agent
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-bold text-primary">4.</span>
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
                                        <h3 className="text-lg font-bold text-foreground">Documentation</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Guides et références techniques pour l'agent Sentinel.</p>
                                    </div>

                                    {/* Quick Links */}
                                    <div className="space-y-2">
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/quickstart"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Zap className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-foreground block">Guide de démarrage rapide</span>
                                                    <span className="text-[11px] text-muted-foreground">Installation en 5 minutes</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/configuration"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Settings className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <span className="text-sm font-medium text-foreground block">Configuration avancée</span>
                                                    <span className="text-[11px] text-muted-foreground">Paramètres et personnalisation</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/security"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Shield className="w-4 h-4 text-success-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-foreground block">Sécurité et confidentialité</span>
                                                    <span className="text-[11px] text-muted-foreground">Données collectées et chiffrement</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/troubleshooting"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <span className="text-sm font-medium text-foreground block">Dépannage</span>
                                                    <span className="text-[11px] text-muted-foreground">Résolution des problèmes courants</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                        <a
                                            href="https://docs.sentinel-grc.com/agent/api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Network className="w-4 h-4 text-primary" />
                                                <div>
                                                    <span className="text-sm font-medium text-foreground block">API Reference</span>
                                                    <span className="text-[11px] text-muted-foreground">Intégration et automatisation</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                    </div>

                                    {/* System Requirements */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <HardDrive className="w-3.5 h-3.5" />
                                            Configuration requise
                                        </h4>
                                        <div className="space-y-3">
                                            {Object.entries(systemRequirements).map(([os, req]) => (
                                                <div key={os || 'unknown'} className="p-3 rounded-3xl bg-muted/50 dark:bg-white/5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {os === 'windows' && <Monitor className="w-4 h-4 text-blue-500" />}
                                                        {os === 'macos' && <Cpu className="w-4 h-4 text-muted-foreground" />}
                                                        {os === 'linux' && <Terminal className="w-4 h-4 text-orange-500" />}
                                                        <span className="text-sm font-bold text-foreground capitalize">{os}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                                        <div>
                                                            <span className="text-muted-foreground">OS:</span>
                                                            <span className="ml-1 text-foreground">{req.os}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">RAM:</span>
                                                            <span className="ml-1 text-foreground">{req.ram}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Disque:</span>
                                                            <span className="ml-1 text-foreground">{req.disk}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Autre:</span>
                                                            <span className="ml-1 text-foreground">{req.other}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* GitHub */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <a
                                            href="https://github.com/sentinel/agent/releases"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-3xl bg-foreground dark:bg-card hover:bg-foreground/90 dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Package className="w-4 h-4 text-background dark:text-foreground" />
                                                <span className="text-sm font-medium text-background dark:text-foreground">Releases GitHub</span>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
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
                                        <h3 className="text-lg font-bold text-foreground">Questions fréquentes</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Trouvez rapidement des réponses à vos questions.</p>
                                    </div>

                                    <div className="space-y-0">
                                        {faqItems.map((item, index) => (
                                            <FAQItem
                                                key={index || 'unknown'}
                                                question={item.question}
                                                answer={item.answer}
                                                isOpen={openFAQ === index}
                                                onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                                            />
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 dark:border-primary/80">
                                            <div className="flex items-start gap-3">
                                                <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        Vous ne trouvez pas votre réponse ?
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
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
                                        <h3 className="text-lg font-bold text-foreground">Support technique</h3>
                                        <p className="text-sm text-muted-foreground mt-1">Besoin d'aide ? Nous sommes là pour vous.</p>
                                    </div>

                                    {/* Support Options */}
                                    <div className="grid grid-cols-1 gap-3">
                                        <a
                                            href="mailto:support@sentinel-grc.com"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-primary/10 rounded-3xl">
                                                    <Headset className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-foreground block">Support par email</span>
                                                    <span className="text-[11px] text-muted-foreground">support@sentinel-grc.com</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>

                                        <a
                                            href="https://github.com/sentinel/agent/issues/new"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-red-50 rounded-3xl">
                                                    <Bug className="w-5 h-5 text-red-500" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-foreground block">Signaler un bug</span>
                                                    <span className="text-[11px] text-muted-foreground">GitHub Issues</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>

                                        <a
                                            href="https://community.sentinel-grc.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 dark:bg-white/5 hover:bg-muted dark:hover:bg-muted transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-purple-500/10 rounded-3xl">
                                                    <Activity className="w-5 h-5 text-purple-500" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-foreground block">Communauté</span>
                                                    <span className="text-[11px] text-muted-foreground">Forum et discussions</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground" />
                                        </a>
                                    </div>

                                    {/* Agent Status Check */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                            Diagnostic rapide
                                        </h4>
                                        <div className="p-4 rounded-2xl bg-muted/50 dark:bg-white/5 space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                Exécutez cette commande pour vérifier l'état de l'agent :
                                            </p>
                                            <div className="relative">
                                                <pre className="p-3 bg-card dark:bg-muted rounded-3xl text-[11px] text-success-400 overflow-x-auto border border-border">
                                                    <code>sentinel-agent status --verbose</code>
                                                </pre>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText('sentinel-agent status --verbose');
                                                        toast.success(t('agents.commandCopied') || "Commande copiée !");
                                                    }}
                                                    className="absolute right-2 top-2 p-1.5 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                                                >
                                                    <Copy className="w-3 h-3 text-muted-foreground" />
                                                </button>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full rounded-3xl text-xs"
                                                onClick={() => {
                                                    toast.info(t('agents.verificationInProgress') || "Vérification des agents en cours...");
                                                }}
                                            >
                                                <RefreshCw className="w-3 h-3 mr-1.5" />
                                                Rafraîchir le statut des agents
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Response Times */}
                                    <div className="pt-4 border-t border-border/40 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                            Temps de réponse
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Critique (P1)</span>
                                                <Badge className="bg-red-50 text-red-600 dark:text-red-400 border-red-500/20">{"<"} 1h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Important (P2)</span>
                                                <Badge className="bg-amber-50 text-amber-600 dark:text-amber-400 border-amber-500/20">{"<"} 4h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Normal (P3)</span>
                                                <Badge className="bg-blue-50 text-blue-600 dark:text-blue-400 border-blue-500/20">{"<"} 24h</Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Demande (P4)</span>
                                                <Badge className="bg-muted/500/10 text-muted-foreground border-border/400/20">{"<"} 72h</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Security Notice */}
                                    <div className="p-4 rounded-2xl bg-success-50 dark:bg-success-bg border border-success-200 dark:border-success-500/20">
                                        <div className="flex items-start gap-3">
                                            <Lock className="w-5 h-5 text-success-600 dark:text-success-400 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-foreground">
                                                    Sécurité des communications
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
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
                onClose={() => {
                    setShowEnrollment(false);
                    if (enrollmentToken) {
                        toast.info(t('agents.viewFleet') || 'Voir la flotte d\'agents', t('agents.viewFleetDesc') || 'Consultez vos agents enrôlés dans la vue dédiée.', {
                            label: 'Voir la flotte',
                            onClick: () => navigate('/agents'),
                        });
                    }
                }}
                enrollmentToken={enrollmentToken}
                releaseInfo={releaseInfo}
                loadingReleases={loadingReleases}
            />

            <AgentDetailsModal
                isOpen={!!selectedAgentId}
                onClose={() => setSelectedAgentId(null)}
                agentId={selectedAgentId}
                initialAgent={agents.find(a => a.id === selectedAgentId)}
                onAgentUpdated={() => {
                    // Refresh via subscription
                }}
            />
        </div>

    );
};
