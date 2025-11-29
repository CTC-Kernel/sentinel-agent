import React, { useState, useEffect } from 'react';
import { Risk, RiskTreatment, Criticality } from '../../types';
import { Calendar, AlertTriangle, CheckCircle2, Clock, User, DollarSign } from '../ui/Icons';
import { format, addDays, isAfter, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RiskTreatmentPlanProps {
    risk: Risk;
    onUpdate: (treatment: RiskTreatment) => void;
    users: { uid: string; displayName: string }[];
}

export const RiskTreatmentPlan: React.FC<RiskTreatmentPlanProps> = ({ risk, onUpdate, users }) => {
    const [treatment, setTreatment] = useState<RiskTreatment>(risk.treatment || {
        strategy: risk.strategy || 'Atténuer',
        status: 'Planifié',
        description: '',
        ownerId: risk.ownerId
    });

    // Default SLAs (in days)
    const SLA_DAYS = {
        [Criticality.CRITICAL]: 7,
        [Criticality.HIGH]: 30,
        [Criticality.MEDIUM]: 90,
        [Criticality.LOW]: 180
    };

    // Calculate SLA Due Date if not set
    useEffect(() => {
        if (!treatment.dueDate && risk.createdAt) {
            const days = SLA_DAYS[risk.score >= 15 ? Criticality.CRITICAL :
                risk.score >= 10 ? Criticality.HIGH :
                    risk.score >= 5 ? Criticality.MEDIUM : Criticality.LOW];

            const suggestedDate = addDays(parseISO(risk.createdAt), days);
            setTreatment(prev => ({ ...prev, dueDate: format(suggestedDate, 'yyyy-MM-dd') }));
        }
    }, [risk.score, risk.createdAt]);

    // Check SLA Status
    useEffect(() => {
        if (treatment.dueDate) {
            const today = new Date();
            const due = parseISO(treatment.dueDate);
            let status: 'On Track' | 'At Risk' | 'Breached' = 'On Track';

            if (isAfter(today, due) && treatment.status !== 'Terminé') {
                status = 'Breached';
            } else if (treatment.status !== 'Terminé') {
                // Warning if within 3 days
                const warningDate = addDays(today, 3);
                if (isAfter(warningDate, due)) {
                    status = 'At Risk';
                }
            }

            if (status !== treatment.slaStatus) {
                setTreatment(prev => ({ ...prev, slaStatus: status }));
            }
        }
    }, [treatment.dueDate, treatment.status]);

    const handleChange = (field: keyof RiskTreatment, value: any) => {
        const updated = { ...treatment, [field]: value };
        setTreatment(updated);
        onUpdate(updated);
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                    Plan de Traitement
                </h3>
                {treatment.slaStatus === 'Breached' && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> SLA Dépassé
                    </span>
                )}
                {treatment.slaStatus === 'At Risk' && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <Clock className="h-3 w-3" /> SLA À Risque
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strategy */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stratégie</label>
                    <select
                        value={treatment.strategy}
                        onChange={(e) => handleChange('strategy', e.target.value)}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    >
                        <option value="Atténuer">Atténuer (Réduire)</option>
                        <option value="Transférer">Transférer (Assurance/Sous-traitance)</option>
                        <option value="Éviter">Éviter (Supprimer l'activité)</option>
                        <option value="Accepter">Accepter (Risque résiduel)</option>
                    </select>
                </div>

                {/* Status */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
                    <select
                        value={treatment.status}
                        onChange={(e) => handleChange('status', e.target.value)}
                        className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    >
                        <option value="Planifié">Planifié</option>
                        <option value="En cours">En cours</option>
                        <option value="Terminé">Terminé</option>
                        <option value="Retard">En retard</option>
                    </select>
                </div>

                {/* Owner */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Responsable</label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={treatment.ownerId || ''}
                            onChange={(e) => handleChange('ownerId', e.target.value)}
                            className="w-full pl-9 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                        >
                            <option value="">Sélectionner un responsable</option>
                            {users.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Due Date */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Échéance (SLA)</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={treatment.dueDate || ''}
                            onChange={(e) => handleChange('dueDate', e.target.value)}
                            className={`w-full pl-9 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm ${treatment.slaStatus === 'Breached' ? 'border-red-500 text-red-600' : ''
                                }`}
                        />
                    </div>
                    {treatment.dueDate && (
                        <p className="text-xs text-slate-500 mt-1">
                            {format(parseISO(treatment.dueDate), 'dd MMMM yyyy', { locale: fr })}
                        </p>
                    )}
                </div>

                {/* Estimated Cost */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Coût Estimé (€)</label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="number"
                            value={treatment.estimatedCost || ''}
                            onChange={(e) => handleChange('estimatedCost', parseFloat(e.target.value))}
                            className="w-full pl-9 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description du plan</label>
                <textarea
                    value={treatment.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    placeholder="Détaillez les actions à entreprendre..."
                />
            </div>
        </div>
    );
};
