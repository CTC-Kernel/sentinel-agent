import React from 'react';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { useStore } from '../store';
import { ActivityLogList } from '../components/activity/ActivityLogList';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Activity, RefreshCw, Download, Shield, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../components/ui/animationVariants';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { CustomSelect } from '../components/ui/CustomSelect';

export const ActivityLogs: React.FC = () => {
    const { t } = useStore();
    const { logs, loading, hasMore, loadMore, refresh, filter, setFilter, stats, exportLogs } = useActivityLogs();

    return (
        <div className="relative min-h-screen">
            <MasterpieceBackground />
            <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto">
                <PageHeader
                    title={t('activity.title')}
                    subtitle={t('activity.subtitle')}
                    icon={<Activity className="h-6 w-6 text-white" />}
                    actions={
                        <div className="flex items-center gap-2">
                            <button
                                aria-label={t('activity.exportCsv')}
                                onClick={exportLogs}
                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors text-sm font-medium"
                            >
                                <Download className="h-4 w-4" />
                                <span>{t('activity.exportCsv')}</span>
                            </button>
                            <button
                                onClick={refresh}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                                title={t('activity.refresh')}
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
                            { label: t('activity.stats.today'), value: stats?.scansToday || 0, icon: Activity, color: 'text-blue-500' },
                            { label: t('activity.stats.critical'), value: stats?.criticalAlerts || 0, icon: AlertTriangle, color: 'text-red-500' },
                            { label: t('activity.stats.admins'), value: stats?.activeAdmins || 0, icon: Shield, color: 'text-emerald-500' },
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
                        searchPlaceholder={t('activity.searchPlaceholder')}
                        actions={
                            <div className="flex items-center gap-2">
                                <div className="w-40">
                                    <CustomSelect
                                        value={filter.severity}
                                        onChange={(val) => setFilter(prev => ({ ...prev, severity: val as string }))}
                                        options={[
                                            { label: t('activity.filters.all'), value: 'all' },
                                            { label: t('activity.filters.info'), value: 'info' },
                                            { label: t('activity.filters.warning'), value: 'warning' },
                                            { label: t('activity.filters.danger'), value: 'danger' },
                                        ]}
                                        placeholder={t('activity.severity')}
                                    />
                                </div>
                                <div className="w-48">
                                    <CustomSelect
                                        value={filter.dateRange}
                                        onChange={(val) => setFilter(prev => ({ ...prev, dateRange: val as string }))}
                                        options={[
                                            { label: t('activity.filters.undefined'), value: 'all' },
                                            { label: t('activity.filters.today'), value: 'today' },
                                            { label: t('activity.filters.week'), value: 'week' },
                                            { label: t('activity.filters.month'), value: 'month' },
                                        ]}
                                        placeholder={t('activity.period')}
                                    />
                                </div>
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


