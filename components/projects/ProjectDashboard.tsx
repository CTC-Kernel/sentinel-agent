import React, { useMemo } from 'react';
import { Project, ProjectMilestone, Risk } from '../../types';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    Target,
    Calendar
} from '../ui/Icons';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { ChartTooltip } from '../ui/ChartTooltip';

interface ProjectDashboardProps {
    project: Project;
    milestones: ProjectMilestone[];
    relatedRisks: Risk[];
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, milestones, relatedRisks }) => {
    // Calculate project health
    const projectHealth = useMemo(() => {
        const tasks = project.tasks || [];
        const completedTasks = tasks.filter(t => t.status === 'Terminé').length;
        const totalTasks = tasks.length;
        const progressRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Check if on schedule
        const dueDate = new Date(project.dueDate);
        const now = new Date();
        const totalDuration = dueDate.getTime() - new Date(project.createdAt).getTime();
        const elapsed = now.getTime() - new Date(project.createdAt).getTime();
        const expectedProgress = (elapsed / totalDuration) * 100;
        const onSchedule = progressRate >= expectedProgress * 0.9; // 90% threshold

        // Count critical risks
        const criticalRisks = relatedRisks.filter(r => r.score >= 15).length;

        // Calculate health score
        let healthScore = 100;
        if (!onSchedule) healthScore -= 30;
        if (criticalRisks > 0) healthScore -= criticalRisks * 10;
        if (progressRate < 20 && elapsed > totalDuration * 0.3) healthScore -= 20;

        return {
            score: Math.max(0, healthScore),
            status: healthScore >= 70 ? 'good' : healthScore >= 40 ? 'warning' : 'critical',
            onSchedule,
            progressRate,
            expectedProgress
        };
    }, [project, relatedRisks]);

    // Task distribution
    const taskDistribution = useMemo(() => {
        const tasks = project.tasks || [];
        return [
            { name: 'À faire', value: tasks.filter(t => t.status === 'A faire').length, color: '#94a3b8' },
            { name: 'En cours', value: tasks.filter(t => t.status === 'En cours').length, color: '#3b82f6' },
            { name: 'Terminé', value: tasks.filter(t => t.status === 'Terminé').length, color: '#10b981' }
        ];
    }, [project.tasks]);

    // Burndown data (simulated - would need historical data in production)
    const burndownData = useMemo(() => {
        const tasks = project.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Terminé').length;
        const remainingTasks = totalTasks - completedTasks;

        // Simulate weekly progress
        const weeks = 8;
        const data = [];
        for (let i = 0; i <= weeks; i++) {
            const ideal = totalTasks - (totalTasks / weeks) * i;
            const actual = i === weeks ? remainingTasks : totalTasks - (completedTasks / weeks) * i;
            data.push({
                week: `S${i}`,
                ideal: Math.max(0, ideal),
                actual: Math.max(0, actual)
            });
        }
        return data;
    }, [project.tasks]);

    // Milestone progress
    const milestoneProgress = useMemo(() => {
        const achieved = milestones.filter(m => m.status === 'achieved').length;
        const total = milestones.length;
        return total > 0 ? (achieved / total) * 100 : 0;
    }, [milestones]);

    const getHealthColor = (status: string) => {
        switch (status) {
            case 'good': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
            case 'warning': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
            case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Health Indicator */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Santé du Projet
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Overall Health */}
                    <CustomTooltip content="Score calculé sur l'avancement, les délais et les risques" position="top" className="w-full">
                        <div className={`p-4 rounded-xl ${getHealthColor(projectHealth.status)}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold uppercase tracking-wider">Score Global</span>
                                {projectHealth.status === 'good' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="text-3xl font-bold">{projectHealth.score}%</div>
                            <div className="text-xs mt-1 opacity-80">
                                {projectHealth.status === 'good' ? 'Excellent' : projectHealth.status === 'warning' ? 'Attention' : 'Critique'}
                            </div>
                        </div>
                    </CustomTooltip>

                    {/* Progress */}
                    <CustomTooltip content={`Progression attendue: ${Math.round(projectHealth.expectedProgress)}%`} position="top" className="w-full">
                        <div className="p-4 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold uppercase tracking-wider">Progression</span>
                                {projectHealth.onSchedule ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                            </div>
                            <div className="text-3xl font-bold">{Math.round(projectHealth.progressRate)}%</div>
                            <div className="text-xs mt-1 opacity-80">
                                {projectHealth.onSchedule ? 'Dans les temps' : 'En retard'}
                            </div>
                        </div>
                    </CustomTooltip>

                    {/* Milestones */}
                    <CustomTooltip content={`${milestones.filter(m => m.status === 'achieved').length} jalons atteints sur ${milestones.length}`} position="top" className="w-full">
                        <div className="p-4 rounded-xl bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold uppercase tracking-wider">Jalons</span>
                                <Target className="h-5 w-5" />
                            </div>
                            <div className="text-3xl font-bold">{milestones.filter(m => m.status === 'achieved').length}/{milestones.length}</div>
                            <div className="text-xs mt-1 opacity-80">
                                {Math.round(milestoneProgress)}% atteints
                            </div>
                        </div>
                    </CustomTooltip>

                    {/* Risks */}
                    <CustomTooltip content={`${relatedRisks.filter(r => r.score >= 15).length} risques critiques identifiés`} position="top" className="w-full">
                        <div className="p-4 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold uppercase tracking-wider">Risques</span>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div className="text-3xl font-bold">{relatedRisks.filter(r => r.score >= 15).length}</div>
                            <div className="text-xs mt-1 opacity-80">
                                Critiques ({relatedRisks.length} total)
                            </div>
                        </div>
                    </CustomTooltip>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 uppercase tracking-wider">Distribution des Tâches</h4>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={taskDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {taskDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} cursor={false} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Burndown Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-6 uppercase tracking-wider">Burndown Chart</h4>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={burndownData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                                <XAxis
                                    dataKey="week"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    dx={-10}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="ideal"
                                    stroke="#94a3b8"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Idéal"
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    name="Réel"
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Milestones Timeline */}
            {milestones.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Jalons du Projet
                    </h4>
                    <div className="space-y-3">
                        {milestones.map((milestone, index) => (
                            <div key={milestone.id} className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${milestone.status === 'achieved'
                                    ? 'bg-green-500 text-white'
                                    : milestone.status === 'missed'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}>
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white">{milestone.title}</span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(milestone.targetDate).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                    {milestone.description && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{milestone.description}</p>
                                    )}
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${milestone.status === 'achieved'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    : milestone.status === 'missed'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                    {milestone.status === 'achieved' ? 'Atteint' : milestone.status === 'missed' ? 'Manqué' : 'En attente'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
