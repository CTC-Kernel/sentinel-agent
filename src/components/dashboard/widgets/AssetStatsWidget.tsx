import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Asset, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Server, ShieldAlert, ShieldCheck, Box } from '../../ui/Icons';
import { PremiumCard } from '../../ui/PremiumCard';
import { EmptyState } from '../../ui/EmptyState';

interface AssetStatsWidgetProps {
    navigate?: (path: string) => void;
}

export const AssetStatsWidget: React.FC<AssetStatsWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: assets, loading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || '')],
        { realtime: true, enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const total = assets.length;
        const critical = assets.filter(a => a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL).length;
        const high = assets.filter(a => a.confidentiality === Criticality.HIGH || a.integrity === Criticality.HIGH || a.availability === Criticality.HIGH).length;

        return { total, critical, high };
    }, [assets]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center glass-premium rounded-2xl border border-border/40 p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    // Empty state when no assets
    if (stats.total === 0) {
        return (
            <PremiumCard glass
                className="h-full flex flex-col p-5 overflow-hidden"
                hover={true}
                gradientOverlay={true}
            >
                <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
                    <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                        <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-800 text-brand-600 dark:text-brand-400">
                            <Server className="w-4 h-4" />
                        </div>
                        Actifs
                    </h3>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-10">
                    <EmptyState
                        icon={Box}
                        title="Aucun actif recensé"
                        description="Inventoriez vos actifs informationnels pour évaluer leur criticité."
                        actionLabel="Ajouter un actif"
                        onAction={() => navigate && navigate('/assets')}
                        semantic="primary"
                        compact
                    />
                </div>
            </PremiumCard>
        );
    }

    return (
        <PremiumCard glass
            className="h-full flex flex-col p-5 overflow-hidden group hover:shadow-apple"
            hover={true}
            gradientOverlay={true}
        >
            <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-800 text-brand-700 dark:text-brand-400">
                        <Server className="w-4 h-4" />
                    </div>
                    Actifs
                </h3>
                <button
                    onClick={() => navigate && navigate('/assets')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex-1 flex flex-col justify-center relative z-10 pt-4">
                <div className="flex items-end gap-3 mb-6">
                    <span className="text-4xl font-black text-foreground tracking-tight">{stats.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mb-1.5 pb-0.5">actifs recensés</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-3xl bg-error-bg/50 dark:bg-error/5 border border-error-border dark:border-error/10 flex flex-col">
                        <div className="flex items-center gap-1.5 text-error-text dark:text-error mb-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span className="text-[11px] uppercase font-bold tracking-wider">Critiques</span>
                        </div>
                        <span className="text-xl font-bold text-error-text dark:text-error">{stats.critical}</span>
                    </div>

                    <div className="p-3 rounded-3xl bg-warning-bg/50 dark:bg-warning/5 border border-warning-border dark:border-warning/10 flex flex-col">
                        <div className="flex items-center gap-1.5 text-warning-text dark:text-warning mb-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-[11px] uppercase font-bold tracking-wider">Élevés</span>
                        </div>
                        <span className="text-xl font-bold text-warning-text dark:text-warning">{stats.high}</span>
                    </div>
                </div>
            </div>
        </PremiumCard>
    );
};
