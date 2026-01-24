/**
 * RiskFormTreatmentTab - Treatment & controls tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React, { useCallback, useState } from 'react';
import { Layers, AlertTriangle, Shield, Sparkles, Search } from '../../ui/Icons';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { RiskTreatmentPlan } from '../RiskTreatmentPlan';
import { Risk } from '../../../types';
import { RiskFormTreatmentTabProps } from './riskFormTypes';

export const RiskFormTreatmentTab: React.FC<RiskFormTreatmentTabProps> = React.memo(({
    control,
    errors,
    existingRisk,
    controls,
    usersList,
    getValues,
    setValue,
    strategy,
    probability,
    impact,
    mitigationControlIds,
    suggestedControlIds,
}) => {
    const toggleControlSelection = useCallback((controlId: string) => {
        const currentIds = getValues('mitigationControlIds') || [];
        if (currentIds.includes(controlId)) {
            setValue('mitigationControlIds', currentIds.filter(id => id !== controlId), { shouldDirty: true });
        } else {
            setValue('mitigationControlIds', [...currentIds, controlId], { shouldDirty: true });
        }
    }, [getValues, setValue]);

    const [searchTerm, setSearchTerm] = useState('');

    const showJustification = strategy === 'Accepter' && (probability * impact) >= 12;

    return (
        <div className="space-y-8 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-brand-500" /> Décision & Plan de Traitement
            </h3>

            {/* 1. Main Treatment Plan (Source of Truth) */}
            <RiskTreatmentPlan
                risk={{ ...existingRisk, ...getValues() } as Risk}
                users={usersList}
                onUpdate={(treatment) => {
                    // Sync Form State
                    setValue('treatment', treatment, { shouldDirty: true });
                    if (treatment.strategy) setValue('strategy', treatment.strategy, { shouldDirty: true });
                    if (treatment.status) {
                        const statusMap: Record<string, string> = {
                            'Terminé': 'Fermé',
                            'En cours': 'En cours',
                            'Planifié': 'Ouvert',
                            'Retard': 'En cours'
                        };
                        const mappedStatus = statusMap[treatment.status] || 'Ouvert';
                        setValue('status', mappedStatus as Risk['status'], { shouldDirty: true });
                    }
                }}
            />

            {/* 2. Justification (Conditional) */}
            {showJustification && (
                <div className="space-y-2 animate-fade-in p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
                    <label className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-200">
                        <AlertTriangle className="h-4 w-4" />
                        Justification d'Acceptation du Risque (Obligatoire)
                    </label>
                    <p className="text-xs text-orange-700 dark:text-orange-300">
                        Vous vous apprêtez à accepter un risque critique (Score: {probability * impact}). Veuillez justifier cette décision pour le registre.
                    </p>
                    <FloatingLabelInput
                        label="Justification d'Acceptation"
                        {...control.register('justification')}
                        textarea
                        rows={3}
                        placeholder="Expliquez pourquoi ce risque est accepté (ex: coût de traitement disproportionné, risque transitoire...)"
                        error={errors.justification?.message}
                    />
                    {errors.justification && (
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
                            {errors.justification.message}
                        </p>
                    )}
                </div>
            )}

            <div className="border-t border-slate-200 dark:border-white/10 pt-6"></div>

            {/* 3. Existing Controls Link */}
            <div className="space-y-3">
                <label className="flex items-center text-sm font-bold text-slate-900 dark:text-white">
                    <Shield className="h-4 w-4 mr-2 text-brand-500" />
                    Mesures de Sécurité Existantes (Contrôles)
                </label>

                {/* Search Bar */}
                <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un contrôle..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none transition-all"
                    />
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-[250px] overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50">
                    {controls.length > 0 ? (
                        controls
                            .filter(c =>
                                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                c.code.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .sort((a, b) => {
                                const aLinked = mitigationControlIds?.includes(a.id) ? 1 : 0;
                                const bLinked = mitigationControlIds?.includes(b.id) ? 1 : 0;
                                if (aLinked !== bLinked) return bLinked - aLinked;

                                const aSugg = suggestedControlIds.includes(a.id) ? 1 : 0;
                                const bSugg = suggestedControlIds.includes(b.id) ? 1 : 0;
                                return bSugg - aSugg;
                            })
                            .map(ctrl => {
                                const isSuggested = suggestedControlIds.includes(ctrl.id);
                                return (
                                    <label key={ctrl.id} className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors ${mitigationControlIds?.includes(ctrl.id) ? 'bg-white dark:bg-slate-800 shadow-sm' : ''} ${isSuggested ? 'bg-purple-50/50 dark:bg-purple-900/10' : ' '}`}>
                                        <input checked={mitigationControlIds?.includes(ctrl.id) || false} onChange={() => toggleControlSelection(ctrl.id)}
                                            type="checkbox"
                                            className="mt-1 rounded border-slate-300 text-brand-600 focus-visible:ring-brand-500"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                    {ctrl.code}
                                                    {isSuggested && <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 rounded-full flex items-center"><Sparkles className="w-3 h-3 mr-1" /> IA</span>}
                                                </span>
                                                {ctrl.status === 'Implémenté' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">Implémenté</span>}
                                            </div>
                                            <span className="text-xs text-slate-600 dark:text-slate-400">{ctrl.name}</span>
                                        </div>
                                    </label>
                                )
                            })
                    ) : (
                        <div className="p-4 text-center text-xs text-slate-500">Aucun contrôle disponible.</div>
                    )}
                </div>
                <p className="text-[10px] text-slate-500">Sélectionnez les contrôles déjà en place réduisant le risque.</p>
            </div>
        </div>
    );
});

RiskFormTreatmentTab.displayName = 'RiskFormTreatmentTab';
