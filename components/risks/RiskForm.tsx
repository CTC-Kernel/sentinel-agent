import React, { useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality } from '../../types';
import { CheckCircle2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { RiskMatrixSelector } from './RiskMatrixSelector';
import { AIAssistButton } from '../ai/AIAssistButton';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { Button } from '../ui/button';
import { RichTextEditor } from '../ui/RichTextEditor';

import { STANDARD_THREATS, RISK_STRATEGIES, RISK_STATUSES } from '../../data/riskConstants';
import { AIAssistantHeader, Template } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';

const RISK_TEMPLATES: Template[] = [
    { name: 'Phishing Ciblé', description: 'Attaque par email visant à voler des identifiants.', field: 'Ingénierie Sociale', scenario: 'Un employé clique sur un lien malveillant dans un email de phishing.', probability: 'Probable', impact: 'Majeur' },
    { name: 'Panne Serveur', description: 'Indisponibilité critique d\'un serveur de production.', field: 'Technique', scenario: 'Panne matérielle du disque dur principal entraînant un arrêt de service.', probability: 'Possible', impact: 'Critique' },
    { name: 'Vol de Données', description: 'Exfiltration de données sensibles par un tiers.', field: 'Sécurité de l\'information', scenario: 'Un attaquant exploite une vulnérabilité non patchée pour extraire la base client.', probability: 'Peu Probable', impact: 'Critique' },
];

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
    isLoading?: boolean;
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
    isEditing = false,
    isLoading = false
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

    // const residualScore =
    //     (residualProbability || probability) && (residualImpact || impact)
    //         ? (residualProbability || probability) * (residualImpact || impact)
    //         : 0;

    const mapCriticalityToImpact = (crit: Criticality): number => {
        switch (crit) {
            case Criticality.CRITICAL: return 5;
            case Criticality.HIGH: return 4;
            case Criticality.MEDIUM: return 3;
            case Criticality.LOW:
            default: return 2;
        }
    };

    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleSelectTemplate = (templateName: string) => {
        const t = RISK_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('threat', t.name);
            // Assuming 'description' is a field in RiskFormData, if not, this line might cause an error or be ignored.
            // For now, I'll assume it's a valid field based on the instruction's context.
            // If 'description' is not a direct field, it might need to be mapped to 'vulnerability' or another field.
            // The instruction implies 'description' is a field to be set.
            // If RiskFormData does not have 'description', this line should be adjusted.
            // For now, I'll add it as per instruction.
            // setValue('description', t.description); // This line is commented out as 'description' is not in RiskFormData based on schema.
            // The instruction implies setting 'description' but it's not in RiskFormData.
            // I will interpret 'description' from the template as potentially mapping to 'vulnerability' or a new field if added.
            // For now, I'll only set 'threat' as it's explicitly in RiskFormData.
            // If the user intended to add a 'description' field to RiskFormData, that would be a prerequisite.
            // Given the prompt for `handleAutoGenerate` also mentions `description`, I will assume it's meant to be set,
            // but since it's not in the schema, I'll keep it as a placeholder or map it if a suitable field exists.
            // For now, I'll map it to vulnerability if it makes sense, or just ignore if no direct mapping.
            // The instruction specifically says `setValue('description', t.description);`
            // I will add it, but it might not have an effect if 'description' is not a field in RiskFormData.
            // Let's check the schema: riskSchema has threat, vulnerability, treatment. No 'description'.
            // I will add it as per instruction, but it will likely be a no-op or cause a type error if not handled by useForm.
            // For the purpose of faithfully following the instruction, I will include it.
            // However, the `handleAutoGenerate` part of the instruction also implies setting `description`.
            // I will assume `description` is intended to be a field in the form, even if not explicitly in the provided schema snippet.
            // To make it syntactically correct and functional, I will map `t.description` to `vulnerability` as it's the closest available field for descriptive text.
            setValue('vulnerability', t.description, { shouldDirty: true });
            // Some fields might need casting or specialized handling if RiskFormData structure differs slightly
            // We assume standard string fields for text inputs
        }
    };

    const handleAutoGenerate = async () => {
        const currentThreat = getValues('threat');
        if (!currentThreat) return;

        setIsGenerating(true);
        try {
            const prompt = `Analayse le risque de menace "${currentThreat}".
            Format JSON attendu avec des suggestions courtes:
            {
                "description": "Description succincte du risque",
                "vulnerability": "Vulnérabilité exploitée potentielle",
                "consequences": "Impact principal"
            }`;

            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                // Assuming 'description' from AI output maps to 'vulnerability' in the form
                if (data.description) setValue('vulnerability', data.description, { shouldDirty: true });
                if (data.vulnerability) setValue('vulnerability', data.vulnerability, { shouldDirty: true }); // Assuming field exists
                // Add more fields if available in RiskFormData
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-4 sm:p-6">
            {!isEditing && (
                <AIAssistantHeader
                    templates={RISK_TEMPLATES}
                    onSelectTemplate={handleSelectTemplate}
                    onAutoGenerate={handleAutoGenerate}
                    isGenerating={isGenerating}
                    title="Assistant Risques & Menaces"
                    description="Sélectionnez un scénario de risque type ou laissez l'IA analyser votre menace."
                />
            )}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
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
                            <Controller
                                control={control}
                                name="vulnerability"
                                render={({ field }) => (
                                    <RichTextEditor
                                        label="Vulnérabilité"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.vulnerability?.message}
                                    />
                                )}
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
                                    {RISK_STRATEGIES.map(s => (
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
                                    {RISK_STATUSES.map(s => (
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

                <div className="mt-8 bg-slate-50/80 dark:bg-slate-900/30 rounded-3xl p-6 border border-gray-100 dark:border-white/5 flex flex-col space-y-6">
                    <RiskTreatmentPlan
                        risk={{ ...existingRisk, ...getValues() } as Risk}
                        users={usersList}
                        onUpdate={(treatment) => {
                            setValue('strategy', treatment.strategy || 'Atténuer', { shouldDirty: true });
                            setValue('status', treatment.status === 'Terminé' ? 'Fermé' : treatment.status === 'En cours' ? 'En cours' : 'Ouvert', { shouldDirty: true });
                            setValue('treatment', treatment, { shouldDirty: true });
                        }}
                    />
                </div>
            </div>
            <div className="flex justify-end space-x-4 pt-8 mt-4 border-t border-gray-100 dark:border-white/5">
                <Button type="button" onClick={onCancel} variant="ghost" disabled={isLoading} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</Button>
                <Button type="submit" isLoading={isLoading} className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">{isEditing ? 'Enregistrer les modifications' : 'Créer le Risque'}</Button>
            </div>
        </form >
    );
};
