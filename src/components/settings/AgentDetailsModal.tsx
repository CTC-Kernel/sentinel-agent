import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import {
 ShieldCheck,
 Clock,
 Monitor,
 Cpu,
 Activity,
 Save,
 Trash2,
 FileText,
 Settings,
 CheckCircle2,
 XCircle,
 Server,
 HardDrive,
 Network,
 RefreshCw
} from '../ui/Icons';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { SentinelAgent, AgentDetails, AgentConfig, AgentStatus, AgentMetricPoint } from '../../types/agent';
import { AgentService } from '../../services/AgentService';
import { useStore } from '../../store';
import { SENTINEL_PALETTE } from '../../theme/chartTheme';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '@/hooks/useLocale';

interface AgentDetailsModalProps {
 isOpen: boolean;
 onClose: () => void;
 agentId: string | null;
 initialAgent?: SentinelAgent;
 onAgentUpdated?: () => void;
 onAgentDeleted?: () => void;
}

// Apple-style radial gauge component
const RadialGauge: React.FC<{
 value: number;
 max?: number;
 label: string;
 color: string;
 bgColor: string;
 icon: React.ComponentType<{ className?: string }>;
 unit?: string;
 subtitle?: string;
}> = ({ value, max = 100, label, color, bgColor, icon: Icon, unit = '%', subtitle }) => {
 const percentage = Math.min((value / max) * 100, 100);
 const circumference = 2 * Math.PI * 42; // radius = 42
 const offset = circumference - (percentage / 100) * circumference;

 return (
 <div className="relative flex flex-col items-center p-4 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/40 hover:shadow-lg transition-shadow">
 <div className="relative w-28 h-28">
 {/* Background circle */}
 <svg className="w-full h-full transform -rotate-90">
  <circle
  cx="56"
  cy="56"
  r="42"
  stroke="currentColor"
  strokeWidth="8"
  fill="none"
  className="text-muted-foreground/60 dark:text-white/10"
  />
  <circle
  cx="56"
  cy="56"
  r="42"
  stroke="currentColor"
  strokeWidth="8"
  fill="none"
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={offset}
  className={color}
  style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
  />
 </svg>
 {/* Center content */}
 <div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-2xl font-black text-foreground">
  {Math.round(value)}
  </span>
  <span className="text-xs text-muted-foreground">{unit}</span>
 </div>
 </div>
 <div className="mt-3 flex items-center gap-2">
 <div className={cn("p-1.5 rounded-lg", bgColor, color)}>
  <Icon className="w-3.5 h-3.5" />
 </div>
 <span className="text-sm font-semibold text-foreground">{label}</span>
 </div>
 {subtitle && (
 <span className="caption mt-1">{subtitle}</span>
 )}
 </div>
 );
};

