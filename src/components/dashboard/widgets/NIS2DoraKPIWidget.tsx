import React, { useMemo } from 'react';
import { Shield, AlertTriangle, Server, CheckCircle } from 'lucide-react';
import { Incident, Supplier } from '../../../types';
import { motion } from 'framer-motion';

interface Props {
    incidents?: Incident[];
    suppliers?: Supplier[];
}

export const NIS2DoraKPIWidget: React.FC<Props> = ({ incidents = [], suppliers = [] }) => {

    // NIS2 Metrics
    const nis2Metrics = useMemo(() => {
        const significant = incidents.filter(i => i.isSignificant);
        const total = significant.length;
        const reported = significant.filter(i => i.notificationStatus === 'Reported').length;
        const pending = significant.filter(i => i.notificationStatus === 'Pending').length;
        const complianceRate = total > 0 ? Math.round((reported / total) * 100) : 100;

        return { total, reported, pending, complianceRate };
    }, [incidents]);

    // DORA Metrics
    const doraMetrics = useMemo(() => {
        const ictProviders = suppliers.filter(s => s.isICTProvider);
        const critical = ictProviders.filter(s => s.doraCriticality === 'Critical');
        const totalICT = ictProviders.length;

        // Avg Score of Critical ICT Providers
        const avgScore = critical.length > 0
            ? Math.round(critical.reduce((acc, s) => acc + (s.securityScore || 0), 0) / critical.length)
            : 0;

        return { totalICT, criticalCount: critical.length, avgScore };
    }, [suppliers]);

    return (
        <div className="glass-panel p-6 rounded-[2rem] h-full flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Shield className="w-24 h-24 text-brand-500" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Conformité NIS2 & DORA</h3>
                    <p className="text-xs text-slate-500 font-medium">Indicateurs clés de régulation</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1">
                {/* NIS 2 Section */}
                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">NIS 2</span>
                        <AlertTriangle className="w-4 h-4 text-indigo-400" />
                    </div>

                    <div className="space-y-3">
                        <div>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{nis2Metrics.total}</span>
                            <span className="text-xs text-slate-500 ml-1">Incidents Significatifs</span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">Taux de Notification</span>
                                <span className="font-bold text-slate-900 dark:text-white">{nis2Metrics.complianceRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${nis2Metrics.complianceRate}%` }}
                                    className={`h-full rounded-full ${nis2Metrics.complianceRate < 80 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* DORA Section */}
                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-emerald-100 dark:border-emerald-500/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">DORA</span>
                        <Server className="w-4 h-4 text-emerald-400" />
                    </div>

                    <div className="space-y-3">
                        <div>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{doraMetrics.criticalCount}</span>
                            <span className="text-xs text-slate-500 ml-1">Fournisseurs Critiques</span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 dark:text-slate-400">Score de Sécurité Avg</span>
                                <span className="font-bold text-slate-900 dark:text-white">{doraMetrics.avgScore}/100</span>
                            </div>
                            <div className="h-1.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${doraMetrics.avgScore}%` }}
                                    className={`h-full rounded-full ${doraMetrics.avgScore < 50 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                <div className="flex -space-x-2">
                    {/* Fake avatars or status icons could go here */}
                </div>
                {nis2Metrics.pending > 0 && (
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{nis2Metrics.pending} En attente</span>
                    </div>
                )}
                {nis2Metrics.pending === 0 && (
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                        <CheckCircle className="w-3 h-3" />
                        <span>Tout notifié</span>
                    </div>
                )}
            </div>
        </div>
    );
};
