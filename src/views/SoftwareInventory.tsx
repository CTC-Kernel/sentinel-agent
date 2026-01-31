import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { PageHeader } from '../components/ui/PageHeader';
import {
    subscribeToSoftwareInventory,
    subscribeToCISBaselines,
    getSoftwareStats,
    SoftwareInventoryService,
} from '../services/SoftwareInventoryService';
import { subscribeToAgents } from '../services/AgentService';
import { SentinelAgent } from '../types/agent';
import {
    SoftwareInventoryEntry,
    SoftwareInventoryStats,
    CISBaseline,
    AuthorizationStatus,
    RiskLevel,
    SoftwareCategory,
    AUTHORIZATION_STATUS,
    RISK_LEVELS,
    SOFTWARE_CATEGORIES,
    formatCategoryLabel,
    getRiskLevelColor,
    getAuthorizationColor,
} from '../types/softwareInventory';
import {
    Download,
    Search,
    Shield,
    Package,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Filter,
    RefreshCw,
    LayoutGrid,
    List,
    ChevronDown,
    Users,
} from '../components/ui/Icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { SoftwareTable } from '../components/agents/SoftwareTable';
import { CISBenchmarkView } from '../components/agents/CISBenchmarkView';
import { cn } from '../utils/cn';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission } from '../utils/permissions';
import { toast } from '@/lib/toast';

// KPI Card Component
const KPICard: React.FC<{
    title: string;
    value: number | string;
    icon: React.ReactNode;
    trend?: { value: number; label: string };
    color?: 'default' | 'success' | 'warning' | 'danger';
}> = ({ title, value, icon, trend, color = 'default' }) => {
    const colorClasses = {
        default: 'text-foreground',
        success: 'text-success',
        warning: 'text-warning',
        danger: 'text-destructive',
    };

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl p-4 sm:p-6 border border-border/40 shadow-sm"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'p-2 rounded-xl bg-muted/50',
                        colorClasses[color]
                    )}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        <p className={cn(
                            'text-2xl font-bold font-display',
                            colorClasses[color]
                        )}>
                            {value}
                        </p>
                    </div>
                </div>
                {trend && (
                    <div className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        trend.value >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    )}>
                        {trend.value >= 0 ? '+' : ''}{trend.value} {trend.label}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Stats Summary Component
const StatsSummary: React.FC<{
    stats: SoftwareInventoryStats;
    loading: boolean;
}> = ({ stats, loading }) => {
    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-muted/50 rounded-2xl" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
                title="Logiciels détectés"
                value={stats.totalSoftware}
                icon={<Package className="h-5 w-5" />}
                trend={stats.newThisWeek > 0 ? { value: stats.newThisWeek, label: 'cette semaine' } : undefined}
            />
            <KPICard
                title="Autorisés"
                value={stats.byAuthorization.authorized}
                icon={<CheckCircle className="h-5 w-5" />}
                color="success"
            />
            <KPICard
                title="En attente"
                value={stats.byAuthorization.pending + stats.pendingRequests}
                icon={<Clock className="h-5 w-5" />}
                color="warning"
            />
            <KPICard
                title="Avec vulnérabilités"
                value={stats.withVulnerabilities}
                icon={<AlertTriangle className="h-5 w-5" />}
                color="danger"
            />
        </div>
    );
};

