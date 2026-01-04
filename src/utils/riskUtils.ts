import { Risk } from '../types';

export const getRiskLevel = (score: number) => {
    if (score >= 15) return { label: 'Critique', status: 'error' as const };
    if (score >= 10) return { label: 'Élevé', status: 'warning' as const };
    if (score >= 5) return { label: 'Moyen', status: 'info' as const };
    return { label: 'Faible', status: 'success' as const };
};

export const getSLAStatus = (risk: Risk) => {
    if (risk.strategy === 'Accepter' || !risk.treatmentDeadline) return null;
    if (risk.status === 'Fermé') return null;

    const deadline = new Date(risk.treatmentDeadline);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'overdue', days: Math.abs(diffDays), label: `Retard ${Math.abs(diffDays)}j`, color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800' };
    if (diffDays <= 7) return { status: 'warning', days: diffDays, label: `J-${diffDays}`, color: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800' };
    return { status: 'ok', days: diffDays, label: `${diffDays}j`, color: 'text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-white/10' };
};
