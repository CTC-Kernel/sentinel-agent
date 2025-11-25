import React from 'react';
import { Control } from '../../types';
import { CheckCircle2, AlertTriangle, ShieldAlert } from '../ui/Icons';

interface ComplianceScorecardProps {
    controls: Control[];
    trend?: number;
}

export const ComplianceScorecard: React.FC<ComplianceScorecardProps> = ({ controls, trend }) => {
    // Group controls by domain (assuming code starts with A.5, A.6 etc or similar)
    // For ISO 27001:2022, domains are 5, 6, 7, 8.
    // Let's try to parse the domain from the code (e.g., "5.1" -> Domain 5)

    const domains = [
        { id: '5', name: 'Organisationnelle', color: 'bg-blue-500' },
        { id: '6', name: 'Personnes', color: 'bg-purple-500' },
        { id: '7', name: 'Physique', color: 'bg-emerald-500' },
        { id: '8', name: 'Technologique', color: 'bg-orange-500' }
    ];

    const stats = domains.map(domain => {
        const domainControls = controls.filter(c => c.code.startsWith(domain.id) || c.code.startsWith(`A.${domain.id}`));
        const implemented = domainControls.filter(c => c.status === 'Implémenté').length;
        const total = domainControls.length;
        const score = total > 0 ? Math.round((implemented / total) * 100) : 0;
        return { ...domain, score, total, implemented };
    });

    const totalScore = Math.round(
        (controls.filter(c => c.status === 'Implémenté').length / (controls.length || 1)) * 100
    );

    return (
        <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 h-full">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scorecard Conformité</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">ISO 27001:2022</p>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-lg">
                        {totalScore}%
                    </div>
                    {trend !== undefined && (
                        <span className={`text-xs font-bold mt-1 ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {trend > 0 ? '+' : ''}{trend}%
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-5">
                {stats.map(stat => (
                    <div key={stat.id}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{stat.name}</span>
                            <span className="text-xs font-bold text-slate-500">{stat.score}% ({stat.implemented}/{stat.total})</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${stat.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${stat.score}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {controls.filter(c => c.status === 'Implémenté').length} Implémentés
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {controls.filter(c => c.status === 'Partiel').length} Partiels
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 whitespace-nowrap">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    {controls.filter(c => c.status === 'Non commencé').length} À faire
                </div>
            </div>
        </div>
    );
};
