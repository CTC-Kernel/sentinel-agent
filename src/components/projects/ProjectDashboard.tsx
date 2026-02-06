import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Project, ProjectMilestone, Risk } from '../../types';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Calendar, CheckCircle2, Clock, Layers } from '../ui/Icons';
import {
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
    Sector
} from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { SENTINEL_PALETTE, SEVERITY_COLORS } from '../../theme/chartTheme';
import { RISK_LEVELS } from '../../constants/RiskConstants';
import { useLocale } from '@/hooks/useLocale';
import { SentinelPieActiveShapeProps } from '../../types/charts';

interface ProjectDashboardProps {
    project: Project;
    milestones: ProjectMilestone[];
    relatedRisks: Risk[];
}

// Premium activeShape for interactive pie
const renderActiveShape = (props: SentinelPieActiveShapeProps) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
    const cyValue = cy ?? 0;
    const innerR = innerRadius ?? 0;
    const outerR = outerRadius ?? 0;
    const percentValue = percent ?? 0;

    return (
        <g>
            <text x={cx} y={cyValue - 8} textAnchor="middle" className="fill-foreground font-black text-base">
                {payload.name}
            </text>
            <text x={cx} y={cyValue + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
                {payload.value} ({(percentValue * 100).toFixed(0)}%)
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerR - 6}
                outerRadius={outerR + 10}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#projectGlow)' }}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={innerR - 4}
                outerRadius={outerR}
                fill={fill}
                stroke="none"
            />
        </g>
    );
};

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, milestones, relatedRisks }) => {
    const { config } = useLocale();
    const [activeTaskIndex, setActiveTaskIndex] = useState<number | null>(null);

    // Calculate project health
    const projectHealth = useMemo(() => {
        const tasks = project.tasks || [];
        const completedTasks = tasks.filter(t => t.status === 'Terminé').length;
        const totalTasks = tasks.length;
        const progressRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        const dueDate = new Date(project.dueDate);
        const now = new Date();
        const totalDuration = dueDate.getTime() - new Date(project.createdAt).getTime();
        const elapsed = now.getTime() - new Date(project.createdAt).getTime();
        const expectedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        const onSchedule = progressRate >= expectedProgress * 0.9;

        const criticalRisks = relatedRisks.filter(r => r.score >= RISK_LEVELS.HIGH.min).length;

        let healthScore = 100;
        if (!onSchedule) healthScore -= 30;
        if (criticalRisks > 0) healthScore -= criticalRisks * 10;
        if (progressRate < 20 && elapsed > totalDuration * 0.3) healthScore -= 20;

        return {
            score: Math.max(0, healthScore),
            status: healthScore >= 70 ? 'good' : healthScore >= 40 ? 'warning' : 'critical',
            onSchedule,
            progressRate,
            expectedProgress,
            completedTasks,
            totalTasks
        };
    }, [project, relatedRisks]);

    // Task distribution with colors
    const taskDistribution = useMemo(() => [
        { name: 'À faire', value: (project.tasks || []).filter(t => t.status === 'À faire').length, color: 'hsl(var(--muted-foreground) / 0.55)' },
        { name: 'En cours', value: (project.tasks || []).filter(t => t.status === 'En cours').length, color: SENTINEL_PALETTE.secondary },
        { name: 'Terminé', value: (project.tasks || []).filter(t => t.status === 'Terminé').length, color: SENTINEL_PALETTE.success }
    ].filter(d => d.value > 0), [project.tasks]);

    // Tasks by Priority
    const tasksByPriority = useMemo(() => [
        { name: 'Haute', value: (project.tasks || []).filter(t => t.priority === 'high').length, color: SEVERITY_COLORS.critical },
        { name: 'Moyenne', value: (project.tasks || []).filter(t => t.priority === 'medium').length, color: SEVERITY_COLORS.medium },
        { name: 'Faible', value: (project.tasks || []).filter(t => t.priority === 'low').length, color: SEVERITY_COLORS.info }
    ], [project.tasks]);

    // Milestone progress
    const milestoneStats = useMemo(() => {
        const achieved = milestones.filter(m => m.status === 'achieved').length;
        const missed = milestones.filter(m => m.status === 'missed').length;
        const pending = milestones.filter(m => m.status === 'pending').length;
        const total = milestones.length;
        const rate = total > 0 ? (achieved / total) * 100 : 0;
        return { achieved, missed, pending, total, rate };
    }, [milestones]);

    // Gauge data
    const healthGaugeData = [{ name: 'Santé', value: projectHealth.score, fill: 'url(#projectHealthGradient)' }];

    return (
        <div className="space-y-6">
            {/* SVG Defs */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="projectGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="projectHealthGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={projectHealth.status === 'good' ? SENTINEL_PALETTE.success : projectHealth.status === 'warning' ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
                        <stop offset="100%" stopColor={projectHealth.status === 'good' ? 'hsl(var(--success))' : projectHealth.status === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--error))'} />
                    </linearGradient>
                    <linearGradient id="projectProgressGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Hero Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-premium p-6 md:p-8 rounded-3xl relative overflow-hidden"
            >
                {/* Tech Corners */}
                <svg className="absolute top-6 left-6 w-4 h-4 text-muted-foreground/30" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-6 right-6 w-4 h-4 text-muted-foreground/30 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 left-6 w-4 h-4 text-muted-foreground/30 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 right-6 w-4 h-4 text-muted-foreground/30 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-3xl -mr-32 -mt-32" />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 relative z-decorator">
                    {/* Health Score Gauge */}
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="h-[120px] w-[120px]">
                                <ResponsiveContainer width="100%" height="100%" >
                                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                        <Pie
                                            data={healthGaugeData}
                                            cx="50%"
                                            cy="85%"
                                            startAngle={180}
                                            endAngle={0}
                                            innerRadius="65%"
                                            outerRadius="95%"
                                            dataKey="value"
                                            stroke="none"
                                            cornerRadius={10}
                                            paddingAngle={0}
                                        >
                                            <Cell
                                                fill="url(#projectHealthGradient)"
                                                style={{ filter: 'url(#projectGlow)' }}
                                            />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
                                <div className={`text-3xl font-black bg-gradient-to-r ${projectHealth.status === 'good' ? 'from-emerald-600 to-emerald-400' : projectHealth.status === 'warning' ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
                                    {projectHealth.score.toFixed(0)}%
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="heading-3 mb-1">Santé du Projet</h3>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                {projectHealth.status === 'good' ? 'Le projet est sur la bonne voie.' : projectHealth.status === 'warning' ? 'Attention requise sur certains points.' : 'Situation critique, action immédiate requise.'}
                            </p>
                        </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="flex-1 grid grid-cols-2 gap-6 border-l border-r border-border/50 px-6 mx-2">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="p-2 bg-primary/10 rounded-3xl">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                </div>
                            </div>
                            <div className="text-2xl font-black bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                {Math.round(projectHealth.progressRate)}%
                            </div>
                            <div className="mono-label mb-2">Progression</div>
                            <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-1000" style={{ width: `${projectHealth.progressRate}%` }} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Attendue: {Math.round(projectHealth.expectedProgress)}%</div>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="p-2 bg-violet-500/10 rounded-3xl">
                                    <Target className="h-4 w-4 text-violet-500" />
                                </div>
                            </div>
                            <div className="text-2xl font-black bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                                {milestoneStats.achieved}/{milestoneStats.total}
                            </div>
                            <div className="mono-label mb-2">Jalons</div>
                            <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-1000" style={{ width: `${milestoneStats.rate}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className="flex flex-col gap-3 min-w-[180px]">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className={`flex items-center gap-3 text-sm px-4 py-3 rounded-3xl border ${projectHealth.onSchedule ? 'text-success-text bg-success-bg border-success-border' : 'text-warning-text bg-warning-bg border-warning-border'}`}
                        >
                            {projectHealth.onSchedule ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
                            <span className="font-bold">{projectHealth.onSchedule ? 'Planning OK' : 'Retard Planning'}</span>
                        </motion.div>

                        {relatedRisks.filter(r => r.score >= RISK_LEVELS.HIGH.min).length > 0 && (
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="flex items-center gap-3 text-sm text-error-text bg-error-bg px-4 py-3 rounded-3xl border border-error-border"
                            >
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span className="font-bold">{relatedRisks.filter(r => r.score >= RISK_LEVELS.HIGH.min).length} Risques Élevés+</span>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Distribution Interactive Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none rounded-3xl" />
                    <h4 className="heading-4 mb-4 flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-3xl">
                            <Layers className="w-4 h-4 text-primary" />
                        </div>
                        Distribution des Tâches
                    </h4>
                    <div className="h-[280px]">
                        {(!project.tasks || project.tasks.length === 0) ? (
                            <EmptyChartState variant="pie" message="Aucune tâche" description="Ajoutez des tâches au projet pour voir la distribution." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" >
                                <PieChart>
                                    <defs>
                                        {taskDistribution.map((entry, idx) => (
                                            <linearGradient key={idx || 'unknown'} id={`projectTaskGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={taskDistribution}
                                        cx="50%"
                                        cy="50%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        innerRadius={60}
                                        outerRadius={80}
                                        activeIndex={activeTaskIndex !== null ? activeTaskIndex : undefined}
                                        activeShape={renderActiveShape as Pie['props']['activeShape']}
                                        onMouseEnter={(_, index) => setActiveTaskIndex(index)}
                                        onMouseLeave={() => setActiveTaskIndex(null)}
                                    >  {taskDistribution.map((_, index) => (
                                        <Cell key={`cell-${index || 'unknown'}`} fill={`url(#projectTaskGrad${index})`} className="cursor-pointer" />
                                    ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={10}
                                        formatter={(value) => <span className="caption ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Tasks by Priority */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-3xl">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                        Tâches par Priorité
                    </h4>
                    <div className="h-[280px]">
                        {(!project.tasks || project.tasks.length === 0) ? (
                            <EmptyChartState variant="bar" message="Priorités non définies" description="Les priorités s'afficheront une fois les tâches créées." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" >
                                <BarChart data={tasksByPriority} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
                                    <Bar dataKey="value" name="Tâches" radius={[8, 8, 0, 0]} barSize={40} animationDuration={1200}>
                                        {tasksByPriority.map((entry, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Burndown Chart - requires historical task completion data */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
            >
                <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2 relative z-decorator">
                    <div className="p-2 bg-emerald-500/10 rounded-3xl">
                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                    </div>
                    Burndown Chart
                </h4>
                <div className="h-[280px] relative z-decorator">
                    <EmptyChartState
                        variant="bar"
                        message="Données insuffisantes"
                        description="Le burndown chart nécessite un historique de complétion des tâches. Les données seront disponibles après plusieurs sprints."
                    />
                </div>
            </motion.div>

            {/* Milestones Timeline */}
            {milestones.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-6 flex items-center gap-2 uppercase tracking-wider">
                        <div className="p-2 bg-violet-500/10 rounded-3xl">
                            <Calendar className="h-4 w-4 text-violet-500" />
                        </div>
                        Jalons du Projet
                    </h4>
                    <div className="space-y-4">
                        {milestones.map((milestone, index) => (
                            <motion.div
                                key={milestone.id || 'unknown'}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.25 + index * 0.05 }}
                                className="flex items-center gap-4 group"
                            >
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black text-white shadow-lg transition-transform group-hover:scale-110 ${milestone.status === 'achieved'
                                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                                    : milestone.status === 'missed'
                                        ? 'bg-gradient-to-br from-red-400 to-red-600'
                                        : 'bg-gradient-to-br from-slate-400 to-slate-600'
                                    }`}>
                                    {milestone.status === 'achieved' ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : milestone.status === 'missed' ? (
                                        <AlertTriangle className="w-5 h-5" />
                                    ) : (
                                        <Clock className="w-5 h-5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{milestone.title}</span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {new Date(milestone.targetDate).toLocaleDateString(config.intlLocale)}
                                        </span>
                                    </div>
                                    {milestone.description && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{milestone.description}</p>
                                    )}
                                </div>
                                <div className={`px-3 py-1.5 rounded-3xl text-xs font-bold ${milestone.status === 'achieved'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : milestone.status === 'missed'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : 'bg-muted text-muted-foreground '
                                    }`}>
                                    {milestone.status === 'achieved' ? 'Atteint' : milestone.status === 'missed' ? 'Manqué' : 'En attente'}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};