// Format bytes to human-readable
const formatBytes = (bytes: number, decimals = 1): string => {
 if (bytes === 0) return '0 B';
 const k = 1024;
 const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
 const i = Math.floor(Math.log(bytes) / Math.log(k));
 return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

// Format uptime
const formatUptime = (seconds?: number): string => {
 if (!seconds) return 'N/A';
 const days = Math.floor(seconds / 86400);
 const hours = Math.floor((seconds % 86400) / 3600);
 const mins = Math.floor((seconds % 3600) / 60);
 if (days > 0) return `${days}j ${hours}h`;
 if (hours > 0) return `${hours}h ${mins}m`;
 return `${mins}m`;
};

export const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({
 isOpen,
 onClose,
 agentId,
 initialAgent,
 onAgentUpdated,
 onAgentDeleted
}) => {
 const { user, t } = useStore();
 const { config } = useLocale();
 const [activeTab, setActiveTab] = useState<'overview' | 'compliance' | 'config' | 'logs'>('overview');
 const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
 const [metricsHistory, setMetricsHistory] = useState<AgentMetricPoint[]>([]);
 const [loading, setLoading] = useState(true);
 const [updating, setUpdating] = useState(false);
 const [configForm, setConfigForm] = useState<Partial<AgentConfig>>({});

 const loadAgentDetails = React.useCallback(async () => {
 if (!agentId || !user?.organizationId) return;
 setLoading(true);
 try {
 const [details, metricsData] = await Promise.all([
 AgentService.getAgentDetails(user.organizationId, agentId),
 AgentService.getAgentMetricsHistory(user.organizationId, agentId, 6).catch(() => ({ metrics: [] }))
 ]);
 setAgentDetails(details);
 setMetricsHistory(metricsData.metrics || []);
 if (details.config) {
 setConfigForm(details.config);
 }
 } catch (error) {
 ErrorLogger.error(error, 'AgentDetailsModal.loadAgentDetails');
 toast.error(t('agents.loadError') || "Erreur lors du chargement des détails de l'agent");
 // Fallback to initial data if available for basic display
 if (initialAgent) {
 // casting to AgentDetails for basic display
 setAgentDetails({ ...initialAgent, resultsSummary: { total: 0, pass: 0, fail: 0, error: 0, not_applicable: 0 }, pendingCommandsCount: 0 });
 }
 } finally {
 setLoading(false);
 }
 }, [agentId, user?.organizationId, initialAgent, t]);

 // Reset state when modal opens/changes agent
 useEffect(() => {
 if (isOpen && agentId && user?.organizationId) {
 loadAgentDetails();
 } else {
 setAgentDetails(null);
 setLoading(false);
 }
 }, [isOpen, agentId, user?.organizationId, loadAgentDetails]);

 const handleSaveConfig = async () => {
 if (!agentId || !user?.organizationId) return;
 setUpdating(true);
 try {
 await AgentService.updateAgentConfig(user.organizationId, agentId, configForm);
 toast.success(t('agents.configUpdated') || "Configuration mise à jour");
 if (onAgentUpdated) onAgentUpdated();
 loadAgentDetails(); // Reload to confirm
 } catch (error) {
 ErrorLogger.error(error, 'AgentDetailsModal.saveConfig');
 toast.error(t('agents.updateError') || "Erreur lors de la mise à jour");
 } finally {
 setUpdating(false);
 }
 };

 const handleDeleteAgent = async () => {
 if (!agentId || !user?.organizationId) return;
 if (!confirm(t('agents.confirmDelete') || "Êtes-vous sûr de vouloir supprimer cet agent ? Cette action est irréversible.")) return;

 setUpdating(true);
 try {
 await AgentService.deleteAgent(user.organizationId, agentId, true);
 toast.success(t('agents.deleted') || "Agent supprimé");
 if (onAgentDeleted) onAgentDeleted();
 onClose();
 } catch (error) {
 ErrorLogger.error(error, 'AgentDetailsModal.deleteAgent');
 toast.error(t('agents.deleteError') || "Erreur lors de la suppression");
 } finally {
 setUpdating(false);
 }
 };

 const getStatusBadge = (status: AgentStatus) => {
 switch (status) {
 case 'active':
 return <Badge className="bg-success-bg text-success-600 border-success-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Actif</Badge>;
 case 'offline':
 return <Badge className="bg-muted/500/10 text-muted-foreground border-border/400/20"><Clock className="w-3 h-3 mr-1" /> Hors-ligne</Badge>;
 case 'error':
 return <Badge className="bg-red-50 text-red-600 dark:text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Erreur</Badge>;
 }
 };

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 title="Détails de l'Agent"
 maxWidth="max-w-4xl"
 >
 <div className="flex flex-col h-[70vh]">
 {/* Header Info */}
 <div className="px-6 py-4 bg-muted/50 dark:bg-white/5 border-b border-border/40 flex items-center justify-between">
  <div>
  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
  {agentDetails?.name || 'Chargement...'}
  </h2>
  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
  <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> {agentDetails?.hostname || 'N/A'}</span>
  <span className="flex items-center gap-1"><Network className="w-3 h-3" /> {agentDetails?.ipAddress || 'N/A'}</span>
  <span className="font-mono bg-muted dark:bg-white/10 px-1.5 py-0.5 rounded">v{agentDetails?.version}</span>
  </div>
  </div>
  <div className="flex items-center gap-2">
  <Button variant="outline" size="sm" onClick={loadAgentDetails} disabled={loading}>
  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
  </Button>
  <Button variant="destructive" size="sm" onClick={handleDeleteAgent} disabled={updating}>
  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
  </Button>
  </div>
 </div>

 {/* Tabs */}
 <div className="px-6 pt-4 border-b border-border/40">
  <div className="flex items-center gap-6">
  {[
  { id: 'overview', label: 'Vue d\'ensemble', icon: Activity },
  { id: 'compliance', label: 'Conformité', icon: ShieldCheck },
  { id: 'config', label: 'Configuration', icon: Settings },
  { id: 'logs', label: 'Logs & Diagnostics', icon: FileText },
  ].map(tab => (
  <button
  key={tab.id || 'unknown'}
  onClick={() => setActiveTab(tab.id as 'overview' | 'compliance' | 'config' | 'logs')}
  className={cn(
   "pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors",
   activeTab === tab.id
   ? "border-primary text-primary"
   : "border-transparent text-muted-foreground hover:text-foreground"
  )}
  >
  <tab.icon className="w-4 h-4" />
  {tab.label}
  </button>
  ))}
  </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6 bg-card">
  {loading && !agentDetails ? (
  <div className="flex items-center justify-center h-full">
  <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
  ) : agentDetails ? (
  <AnimatePresence mode="popLayout">
  {activeTab === 'overview' && (
  <motion.div
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   exit={{ opacity: 0, y: -10 }}
   className="space-y-6"
  >
   {/* Apple-style Metrics Gauges */}
   <div className="grid grid-cols-4 gap-4">
   <RadialGauge
   value={agentDetails.cpuPercent || 0}
   label="CPU"
   color="text-blue-500"
   bgColor="bg-blue-50"
   icon={Cpu}
   subtitle="Utilisation"
   />
   <RadialGauge
   value={agentDetails.memoryPercent ?? (agentDetails.memoryBytes && agentDetails.memoryTotalBytes ? Math.round((agentDetails.memoryBytes / agentDetails.memoryTotalBytes) * 100) : 0)}
   label="RAM"
   color="text-purple-500"
   bgColor="bg-purple-500/10"
   icon={HardDrive}
   subtitle={agentDetails.memoryBytes ? formatBytes(agentDetails.memoryBytes) : undefined}
   />
   <RadialGauge
   value={agentDetails.diskPercent || 0}
   label="Disque"
   color="text-amber-500"
   bgColor="bg-amber-50"
   icon={Server}
   subtitle={agentDetails.diskUsedBytes ? formatBytes(agentDetails.diskUsedBytes) : undefined}
   />
   <RadialGauge
   value={agentDetails.complianceScore ?? 0}
   label="Conformité"
   color="text-emerald-500"
   bgColor="bg-emerald-500/10"
   icon={ShieldCheck}
   />
   </div>

   {/* Metrics Trend Chart */}
   {metricsHistory.length > 0 && (
   <div className="p-5 rounded-2xl border border-border/40">
   <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
   <Activity className="w-4 h-4 text-primary" />
   Tendance des métriques (6h)
   </h3>
   <div className="h-[180px]">
   <ResponsiveContainer width="100%" height="100%" >
    <AreaChart data={metricsHistory.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(config.intlLocale, { hour: '2-digit', minute: '2-digit' }),
    cpu: m.cpuPercent,
    ram: m.memoryPercent || 0,
    }))}>
    <defs>
    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="hsl(var(--nav-repository))" stopOpacity={0.3} />
    <stop offset="95%" stopColor="hsl(var(--nav-repository))" stopOpacity={0} />
    </linearGradient>
    </defs>
    <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
    <Tooltip
    contentStyle={{
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'hsl(var(--popover-foreground))'
    }}
    />
    <Area type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" fill="url(#cpuGradient)" strokeWidth={2} name="CPU %" />
    <Area type="monotone" dataKey="ram" stroke="hsl(var(--nav-repository))" fill="url(#ramGradient)" strokeWidth={2} name="RAM %" />
    </AreaChart>
   </ResponsiveContainer>
   </div>
   <div className="flex gap-4 mt-2 justify-center">
   <div className="flex items-center gap-2 text-xs">
    <div className="w-3 h-3 rounded-full bg-blue-500" />
    <span className="text-muted-foreground">CPU</span>
   </div>
   <div className="flex items-center gap-2 text-xs">
    <div className="w-3 h-3 rounded-full bg-purple-500" />
    <span className="text-muted-foreground">RAM</span>
   </div>
   </div>
   </div>
   )}

   {/* Info Cards */}
   <div className="grid grid-cols-2 gap-6">
   <div className="p-5 rounded-2xl border border-border/40">
   <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
   <Server className="w-4 h-4 text-primary" />
   Informations Système
   </h3>
   <div className="space-y-3 text-sm">
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">OS</span>
    <span className="font-medium">{agentDetails.os} {agentDetails.osVersion}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Hostname</span>
    <span className="font-medium">{agentDetails.hostname}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">IP Address</span>
    <span className="font-medium">{agentDetails.ipAddress}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Machine ID</span>
    <span className="font-mono text-xs">{agentDetails.machineId?.substring(0, 16)}...</span>
   </div>
   </div>
   </div>

   <div className="p-5 rounded-2xl border border-border/40">
   <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
   <Activity className="w-4 h-4 text-primary" />
   État & Activité
   </h3>
   <div className="space-y-3 text-sm">
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Status</span>
    <span>{getStatusBadge(agentDetails.status)}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Uptime</span>
    <span className="font-medium">{formatUptime(agentDetails.uptimeSeconds)}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Dernier Heartbeat</span>
    <span className="font-medium">{new Date(agentDetails.lastHeartbeat).toLocaleString()}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Enrôlé le</span>
    <span className="font-medium">{agentDetails.enrolledAt ? new Date(agentDetails.enrolledAt).toLocaleDateString() : 'N/A'}</span>
   </div>
   <div className="flex justify-between py-2 border-b border-border/40 dark:border-white/5">
    <span className="text-muted-foreground">Version Config</span>
    <span className="font-mono">v{agentDetails.configVersion}</span>
   </div>
   </div>
   </div>
   </div>
  </motion.div>
  )}

  {activeTab === 'compliance' && (
  <motion.div
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   className="space-y-6"
  >
   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
   {/* Compliance Chart */}
   <div className="p-6 rounded-2xl border border-border/40 flex flex-col items-center justify-center">
   <h3 className="text-sm font-bold mb-4 w-full text-left">Résumé des Contrôles</h3>
   <div className="h-[200px] w-full">
   <ResponsiveContainer width="100%" height="100%" >
    <PieChart>
    <Pie
    data={[
    { name: 'Pass', value: agentDetails.resultsSummary?.pass || 0, color: SENTINEL_PALETTE.success },
    { name: 'Fail', value: agentDetails.resultsSummary?.fail || 0, color: SENTINEL_PALETTE.danger },
    { name: 'Error', value: agentDetails.resultsSummary?.error || 0, color: SENTINEL_PALETTE.warning },
    ]}
    cx="50%"
    cy="50%"
    innerRadius={60}
    outerRadius={80}
    paddingAngle={5}
    dataKey="value"
    >
    {[
    { name: 'Pass', value: agentDetails.resultsSummary?.pass || 0, color: SENTINEL_PALETTE.success },
    { name: 'Fail', value: agentDetails.resultsSummary?.fail || 0, color: SENTINEL_PALETTE.danger },
    { name: 'Error', value: agentDetails.resultsSummary?.error || 0, color: SENTINEL_PALETTE.warning },
    ].map((entry, index) => (
    <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
    ))}
    </Pie>
    </PieChart>
   </ResponsiveContainer>
   </div>
   <div className="flex gap-4 mt-4">
   <div className="flex items-center gap-2 text-xs">
    <div className="w-3 h-3 rounded-full bg-success-500" />
    <span>Pass ({agentDetails.resultsSummary?.pass || 0})</span>
   </div>
   <div className="flex items-center gap-2 text-xs">
    <div className="w-3 h-3 rounded-full bg-red-500" />
    <span>Fail ({agentDetails.resultsSummary?.fail || 0})</span>
   </div>
   </div>
   </div>

   {/* Compliance Text Stats */}
   <div className="space-y-4">
   <div className="p-4 rounded-3xl bg-muted/50 dark:bg-white/5 border-l-4 border-success-500">
   <div className="text-xs text-muted-foreground uppercase font-bold">Conforme</div>
   <div className="text-2xl font-black text-foreground">
    {agentDetails.complianceScore ?? 0}%
   </div>
   </div>
   <div className="p-4 rounded-3xl bg-muted/50 dark:bg-white/5 border-l-4 border-border/400">
   <div className="text-xs text-muted-foreground uppercase font-bold">Total Contrôles</div>
   <div className="text-2xl font-black text-foreground">
    {agentDetails.resultsSummary?.total ?? 0}
   </div>
   </div>
   </div>
   </div>

   {/* Individual Check Results */}
   {agentDetails.checkResults && agentDetails.checkResults.length > 0 && (
   <div className="p-5 rounded-2xl border border-border/40">
   <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
   <ShieldCheck className="w-4 h-4 text-primary" />
   Détail des Contrôles ({agentDetails.checkResults.length})
   </h3>
   <div className="space-y-2 max-h-[300px] overflow-y-auto">
   {agentDetails.checkResults.map((result) => (
    <div
    key={result.id || 'unknown'}
    className={cn(
    "flex items-center justify-between p-3 rounded-xl border transition-colors",
    result.status === 'pass'
    ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30"
    : result.status === 'fail'
     ? "bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30"
     : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"
    )}
    >
    <div className="flex items-center gap-3 min-w-0">
    {result.status === 'pass' ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    ) : result.status === 'fail' ? (
    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
    ) : (
    <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
    )}
    <div className="min-w-0">
    <span className="text-sm font-medium text-foreground truncate block">
     {result.checkId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
    {result.durationMs !== undefined && result.durationMs > 0 && (
     <span className="text-xs text-muted-foreground">{result.durationMs}ms</span>
    )}
    </div>
    </div>
    <Badge className={cn(
    "text-xs font-bold",
    result.status === 'pass'
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : result.status === 'fail'
     ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
     : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    )}>
    {result.status === 'pass' ? 'Conforme' : result.status === 'fail' ? 'Non conforme' : result.status === 'error' ? 'Erreur' : 'N/A'}
    </Badge>
    </div>
   ))}
   </div>
   </div>
   )}
  </motion.div>
  )}

  {activeTab === 'config' && (
  <motion.div
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   className="space-y-6 max-w-2xl mx-auto"
  >
   <div className="space-y-4">
   <div className="space-y-2">
   <label htmlFor="check-interval" className="text-sm font-medium text-foreground">Intervalle de vérification (secondes)</label>
   <input
   id="check-interval"
   type="number"
   className="w-full px-4 py-2 rounded-3xl border border-border/40 bg-white dark:bg-white/5 focus:ring-2 focus:ring-primary outline-none transition-all"
   value={configForm.check_interval_secs || 900}
   onChange={e => setConfigForm({ ...configForm, check_interval_secs: parseInt(e.target.value) })}
   />
   <p className="text-xs text-muted-foreground">Fréquence d'exécution des contrôles de conformité.</p>
   </div>

   <div className="space-y-2">
   <label htmlFor="log-level" className="text-sm font-medium text-foreground">Niveau de Log</label>
   <select
   id="log-level"
   className="w-full px-4 py-2 rounded-3xl border border-border/40 bg-white dark:bg-white/5 focus:ring-2 focus:ring-primary outline-none transition-all"
   value={configForm.log_level || 'info'}
   onChange={e => setConfigForm({ ...configForm, log_level: e.target.value })}
   >
   <option value="debug">Debug (Verbeux)</option>
   <option value="info">Info (Standard)</option>
   <option value="warn">Warning (Avertissements)</option>
   <option value="error">Error (Critique)</option>
   </select>
   </div>

   <div className="space-y-2">
   <label htmlFor="heartbeat-interval" className="text-sm font-medium text-foreground">Intervalle Heartbeat (secondes)</label>
   <input
   id="heartbeat-interval"
   type="number"
   className="w-full px-4 py-2 rounded-3xl border border-border/40 bg-white dark:bg-white/5 focus:ring-2 focus:ring-primary outline-none transition-all"
   value={configForm.heartbeat_interval_secs || 60}
   onChange={e => setConfigForm({ ...configForm, heartbeat_interval_secs: parseInt(e.target.value) })}
   />
   </div>
   </div>

   <div className="pt-6 flex justify-end">
   <Button
   onClick={handleSaveConfig}
   disabled={updating}
   className="bg-primary text-primary-foreground shadow-lg shadow-primary/20"
   >
   {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
   Sauvegarder la configuration
   </Button>
   </div>
  </motion.div>
  )}

  {activeTab === 'logs' && (
  <motion.div
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   className="space-y-4"
  >
   <h3 className="text-sm font-bold flex items-center gap-2">
   <FileText className="w-4 h-4 text-primary" />
   Dernier Self-Check
   </h3>

   <div className="p-4 bg-card dark:bg-muted rounded-3xl border border-border shadow-inner overflow-x-auto">
   <pre className="text-xs font-mono text-emerald-400">
   {agentDetails.selfCheckResult
   ? JSON.stringify(agentDetails.selfCheckResult, null, 2)
   : "// Aucun résultat d'autodiagnostic disponible"
   }
   </pre>
   </div>

   <h3 className="text-sm font-bold flex items-center gap-2 mt-6">
   <Clock className="w-4 h-4 text-primary" />
   Pending Commands ({agentDetails.pendingCommandsCount})
   </h3>
   <p className="text-sm text-muted-foreground">Commandes en attente de récupération par l'agent.</p>
  </motion.div>
  )}
  </AnimatePresence>
  ) : null}
 </div>
 </div>
 </Modal>
 );
};
