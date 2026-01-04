import React from 'react';
import { Control } from '../../../types';
import { Clock, TrendingUp, ShieldAlert } from '../../ui/Icons';

interface ComplianceScoreCardProps {
    controls: Control[];
    currentFramework: string;
    trend?: number;
    onFilterChange?: (status: string | null) => void;
}

export const ComplianceScoreCard: React.FC<ComplianceScoreCardProps> = ({
    controls,
    currentFramework,
    trend,
    onFilterChange
}) => {
    // Calculate metrics
    const totalControls = controls.length;
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;

    // Global Score
    const globalScore = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;

    // Framework specific scores (example logic from original dashboard)
    const calculateScore = (fw: string) => {
        const fwControls = controls.filter(c => c.framework === fw);
        if (fwControls.length === 0) return 0;
        const implemented = fwControls.filter(c => c.status === 'Implémenté').length;
        return (implemented / fwControls.length) * 100;
    };

    const isoScore = calculateScore('ISO27001');
    const rgpdScore = calculateScore('GDPR');
    const doraScore = calculateScore('DORA');

    return (
        <div className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-lg flex flex-col xl:flex-row gap-8 relative overflow-hidden group hover:shadow-apple transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

            {/* Left: Global Score */}
            <div className="flex items-center gap-6 md:p-8 min-w-[240px] z-10">
                <div className="relative flex-shrink-0 group/ring">
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-14 -14 124 124">
                        <circle className="text-muted-foreground/10" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="48" cy="48" />
                        <circle
                            className="text-brand-600 transition-all duration-1000 ease-out"
                            strokeWidth="6"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * globalScore) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="42"
                            cx="48"
                            cy="48"
                            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black text-foreground">{globalScore.toFixed(0)}%</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">Score {currentFramework}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Conformité moyenne</p>
                    {trend !== undefined && (
                        <div className={`text-xs font-bold mt-2 px-2.5 py-1 rounded-lg w-fit inline-flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <TrendingUp className="w-3.5 h-3.5" />
                            {trend > 0 ? '+' : ''}{trend}% vs 30j
                        </div>
                    )}
                </div>
            </div>

            {/* Middle: Frameworks Mini-Cards */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                {(currentFramework === 'ISO27001' || isoScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">ISO 27001</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(isoScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${isoScore}%` }}></div>
                        </div>
                    </div>
                )}
                {(currentFramework === 'GDPR' || rgpdScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">RGPD</span>
                            <span className="text-sm font-black text-purple-600 dark:text-purple-400">{Math.round(rgpdScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${rgpdScore}%` }}></div>
                        </div>
                    </div>
                )}
                {(currentFramework === 'DORA' || doraScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">DORA</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(doraScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${doraScore}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Quick Stats */}
            <div className="flex xl:flex-col gap-3 min-w-[160px]">
                <div
                    onClick={() => onFilterChange?.('Non commencé')}
                    onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.('Non commencé')}
                    role="button"
                    tabIndex={0}
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-red-50/80 dark:bg-red-900/10 rounded-xl border border-red-100/50 dark:border-red-900/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-red-600/70" />
                        <span className="text-xs font-bold text-red-700/70 dark:text-red-400/70">Alertes</span>
                    </div>
                    <span className="text-lg font-black text-red-700 dark:text-red-400">{notImplementedControls}</span>
                </div>
                <div
                    onClick={() => onFilterChange?.('Partiel')}
                    onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.('Partiel')}
                    role="button"
                    tabIndex={0}
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-amber-50/80 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-900/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-600/70" />
                        <span className="text-xs font-bold text-amber-700/70 dark:text-amber-400/70">En cours</span>
                    </div>
                    <span className="text-lg font-black text-amber-700 dark:text-amber-400">{inProgressControls}</span>
                </div>
            </div>
        </div>
    );
};
