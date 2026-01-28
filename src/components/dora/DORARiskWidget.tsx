/**
 * DORA Risk Dashboard Widget
 * Story 35-2: ICT Risk Assessment
 * Displays risk overview for ICT providers
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { AlertTriangle, TrendingUp, Clock, Shield, ChevronRight } from '../ui/Icons';
import { useICTProviders } from '../../hooks/useICTProviders';

interface DORARiskWidgetProps {
    className?: string;
}

export const DORARiskWidget: React.FC<DORARiskWidgetProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const { stats, riskStats, concentrationAnalysis, getHighRiskProviders, loading } = useICTProviders();

    const highRiskProviders = getHighRiskProviders();

    // Calculate average concentration
    const avgConcentration = concentrationAnalysis.averageConcentrationRisk || 0;

    // Risk distribution for mini chart
    const totalProviders = stats.total || 1;
    const highPct = Math.round((riskStats.highRiskCount / totalProviders) * 100);
    const mediumPct = Math.round((riskStats.mediumRiskCount / totalProviders) * 100);
    const lowPct = Math.round((riskStats.lowRiskCount / totalProviders) * 100);

    if (loading) {
        return (
            <div className={`glass-premium rounded-3xl p-6 animate-pulse border border-border/40 ${className}`}>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-3xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`glass-premium rounded-3xl p-6 border border-white/50 dark:border-white/5 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-3xl">
                        <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                            {t('dora.riskWidget.title', 'Risques ICT DORA')}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {stats.total} {t('dora.riskWidget.providers', 'fournisseurs')}
                        </p>
                    </div>
                </div>
                <NavLink
                    to="/dora/providers"
                    className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:underline"
                >
                    {t('common.viewAll', 'Voir tout')}
                    <ChevronRight className="w-4 h-4" />
                </NavLink>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                {/* High Risk */}
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-100 dark:border-red-800/30">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">
                            {t('dora.riskWidget.highRisk', 'Risque Élevé')}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {riskStats.highRiskCount}
                    </p>
                </div>

                {/* Reassessment Due */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            {t('dora.riskWidget.reassessmentDue', 'À Réévaluer')}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {riskStats.reassessmentsDueCount}
                    </p>
                </div>

                {/* Avg Concentration */}
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-800/30">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
                            {t('dora.riskWidget.avgConcentration', 'Concentration Moy.')}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {avgConcentration}%
                    </p>
                </div>

                {/* Non-EU */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-border/40 dark:border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">
                            {t('dora.riskWidget.nonEu', 'Hors UE')}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                        {concentrationAnalysis.nonEuProviders?.length || 0}
                    </p>
                </div>
            </div>

            {/* Risk Distribution Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 mb-2">
                    <span>{t('dora.riskWidget.distribution', 'Distribution des risques')}</span>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            {t('dora.riskWidget.high', 'Élevé')} ({highPct}%)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            {t('dora.riskWidget.medium', 'Moyen')} ({mediumPct}%)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {t('dora.riskWidget.low', 'Faible')} ({lowPct}%)
                        </span>
                    </div>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${highPct}%` }}
                    />
                    <div
                        className="h-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${mediumPct}%` }}
                    />
                    <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${lowPct}%` }}
                    />
                </div>
            </div>

            {/* High Risk Providers List */}
            {highRiskProviders.length > 0 && (
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 mb-2">
                        {t('dora.riskWidget.criticalProviders', 'Fournisseurs Critiques')}
                    </p>
                    <div className="space-y-2">
                        {highRiskProviders.slice(0, 3).map(provider => (
                            <div
                                key={provider.id}
                                className="flex items-center justify-between p-2 bg-red-500 dark:bg-red-50 dark:bg-red-900 rounded-lg"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[150px]">
                                        {provider.name}
                                    </span>
                                </div>
                                <span className="text-xs font-mono text-red-600 dark:text-red-400">
                                    {provider.riskAssessment?.concentration || 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
