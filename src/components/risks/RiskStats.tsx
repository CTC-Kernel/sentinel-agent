import React from 'react';
import { motion } from 'framer-motion';
import { TrendingDown } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { slideUpVariants } from '../ui/animationVariants';
import { Risk } from '../../types';
import { PremiumCard } from '../ui/PremiumCard';

interface RiskStatsProps {
    stats: {
        total: number;
        critical: number;
        avgScore: number;
        reductionPercentage: number;
        untreatedCritical: number;
    };
    risks: Risk[]; // Or proper Risk type
}

export const RiskStats: React.FC<RiskStatsProps> = ({ stats }) => {
    return (
        <motion.div variants={slideUpVariants}>
            <PremiumCard glass
                className="p-6 md:p-8 relative overflow-hidden group"
                gradientOverlay={true}
            >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative z-10">
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-brand-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            Vue globale des risques
                        </p>
                        <div className="flex items-baseline gap-3">
                            <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight">{stats.total}</h2>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 dark:text-muted-foreground">Risques identifiés</span>
                        </div>
                    </div>

                    <div className="h-px w-full md:w-px md:h-20 bg-gradient-to-b from-transparent via-slate-200 dark:via-white/5 to-transparent" />

                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-2">Critiques</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-red-500 drop-shadow-sm">{stats.critical}</span>
                                <Badge status="error" variant="soft" size="sm" className="shadow-none">Score 15+</Badge>
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-2">Score Moyen</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-white">
                                    {stats.avgScore.toFixed(1)}
                                </span>
                                <span className="text-xs font-medium text-slate-500 dark:text-muted-foreground">/ 25</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-2">Non Traités</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-warning-text drop-shadow-sm">
                                    {stats.untreatedCritical}
                                </span>
                                <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Critiques</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground mb-2">Réduction</p>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-success-text drop-shadow-sm">
                                    {stats.reductionPercentage}%
                                </span>
                                <TrendingDown className="h-4 w-4 text-success-text" />
                            </div>
                        </div>
                    </div>
                </div>
            </PremiumCard>
        </motion.div>
    );
};
