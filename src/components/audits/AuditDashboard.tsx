import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Audit, Finding } from '../../types';
import { CheckCircle2 } from '../ui/Icons';
import { EmptyChartState } from '../ui/EmptyChartState';
import { staggerContainerVariants } from '../ui/animationVariants';

// Sub-components
import { AuditCharts } from './dashboard/AuditCharts';

interface AuditDashboardProps {
    audits: Audit[];
    findings: Finding[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
    loading?: boolean;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({ audits, findings, loading }) => {
    // Metrics Calculation
    const metrics = useMemo(() => {
        const totalAudits = audits.length;
        const openFindings = findings.filter(f => f.status === 'Ouvert').length;
        const completedAudits = audits.filter(a => a.status === 'Terminé').length;
        const complianceRate = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0;

        const upcomingAudits = audits.filter(a => {
            if (!a.dateScheduled) return false;
            const date = new Date(a.dateScheduled);
            const now = new Date();
            const diffTime = date.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 0 && diffDays <= 30;
        }).length;

        return { totalAudits, openFindings, completedAudits, complianceRate, upcomingAudits };
    }, [audits, findings]);

    // Chart Data
    const chartData = useMemo(() => {
        const statusData = [
            { name: 'Planifié', value: audits.filter(a => a.status === 'Planifié').length, color: '#3B82F6' },
            { name: 'En cours', value: audits.filter(a => a.status === 'En cours').length, color: '#F59E0B' },
            { name: 'Terminé', value: audits.filter(a => a.status === 'Terminé').length, color: '#10B981' },
            { name: 'Validé', value: audits.filter(a => a.status === 'Validé').length, color: '#8B5CF6' },
        ].filter(d => d.value > 0);

        const findingsByType = [
            { name: 'Majeure', value: findings.filter(f => f.type === 'Majeure').length },
            { name: 'Mineure', value: findings.filter(f => f.type === 'Mineure').length },
            { name: 'Observation', value: findings.filter(f => f.type === 'Observation').length },
            { name: 'Opportunité', value: findings.filter(f => f.type === 'Opportunité').length },
        ].filter(d => d.value > 0);

        return { statusData, findingsByType };
    }, [audits, findings]);

    if (loading) {
        return (
            <motion.div
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {/* Skeleton for AuditScoreCard */}
                <div className="glass-premium p-6 rounded-5xl animate-pulse">
                    <div className="h-40 bg-slate-200 dark:bg-slate-700/50 rounded-2xl"></div>
                </div>
                {/* Skeleton for AuditCharts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 rounded-4xl h-[300px] animate-pulse bg-slate-100 dark:bg-white/5"></div>
                    <div className="glass-panel p-6 rounded-4xl h-[300px] animate-pulse bg-slate-100 dark:bg-white/5"></div>
                </div>
            </motion.div>
        );
    }

    if (metrics.totalAudits === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <EmptyChartState
                    message="Aucun audit pour le moment"
                    description="Commencez par planifier un audit pour voir apparaître des métriques et des analyses détaillées."
                    className="glass-premium rounded-5xl min-h-[400px]"
                    variant="default"
                    icon={<CheckCircle2 className="h-10 w-10 text-brand-500" />}
                />
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >


            <AuditCharts
                statusData={chartData.statusData}
                findingsByType={chartData.findingsByType}
            />
        </motion.div>
    );
};
