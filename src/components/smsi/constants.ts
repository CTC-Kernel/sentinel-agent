
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

export const MILESTONE_STATUS_CONFIG = {
    pending: { label: 'En attente', color: 'slate', icon: Clock },
    in_progress: { label: 'En cours', color: 'blue', icon: TrendingUp },
    completed: { label: 'Terminé', color: 'emerald', icon: CheckCircle2 },
    overdue: { label: 'En retard', color: 'red', icon: AlertTriangle },
};
