import React from 'react';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { ActivityLogList } from '../components/activity/ActivityLogList';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Activity, RefreshCw, Download, Shield, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../components/ui/animationVariants';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';

export const ActivityLogs: React.FC = () => {
    const { logs, loading, hasMore, loadMore, refresh, filter, setFilter, stats, exportLogs } = useActivityLogs();

    return (
        <div className="relative min-h-screen">
            <MasterpieceBackground />
            <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto">
                <PageHeader
                    title="Journal d'Activité"
                    subtitle="Traçabilité complète des actions utilisateurs et système pour la conformité ISO 27001."
                    icon={<Activity className="h-6 w-6 text-white" />}
                    actions={
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportLogs}
                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors text-sm font-medium"
                            >
                                <Download className="h-4 w-4" />
                                <span>Export CSV</span>
                            </button>
                            <button
                                onClick={refresh}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                                title="Actualiser"
                            >
                                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    }
                />

                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: "Événements Aujourd'hui", value: stats?.scansToday || 0, icon: Activity, color: 'text-blue-500' },
                            { label: "Alertes Critiques", value: stats?.criticalAlerts || 0, icon: AlertTriangle, color: 'text-red-500' },
                            { label: "Admins Actifs", value: stats?.activeAdmins || 0, icon: Shield, color: 'text-emerald-500' },
                        ].map((stat, idx) => (
                            <div key={idx} className="glass-panel p-5 rounded-2xl flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-white/50 dark:bg-white/5 ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h3>
                                </div>
                            </div>
                        ))}
                    </div>

                    <PremiumPageControl
                        searchQuery={filter.search}
                        onSearchChange={(val) => setFilter(prev => ({ ...prev, search: val }))}
                        searchPlaceholder="Rechercher par utilisateur, action ou détails..."
                        actions={
                            <div className="flex items-center gap-2">
                                <FilterDropdown
                                    label="Sévérité"
                                    value={filter.severity}
                                    onChange={(val) => setFilter(prev => ({ ...prev, severity: val }))}
                                    options={[
                                        { label: 'Toutes', value: 'all' },
                                        { label: 'Info', value: 'info' },
                                        { label: 'Avertissement', value: 'warning' },
                                        { label: 'Critique', value: 'danger' }, // Mapped to danger in types? Log hook used 'severity || info'
                                    ]}
                                />
                                <FilterDropdown
                                    label="Période"
                                    value={filter.dateRange}
                                    onChange={(val) => setFilter(prev => ({ ...prev, dateRange: val }))}
                                    options={[
                                        { label: 'Indéfini', value: 'all' },
                                        { label: "Aujourd'hui", value: 'today' },
                                        { label: '7 derniers jours', value: 'week' },
                                        { label: '30 derniers jours', value: 'month' },
                                    ]}
                                />
                            </div>
                        }
                    />

                    <div className="glass-panel p-6 rounded-2xl">
                        <ActivityLogList
                            logs={logs}
                            loading={loading}
                            hasMore={hasMore}
                            onLoadMore={loadMore}
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

// Simple Filter Dropdown Component (Local for now or move to UI later)
const FilterDropdown: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }> = ({ label, value, onChange, options }) => (
    <div className="relative inline-block flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">{label}</span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none shadow-sm"
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);
