import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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
import { Document } from '../../types';
import { SentinelPieActiveShapeProps } from '../../types/charts';
import {
    FileText,
    CheckCircle2,
    Edit,
    Clock,
    AlertTriangle,
    TrendingUp,
    FolderOpen,
    Shield,
    Calendar,
    Activity,
    FileCheck,
    History
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface DocumentsChartsProps {
    documents: Document[];
    loading?: boolean;
}

// Status Colors
const STATUS_COLORS: Record<string, string> = {
    'Publié': SENTINEL_PALETTE.success,
    'Approuvé': SENTINEL_PALETTE.success,
    'En revue': SENTINEL_PALETTE.warning,
    'Brouillon': 'hsl(var(--muted-foreground))',
    'Archivé': 'hsl(var(--muted-foreground) / 0.6)',
    'Rejeté': SENTINEL_PALETTE.danger
};

// Type Colors
const TYPE_COLORS: Record<string, string> = {
    'Politique': SENTINEL_PALETTE.primary,
    'Procédure': SENTINEL_PALETTE.success,
    'Preuve': SENTINEL_PALETTE.secondary,
    'Contrat': SENTINEL_PALETTE.info,
    'Guide': SENTINEL_PALETTE.warning,
    'Rapport': SENTINEL_PALETTE.series7,
    'Autre': 'hsl(var(--muted-foreground) / 0.6)'
};

// Custom active shape for interactive pie chart
const renderActiveShape = (props: SentinelPieActiveShapeProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const cxValue = cx ?? 0;
    const cyValue = cy ?? 0;
    const innerR = innerRadius ?? 0;
    const outerR = outerRadius ?? 0;
    const midA = midAngle ?? 0;
    const percentValue = percent ?? payload.percent ?? 0;
    const totalValue = value ?? payload.value ?? 0;

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
            <text x={cxValue} y={cyValue} dy={-5} textAnchor="middle" className="fill-foreground text-sm font-bold">
                {payload.name}
            </text>
            <text x={cxValue} y={cyValue} dy={15} textAnchor="middle" className="fill-muted-foreground text-xs">
                {totalValue} docs
            </text>
            <Sector
                cx={cxValue}
                cy={cyValue}
                innerRadius={innerR}
                outerRadius={outerR + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#docGlow)' }}
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
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} className="fill-foreground dark:fill-muted-foreground/50 text-xs font-medium">
                {`${(percentValue * 100).toFixed(0)}%`}
            </text>
        </g>
    );
};

// Tech corner decoration
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("pointer-events-none", className)}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
    </div>
);

