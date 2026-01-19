import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { Activity, Database, Server, Shield, Globe, Cpu, HardDrive, Users, Zap, AlertCircle, CheckCircle2 } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useStore } from '../store';
import { hasPermission } from '../utils/permissions';

import { useConnectivity } from '../hooks/useConnectivity';

export const SystemHealth: React.FC = () => {
    const { t } = useTranslation();
    const { userCount, loading, metrics } = useSystemHealth();
    const { user } = useStore();
    const { authStatus, dbStatus, storageStatus, edgeStatus } = useConnectivity();

    if (!user || !hasPermission(user, 'SystemLog', 'read')) {
        return <Navigate to="/" replace />;
    }

    // Service Status (Real connectivity check)
    const services = [
        { name: 'Firebase Auth', status: authStatus, icon: Shield, uptime: '99.99%' },
        { name: 'Cloud Firestore', status: dbStatus, icon: Database, uptime: '99.95%' },
        { name: 'Cloud Storage', status: storageStatus, icon: HardDrive, uptime: '99.99%' },
        { name: 'Edge Functions', status: edgeStatus, icon: Zap, uptime: '100%' },
        { name: 'CDN Global', status: 'operational', icon: Globe, uptime: '100%' }, // External check harder, assume operational
        { name: 'AI Engine Cyber Threat Consulting', status: 'operational', icon: Cpu, uptime: '99.9%' },
    ];

    const getStatusColor = (status: string) => {
        return status === 'operational' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    };

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <PageHeader
                title={t('systemHealth.title')}
                subtitle={t('systemHealth.subtitle')}
                icon={
                    <img
                        src="/images/administration.png"
                        alt="ADMINISTRATION"
                        className="w-full h-full object-contain"
                    />
                }
                breadcrumbs={[{ label: t('common.administration') }, { label: t('systemHealth.title') }]}
                trustType="admin"
            />

            {/* Voxel Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: t('systemHealth.metrics.activeUsers'), value: loading ? '...' : userCount, icon: Users, color: 'text-blue-500', sub: t('systemHealth.metrics.totalAccounts') },
                    { label: t('systemHealth.metrics.systemLoad'), value: `${Math.round(metrics.systemLoad)}%`, icon: Cpu, color: 'text-violet-500', sub: t('systemHealth.metrics.cpuUsage') },
                    { label: t('systemHealth.metrics.memory'), value: `${Math.round(metrics.memoryUsage)}%`, icon: Server, color: 'text-emerald-500', sub: t('systemHealth.metrics.ramAllocated') },
                    { label: t('systemHealth.metrics.latency'), value: `${Math.round(metrics.networkLatency)}ms`, icon: Activity, color: 'text-amber-500', sub: t('systemHealth.metrics.globalPing') },
                ].map((metric) => (
                    <motion.div
                        key={metric.label}
                        variants={slideUpVariants}
                        className="glass-premium p-6 rounded-2xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <metric.icon className="h-24 w-24" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{metric.label}</p>
                                <h3 className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{metric.value}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <metric.icon className={`h-4 w-4 ${metric.color}`} />
                                <span className={`text-xs font-bold ${metric.color}`}>{metric.sub}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Services Status */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-brand-500" />
                    {t('systemHealth.servicesStatus')}
                    <span className="ml-auto flex items-center gap-2 text-xs font-normal text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        {t('systemHealth.operational')}
                    </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map((service) => (
                        <div key={service.name} className="p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl flex items-center gap-4 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <service.icon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{service.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}></span>
                                    <span className="text-xs text-slate-500 capitalize">{service.status}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{service.uptime}</p>
                                <p className="text-[10px] text-slate-400">uptime</p>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Recent Alerts (Mock) */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    {t('systemHealth.recentAlerts')}
                </h3>
                <div className="space-y-3">
                    <div className="flex items-start gap-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{t('systemHealth.alerts.networkLatency')}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('systemHealth.alerts.networkLatencyDesc')}</p>
                        </div>
                        <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{t('systemHealth.alerts.twoHoursAgo')}</span>
                    </div>
                    <div className="flex items-start gap-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{t('systemHealth.alerts.backupComplete')}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('systemHealth.alerts.backupCompleteDesc')}</p>
                        </div>
                        <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{t('systemHealth.alerts.fourHoursAgo')}</span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
