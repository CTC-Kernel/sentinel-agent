import React, { useMemo } from 'react';
import { Project, ProjectMilestone, Risk } from '../../types';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Target,
    Calendar
} from '../ui/Icons';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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



    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

                {/* Global Health Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${projectHealth.status === 'good' ? 'text-emerald-500' : projectHealth.status === 'warning' ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={276}
                                strokeDashoffset={276 - (276 * projectHealth.score) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{projectHealth.score.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Santé du Projet</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            {projectHealth.status === 'good' ? 'Le projet est sur la bonne voie.' : projectHealth.status === 'warning' ? 'Attention requise sur certains points.' : 'Situation critique, action immédiate requise.'}
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-2 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progression</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{Math.round(projectHealth.progressRate)}%</div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${projectHealth.progressRate}%` }}></div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Attendue: {Math.round(projectHealth.expectedProgress)}%</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jalons</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{milestones.filter(m => m.status === 'achieved').length}/{milestones.length}</div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${milestoneProgress}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <div className={`flex items-center justify-between p-2.5 rounded-xl border ${projectHealth.onSchedule ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'}`}>
                        <div className="flex items-center gap-2">
                            {projectHealth.onSchedule ? <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                            <span className={`text-xs font-bold ${projectHealth.onSchedule ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>Planning</span>
                        </div>
                        <span className={`text-sm font-black ${projectHealth.onSchedule ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{projectHealth.onSchedule ? 'OK' : 'Retard'}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">Risques Critiques</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{relatedRisks.filter(r => r.score >= 15).length}</span>
                    </div>
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
                                    wrapperStyle={{ paddingTop: '20px' }}
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