export const DocumentsCharts: React.FC<DocumentsChartsProps> = ({ documents, loading = false }) => {
    const [activeStatusIndex, setActiveStatusIndex] = useState(0);
    const [activeTypeIndex, setActiveTypeIndex] = useState(0);

    // Calculate statistics
    const stats = useMemo(() => {
        const total = documents.length;
        const published = documents.filter(d => d.status === 'Publié' || d.status === 'Approuvé').length;
        const inReview = documents.filter(d => d.status === 'En revue').length;
        const drafts = documents.filter(d => d.status === 'Brouillon').length;
        const expired = documents.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;
        const validationRate = total > 0 ? Math.round((published / total) * 100) : 0;
        const secure = documents.filter(d => d.isSecure).length;

        return { total, published, inReview, drafts, expired, validationRate, secure };
    }, [documents]);

    // Status distribution data
    const statusDistribution = useMemo(() => {
        const statusCounts: Record<string, number> = {};
        documents.forEach(doc => {
            const status = doc.status || 'Brouillon';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return Object.entries(statusCounts)
            .map(([name, value]) => ({
                name,
                value,
                color: STATUS_COLORS[name] || 'hsl(var(--muted-foreground) / 0.6)',
                percent: documents.length > 0 ? value / documents.length : 0
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [documents]);

    // Type distribution data
    const typeDistribution = useMemo(() => {
        const typeCounts: Record<string, number> = {};
        documents.forEach(doc => {
            const type = doc.type || 'Autre';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        return Object.entries(typeCounts)
            .map(([name, value]) => ({
                name,
                value,
                color: TYPE_COLORS[name] || 'hsl(var(--muted-foreground) / 0.6)',
                percent: documents.length > 0 ? value / documents.length : 0
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [documents]);

    // Activity timeline (documents by month)
    const activityTimeline = useMemo(() => {
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        const now = new Date();
        const data = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            const monthName = months[date.getMonth()];

            const created = documents.filter(d => {
                const createdAt = d.createdAt ? new Date(d.createdAt) : null;
                return createdAt && createdAt >= date && createdAt <= monthEnd;
            }).length;

            const updated = documents.filter(d => {
                const updatedAt = d.updatedAt ? new Date(d.updatedAt) : null;
                return updatedAt && updatedAt >= date && updatedAt <= monthEnd;
            }).length;

            data.push({
                month: monthName,
                créés: created,
                modifiés: updated
            });
        }

        return data;
    }, [documents]);

    // Expiring soon documents
    const expiringDocuments = useMemo(() => {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return documents
            .filter(d => {
                if (!d.nextReviewDate) return false;
                const reviewDate = new Date(d.nextReviewDate);
                return reviewDate >= now && reviewDate <= thirtyDaysFromNow;
            })
            .sort((a, b) => new Date(a.nextReviewDate!).getTime() - new Date(b.nextReviewDate!).getTime())
            .slice(0, 5);
    }, [documents]);

    // Health gauge data
    const healthGaugeData = useMemo(() => [
        {
            name: 'Validation',
            value: stats.validationRate,
            fill: stats.validationRate >= 80 ? SENTINEL_PALETTE.success : stats.validationRate >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
        }
    ], [stats.validationRate]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i || 'unknown'} className="glass-premium p-6 rounded-4xl h-48 animate-pulse bg-muted/50" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* SVG Definitions for glow effects */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="docGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="docActivityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="docModifiedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.6} />
                        <stop offset="95%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Hero Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Validation Score Gauge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Taux Validation</span>
                        <FileCheck className="w-4 h-4 text-primary" />
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
                                    innerRadius="70%"
                                    outerRadius="105%"
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={12}
                                    paddingAngle={0}
                                >
                                    <Cell
                                        fill={healthGaugeData[0].fill}
                                        style={{ filter: 'url(#docGlow)' }}
                                    />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-foreground">
                                {stats.validationRate}%
                            </span>
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                                {stats.validationRate >= 80 ? 'Excellent' : stats.validationRate >= 50 ? 'Moyen' : 'Faible'}
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
                            <CheckCircle2 className="w-5 h-5 text-success-500" />
                        </div>
                        <Badge className="bg-success-bg text-success-600 border-success-500/20 text-[11px]">
                            {stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}%
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {stats.published}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Publiés</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stats.published / Math.max(stats.total, 1)) * 100}%` }}
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
                        <div className="p-3 bg-warning-bg rounded-2xl">
                            <Clock className="w-5 h-5 text-warning-500" />
                        </div>
                        <Badge className="bg-warning-bg text-warning-600 border-warning-500/20 text-[11px]">
                            En attente
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {stats.inReview}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">En Revue</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stats.inReview / Math.max(stats.total, 1)) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-warning-500 rounded-full"
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
                        {stats.expired > 0 && (
                            <Badge className="bg-red-50 text-red-600 dark:text-red-400 border-red-500/20 text-[11px] animate-pulse">
                                Action requise
                            </Badge>
                        )}
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-foreground">
                            {stats.expired}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Expirés</div>
                    </div>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(stats.expired / Math.max(stats.total, 1)) * 100}%` }}
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
                        <h3 className="text-sm font-bold text-foreground">Distribution par Statut</h3>
                        <Activity className="w-4 h-4 text-primary" />
                    </div>
                    {statusDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" >
                                <PieChart>
                                    <Pie
                                        activeIndex={activeStatusIndex}
                                        activeShape={renderActiveShape as Pie['props']['activeShape']}
                                        data={statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveStatusIndex(index)}
                                        paddingAngle={3}
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
                            Aucun document
                        </div>
                    )}
                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                        {statusDistribution.slice(0, 4).map((entry, index) => (
                            <div key={index || 'unknown'} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Type Distribution Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground">Distribution par Type</h3>
                        <FolderOpen className="w-4 h-4 text-primary" />
                    </div>
                    {typeDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" >
                                <PieChart>
                                    <Pie
                                        activeIndex={activeTypeIndex}
                                        activeShape={renderActiveShape as Pie['props']['activeShape']}
                                        data={typeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveTypeIndex(index)}
                                        paddingAngle={3}
                                    >
                                        {typeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            Aucun document
                        </div>
                    )}
                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                        {typeDistribution.slice(0, 4).map((entry, index) => (
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
                        <h3 className="text-sm font-bold text-foreground">Activité (6 mois)</h3>
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%" >
                            <AreaChart data={activityTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis
                                    dataKey="month"
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
                                    dataKey="créés"
                                    stroke={SENTINEL_PALETTE.primary}
                                    fillOpacity={1}
                                    fill="url(#docActivityGradient)"
                                    strokeWidth={2}
                                    name="Créés"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="modifiés"
                                    stroke={SENTINEL_PALETTE.success}
                                    fillOpacity={1}
                                    fill="url(#docModifiedGradient)"
                                    strokeWidth={2}
                                    name="Modifiés"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.primary }} />
                            <span className="text-muted-foreground">Créés</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.success }} />
                            <span className="text-muted-foreground">Modifiés</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Expiring Documents & Secure Documents Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring Soon */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <History className="w-4 h-4 text-warning-500" />
                            Expiration Prochaine (30j)
                        </h3>
                        <Badge className="bg-warning-bg text-warning-600 border-warning-500/20 text-[11px]">
                            {expiringDocuments.length} docs
                        </Badge>
                    </div>
                    {expiringDocuments.length > 0 ? (
                        <div className="space-y-3">
                            {expiringDocuments.map((doc, index) => {
                                const daysUntil = Math.ceil((new Date(doc.nextReviewDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div
                                        key={doc.id || 'unknown'}
                                        className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-3xl border border-border/40"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                                daysUntil <= 7 ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-warning-bg text-warning-600"
                                            )}>
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-foreground truncate">
                                                    {doc.title}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                                                    {doc.type}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "text-[11px]",
                                            daysUntil <= 7 ? "bg-red-50 text-red-600 dark:text-red-400 border-red-500/20" : "bg-warning-bg text-warning-600 border-warning-500/20"
                                        )}>
                                            {daysUntil}j
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-[150px] flex flex-col items-center justify-center text-muted-foreground">
                            <CheckCircle2 className="w-8 h-8 text-success-500 mb-2" />
                            <span className="text-sm">Aucun document à revoir</span>
                        </div>
                    )}
                </motion.div>

                {/* Quick Stats Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-premium p-6 rounded-4xl border border-border/40 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            Résumé Documentaire
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Total</span>
                            </div>
                            <div className="text-2xl font-black text-foreground">{stats.total}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-2 mb-2">
                                <Edit className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Brouillons</span>
                            </div>
                            <div className="text-2xl font-black text-foreground">{stats.drafts}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-primary" />
                                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Sécurisés</span>
                            </div>
                            <div className="text-2xl font-black text-foreground">{stats.secure}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Ce Mois</span>
                            </div>
                            <div className="text-2xl font-black text-foreground">
                                {documents.filter(d => {
                                    const createdAt = d.createdAt ? new Date(d.createdAt) : null;
                                    const now = new Date();
                                    return createdAt && createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
                                }).length}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
