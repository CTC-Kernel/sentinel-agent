import React from 'react';
import { Audit } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { Calendar, ClipboardCheck, AlertOctagon } from '../ui/Icons';
import { cn } from '../../utils/cn';

interface AuditStatsWidgetProps {
    audits: Audit[];
    findingsCount: number;
}

export const AuditStatsWidget: React.FC<AuditStatsWidgetProps> = ({ audits, findingsCount }) => {

    const totalAudits = audits.length;
    const completedAudits = audits.filter(a => a.status === 'Terminé' || a.status === 'Validé').length;
    const inProgressAudits = audits.filter(a => a.status === 'En cours').length;

    // Calculate compliance rate (Completed / Total) * 100
    const complianceRate = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 0;

    const upcomingAudits = audits.filter(a => {
        if (!a.dateScheduled) return false;
        const date = new Date(a.dateScheduled);
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 30;
    }).length;

    const stats = [
        {
            label: "Taux de Réalisation",
            value: `${complianceRate}%`,
            subtext: `${completedAudits} audits terminés`,
            icon: ClipboardCheck,
            color: 'text-success-text',
            bg: 'bg-success-bg'
        },
        {
            label: "Audits Planifiés",
            value: totalAudits,
            subtext: `${inProgressAudits} en cours`,
            icon: Calendar,
            color: 'text-info-text',
            bg: 'bg-info-bg'
        },
        {
            label: "Prochains (30j)",
            value: upcomingAudits,
            subtext: "À préparer",
            icon: ClockIcon,
            color: 'text-brand-600 dark:text-brand-400',
            bg: 'bg-brand-500/10'
        },
        {
            label: "Non-conformités",
            value: findingsCount,
            subtext: "Ouvertes",
            icon: AlertOctagon,
            color: 'text-error-text',
            bg: 'bg-error-bg'
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
                            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 font-medium">
                                {stat.subtext}
                            </p>
                        )}
                    </div>
                    <div className={cn("p-4 rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
};

// Helper icon
const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);
