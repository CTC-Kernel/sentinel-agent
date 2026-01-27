import React, { useState } from 'react';
import { Supplier } from '../../../types';
import { SupplierFormData } from '../../../schemas/supplierSchema';
import { Check, ShieldCheck, AlertTriangle, FileText, Scale, Siren, LogOut, Globe } from '../../ui/Icons';
import { motion } from 'framer-motion';
import { ErrorLogger } from '../../../services/errorLogger';

interface Props {
    supplier: Supplier;
    canEdit: boolean;
    onUpdate: (data: SupplierFormData) => Promise<void>;
}

export const SupplierContractCompliance: React.FC<Props> = ({ supplier, canEdit, onUpdate }) => {
    const [clauses, setClauses] = useState(supplier.doraContractClauses || {
        auditRights: false,
        slaDefined: false,
        dataLocation: false,
        subcontractingConditions: false,
        incidentNotification: false,
        exitStrategy: false,
    });
    const [, setIsSaving] = useState(false);

    const handleToggle = async (key: keyof typeof clauses) => {
        if (!canEdit) return;

        const newClauses = { ...clauses, [key]: !clauses[key] };
        setClauses(newClauses);

        // Auto-save logic
        setIsSaving(true);
        try {
            await onUpdate({
                ...supplier,
                // Ensure enum fields match schema exactly
                category: supplier.category,
                criticality: supplier.criticality,
                status: supplier.status,
                doraContractClauses: newClauses
            } as unknown as SupplierFormData);
        } catch (error) {
            ErrorLogger.error(error, 'SupplierContractCompliance.handleClauseToggle');
            // Revert on error
            setClauses(clauses);
        } finally {
            setIsSaving(false);
        }
    };

    const requirements = [
        {
            key: 'auditRights',
            label: "Droit d'Audit et d'Inspection",
            description: "Le contrat doit garantir un accès complet aux données et systèmes pour audit (DORA Art. 30).",
            icon: Scale
        },
        {
            key: 'slaDefined',
            label: "Niveaux de Service (SLA)",
            description: "Définition précise des niveaux de service attendus et pénalités associées.",
            icon: FileText
        },
        {
            key: 'dataLocation',
            label: "Localisation des Données",
            description: "Clarté sur les régions de stockage et traitement (Souveraineté, RGPD).",
            icon: Globe
        },
        {
            key: 'subcontractingConditions',
            label: "Contrôle de la Sous-traitance",
            description: "Conditions strictes pour le recours à des sous-traitants (Chaîne de responsabilité).",
            icon: ShieldCheck
        },
        {
            key: 'incidentNotification',
            label: "Notification d'Incidents",
            description: "Obligation de signaler les incidents majeurs dans des délais définis.",
            icon: Siren
        },
        {
            key: 'exitStrategy',
            label: "Stratégie de Sortie (Réversibilité)",
            description: "Clauses garantissant la récupération des données et la transition vers un autre tiers.",
            icon: LogOut
        }
    ] as const;

    const completedCount = Object.values(clauses).filter(Boolean).length;
    const totalCount = requirements.length;
    const progress = Math.round((completedCount / totalCount) * 100);

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                            Conformité Contractuelle DORA
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Vérifiez la présence des clauses obligatoires pour les prestataires TIC critiques.
                        </p>
                    </div>
                    <div className="text-right">
                        <span className={`text-2xl font-black ${progress === 100 ? 'text-emerald-500' : 'text-indigo-600'}`}>
                            {progress}%
                        </span>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conformité</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    />
                </div>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 gap-4">
                {requirements.map((req) => {
                    const isChecked = clauses[req.key as keyof typeof clauses];
                    const Icon = req.icon;

                    return (
                        <div
                            key={req.key}
                            onClick={() => handleToggle(req.key as keyof typeof clauses)}
                            className={`
                                group relative p-4 rounded-xl border transition-all cursor-pointer select-none
                                ${isChecked
                                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                }
                            `}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`
                                    flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                    ${isChecked
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                                    }
                                `}>
                                    {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                </div>

                                <div className="flex-1">
                                    <h4 className={`font-bold text-sm mb-1 ${isChecked ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                        {req.label}
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed">
                                        {req.description}
                                    </p>
                                </div>

                                <Icon className={`w-5 h-5 opacity-20 group-hover:opacity-40 transition-opacity ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Info */}
            {!canEdit && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-500">
                    <AlertTriangle className="w-4 h-4" />
                    Lecture seule : Vous n'avez pas les droits pour modifier la conformité contractuelle.
                </div>
            )}
        </div>
    );
};
