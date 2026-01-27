import React from 'react';
import { ShieldAlert, Siren, CheckCircle2 } from '../../ui/Icons';

interface IncidentSummaryCardProps {
    resolutionRate: number;
    totalIncidents: number;
    openIncidents: number;
    criticalIncidents: number;
}

export const IncidentSummaryCard: React.FC<IncidentSummaryCardProps> = ({
    resolutionRate,
    totalIncidents,
    openIncidents,
    criticalIncidents
}) => {
    return (
        <div className="glass-premium p-6 md:p-8 rounded-3xl border border-white/60 dark:border-white/5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
            {/* Tech Corners Generic */}
            <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70 opacity-70"></div>
            </div>

            {/* Global Score */}
            <div className="flex items-center gap-6 relative z-decorator">
                <div className="relative">
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-4 -4 104 104">
                        <defs>
                            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#2d9d6a" />
                                <stop offset="100%" stopColor="#6fcca3" />
                            </linearGradient>
                        </defs>
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-slate-200/50 dark:text-slate-700/50"
                        />
                        <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="url(#progressGradient)"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * resolutionRate) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out drop-shadow-sm"
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{resolutionRate}%</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Taux de Résolution</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 max-w-[200px] leading-snug">
                        Pourcentage d'incidents résolus ou fermés.
                    </p>
                </div>
            </div>

            {/* Key Metrics Breakdown */}
            <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2 relative z-decorator">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-1">Total</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">{totalIncidents}</div>
                </div>
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-1">En Cours</div>
                    <div className={`text-2xl font-black ${openIncidents > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                        {openIncidents}
                    </div>
                </div>
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-1">Critiques</div>
                    <div className={`text-2xl font-black ${criticalIncidents > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                        {criticalIncidents}
                    </div>
                </div>
            </div>

            {/* Alerts/Status */}
            <div className="flex flex-col gap-3 min-w-0 sm:min-w-[200px] relative z-decorator">
                {criticalIncidents > 0 && (
                    <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 backdrop-blur-sm">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>{criticalIncidents} critiques ouverts</span>
                    </div>
                )}
                {openIncidents > 0 && criticalIncidents === 0 && (
                    <div className="flex items-center gap-3 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-4 py-2.5 rounded-xl border border-orange-200 dark:border-orange-800/50 backdrop-blur-sm">
                        <Siren className="h-4 w-4 shrink-0" />
                        <span>{openIncidents} incidents actifs</span>
                    </div>
                )}
                {openIncidents === 0 && (
                    <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 backdrop-blur-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Aucun incident actif</span>
                    </div>
                )}
            </div>
        </div>
    );
};
