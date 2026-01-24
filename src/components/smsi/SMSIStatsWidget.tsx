import React from 'react';
import {
    TrendingUp,
    Target,
    AlertTriangle,
    Calendar,
    PlayCircle,
    BarChart3,
    Settings2
} from '../ui/Icons';
import { GlassCard } from '../ui/GlassCard';
import { SMSIProgram, PDCAPhase } from '../../types/ebios';
import { cn } from '../../utils/cn';

interface SMSIStatsWidgetProps {
    program: SMSIProgram;
    overdueCount: number;
}

const PHASE_ICONS = {
    plan: Target,
    do: PlayCircle,
    check: BarChart3,
    act: Settings2
};

const PHASE_COLORS = {
    plan: 'text-blue-500 bg-blue-500/10',
    do: 'text-emerald-500 bg-emerald-500/10',
    check: 'text-amber-500 bg-amber-500/10',
    act: 'text-purple-500 bg-purple-500/10'
};

const PHASE_LABELS = {
    plan: 'Plan',
    do: 'Do',
    check: 'Check',
    act: 'Act'
};

export const SMSIStatsWidget: React.FC<SMSIStatsWidgetProps> = ({ program, overdueCount }) => {

    const currentPhase = program.currentPhase as PDCAPhase;
    const PhaseIcon = PHASE_ICONS[currentPhase] || Target;
    const phaseColorClass = PHASE_COLORS[currentPhase] || PHASE_COLORS.plan;
    const phaseLabel = PHASE_LABELS[currentPhase] || 'Inconnu';

    // Calculate next deadline (closest future date from targetCertificationDate or just a placeholder logic if milestones aren't passed)
    // Since we don't have milestones passed as prop here (only count), we use target certification date
    const targetDate = program.targetCertificationDate ? new Date(program.targetCertificationDate) : null;
    const daysUntilCertification = targetDate
        ? Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    const stats = [
        {
            label: "Conformité Globale",
            value: `${program.overallProgress}%`,
            icon: TrendingUp,
            className: "text-blue-500 bg-blue-500/10"
        },
        {
            label: "Phase Active",
            value: phaseLabel,
            icon: PhaseIcon,
            className: phaseColorClass
        },
        {
            label: "Jalons en retard",
            value: overdueCount,
            icon: AlertTriangle,
            className: overdueCount > 0 ? "text-red-500 bg-red-500/10" : "text-green-500 bg-green-500/10",
            valueColor: overdueCount > 0 ? "text-red-600 dark:text-red-400" : undefined
        },
        {
            label: "Certification",
            value: targetDate ? `J-${daysUntilCertification}` : "Non définie",
            subtext: targetDate ? targetDate.toLocaleDateString() : undefined,
            icon: Calendar,
            className: "text-indigo-500 bg-indigo-500/10"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <GlassCard key={index} className="p-4 flex items-center justify-between" hoverEffect>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {stat.label}
                        </p>
                        <p className={cn(
                            "text-2xl font-bold mt-1",
                            stat.valueColor ? stat.valueColor : "text-slate-900 dark:text-white"
                        )}>
                            {stat.value}
                        </p>
                        {stat.subtext && (
                            <p className="text-xs text-slate-400 mt-0.5">
                                {stat.subtext}
                            </p>
                        )}
                    </div>
                    <div className={cn("p-3 rounded-xl", stat.className)}>
                        <stat.icon className="w-6 h-6" />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
};
