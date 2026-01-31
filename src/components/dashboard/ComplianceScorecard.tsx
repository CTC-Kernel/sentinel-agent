import React from 'react';
import { Control } from '../../types';
import { CheckCircle2, AlertTriangle, ShieldAlert } from '../ui/Icons';
import { useLocale } from '../../hooks/useLocale';

interface ComplianceScorecardProps {
    controls: Control[];
    trend?: number;
}

export const ComplianceScorecard: React.FC<ComplianceScorecardProps> = ({ controls, trend }) => {
    const { t } = useLocale();
    // Group controls by domain (assuming code starts with A.5, A.6 etc or similar)
    // For ISO 27001:2022, domains are 5, 6, 7, 8.
    // Let's try to parse the domain from the code (e.g., "5.1" -> Domain 5)

    const domains = [
        { id: '5', name: t('compliance.domains.organizational', { defaultValue: 'Organisationnelle' }), color: 'bg-blue-500' },
        { id: '6', name: t('compliance.domains.people', { defaultValue: 'Personnes' }), color: 'bg-purple-500' },
        { id: '7', name: t('compliance.domains.physical', { defaultValue: 'Physique' }), color: 'bg-emerald-500' },
        { id: '8', name: t('compliance.domains.technological', { defaultValue: 'Technologique' }), color: 'bg-orange-500' }
    ];

    const stats = controls.length > 0 ? domains.map(domain => {
        const domainControls = controls.filter(c => c.code.startsWith(domain.id) || c.code.startsWith(`A.${domain.id}`));
        const applicableControls = domainControls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable');
        const implemented = applicableControls.filter(c => c.status === 'Implémenté').length;
        const total = applicableControls.length;
        const score = total > 0 ? Math.round((implemented / total) * 100) : 0;
        return { ...domain, score, total, implemented };
    }) : [];

    const applicableTotal = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable');
    const totalScore = Math.round(
        (applicableTotal.filter(c => c.status === 'Implémenté').length / (applicableTotal.length || 1)) * 100
    );

    return (
        <div className="glass-premium p-4 sm:p-6 rounded-3xl h-full border border-border/40">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Scorecard Conformité</h3>
                    <p className="text-sm text-muted-foreground">ISO 27001:2022</p>
                </div>
                <div className="flex flex-col items-end">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-foreground text-background font-bold text-lg shadow-lg">
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
                {controls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center opacity-70">
                        <p className="text-sm font-bold text-foreground">{t('compliance.noData', { defaultValue: 'Aucune donnée' })}</p>
                        <p className="text-xs text-muted-foreground">{t('compliance.importControls', { defaultValue: 'Importez des contrôles pour voir le score.' })}</p>
                    </div>
                ) : (
                    stats.map(stat => (
                        <div key={stat.id}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-foreground">{stat.name}</span>
                                <span className="text-xs font-bold text-muted-foreground">{stat.score}% ({stat.implemented}/{stat.total})</span>
                            </div>
                            <div className="w-full bg-accent rounded-full h-2.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${stat.color} transition-all duration-1000 ease-out`}
                                    style={{ width: `${stat.score}%` }}
                                ></div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-border/60 flex gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground whitespace-nowrap">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {controls.filter(c => c.status === 'Implémenté').length} {t('compliance.status.implemented', { defaultValue: 'Implémentés' })}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground whitespace-nowrap">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {controls.filter(c => c.status === 'Partiel').length} {t('compliance.status.partial', { defaultValue: 'Partiels' })}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground whitespace-nowrap">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    {controls.filter(c => c.status === 'Non commencé').length} {t('compliance.status.todo', { defaultValue: 'À faire' })}
                </div>
            </div>
        </div>
    );
};
