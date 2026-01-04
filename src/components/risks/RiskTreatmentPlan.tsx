import React, { useState } from 'react';
import { Risk, RiskTreatment, Criticality } from '../../types';
import { Calendar, AlertTriangle, CheckCircle2, Clock, User } from '../ui/Icons';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RiskTreatmentPlanProps {
    risk: Risk;
    onUpdate: (treatment: RiskTreatment) => void;
    users: { uid: string; displayName: string }[];
}

export const RiskTreatmentPlan: React.FC<RiskTreatmentPlanProps> = ({ risk, onUpdate, users }) => {
    // Default SLAs (in days)
    const SLA_DAYS = {
        [Criticality.CRITICAL]: 7,
        [Criticality.HIGH]: 30,
        [Criticality.MEDIUM]: 90,
        [Criticality.LOW]: 180
    };

    // Helper to calculate SLA status
    const calculateSLAStatus = (dueDate: string | undefined, status: string): 'On Track' | 'At Risk' | 'Breached' => {
        if (!dueDate) return 'On Track';

        const today = new Date();
        const due = parseISO(dueDate);

        if (isAfter(today, due) && status !== 'Terminé') {
            return 'Breached';
        } else if (status !== 'Terminé') {
            // Warning if within 3 days
            const warningDate = addDays(today, 3);
            if (isAfter(warningDate, due)) {
                return 'At Risk';
            }
        }
        return 'On Track';
    };

    const [treatment, setTreatment] = useState<RiskTreatment>(() => {
        const initial: RiskTreatment = risk.treatment ? { ...risk.treatment } : {
            strategy: risk.strategy || 'Atténuer',
            status: 'Planifié',
            description: '',
            ownerId: risk.ownerId
        };

        // Calculate default due date if not present
        if (!initial.dueDate && risk.createdAt) {
            try {
                const days = SLA_DAYS[risk.score >= 15 ? Criticality.CRITICAL :
                    risk.score >= 10 ? Criticality.HIGH :
                        risk.score >= 5 ? Criticality.MEDIUM : Criticality.LOW] || 90;

                const createdAtDate = parseISO(risk.createdAt);
                if (!isNaN(createdAtDate.getTime())) {
                    const suggestedDate = addDays(createdAtDate, days);
                    const formattedDate = format(suggestedDate, 'yyyy-MM-dd');

                    initial.dueDate = formattedDate;
                    initial.slaStatus = calculateSLAStatus(formattedDate, initial.status || 'Planifié');
                }
            } catch {
                // ErrorLogger.error(error, 'RiskTreatmentPlan.parseDate');
                // Keep default date if parsing fails
            }
        }

        return initial;
    });

    const handleChange = (field: keyof RiskTreatment, value: string | number) => {
        const updated = { ...treatment, [field]: value };

        // Recalculate SLA if relevant fields change
        if (field === 'dueDate' || field === 'status') {
            updated.slaStatus = calculateSLAStatus(
                field === 'dueDate' ? String(value) : treatment.dueDate,
                field === 'status' ? String(value) : (treatment.status || 'Planifié')
            );
        }

        setTreatment(updated);
        onUpdate(updated);
    };

    return (
        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-brand-500" />
                    Plan de Traitement
                </h3>
                {treatment.slaStatus === 'Breached' && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1 border border-red-200">
                        <AlertTriangle className="h-3 w-3" /> SLA Dépassé
                    </span>
                )}
                {treatment.slaStatus === 'At Risk' && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center gap-1 border border-orange-200">
                        <Clock className="h-3 w-3" /> SLA À Risque
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strategy */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Stratégie</label>
                    <div className="relative group">
                        <select
                            value={treatment.strategy}
                            onChange={(e) => handleChange('strategy', e.target.value)}
                            className="w-full appearance-none rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                        >
                            <option value="Atténuer">Atténuer (Réduire)</option>
                            <option value="Transférer">Transférer (Assurance/Sous-traitance)</option>
                            <option value="Éviter">Éviter (Supprimer l'activité)</option>
                            <option value="Accepter">Accepter (Risque résiduel)</option>
                        </select>
                        <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors" />
                    </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Statut</label>
                    <div className="relative group">
                        <select
                            value={treatment.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            className="w-full appearance-none rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                        >
                            <option value="Planifié">Planifié</option>
                            <option value="En cours">En cours</option>
                            <option value="Terminé">Terminé</option>
                            <option value="Retard">En retard</option>
                        </select>
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none group-hover:text-brand-500 transition-colors" />
                    </div>
                </div>

                {/* Owner */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Responsable</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <select
                            value={treatment.ownerId || ''}
                            onChange={(e) => handleChange('ownerId', e.target.value)}
                            className="w-full pl-10 pr-4 rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none appearance-none"
                        >
                            <option value="">Sélectionner un responsable</option>
                            {users.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Échéance (SLA)</label>
                    <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input value={treatment.dueDate || ''} onChange={(e) => handleChange('dueDate', e.target.value)}
                            type="date"
                            className={`w-full pl-10 pr-4 rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none ${treatment.slaStatus === 'Breached' ? 'border-red-500 text-red-600' : ''
                                }`}
                        />
                    </div>
                    {treatment.dueDate && (
                        <p className="text-xs text-slate-500 ml-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(treatment.dueDate), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                    )}
                </div>

                {/* Estimated Cost */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Coût Estimé (€)</label>
                    <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within:text-brand-500 transition-colors">€</span>
                        <input value={treatment.estimatedCost || ''} onChange={(e) => handleChange('estimatedCost', parseFloat(e.target.value))}
                            type="number"
                            className="w-full pl-8 pr-4 rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-slate-400"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Description du plan</label>
                <textarea
                    value={treatment.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm p-4 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-slate-400 resize-none"
                    placeholder="Détaillez les actions à entreprendre pour traiter ce risque..."
                />
            </div>
        </div>
    );
};
