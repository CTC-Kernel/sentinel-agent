import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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
import { Document } from '../../types';
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
    'Brouillon': '#64748b',
    'Archivé': '#94a3b8',
    'Rejeté': SENTINEL_PALETTE.danger
};

// Type Colors
const TYPE_COLORS: Record<string, string> = {
    'Politique': SENTINEL_PALETTE.primary,
    'Procédure': SENTINEL_PALETTE.success,
    'Preuve': SENTINEL_PALETTE.secondary,
    'Contrat': SENTINEL_PALETTE.info,
    'Guide': SENTINEL_PALETTE.warning,
    'Rapport': '#6b8fa3',
    'Autre': '#94a3b8'
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
                {value} docs
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#docGlow)' }}
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

// Tech corner decoration
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("pointer-events-none", className)}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-500/30 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-500/30 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-500/30 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-500/30 rounded-br-lg" />
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
                color: STATUS_COLORS[name] || '#94a3b8',
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
                color: TYPE_COLORS[name] || '#94a3b8',
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
                    <div key={i} className="glass-premium p-6 rounded-4xl h-48 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
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
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taux Validation</span>
                        <FileCheck className="w-4 h-4 text-brand-500" />
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
                                    style={{ filter: 'url(#docGlow)' }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                {stats.validationRate}%
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
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
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-success-500/10 rounded-2xl">
                            <CheckCircle2 className="w-5 h-5 text-success-500" />
                        </div>
                        <Badge className="bg-success-500/10 text-success-600 border-success-500/20 text-[10px]">
                            {stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}%
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {stats.published}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Publiés</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
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
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-warning-500/10 rounded-2xl">
                            <Clock className="w-5 h-5 text-warning-500" />
                        </div>
                        <Badge className="bg-warning-500/10 text-warning-600 border-warning-500/20 text-[10px]">
                            En attente
                        </Badge>
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {stats.inReview}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">En Revue</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
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
                    className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 flex flex-col justify-between"
                >
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-red-500/10 rounded-2xl">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        {stats.expired > 0 && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] animate-pulse">
                                Action requise
                            </Badge>
                        )}
                    </div>
                    <div className="mt-4">
                        <div className="text-3xl font-black text-slate-900 dark:text-white">
                            {stats.expired}
                        </div>
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Expirés</div>
                    </div>
                    <div className="mt-3 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
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
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Distribution par Statut</h3>
                        <Activity className="w-4 h-4 text-brand-500" />
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
                            Aucun document
                        </div>
                    )}
                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                        {statusDistribution.slice(0, 4).map((entry, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-600 dark:text-slate-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Type Distribution Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Distribution par Type</h3>
                        <FolderOpen className="w-4 h-4 text-brand-500" />
                    </div>
                    {typeDistribution.length > 0 ? (
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={activeTypeIndex}
                                        activeShape={renderActiveShape}
                                        data={typeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setActiveTypeIndex(index)}
                                    >
                                        {typeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                            Aucun document
                        </div>
                    )}
                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                        {typeDistribution.slice(0, 4).map((entry, index) => (
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
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activité (6 mois)</h3>
                        <TrendingUp className="w-4 h-4 text-brand-500" />
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
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
                            <span className="text-slate-600 dark:text-slate-400">Créés</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.success }} />
                            <span className="text-slate-600 dark:text-slate-400">Modifiés</span>
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
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <History className="w-4 h-4 text-warning-500" />
                            Expiration Prochaine (30j)
                        </h3>
                        <Badge className="bg-warning-500/10 text-warning-600 border-warning-500/20 text-[10px]">
                            {expiringDocuments.length} docs
                        </Badge>
                    </div>
                    {expiringDocuments.length > 0 ? (
                        <div className="space-y-3">
                            {expiringDocuments.map((doc, index) => {
                                const daysUntil = Math.ceil((new Date(doc.nextReviewDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div
                                        key={doc.id}
                                        className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                                daysUntil <= 7 ? "bg-red-500/10 text-red-600" : "bg-warning-500/10 text-warning-600"
                                            )}>
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                    {doc.title}
                                                </div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                    {doc.type}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "text-[10px]",
                                            daysUntil <= 7 ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-warning-500/10 text-warning-600 border-warning-500/20"
                                        )}>
                                            {daysUntil}j
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-[150px] flex flex-col items-center justify-center text-slate-500">
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
                    className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden"
                >
                    <TechCorners />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-brand-500" />
                            Résumé Documentaire
                        </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-slate-500" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Edit className="w-4 h-4 text-slate-500" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Brouillons</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.drafts}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-brand-500" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Sécurisés</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.secure}</div>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Ce Mois</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
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
