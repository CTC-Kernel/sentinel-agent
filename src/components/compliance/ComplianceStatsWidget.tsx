import React from 'react';
import { Control, Framework } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { TrendingUp, CheckCircle2, AlertTriangle, Paperclip } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ComplianceStatsWidgetProps {
    controls: Control[];
    currentFramework: Framework;
}

export const ComplianceStatsWidget: React.FC<ComplianceStatsWidgetProps> = ({ controls, currentFramework }) => {

    // Calculate metrics
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const partialControls = controls.filter(c => c.status === 'Partiel').length;
    // Actionable = Not N/A and Not Excluded
    const actionableControls = controls.filter(c => c.status !== 'Non applicable' && c.status !== 'Exclu').length;

    // Global Score: Implemented (100%) + Partial (50%) over Actionable
    const globalScore = actionableControls > 0
        ? Math.round(((implementedControls + (partialControls * 0.5)) / actionableControls) * 100)
        : 0;

    const evidenceCount = controls.reduce((acc, curr) => acc + (curr.evidenceIds?.length || 0), 0);

    // Critical (or just missing evidence/high priority) - simplistic metric for now
    // Let's count "En cours" or "Non commencé" as 'In Progress/To Do'
    const todoControls = controls.filter(c => c.status === 'Non commencé' || c.status === 'En cours').length;

    const stats = [
        {
            label: `Score ${currentFramework}`,
            value: `${globalScore}%`,
            icon: TrendingUp,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: "Contrôles Implémentés",
            value: `${implementedControls}/${actionableControls}`,
            subtext: "Sur le périmètre applicable",
            icon: CheckCircle2,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            label: "À traiter",
            value: todoControls,
            icon: AlertTriangle,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            label: "Preuves collectées",
            value: evidenceCount,
            icon: Paperclip,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <GlassCard key={index} className="p-4 flex items-center justify-between" hoverEffect>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            {stat.value}
                        </p>
                        {stat.subtext && (
                            <p className="text-xs text-gray-400 mt-0.5">
                                {stat.subtext}
                            </p>
                        )}
                    </div>
                    <div className={cn("p-3 rounded-xl", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
};
