import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Supplier, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Truck, ShieldAlert, CheckCircle2 } from '../../ui/Icons';

interface SuppliersStatsWidgetProps {
    navigate?: (path: string) => void;
}

export const SuppliersStatsWidget: React.FC<SuppliersStatsWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: suppliers, loading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { realtime: true }
    );

    const stats = useMemo(() => {
        const total = suppliers.length;
        const critical = suppliers.filter(s => s.criticality === Criticality.CRITICAL).length;
        // Assume 'Actif' or 'Active' status for valid suppliers
        const active = suppliers.filter(s => s.status === 'Actif' || (s.status as string) === 'Active').length;

        return { total, critical, active };
    }, [suppliers]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center glass-panel rounded-2xl border border-white/60 dark:border-white/5 p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/5 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400">
                        <Truck className="w-4 h-4" />
                    </div>
                    Fournisseurs
                </h3>
                <button
                    onClick={() => navigate && navigate('/suppliers')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-center relative z-10 pt-4">
                <div className="flex items-end gap-3 mb-6">
                    <span className="text-4xl font-black text-foreground tracking-tight">{stats.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mb-1.5 pb-0.5">tiers gérés</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 flex flex-col">
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Critiques</span>
                        </div>
                        <span className="text-xl font-bold text-red-700 dark:text-red-300">{stats.critical}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 flex flex-col">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-bold tracking-wider">Actifs</span>
                        </div>
                        <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{stats.active}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
