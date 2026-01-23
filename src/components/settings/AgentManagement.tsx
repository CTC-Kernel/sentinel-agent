import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import {
    Server,
    Terminal,
    Download,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    ExternalLink,
    ShieldCheck,
    Cpu,
    Monitor
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import { AgentService } from '../../services/AgentService';
import { SentinelAgent, AgentStatus } from '../../types/agent';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export const AgentManagement: React.FC = () => {
    const { user } = useStore();
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showEnrollment, setShowEnrollment] = useState(false);
    const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null);

    const loadAgents = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const data = await AgentService.getAgents(user.organizationId);
            setAgents(data);
        } catch {
            toast.error("Échec du chargement des agents");
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        loadAgents();
    }, [loadAgents]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadAgents();
        setIsRefreshing(false);
        toast.success("Liste mis à jour");
    };

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
            setEnrollmentToken(result.token);
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
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        className="rounded-xl border border-slate-200 dark:border-white/10"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                        Actualiser
                    </Button>
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
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border border-white/60 dark:border-white/10 overflow-hidden backdrop-blur-sm">
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
                                                        <Server className="w-8 h-8 text-slate-400" />
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
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
                            className="glass-panel p-6 rounded-[2.5rem] border border-brand-500/30 bg-brand-500/5 relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                                    Nouveau Token
                                </h3>
                                <div className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-brand-500/20 font-mono text-sm text-brand-600 dark:text-brand-400 break-all select-all flex justify-between items-center gap-2">
                                    {enrollmentToken}
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(enrollmentToken || '');
                                            toast.success("Copié !");
                                        }}
                                        className="p-2 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                                    Utilisez ce token lors de l'installation de l'agent. Il expirera dans 24 heures.
                                </p>
                                <Button
                                    className="w-full mt-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                                    onClick={() => setShowEnrollment(false)}
                                >
                                    Fermer
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Documentation / Downloads */}
                    <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-500/10 rounded-xl text-brand-600">
                                <Download className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Téléchargements</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <a
                                href="/downloads/sentinel-agent-windows-x64.msi"
                                download
                                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">Windows .MSI</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">x64 Architecture</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                            </a>

                            <a
                                href="/downloads/sentinel-agent-linux-amd64.deb"
                                download
                                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Terminal className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">Linux .DEB</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Debian / Ubuntu</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                            </a>

                            <a
                                href="/downloads/sentinel-agent-linux-amd64.rpm"
                                download
                                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Terminal className="w-5 h-5 text-red-500" />
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">Linux .RPM</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">RHEL / CentOS / Fedora</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                            </a>

                            <a
                                href="/downloads/sentinel-agent-darwin-arm64"
                                download
                                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all group text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Cpu className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">macOS</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Apple Silicon / Intel</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                            </a>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                            <a
                                href="/docs/agent-installation"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between text-sm text-brand-500 font-bold hover:underline"
                            >
                                Manuel d'installation
                                <ExternalLink className="w-4 h-4" />
                            </a>
                            <a
                                href="/docs/agent-troubleshooting"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between text-sm text-slate-500 hover:text-brand-500 hover:underline"
                            >
                                Guide de dépannage
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
