import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Control } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { TrendingUp, Loader2, ShieldCheck } from '../../ui/Icons';

interface ComplianceProgressWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const ComplianceProgressWidget: React.FC<ComplianceProgressWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: controls, loading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const totalControls = controls.length;
        const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
        const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
        const complianceRate = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;

        return {
            totalControls,
            implementedControls,
            inProgressControls,
            complianceRate
        };
    }, [controls]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/5 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                    </div>
                    Conformité
                </h3>
                <button
                    onClick={() => navigate && navigate('/compliance')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex items-center gap-4 flex-1 relative z-10">
                {/* Score Circle */}
                <div
                    className="relative flex-shrink-0 group/chart cursor-pointer transform hover:scale-105 transition-transform duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full"
                    onClick={() => navigate && navigate('/compliance')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate && navigate('/compliance')}
                >
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                        <defs>
                            <linearGradient id="complianceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={stats.complianceRate >= 80 ? 'hsl(var(--success))' : stats.complianceRate >= 50 ? 'hsl(var(--primary))' : 'hsl(var(--warning))'} />
                                <stop offset="100%" stopColor={stats.complianceRate >= 80 ? 'hsl(var(--emerald-400))' : stats.complianceRate >= 50 ? 'hsl(var(--blue-400))' : 'hsl(var(--amber-400))'} />
                            </linearGradient>
                        </defs>
                        <circle className="text-slate-100 dark:text-slate-800" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="48" cy="48" />
                        <circle
                            stroke="url(#complianceGradient)"
                            strokeWidth="6"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * stats.complianceRate) / 100}
                            strokeLinecap="round"
                            fill="transparent"
                            r="42"
                            cx="48"
                            cy="48"
                            style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black text-foreground tracking-tight">{stats.complianceRate.toFixed(0)}%</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground truncate">Score Global</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        Moyenne pondérée des contrôles implémentés.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50`}>
                            <TrendingUp className="w-3 h-3" />
                            Stable
                        </div>
                    </div>
                </div>
            </div>

            {/* Mini Progress Bar breakdown */}
            <div className="mt-auto space-y-2 relative z-10">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">Implémenté</span>
                    <span className="font-bold text-foreground">{stats.implementedControls}/{stats.totalControls}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(stats.implementedControls / (stats.totalControls || 1)) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