// Risk Distribution Component
const RiskDistribution: React.FC<{
    byRiskLevel: SoftwareInventoryStats['byRiskLevel'];
}> = ({ byRiskLevel }) => {
    const total = Object.values(byRiskLevel).reduce((a, b) => a + b, 0);
    if (total === 0) return null;

    const levels: { key: RiskLevel; label: string; color: string }[] = [
        { key: 'critical', label: 'Critique', color: 'bg-destructive' },
        { key: 'high', label: 'Élevé', color: 'bg-orange-500' },
        { key: 'medium', label: 'Moyen', color: 'bg-warning' },
        { key: 'low', label: 'Faible', color: 'bg-success' },
        { key: 'none', label: 'Aucun', color: 'bg-muted' },
    ];

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl p-4 sm:p-6 border border-border/40 shadow-sm"
        >
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Distribution des risques
            </h3>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {levels.map(({ key, color }) => {
                    const width = (byRiskLevel[key] / total) * 100;
                    if (width === 0) return null;
                    return (
                        <div
                            key={key}
                            className={cn(color, 'transition-all duration-500')}
                            style={{ width: `${width}%` }}
                        />
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
                {levels.map(({ key, label, color }) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                        <div className={cn('w-3 h-3 rounded-full', color)} />
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{byRiskLevel[key]}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

// Filter Dropdown Component
const FilterDropdown: React.FC<{
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (values: string[]) => void;
    icon?: React.ReactNode;
}> = ({ label, options, selected, onChange, icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className="gap-2"
            >
                {icon}
                {label}
                {selected.length > 0 && (
                    <Badge variant="soft" className="ml-1">
                        {selected.length}
                    </Badge>
                )}
                <ChevronDown className={cn(
                    'h-4 w-4 transition-transform',
                    isOpen && 'rotate-180'
                )} />
            </Button>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 min-w-48">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => toggleOption(option.value)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                                    selected.includes(option.value)
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-muted'
                                )}
                            >
                                <div className={cn(
                                    'w-4 h-4 border rounded flex items-center justify-center',
                                    selected.includes(option.value) && 'bg-primary border-primary'
                                )}>
                                    {selected.includes(option.value) && (
                                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                                    )}
                                </div>
                                {option.label}
                            </button>
                        ))}
                        {selected.length > 0 && (
                            <button
                                onClick={() => onChange([])}
                                className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-2 pt-2 border-t"
                            >
                                Effacer les filtres
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Sanitize CSV values to prevent CSV injection
function sanitizeCSVValue(value: string | number | undefined | null): string {
    const str = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
    if (str.includes('"') || str.includes(';') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// Skeleton for loading state
const SoftwareInventorySkeleton: React.FC = () => (
    <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-muted/50 rounded-2xl" />
            ))}
        </div>
        <div className="h-16 bg-muted/50 rounded-2xl" />
        <div className="h-96 bg-muted/50 rounded-2xl" />
    </div>
);

// Tab type
type TabType = 'inventory' | 'cis';

// Main SoftwareInventory View Component
export const SoftwareInventory: React.FC = () => {
    const { user } = useStore();
    const [software, setSoftware] = useState<SoftwareInventoryEntry[]>([]);
    const [cisBaselines, setCISBaselines] = useState<CISBaseline[]>([]);
    const [stats, setStats] = useState<SoftwareInventoryStats | null>(null);
    const [agents, setAgents] = useState<SentinelAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [displayMode, setDisplayMode] = useState<'software' | 'agent'>('software');
    const [activeTab, setActiveTab] = useState<TabType>('inventory');

    // Filters
    const [authFilters, setAuthFilters] = useState<AuthorizationStatus[]>([]);
    const [riskFilters, setRiskFilters] = useState<RiskLevel[]>([]);
    const [categoryFilters, setCategoryFilters] = useState<SoftwareCategory[]>([]);
    const [vulnFilter, setVulnFilter] = useState<boolean | undefined>(undefined);

    // Drawer state
    const [selectedSoftware, setSelectedSoftware] = useState<SoftwareInventoryEntry | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [authorizingId, setAuthorizingId] = useState<string | null>(null);

    const canUpdateAgent = hasPermission(user, 'Agent', 'update');

    // Load stats
    const loadStats = useCallback(async () => {
        if (!user?.organizationId) return;
        setStatsLoading(true);
        try {
            const statsData = await getSoftwareStats(user.organizationId);
            setStats(statsData);
        } catch (error) {
            ErrorLogger.error(error, 'SoftwareInventory.loadStats');
        } finally {
            setStatsLoading(false);
        }
    }, [user?.organizationId]);

    // Subscribe to software inventory
    useEffect(() => {
        if (!user?.organizationId) return;

        setLoading(true);

        const unsubscribe = subscribeToSoftwareInventory(
            user.organizationId,
            (softwareList) => {
                setSoftware(softwareList);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'SoftwareInventory.subscribeToSoftwareInventory');
                setError('Erreur de chargement des donnees');
                setLoading(false);
            },
            {
                authorizationStatus: authFilters.length > 0 ? authFilters : undefined,
                riskLevel: riskFilters.length > 0 ? riskFilters : undefined,
                category: categoryFilters.length > 0 ? categoryFilters : undefined,
                hasVulnerabilities: vulnFilter,
            }
        );

        return unsubscribe;
    }, [user?.organizationId, authFilters, riskFilters, categoryFilters, vulnFilter, retryCount]);

    // Subscribe to agents
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = subscribeToAgents(
            user.organizationId,
            (agentList) => {
                setAgents(agentList);
            },
            (error) => {
                ErrorLogger.error(error, 'SoftwareInventory.subscribeToAgents');
            }
        );

        return unsubscribe;
    }, [user?.organizationId]);

    // Subscribe to CIS baselines
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = subscribeToCISBaselines(
            user.organizationId,
            (baselines) => {
                setCISBaselines(baselines);
            },
            (error) => {
                ErrorLogger.error(error, 'SoftwareInventory.subscribeToCISBaselines');
            }
        );

        return unsubscribe;
    }, [user?.organizationId]);

    // Load stats on mount
    useEffect(() => {
        loadStats();
    }, [loadStats]);

    // Handle software click
    const handleSoftwareClick = useCallback((sw: SoftwareInventoryEntry) => {
        setSelectedSoftware(sw);
        setIsDrawerOpen(true);
    }, []);

    // Handle drawer close
    const handleDrawerClose = useCallback(() => {
        setIsDrawerOpen(false);
        setSelectedSoftware(null);
    }, []);

    // Filtered software (client-side additional filtering)
    const filteredSoftware = useMemo(() => {
        return software.filter(sw => {
            const matchesSearch = !searchQuery ||
                sw.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                sw.vendor.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesSearch;
        });
    }, [software, searchQuery]);

    // Agent hostname lookup for CIS view
    const agentHostnames = useMemo(() => {
        const map = new Map<string, string>();
        agents.forEach(a => {
            map.set(a.id, a.name || a.hostname || a.id.slice(0, 8));
        });
        return map;
    }, [agents]);

    // Filter options
    const authOptions = AUTHORIZATION_STATUS.map(status => ({
        value: status,
        label: status === 'authorized' ? 'Autorisé' :
            status === 'pending' ? 'En attente' :
                status === 'unauthorized' ? 'Non autorisé' : 'Bloqué'
    }));

    const riskOptions = RISK_LEVELS.map(level => ({
        value: level,
        label: level === 'critical' ? 'Critique' :
            level === 'high' ? 'Élevé' :
                level === 'medium' ? 'Moyen' :
                    level === 'low' ? 'Faible' : 'Aucun'
    }));

    const categoryOptions = SOFTWARE_CATEGORIES.map(cat => ({
        value: cat,
        label: formatCategoryLabel(cat)
    }));

    if (loading && !stats) {
        return (
            <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-6">
                <SoftwareInventorySkeleton />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <p className="text-lg font-medium">{error}</p>
                <Button onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1); }} variant="outline">
                    Reessayer
                </Button>
            </div>
        );
    }

    return (
        <>
            <motion.div
                variants={staggerContainerVariants}
                initial="initial"
                animate="visible"
                className="flex flex-col gap-6 sm:gap-8"
            >
                {/* Header */}
                <PageHeader
                    title="Inventaire Logiciels"
                    subtitle="Cartographie logicielle et conformité CIS Benchmarks"
                    icon={
                        <img
                            src="/images/IA.png"
                            alt="IA"
                            className="w-full h-full object-contain"
                        />
                    }
                    actions={
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadStats}
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                <span className="hidden sm:inline">Actualiser</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                    const BOM = '\uFEFF';
                                    const headers = ['Nom', 'Editeur', 'Categorie', 'Risque', 'Score', 'Agents', 'Autorisation', 'Vulnerabilites'].join(';');
                                    const rows = filteredSoftware.map(sw =>
                                        [
                                            sanitizeCSVValue(sw.name),
                                            sanitizeCSVValue(sw.vendor),
                                            sanitizeCSVValue(sw.category),
                                            sanitizeCSVValue(sw.riskLevel),
                                            sanitizeCSVValue(sw.riskScore),
                                            sanitizeCSVValue(sw.agentCount),
                                            sanitizeCSVValue(sw.authorizationStatus),
                                            sanitizeCSVValue(sw.linkedCveIds?.length || 0),
                                        ].join(';')
                                    );
                                    const csv = BOM + [headers, ...rows].join('\n');
                                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `inventaire-logiciels-${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Exporter</span>
                            </Button>
                        </div>
                    }
                />

                {/* Stats Summary */}
                {stats && (
                    <StatsSummary stats={stats} loading={statsLoading} />
                )}

                {/* Risk Distribution */}
                {stats && stats.totalSoftware > 0 && (
                    <RiskDistribution byRiskLevel={stats.byRiskLevel} />
                )}

                {/* Tab Navigation */}
                <motion.div
                    variants={slideUpVariants}
                    className="flex items-center gap-2 border-b"
                >
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                            activeTab === 'inventory'
                                ? 'border-primary text-slate-900 dark:text-white font-bold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Package className="h-4 w-4 inline-block mr-2" />
                        Inventaire ({filteredSoftware.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('cis')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                            activeTab === 'cis'
                                ? 'border-primary text-slate-900 dark:text-white font-bold'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Shield className="h-4 w-4 inline-block mr-2" />
                        CIS Benchmarks ({cisBaselines.length})
                    </button>
                </motion.div>

                {/* Search and Filters */}
                <motion.div
                    variants={slideUpVariants}
                    className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
                >
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={activeTab === 'inventory' ? "Rechercher un logiciel..." : "Rechercher un agent..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {activeTab === 'inventory' && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <FilterDropdown
                                    label="Statut"
                                    options={authOptions}
                                    selected={authFilters}
                                    onChange={(values) => setAuthFilters(values as AuthorizationStatus[])}
                                    icon={<CheckCircle className="h-4 w-4" />}
                                />
                                <FilterDropdown
                                    label="Risque"
                                    options={riskOptions}
                                    selected={riskFilters}
                                    onChange={(values) => setRiskFilters(values as RiskLevel[])}
                                    icon={<AlertTriangle className="h-4 w-4" />}
                                />
                                <FilterDropdown
                                    label="Catégorie"
                                    options={categoryOptions}
                                    selected={categoryFilters}
                                    onChange={(values) => setCategoryFilters(values as SoftwareCategory[])}
                                    icon={<Filter className="h-4 w-4" />}
                                />
                                <Button
                                    variant={vulnFilter === true ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setVulnFilter(vulnFilter === true ? undefined : true)}
                                    className="gap-2"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Vulnérables
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* View Mode and Display Mode Toggle */}
                    <div className="flex items-center gap-4">
                        {activeTab === 'inventory' && (
                            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                <Button
                                    variant={displayMode === 'software' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDisplayMode('software')}
                                    className="h-8 px-3 text-xs gap-2"
                                    title="Vue par logiciel"
                                >
                                    <Package className="h-3.5 w-3.5" />
                                    Logiciels
                                </Button>
                                <Button
                                    variant={displayMode === 'agent' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setDisplayMode('agent')}
                                    className="h-8 px-3 text-xs gap-2"
                                    title="Vue par agent"
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    Agents
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className="h-8 w-8 p-0"
                                title="Vue tableau"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className="h-8 w-8 p-0"
                                title="Vue grille"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Content */}
                {activeTab === 'inventory' ? (
                    <motion.div variants={slideUpVariants}>
                        <SoftwareTable
                            software={filteredSoftware}
                            agents={agents}
                            viewMode={viewMode}
                            displayMode={displayMode}
                            onSoftwareClick={handleSoftwareClick}
                            loading={loading}
                        />
                    </motion.div>
                ) : (
                    <motion.div variants={slideUpVariants}>
                        <CISBenchmarkView
                            baselines={cisBaselines}
                            searchQuery={searchQuery}
                            agentHostnames={agentHostnames}
                        />
                    </motion.div>
                )}
            </motion.div>

            {/* Software Details Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                width="max-w-2xl"
                title={selectedSoftware?.name || 'Logiciel'}
                subtitle={selectedSoftware?.vendor}
            >
                {selectedSoftware && (
                    <div className="p-6 space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Informations générales</h3>
                                <Badge className={getAuthorizationColor(selectedSoftware.authorizationStatus)}>
                                    {selectedSoftware.authorizationStatus === 'authorized' ? 'Autorisé' :
                                        selectedSoftware.authorizationStatus === 'pending' ? 'En attente' :
                                            selectedSoftware.authorizationStatus === 'unauthorized' ? 'Non autorisé' : 'Bloqué'}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Catégorie</p>
                                    <p className="font-medium">{formatCategoryLabel(selectedSoftware.category)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Agents affectés</p>
                                    <p className="font-medium">{selectedSoftware.agentCount}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Score de risque</p>
                                    <p className={cn('font-medium', getRiskLevelColor(selectedSoftware.riskLevel))}>
                                        {selectedSoftware.riskScore}/100
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Première détection</p>
                                    <p className="font-medium">
                                        {new Date(selectedSoftware.firstDiscovered).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Versions */}
                        <div className="space-y-4">
                            <h3 className="font-medium">Versions installées</h3>
                            <div className="space-y-2">
                                {selectedSoftware.versions.map((version, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            'flex items-center justify-between p-3 rounded-lg',
                                            version.isLatest ? 'bg-success/10' : 'bg-muted/50'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm">{version.version}</span>
                                            {version.isLatest && (
                                                <Badge variant="outline" className="text-success">
                                                    Dernière
                                                </Badge>
                                            )}
                                            {version.isOutdated && (
                                                <Badge variant="outline" className="text-warning">
                                                    Obsolète
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {version.agentCount} agent{version.agentCount > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Vulnerabilities */}
                        {selectedSoftware.hasVulnerabilities && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-destructive">Vulnérabilités</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="p-3 rounded-lg bg-destructive/10 text-center">
                                        <p className="text-2xl font-bold text-destructive">
                                            {selectedSoftware.vulnerabilitySummary.critical}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Critiques</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-orange-500/10 text-center">
                                        <p className="text-2xl font-bold text-orange-500">
                                            {selectedSoftware.vulnerabilitySummary.high}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Élevées</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-warning/10 text-center">
                                        <p className="text-2xl font-bold text-warning">
                                            {selectedSoftware.vulnerabilitySummary.medium}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Moyennes</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-success/10 text-center">
                                        <p className="text-2xl font-bold text-success">
                                            {selectedSoftware.vulnerabilitySummary.low}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Faibles</p>
                                    </div>
                                </div>
                                {selectedSoftware.linkedCveIds.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedSoftware.linkedCveIds.slice(0, 5).map(cveId => (
                                            <Badge key={cveId} variant="outline">
                                                {cveId}
                                            </Badge>
                                        ))}
                                        {selectedSoftware.linkedCveIds.length > 5 && (
                                            <Badge variant="outline">
                                                +{selectedSoftware.linkedCveIds.length - 5} autres
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        {canUpdateAgent && (
                            <div className="flex gap-2 pt-4 border-t">
                                {selectedSoftware.authorizationStatus === 'pending' && (
                                    <>
                                        <Button
                                            variant="default"
                                            className="flex-1 gap-2"
                                            disabled={authorizingId === selectedSoftware.id}
                                            onClick={async () => {
                                                if (!user?.organizationId || !selectedSoftware) return;
                                                setAuthorizingId(selectedSoftware.id);
                                                try {
                                                    await SoftwareInventoryService.updateAuthorizationStatus(user.organizationId, selectedSoftware.id, 'authorized', user.uid);
                                                    toast.success('Logiciel autorise', `"${selectedSoftware.name}" a ete autorise avec succes.`);
                                                    setSelectedSoftware(null);
                                                    setIsDrawerOpen(false);
                                                } catch (err) {
                                                    toast.error('Erreur', "Impossible de modifier le statut d'autorisation.");
                                                    ErrorLogger.error(err, 'SoftwareInventory.authorize');
                                                } finally {
                                                    setAuthorizingId(null);
                                                }
                                            }}
                                        >
                                            {authorizingId === selectedSoftware.id ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4" />
                                            )}
                                            Autoriser
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="flex-1 gap-2"
                                            disabled={authorizingId === selectedSoftware.id}
                                            onClick={async () => {
                                                if (!user?.organizationId || !selectedSoftware) return;
                                                setAuthorizingId(selectedSoftware.id);
                                                try {
                                                    await SoftwareInventoryService.updateAuthorizationStatus(user.organizationId, selectedSoftware.id, 'blocked', user.uid);
                                                    toast.success('Logiciel bloque', `"${selectedSoftware.name}" a ete bloque avec succes.`);
                                                    setSelectedSoftware(null);
                                                    setIsDrawerOpen(false);
                                                } catch (err) {
                                                    toast.error('Erreur', "Impossible de modifier le statut d'autorisation.");
                                                    ErrorLogger.error(err, 'SoftwareInventory.block');
                                                } finally {
                                                    setAuthorizingId(null);
                                                }
                                            }}
                                        >
                                            {authorizingId === selectedSoftware.id ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <XCircle className="h-4 w-4" />
                                            )}
                                            Bloquer
                                        </Button>
                                    </>
                                )}
                                {selectedSoftware.authorizationStatus === 'authorized' && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        disabled={authorizingId === selectedSoftware.id}
                                        onClick={async () => {
                                            if (!user?.organizationId || !selectedSoftware) return;
                                            setAuthorizingId(selectedSoftware.id);
                                            try {
                                                await SoftwareInventoryService.updateAuthorizationStatus(user.organizationId, selectedSoftware.id, 'pending', user.uid);
                                                toast.success('Autorisation revoquee', `L'autorisation de "${selectedSoftware.name}" a ete revoquee.`);
                                                setSelectedSoftware(null);
                                                setIsDrawerOpen(false);
                                            } catch (err) {
                                                toast.error('Erreur', "Impossible de modifier le statut d'autorisation.");
                                                ErrorLogger.error(err, 'SoftwareInventory.revoke');
                                            } finally {
                                                setAuthorizingId(null);
                                            }
                                        }}
                                    >
                                        {authorizingId === selectedSoftware.id ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <XCircle className="h-4 w-4" />
                                        )}
                                        Révoquer l'autorisation
                                    </Button>
                                )}
                                {selectedSoftware.authorizationStatus === 'blocked' && (
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        disabled={authorizingId === selectedSoftware.id}
                                        onClick={async () => {
                                            if (!user?.organizationId || !selectedSoftware) return;
                                            setAuthorizingId(selectedSoftware.id);
                                            try {
                                                await SoftwareInventoryService.updateAuthorizationStatus(user.organizationId, selectedSoftware.id, 'pending', user.uid);
                                                toast.success('Logiciel debloque', `"${selectedSoftware.name}" a ete debloque avec succes.`);
                                                setSelectedSoftware(null);
                                                setIsDrawerOpen(false);
                                            } catch (err) {
                                                toast.error('Erreur', "Impossible de modifier le statut d'autorisation.");
                                                ErrorLogger.error(err, 'SoftwareInventory.unblock');
                                            } finally {
                                                setAuthorizingId(null);
                                            }
                                        }}
                                    >
                                        {authorizingId === selectedSoftware.id ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4" />
                                        )}
                                        Débloquer
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </>
    );
};

export default SoftwareInventory;
