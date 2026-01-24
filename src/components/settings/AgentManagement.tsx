import React, { useState, useEffect } from 'react';
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
    Loader2
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import { AgentService } from '../../services/AgentService';
import { SentinelAgent, AgentStatus } from '../../types/agent';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

// Types for release info
interface PlatformInfo {
    displayName: string;
    available: boolean;
    downloadUrl: string;
    directUrl: string | null;
}

interface ReleaseInfo {
    product: string;
    currentVersion: string;
    platforms: Record<string, PlatformInfo>;
    mobile?: {
        ios: { available: boolean; appStoreUrl: string; comingSoon: boolean };
        android: { available: boolean; playStoreUrl: string; comingSoon: boolean };
    };
}

// Download API base URL
const RELEASE_API_URL = 'https://europe-west1-sentinel-grc-a8701.cloudfunctions.net/downloadRelease';

interface DownloadButtonProps {
    platform: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    available?: boolean;
    loading?: boolean;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ platform, label, sublabel, icon, available = true, loading = false }) => {
    const handleDownload = () => {
        if (loading) return;
        if (!available) {
            toast.info("Cette version sera disponible prochainement");
            return;
        }
        // Redirect to Cloud Function which will generate signed URL
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

export const AgentManagement: React.FC = () => {
    const { user } = useStore();
    const { claimsSynced } = useAuth();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEnrollment, setShowEnrollment] = useState(false);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);
    const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
    const [loadingReleases, setLoadingReleases] = useState(true);

    // Fetch available releases on mount
    useEffect(() => {
        const fetchReleases = async () => {
            try {
                const getReleaseInfo = httpsCallable<{ product: string }, ReleaseInfo>(functions, 'getReleaseInfo');
                const result = await getReleaseInfo({ product: 'agent' });
                setReleaseInfo(result.data);
            } catch (error) {
                console.error('Failed to fetch release info:', error);
                // Set default values if fetch fails
                setReleaseInfo({
                    product: 'agent',
                    currentVersion: '1.0.0',
                    platforms: {
                        windows: { displayName: 'Windows (MSI)', available: false, downloadUrl: '', directUrl: null },
                        macos: { displayName: 'macOS (DMG)', available: false, downloadUrl: '', directUrl: null },
                        linux_deb: { displayName: 'Linux (DEB)', available: false, downloadUrl: '', directUrl: null },
                        linux_rpm: { displayName: 'Linux (RPM)', available: false, downloadUrl: '', directUrl: null },
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
    // IMPORTANT: Wait for claimsSynced to be true before subscribing
    // This prevents "permission-denied" errors when the Firebase Auth token
    // hasn't been refreshed yet with the organizationId custom claim
    useEffect(() => {
        if (!user?.organizationId) return;

        // Wait for custom claims to be synced before subscribing
        if (!claimsSynced) {
            setLoading(true);
            return;
        }

        let unsubscribe: (() => void) | null = null;

        // Force token refresh before subscribing to ensure fresh credentials
        const initSubscription = async () => {
            try {
                // Force token refresh to ensure Firestore uses latest claims
                const { auth } = await import('../../firebase');
                if (auth.currentUser) {
                    await auth.currentUser.getIdToken(true);
                }
            } catch (e) {
                console.warn('Token refresh failed, proceeding anyway:', e);
            }

            unsubscribe = AgentService.subscribeToAgents(
            user.organizationId,
            (data) => {
                setAgents(data);
                setLoading(false);
            },
            (error) => {
                console.error('Agent subscription error:', error);
                // Show more detailed error message for debugging
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
                    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
                    bg: 'bg-emerald-500'
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
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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

            {/* Quick Actions / Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-panel p-4 rounded-3xl border border-white/60 dark:border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {agents.filter(a => a.status === 'active').length}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Actifs</div>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-3xl border border-white/60 dark:border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-slate-500/10 rounded-2xl">
                        <Clock className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {agents.filter(a => a.status === 'offline').length}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Hors-ligne</div>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-3xl border border-white/60 dark:border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                        <XCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {agents.filter(a => a.status === 'error').length}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Erreurs</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Agent List */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-5xl border border-white/60 dark:border-white/10 overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-white/10">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Agent</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Système</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">État</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Dernier Signe</th>
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
                                                    <td className="px-6 py-5 text-xs text-slate-500 font-medium">
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
                    </div>
                </div>

                {/* Sidebar Context */}
                <div className="space-y-6">
                    {/* Enrollment Card */}
                    {showEnrollment && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="glass-panel p-6 rounded-5xl border border-brand-500/30 bg-brand-500/5 relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                                    Token d'Enrôlement
                                </h3>

                                {/* Token display */}
                                <div className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-brand-500/20 font-mono text-xs text-brand-600 dark:text-brand-400 break-all select-all flex justify-between items-center gap-2">
                                    <span className="truncate">{enrollmentToken}</span>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(enrollmentToken || '');
                                            toast.success("Token copié !");
                                        }}
                                        className="p-2 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors flex-shrink-0"
                                        title="Copier le token"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Installation instructions */}
                                <div className="mt-4 space-y-3">
                                    <p className="text-xs text-slate-500 font-medium">
                                        Utilisez ce token lors de l'installation. Expire dans 24h.
                                    </p>

                                    <div className="space-y-2">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                                            Commande d'enrôlement :
                                        </p>
                                        <div className="relative">
                                            <pre className="p-3 bg-slate-900 dark:bg-black/50 rounded-xl text-[11px] text-emerald-400 overflow-x-auto">
                                                <code>sentinel-agent enroll --token {enrollmentToken?.substring(0, 8)}...</code>
                                            </pre>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`sentinel-agent enroll --token ${enrollmentToken}`);
                                                    toast.success("Commande copiée !");
                                                }}
                                                className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                <Copy className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            <strong>macOS :</strong> Ouvrez le Terminal après installation<br />
                                            <strong>Windows :</strong> Ouvrez PowerShell en admin<br />
                                            <strong>Linux :</strong> Ouvrez un terminal
                                        </p>
                                    </div>
                                </div>

                                <Button
                                    className="w-full mt-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                                    onClick={() => setShowEnrollment(false)}
                                >
                                    Fermer
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* What is the Agent? */}
                    <div className="glass-panel p-6 rounded-5xl border border-white/60 dark:border-white/10 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600">
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
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>Vérifie la conformité de sécurité</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>Fonctionne silencieusement ({"<"}1% CPU)</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>Ne collecte pas vos données personnelles</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>Communications chiffrées (TLS 1.3)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Documentation / Downloads */}
                    <div className="glass-panel p-6 rounded-5xl border border-white/60 dark:border-white/10 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-500/10 rounded-xl text-brand-600">
                                <Download className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Téléchargements</h3>
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
                        </div>

                        {/* Mobile Apps */}
                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Applications Mobiles</h4>
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
                                    <Server className="w-6 h-6 text-emerald-500 mb-2" />
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

                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Installation rapide</h4>
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
                    </div>
                </div>
            </div>
        </div>
    );
};
