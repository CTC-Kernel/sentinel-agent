
import { Target, PlayCircle, BarChart3, Settings2, Clock, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PDCAPhase } from '../../types/ebios';

export const PHASE_CONFIG: Record<PDCAPhase, { label: string; color: string; icon: React.ElementType; description: string }> = {
    plan: {
        label: 'Plan',
        color: 'blue',
        icon: Target,
        description: 'Identification du contexte, politique SMSI, appréciation des risques',
    },
    do: {
        label: 'Do',
        color: 'emerald',
        icon: PlayCircle,
        description: 'Mise en oeuvre du plan de traitement des risques, sensibilisation',
    },
    check: {
        label: 'Check',
        color: 'amber',
        icon: BarChart3,
        description: 'Audits internes, revue de direction, mesure de performance',
    },
    act: {
        label: 'Act',
        color: 'purple',
        icon: Settings2,
        description: 'Actions correctives, amélioration continue, ajustements',
    },
};

// Static color mappings for Tailwind JIT
// Using muted, professional colors aligned with design tokens
export const PHASE_STYLES: Record<PDCAPhase, {
    borderActive: string;
    bgActive: string;
    badge: string;
    iconBg: string;
    iconText: string;
    textActive: string;
    cardBorder: string;
    text: string;
}> = {
    plan: {
        borderActive: 'border-brand-400',
        bgActive: 'bg-brand-50 dark:bg-brand-900/30',
        badge: 'bg-brand-500',
        iconBg: 'bg-brand-50 dark:bg-brand-800',
        iconText: 'text-brand-600 dark:text-brand-400',
        textActive: 'text-brand-600 dark:text-brand-400',
        cardBorder: 'border-brand-200 dark:border-brand-800',
        text: 'text-brand-600 dark:text-brand-400'
    },
    do: {
        borderActive: 'border-success/60',
        bgActive: 'bg-success-bg dark:bg-success/10',
        badge: 'bg-success',
        iconBg: 'bg-success-bg dark:bg-success/20',
        iconText: 'text-success-text dark:text-success',
        textActive: 'text-success-text dark:text-success',
        cardBorder: 'border-success-border dark:border-success/30',
        text: 'text-success-text dark:text-success'
    },
    check: {
        borderActive: 'border-warning/60',
        bgActive: 'bg-warning-bg dark:bg-warning/10',
        badge: 'bg-warning',
        iconBg: 'bg-warning-bg dark:bg-warning/20',
        iconText: 'text-warning-text dark:text-warning',
        textActive: 'text-warning-text dark:text-warning',
        cardBorder: 'border-warning-border dark:border-warning/30',
        text: 'text-warning-text dark:text-warning'
    },
    act: {
        borderActive: 'border-violet-400 dark:border-violet-500',
        bgActive: 'bg-violet-50/50 dark:bg-violet-900/10',
        badge: 'bg-violet-500',
        iconBg: 'bg-violet-50 dark:bg-violet-900/20',
        iconText: 'text-violet-600 dark:text-violet-400',
        textActive: 'text-violet-600 dark:text-violet-400',
        cardBorder: 'border-violet-200 dark:border-violet-800',
        text: 'text-violet-600 dark:text-violet-400'
    },
};

export const MILESTONE_STATUS_CONFIG = {
    pending: { label: 'En attente', color: 'slate', icon: Clock },
    in_progress: { label: 'En cours', color: 'blue', icon: TrendingUp },
    completed: { label: 'Terminé', color: 'emerald', icon: CheckCircle2 },
    overdue: { label: 'En retard', color: 'red', icon: AlertTriangle },
};

export const MILESTONE_STATUS_STYLES = {
    pending: {
        bg: 'bg-slate-100 dark:bg-slate-800/50',
        text: 'text-muted-foreground',
        button: 'bg-slate-500 hover:bg-slate-600'
    },
    in_progress: {
        bg: 'bg-info-bg dark:bg-info/15',
        text: 'text-info-text dark:text-info',
        button: 'bg-info hover:bg-info/90'
    },
    completed: {
        bg: 'bg-success-bg dark:bg-success/15',
        text: 'text-success-text dark:text-success',
        button: 'bg-success hover:bg-success/90'
    },
    overdue: {
        bg: 'bg-error-bg dark:bg-error/15',
        text: 'text-error-text dark:text-error',
        button: 'bg-error hover:bg-error/90'
    }
};
