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

export const ComplianceProgressWidget: React.FC<ComplianceProgressWidgetProps> = ({ navigate, t = (k) => k }) => {
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
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                    Conformité
                </h3>
                <button
                    onClick={() => navigate && navigate('/compliance')}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex items-center gap-4 flex-1">
                {/* Score Circle */}
                <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => navigate && navigate('/compliance')}>
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                        <circle className="text-muted-foreground/10" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="48" cy="48" />
                        <circle
                            className="text-brand-600 transition-all duration-1000 ease-out"
                            strokeWidth="6"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * stats.complianceRate) / 100}
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
                        <span className="text-xl font-black text-foreground">{stats.complianceRate.toFixed(0)}%</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground truncate">Score Global</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        Moyenne pondérée des contrôles implémentés.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}>
                            <TrendingUp className="w-3 h-3" />
                            Stable
                        </div>
                    </div>
                </div>
            </div>

            {/* Mini Progress Bar breakdown */}
            <div className="mt-auto space-y-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium">Implémenté</span>
                    <span className="font-bold text-foreground">{stats.implementedControls}/{stats.totalControls}</span>
                </div>
                <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(stats.implementedControls / (stats.totalControls || 1)) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
