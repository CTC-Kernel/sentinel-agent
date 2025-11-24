import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    ShieldAlert,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    Users,
    Server,
    Calendar,
    Download
} from '../ui/Icons';
import { useStore } from '../../store';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Risk, Asset, Incident, Audit, Control, Project } from '../../types';
import { StatCard } from '../ui/StatCard';
import { ProgressRing } from '../ui/ProgressRing';
import { DataTable, Column } from '../ui/DataTable';

interface TrendData {
    date: string;
    risks: number;
    incidents: number;
    compliance: number;
    assets: number;
}

interface CategoryData {
    name: string;
    value: number;
    color: string;
}

export const AnalyticsDashboard: React.FC = () => {
    const { user } = useStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

    // Data states
    const [risks, setRisks] = useState<Risk[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [controls, setControls] = useState<Control[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchData = async () => {
            try {
                const orgId = user.organizationId;

                const [risksSnap, assetsSnap, incidentsSnap, auditsSnap, controlsSnap, projectsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'assets'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'audits'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId)))
                ]);

                setRisks(risksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk)));
                setAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
                setIncidents(incidentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Incident)));
                setAudits(auditsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Audit)));
                setControls(controlsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Control)));
                setProjects(projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));

                setLoading(false);
            } catch (error) {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    // Calculate metrics
    const metrics = useMemo(() => {
        const criticalRisks = risks.filter(r => (r.score || 0) >= 15).length;
        const openIncidents = incidents.filter(i => i.status !== 'Résolu').length;
        const complianceRate = controls.length > 0
            ? (controls.filter(c => c.status === 'Implémenté').length / controls.length) * 100
            : 0;
        const activeProjects = projects.filter(p => p.status === 'En cours').length;

        // Calculate trends (mock for now - would need historical data)
        const riskTrend = 5.2;
        const incidentTrend = -12.3;
        const complianceTrend = 8.1;
        const projectTrend = 3.4;

        return {
            criticalRisks,
            openIncidents,
            complianceRate,
            activeProjects,
            trends: { riskTrend, incidentTrend, complianceTrend, projectTrend }
        };
    }, [risks, incidents, controls, projects]);

    // Trend data for charts
    const trendData: TrendData[] = useMemo(() => {
        // Mock data - in production, this would come from historical stats
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const data: TrendData[] = [];

        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            data.push({
                date: date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                risks: Math.floor(Math.random() * 20) + risks.length - 10,
                incidents: Math.floor(Math.random() * 10) + incidents.length - 5,
                compliance: Math.floor(Math.random() * 10) + metrics.complianceRate - 5,
                assets: Math.floor(Math.random() * 30) + assets.length - 15
            });
        }

        return data;
    }, [timeRange, risks, incidents, assets, metrics.complianceRate]);

    // Risk distribution by category
    const risksByCategory: CategoryData[] = useMemo(() => {
        const categories: Record<string, number> = {};

        risks.forEach(risk => {
            const category = (risk as any).category || 'Autre';
            categories[category] = (categories[category] || 0) + 1;
        });

        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

        return Object.entries(categories).map(([name, value], idx) => ({
            name,
            value,
            color: colors[idx % colors.length]
        }));
    }, [risks]);

    // Top risks table columns
    const topRisksColumns: Column<Risk>[] = [
        {
            key: 'threat',
            label: 'Menace',
            render: (value) => <span className="font-medium">{value}</span>
        },
        {
            key: 'score',
            label: 'Score',
            render: (value) => (
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${value >= 15 ? 'bg-red-100 text-red-700' :
                    value >= 10 ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                    }`}>
                    {value}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Statut',
            render: (value) => value || 'Ouvert'
        },
        {
            key: 'responsable',
            label: 'Responsable',
            render: (value) => value || '-'
        }
    ];

    const topRisks = useMemo(() => {
        return [...risks]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 10);
    }, [risks]);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Analytics Dashboard
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        Vue d'ensemble des métriques et tendances de sécurité
                    </p>
                </div>

                {/* Time range selector */}
                <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                    {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${timeRange === range
                                ? 'bg-brand-600 text-white'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : range === '90d' ? '90 jours' : '1 an'}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Risques Critiques"
                    value={metrics.criticalRisks}
                    icon={AlertTriangle}
                    colorClass="bg-red-500"
                    trend={{ value: metrics.trends.riskTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/risks')}
                    sparklineData={trendData.slice(-7).map(d => d.risks)}
                />

                <StatCard
                    title="Incidents Ouverts"
                    value={metrics.openIncidents}
                    icon={Activity}
                    colorClass="bg-orange-500"
                    trend={{ value: metrics.trends.incidentTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/incidents')}
                    sparklineData={trendData.slice(-7).map(d => d.incidents)}
                />

                <StatCard
                    title="Conformité"
                    value={`${Math.round(metrics.complianceRate)}%`}
                    icon={CheckCircle2}
                    colorClass="bg-green-500"
                    trend={{ value: metrics.trends.complianceTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/compliance')}
                    sparklineData={trendData.slice(-7).map(d => d.compliance)}
                />

                <StatCard
                    title="Projets Actifs"
                    value={metrics.activeProjects}
                    icon={Clock}
                    colorClass="bg-blue-500"
                    trend={{ value: metrics.trends.projectTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/projects')}
                    sparklineData={trendData.slice(-7).map(d => d.assets)}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                        Évolution des Risques et Incidents
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorRisks" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                            <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                    padding: '12px'
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="risks"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorRisks)"
                                name="Risques"
                            />
                            <Area
                                type="monotone"
                                dataKey="incidents"
                                stroke="#f59e0b"
                                fillOpacity={1}
                                fill="url(#colorIncidents)"
                                name="Incidents"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Compliance Progress */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                        Taux de Conformité ISO 27001
                    </h3>
                    <div className="flex items-center justify-center h-[300px]">
                        <ProgressRing
                            progress={metrics.complianceRate}
                            size={200}
                            strokeWidth={12}
                            color="#10b981"
                            label="Conformité"
                        />
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold text-green-600">{controls.filter(c => c.status === 'Implémenté').length}</p>
                            <p className="text-xs text-slate-500">Implémentés</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-orange-600">{controls.filter(c => c.status === 'Partiel').length}</p>
                            <p className="text-xs text-slate-500">Partiels</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-600">{controls.filter(c => c.status === 'Non commencé').length}</p>
                            <p className="text-xs text-slate-500">Non commencés</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                    Distribution des Risques par Catégorie
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={risksByCategory}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {risksByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Top Risks Table */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Top 10 Risques Critiques
                    </h3>
                    <button
                        onClick={() => navigate('/risks')}
                        className="text-sm font-bold text-brand-600 hover:text-brand-700 flex items-center gap-2"
                    >
                        Voir tous les risques
                        <TrendingUp className="h-4 w-4" />
                    </button>
                </div>

                <DataTable
                    data={topRisks}
                    columns={topRisksColumns}
                    onRowClick={(risk) => navigate(`/risks?id=${risk.id}`)}
                    exportable
                    exportFilename="top_risques"
                    searchable
                    pageSize={5}
                />
            </div>
        </div>
    );
};
