import React, { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality } from '../../types';
import { CheckCircle2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { RiskMatrixSelector } from './RiskMatrixSelector';
import { AIAssistButton } from '../ai/AIAssistButton';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';

const STANDARD_THREATS = ["Panne matérielle serveur", "Incendie", "Inondation", "Vol d'équipement", "Attaque par Ransomware", "Phishing / Ingénierie Sociale", "Erreur humaine / Configuration", "Divulgation non autorisée", "Interruption de service FAI", "Sabotage interne", "Obsolescence technologique", "Perte de personnel clé"];

interface RiskFormProps {
    onSubmit: (data: RiskFormData) => Promise<void>;
    onCancel: () => void;
    existingRisk?: Risk | null;
    assets: Asset[];
    usersList: UserProfile[];
    processes: BusinessProcess[];
    suppliers: Supplier[];
    controls: Control[];
    initialData?: Partial<RiskFormData>;
    isEditing?: boolean;
}

export const RiskForm: React.FC<RiskFormProps> = ({
    onSubmit,
    onCancel,
    existingRisk,
    assets,
    usersList,
    processes,
    suppliers,
    controls,
    initialData,
    isEditing = false
}) => {
    const { control, handleSubmit, reset, formState: { errors }, setValue, getValues } = useForm<RiskFormData>({
        resolver: zodResolver(riskSchema),
        defaultValues: {
            assetId: '',
            threat: '',
            vulnerability: '',
            probability: 3,
            impact: 3,
            residualProbability: 3,
            residualImpact: 3,
            strategy: 'Atténuer',
            status: 'Ouvert',
            ownerId: '',
            mitigationControlIds: [],
            affectedProcessIds: [],
            relatedSupplierIds: []
        }
    });

    // Watch values for score calculation
    const probability = useWatch({ control, name: 'probability' });
    const impact = useWatch({ control, name: 'impact' });
    const residualProbability = useWatch({ control, name: 'residualProbability' });
    const residualImpact = useWatch({ control, name: 'residualImpact' });
    const mitigationControlIds = useWatch({ control, name: 'mitigationControlIds' });
    const strategy = useWatch({ control, name: 'strategy' });
    const status = useWatch({ control, name: 'status' });
    const assetId = useWatch({ control, name: 'assetId' });

    const residualScore =
        (residualProbability || probability) && (residualImpact || impact)
            ? (residualProbability || probability) * (residualImpact || impact)
            : 0;

    const mapCriticalityToImpact = (crit: Criticality): number => {
        switch (crit) {
            case Criticality.CRITICAL: return 5;
            case Criticality.HIGH: return 4;
            case Criticality.MEDIUM: return 3;
            case Criticality.LOW:
            default: return 2;
        }
    };

    useEffect(() => {
        if (existingRisk) {
            // Resolve ownerId if missing (backward compatibility)
            let resolvedOwnerId = existingRisk.ownerId || '';
            if (!resolvedOwnerId && existingRisk.owner) {
                const foundUser = usersList.find(u => u.displayName === existingRisk.owner);
                if (foundUser) resolvedOwnerId = foundUser.uid;
            }

            reset({
                assetId: existingRisk.assetId,
                threat: existingRisk.threat,
                vulnerability: existingRisk.vulnerability,
                probability: existingRisk.probability,
                impact: existingRisk.impact,
                residualProbability: existingRisk.residualProbability || existingRisk.probability,
                residualImpact: existingRisk.residualImpact || existingRisk.impact,
                strategy: existingRisk.strategy,
                status: existingRisk.status,
                ownerId: resolvedOwnerId,
                mitigationControlIds: existingRisk.mitigationControlIds || [],
                affectedProcessIds: existingRisk.affectedProcessIds || [],
                relatedSupplierIds: existingRisk.relatedSupplierIds || [],
                treatment: existingRisk.treatment,
                isSecureStorage: existingRisk.isSecureStorage || false
            });
        } else {
            reset({
                assetId: initialData?.assetId || '',
                threat: initialData?.threat || '',
                vulnerability: initialData?.vulnerability || '',
                probability: initialData?.probability || 3,
                impact: initialData?.impact || 3,
                residualProbability: initialData?.residualProbability || 3,
                residualImpact: initialData?.residualImpact || 3,
                strategy: initialData?.strategy || 'Atténuer',
                status: initialData?.status || 'Ouvert',
                ownerId: initialData?.ownerId || '',
                mitigationControlIds: initialData?.mitigationControlIds || [],
                affectedProcessIds: initialData?.affectedProcessIds || [],
                relatedSupplierIds: initialData?.relatedSupplierIds || [],
                treatment: initialData?.treatment,
                isSecureStorage: initialData?.isSecureStorage || false
            });
        }
    }, [existingRisk, initialData, reset, usersList]);

    useEffect(() => {
        if (!assetId) return;
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        const cia = [asset.confidentiality, asset.integrity, asset.availability];
        const recommendedImpact = Math.max(...cia.map(mapCriticalityToImpact));

        if (!isEditing) {
            const currentImpact = getValues('impact');
            const currentResidualImpact = getValues('residualImpact');
            if (currentImpact === 3 && currentResidualImpact === 3) {
                setValue('impact', recommendedImpact as Risk['impact'], { shouldDirty: true });
                setValue('residualImpact', recommendedImpact as Risk['impact'], { shouldDirty: true });
            }
        }
    }, [assetId, assets, getValues, isEditing, setValue]);

    const toggleControlSelection = (controlId: string) => {
        const currentIds = getValues('mitigationControlIds') || [];
        if (currentIds.includes(controlId)) {
            setValue('mitigationControlIds', currentIds.filter(id => id !== controlId), { shouldDirty: true });
        } else {
            setValue('mitigationControlIds', [...currentIds, controlId], { shouldDirty: true });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit, (errors) => ErrorLogger.warn("RiskForm validation errors", 'RiskForm.onSubmit', { metadata: { errors } }))} className="p-8 overflow-y-auto custom-scrollbar h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <Controller
                        name="assetId"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Actif concerné"
                                value={field.value}
                                onChange={field.onChange}
                                options={assets.map(a => ({ value: a.id, label: a.name }))}
                                required
                                error={errors.assetId?.message}
                            />
                        )}
                    />
                    <div className="relative">
                        <FloatingLabelInput
                            label="Menace"
                            {...control.register('threat')}
                            list="threatsList"
                            required
                            error={errors.threat?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ asset: assets.find(a => a.id === getValues('assetId')), existingThreats: STANDARD_THREATS }}
                                fieldName="Menace"
                                prompt="Suggère une menace de sécurité pertinente pour cet actif (Asset). Réponds uniquement par le titre de la menace, court et précis."
                                onSuggest={(val: string) => setValue('threat', val, { shouldDirty: true })}
                            />
                        </div>
                        <datalist id="threatsList">
                            {STANDARD_THREATS.map((t, i) => <option key={i} value={t} />)}
                        </datalist>
                    </div>
                    <div className="relative">
                        <FloatingLabelTextarea
                            label="Vulnérabilité"
                            {...control.register('vulnerability')}
                            required
                            rows={3}
                            error={errors.vulnerability?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ asset: assets.find(a => a.id === getValues('assetId')), threat: getValues('threat') }}
                                fieldName="Vulnérabilité"
                                prompt="Décris une vulnérabilité technique ou organisationnelle qui pourrait permettre la réalisation de cette menace sur cet actif. Soyez concis."
                                onSuggest={(val: string) => setValue('vulnerability', val, { shouldDirty: true })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <Controller
                            name="ownerId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Propriétaire"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                />
                            )}
                        />


                        <Controller
                            name="affectedProcessIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Processus Impactés"
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                                    multiple
                                />
                            )}
                        />

                        <Controller
                            name="relatedSupplierIds"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Fournisseurs Concernés"
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                    multiple
                                />
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <RiskMatrixSelector
                                label="Évaluation du Risque Brut"
                                probability={probability}
                                impact={impact}
                                onChange={(p, i) => {
                                    setValue('probability', p, { shouldDirty: true });
                                    setValue('impact', i, { shouldDirty: true });
                                }}
                            />
                            <RiskMatrixSelector
                                label="Évaluation du Risque Résiduel"
                                probability={residualProbability || probability}
                                impact={residualImpact || impact}
                                onChange={(p, i) => {
                                    setValue('residualProbability', p, { shouldDirty: true });
                                    setValue('residualImpact', i, { shouldDirty: true });
                                }}
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stratégie de traitement</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Accepter', 'Atténuer', 'Transférer', 'Éviter'].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setValue('strategy', s as Risk['strategy'], { shouldDirty: true })}
                                        className={`
                                        px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200
                                        ${strategy === s
                                                ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-900/10'}
                                    `}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Statut</label>
                            <div className="flex gap-3">
                                {['Ouvert', 'En cours', 'Fermé'].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setValue('status', s as Risk['status'], { shouldDirty: true })}
                                        className={`
                                        flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200
                                        ${status === s
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg'
                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
                                    `}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <FloatingLabelTextarea
                                label="Justification (acceptation de risque, décisions)"
                                {...control.register('justification')}
                                rows={3}
                                error={errors.justification?.message}
                            />
                            {strategy === 'Accepter' && residualScore >= 15 && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    Pour accepter un risque critique (score résiduel &gt;= 15), une justification détaillée est requise selon ISO 27005.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center space-x-3 p-4 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <input
                                type="checkbox"
                                id="isSecureStorage"
                                {...control.register('isSecureStorage')}
                                className="h-5 w-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                            />
                            <label htmlFor="isSecureStorage" className="flex flex-col cursor-pointer">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">Stockage Sécurisé (SecNumCloud)</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Héberger ce risque critique sur le cloud souverain OVH</span>
                            </label>
                        </div>

                    </div>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-900/30 rounded-3xl p-6 border border-gray-100 dark:border-white/5 flex flex-col h-full space-y-6">
                    {/* Treatment Plan Section */}
                    <div className="flex-1">
                        <RiskTreatmentPlan
                            risk={{ ...existingRisk, ...getValues() } as Risk}
                            onUpdate={(treatment) => {
                                setValue('strategy', treatment.strategy || 'Atténuer', { shouldDirty: true });
                                setValue('status', treatment.status === 'Terminé' ? 'Fermé' : treatment.status === 'En cours' ? 'En cours' : 'Ouvert', { shouldDirty: true });
                                setValue('treatment', treatment, { shouldDirty: true });
                            }}
                            users={usersList}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar max-h-[300px]">
                        <label className="flex items-center text-xs font-bold uppercase tracking-widest text-brand-600 mb-4">
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Contrôles d'atténuation
                        </label>
                        {controls.map(ctrl => (
                            <label key={ctrl.id} className={`flex items-start space-x-3 p-3.5 rounded-xl cursor-pointer transition-all border ${mitigationControlIds?.includes(ctrl.id) ? 'bg-white dark:bg-slate-800 border-brand-200 dark:border-brand-800 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-slate-800'}`}>
                                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${mitigationControlIds?.includes(ctrl.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-300 bg-white dark:bg-black/20'}`}>
                                    {mitigationControlIds?.includes(ctrl.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={mitigationControlIds?.includes(ctrl.id) || false} onChange={() => toggleControlSelection(ctrl.id)} />
                                <div>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white block mb-0.5">{ctrl.code}</span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug block">{ctrl.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-4 pt-8 mt-4 border-t border-gray-100 dark:border-white/5">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">{isEditing ? 'Enregistrer les modifications' : 'Créer le Risque'}</button>
            </div>
        </form >
    );
};
