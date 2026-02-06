import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PremiumCard } from '../../ui/PremiumCard';
import { ShieldAlert, Cpu, BarChart3, ChevronRight, Zap } from '../../ui/Icons';
import { Asset, Risk, Control, Criticality } from '../../../types';
import { useNavigate } from 'react-router-dom';

interface IntelligenceHubProps {
    allAssets?: Asset[];
    allRisks?: Risk[];
    controls?: Control[];
    loading?: boolean;
}

/**
 * IntelligenceHub Widget
 * Advanced correlation engine surfacing hidden gaps between assets, risks, and compliance controls.
 */
export const IntelligenceHub: React.FC<IntelligenceHubProps> = ({
    allAssets = [],
    allRisks = [],
    controls = [],
    loading = false
}) => {
    const navigate = useNavigate();

    // 1. Assets health: Critical assets without risks
    const exposedAssets = useMemo(() => {
        const riskAssetIds = new Set(allRisks.map(r => r.assetId));
        return allAssets.filter(a =>
            (a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL) &&
            !riskAssetIds.has(a.id)
        );
    }, [allAssets, allRisks]);

    // 2. High Risks without controls
    const unprotectedRisks = useMemo(() => {
        return allRisks.filter(r => r.score >= 12 && (!r.mitigationControlIds || r.mitigationControlIds.length === 0));
    }, [allRisks]);

    // 3. Compliance Pulse: controls implemented + evidence
    const readiness = useMemo(() => {
        if (controls.length === 0) return 0;
        const documented = controls.filter(c => c.status === 'Implémenté' && c.evidenceIds && c.evidenceIds.length > 0).length;
        return Math.round((documented / controls.length) * 100);
    }, [controls]);

    if (loading) return (
        <PremiumCard glass className="h-full min-h-[350px] animate-pulse">
            <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-muted/20 animate-pulse" />
                <div className="w-24 h-4 bg-muted/20 rounded animate-pulse" />
            </div>
        </PremiumCard>
    );

    return (
        <PremiumCard
            glass
            hover
            gradientOverlay
            className="flex flex-col h-full overflow-hidden group border-primary/20"
        >
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm shadow-primary/5 group-hover:shadow-primary/10 transition-shadow">
                    <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-foreground leading-tight tracking-tight">Intelligence Hub</h3>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Corrélations & Gaps Critiques</p>
                </div>
            </div>

            <div className="space-y-4 flex-1 relative z-10">
                {/* Insight 1: Exposed Assets */}
                <motion.div
                    whileHover={{ x: 4 }}
                    onClick={() => navigate('/assets')}
                    className="p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all cursor-pointer group/item"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-warning" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exposition Assets</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/item:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{exposedAssets.length}</span>
                        <span className="text-xs font-medium text-muted-foreground">actifs critiques non couverts</span>
                    </div>
                </motion.div>

                {/* Insight 2: Unprotected Risks */}
                <motion.div
                    whileHover={{ x: 4 }}
                    onClick={() => navigate('/risks')}
                    className="p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all cursor-pointer group/item"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-destructive" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gaps de Protection</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/item:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-foreground">{unprotectedRisks.length}</span>
                        <span className="text-xs font-medium text-muted-foreground">risques majeurs sans contrôles</span>
                    </div>
                </motion.div>

                {/* Insight 3: Audit Readiness */}
                <motion.div
                    whileHover={{ x: 4 }}
                    onClick={() => navigate('/compliance')}
                    className="p-4 rounded-2xl bg-secondary/20 border border-border/40 hover:bg-secondary/40 transition-all cursor-pointer group/item"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-success" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Préparation Audit</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/item:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${readiness}%` }}
                                className="bg-success h-full rounded-full"
                            />
                        </div>
                        <span className="text-lg font-bold text-foreground">{readiness}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic font-medium opacity-70">
                        Score de complétude des preuves
                    </p>
                </motion.div>
            </div>

            {/* Subtle glow in background */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-colors duration-700" />
        </PremiumCard>
    );
};
