
import { Target, PlayCircle, BarChart3, Settings2, Clock, TrendingUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PDCAPhase } from '../../types/ebios';

export const PHASE_CONFIG: Record<PDCAPhase, { label: string; color: string; icon: any; description: string }> = {
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
export const PHASE_STYLES = {
    plan: {
        borderActive: 'border-blue-500',
        bgActive: 'bg-blue-50 dark:bg-blue-900/20',
        badge: 'bg-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconText: 'text-blue-600 dark:text-blue-400',
        textActive: 'text-blue-600 dark:text-blue-400',
        cardBorder: 'border-blue-200 dark:border-blue-900',
        text: 'text-blue-600 dark:text-blue-400'
    },
    do: {
        borderActive: 'border-emerald-500',
        bgActive: 'bg-emerald-50 dark:bg-emerald-900/20',
        badge: 'bg-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        iconText: 'text-emerald-600 dark:text-emerald-400',
        textActive: 'text-emerald-600 dark:text-emerald-400',
        cardBorder: 'border-emerald-200 dark:border-emerald-900',
        text: 'text-emerald-600 dark:text-emerald-400'
    },
    check: {
        borderActive: 'border-amber-500',
        bgActive: 'bg-amber-50 dark:bg-amber-900/20',
        badge: 'bg-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconText: 'text-amber-600 dark:text-amber-400',
        textActive: 'text-amber-600 dark:text-amber-400',
        cardBorder: 'border-amber-200 dark:border-amber-900',
        text: 'text-amber-600 dark:text-amber-400'
    },
    act: {
        borderActive: 'border-purple-500',
        bgActive: 'bg-purple-50 dark:bg-purple-900/20',
        badge: 'bg-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        iconText: 'text-purple-600 dark:text-purple-400',
        textActive: 'text-purple-600 dark:text-purple-400',
        cardBorder: 'border-purple-200 dark:border-purple-900',
        text: 'text-purple-600 dark:text-purple-400'
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
        bg: 'bg-slate-100 dark:bg-slate-900/30',
        text: 'text-slate-700 dark:text-slate-400',
        button: 'bg-slate-500 hover:bg-slate-600'
    },
    in_progress: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        button: 'bg-blue-500 hover:bg-blue-600'
    },
    completed: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        button: 'bg-emerald-500 hover:bg-emerald-600'
    },
    overdue: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        button: 'bg-red-500 hover:bg-red-600' // Although overdue is usually auto, but just in case
    }
};
